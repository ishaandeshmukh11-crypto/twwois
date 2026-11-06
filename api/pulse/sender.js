// Sends campaigns the safe way: canary wave first, then the rest inside the daily limit, watching quality all along.
import { col, id } from "./store.js";
import { blockReason, tierLimit, guard } from "./shield.js";
import * as wa from "./wa.js";
import { getAccount, refreshAccount, handleStatus, handleInbound } from "./events.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const busy = new Set();
const CANARY_WAIT = () => +(process.env.CANARY_WAIT_MS ?? 120000);
const RATE = () => +(process.env.PULSE_RATE ?? 20); // messages per second
const iso = () => new Date().toISOString();

export function startScheduler() { const t = setInterval(() => tick().catch((e) => console.error("[pulse] tick", e.message)), +(process.env.TICK_MS ?? 3000)); t.unref?.(); return t; }
export async function tick() {
  for (const c of await col("campaigns").find({ status: "running" }).toArray()) {
    if (busy.has(c._id)) continue; busy.add(c._id);
    run(c).catch((e) => console.error("[pulse] campaign", c._id, e.message)).finally(() => busy.delete(c._id));
  }
}
const setC = (c, s) => col("campaigns").updateOne({ _id: c._id }, { $set: s });

function simulate(orgId, wamid, phone) { // demo mode: pretend WhatsApp reports back
  const later = (ms, fn) => setTimeout(fn, ms * (process.env.DEMO_FAST ? 0.05 : 1)).unref?.();
  later(400 + Math.random() * 1000, () => handleStatus({ wamid, status: "delivered" }));
  if (Math.random() < 0.8) later(1500 + Math.random() * 2500, () => handleStatus({ wamid, status: "read" }));
  if (Math.random() < 0.25) later(3500 + Math.random() * 3000, () => handleInbound(orgId, { from: phone, text: ["YES", "PRICE", "STOP", "Thanks", "CALL"][Math.floor(Math.random() * 5)] }));
}

async function stats(c) {
  const ms = await col("messages").find({ campaignId: c._id }).toArray();
  const recent = Date.now() - 2 * 36e5;
  return { sent: ms.filter((m) => m.sentAt).length, failed: ms.filter((m) => m.status === "failed").length, spamErrors: ms.filter((m) => m.errorCode === 131048 && new Date(m.errorAt || 0).getTime() > recent).length, queued: ms.filter((m) => m.status === "queued").length };
}

async function sendOne(c, acc, m) {
  const contact = await col("contacts").findOne({ _id: m.contactId });
  const why = contact && blockReason({ ...contact, mkt: [] }, Date.now()); // re-check consent/opt-out at the last moment
  if (!contact || why) return col("messages").updateOne({ _id: m._id }, { $set: { status: "skipped", error: why || "contact removed" } });
  const vars = (c.varCols || []).map((k) => (k === "name" ? contact.name : contact.fields?.[k] ?? contact[k]) ?? "");
  if (vars.some((v) => String(v).trim() === "")) return col("messages").updateOne({ _id: m._id }, { $set: { status: "failed", error: "A template variable was empty for this contact", errorCode: "missing_var", errorAt: iso() } });
  let wamid;
  if (!acc) wamid = "demo." + id();
  else {
    for (let tryN = 0; ; tryN++) {
      try { wamid = (await wa.sendTemplate(acc, contact.phone, { name: c.templateName, lang: c.lang, vars })).messages?.[0]?.id; break; }
      catch (e) {
        if (e.code === 130429 && tryN < 2) { await sleep(+(process.env.BACKOFF_MS ?? 3000)); continue; }
        if (e.code === 130429) return "stop"; // still throttled: leave the rest queued for the next tick
        if (e.code === 190) { await setC(c, { status: "paused", pauseReason: "WhatsApp access token is invalid or expired. Reconnect WhatsApp." }); return "stop"; }
        await col("messages").updateOne({ _id: m._id }, { $set: { status: "failed", errorCode: e.code ?? "error", error: e.code === 131049 ? "WhatsApp held this message to protect the customer (marketing frequency limit)" : e.message, errorAt: iso() } });
        if (e.code === 131048) { await setC(c, { status: "paused", pauseReason: "WhatsApp reported a spam-rate limit. Paused to protect your number." }); return "stop"; }
        return;
      }
    }
  }
  const now = iso();
  await col("messages").updateOne({ _id: m._id }, { $set: { status: "sent", wamid, sentAt: now } });
  const week = (contact.mkt || []).filter((t) => Date.now() - new Date(t).getTime() < 7 * 864e5);
  await col("contacts").updateOne({ _id: contact._id }, { $set: { mkt: [...week, now] } });
  if (!acc) simulate(c.orgId, wamid, contact.phone);
}

async function run(c) {
  let acc = await getAccount(c.orgId);
  if (acc && Date.now() - new Date(acc.checkedAt || 0) > 5 * 60e3) acc = (await refreshAccount(c.orgId).catch(() => null)) || acc;
  const quality = acc ? acc.quality : "GREEN";
  const st = await stats(c);
  const g = guard({ ...st, quality });
  if (g.action === "pause") return setC(c, { status: "paused", pauseReason: g.why });
  if (!st.queued) { // finished: contacts who got it but never read it move toward "fatigued"
    const ms = await col("messages").find({ campaignId: c._id, status: "delivered" }).toArray();
    for (const m of ms) { const k = await col("contacts").findOne({ _id: m.contactId }); if (k) await col("contacts").updateOne({ _id: k._id }, { $set: { unreadStreak: (k.unreadStreak || 0) + 1 } }); }
    return setC(c, { status: "done", finishedAt: iso(), stage: "done" });
  }
  if (c.stage === "canary_wait") {
    if (Date.now() - new Date(c.canaryAt).getTime() < CANARY_WAIT()) return;
    await setC(c, { stage: "main", note: g.action === "slow" ? g.why : "" });
    c = { ...c, stage: "main" };
  }
  const pending = await col("messages").find({ campaignId: c._id, status: "queued" }).sort({ score: -1 }).toArray();
  let batch;
  if (c.stage === "canary") batch = pending.slice(0, c.canary);
  else {
    const recent = await col("messages").find({ orgId: c.orgId, sentAt: { $gte: new Date(Date.now() - 864e5).toISOString() } }).toArray();
    const capacity = (acc ? tierLimit(acc.tier) : 1000) - new Set(recent.map((m) => m.phone)).size;
    if (capacity <= 0) return setC(c, { note: "Waiting for WhatsApp's daily limit to reset. Remaining contacts go out automatically." });
    batch = pending.slice(0, capacity);
    await setC(c, { note: g.action === "slow" ? "Sending slowly: " + g.why : "" });
  }
  const gap = g.action === "slow" ? 1000 : 1000 / RATE();
  let n = 0;
  for (const m of batch) {
    if (n++ % 10 === 0) { const cur = await col("campaigns").findOne({ _id: c._id }); if (cur.status !== "running") return; }
    if ((await sendOne(c, acc, m)) === "stop") break;
    await sleep(gap);
  }
  if (c.stage === "canary") await setC(c, { stage: "canary_wait", canaryAt: iso() });
}
