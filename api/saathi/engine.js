import { col, id } from "../pulse/store.js";
import { hooks } from "../pulse/hooks.js";
import { sendMail } from "../pulse/mail.js";
import { isOptOut } from "../pulse/shield.js";
import { chunk, retrieve, ask } from "./ai.js";

const iso = () => new Date().toISOString();
const HOUR = 36e5;
export const PLANS = {
  none: { label: "Not subscribed", replies: 0, price: 0 }, // no free plan: setting up and test chat work, customer-facing replies need a subscription
  starter: { label: "Starter", replies: Number(process.env.SAATHI_STARTER_REPLIES || 2000), price: Number(process.env.PRICE_SAATHI_STARTER || 1499) },
  growth: { label: "Growth", replies: 8000, price: Number(process.env.PRICE_SAATHI_GROWTH || 3499) },
};
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/, EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
export const DEFAULTS = { enabled: true, tone: "friendly", bookingEnabled: true, greeting: "Hi! I'm the assistant here. Ask me anything about our services, prices or timings." };

export const settingsOf = async (orgId) => ({ ...DEFAULTS, ...((await col("saathi_settings").findOne({ orgId })) || {}) });

export async function access(orgId) {
  const o = await col("orgs").findOne({ _id: orgId }); if (!o) return { ok: false, plan: "none", cap: 0, used: 0 };
  const plan = PLANS[o.saathiPlan] && o.saathiPlan !== "none" ? o.saathiPlan : "none", cap = PLANS[plan].replies;
  const expired = plan !== "none" && !!o.saathiPaidUntil && new Date(o.saathiPaidUntil) < new Date();
  const used = await col("saathi_msgs").countDocuments({ orgId, dir: "out", ai: true, channel: { $ne: "test" }, ts: { $gte: monthStart() } });
  return { ok: plan !== "none" && !expired && used < cap, plan, cap, used, expired, paidUntil: o.saathiPaidUntil || null };
}

async function thread(orgId, channel, senderId, name) {
  let t = await col("saathi_threads").findOne({ orgId, channel, senderId });
  if (!t) { t = { _id: id(), orgId, channel, senderId, name: name || "", humanOnly: false, lead: {}, createdAt: iso() }; await col("saathi_threads").insertOne(t); }
  else if (name && !t.name) await col("saathi_threads").updateOne({ _id: t._id }, { $set: { name } });
  return t;
}
let SEQ = 0; // strict ordering even when two messages share a millisecond
const log = (orgId, t, dir, text, extra = {}) => col("saathi_msgs").insertOne({ _id: id(), orgId, threadId: t._id, channel: t.channel, dir, text, ts: iso(), seq: Date.now() * 1000 + (SEQ++ % 1000), ...extra });

async function alertOwner(orgId, s, subject, body) {
  const to = s.ownerEmail || (await col("users").findOne({ orgId }))?.email; if (!to) return;
  sendMail(to, subject, body + `\n\nOpen your Mira inbox to reply: ${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/solutions/saathi`);
}

// Core: one customer message in, one reply out. Channels (website, WhatsApp, Instagram, Facebook, test) call this and deliver the reply.
export async function handleMessage(orgId, { channel, senderId, name, text }) {
  const s = await settingsOf(orgId); text = String(text || "").slice(0, 1500);
  const t = await thread(orgId, channel, senderId, name);
  await col("saathi_threads").updateOne({ _id: t._id }, { $set: { lastAt: iso(), lastInboundAt: iso() } });
  await log(orgId, t, "in", text);
  const ph = text.match(PHONE), em = text.match(EMAIL);
  if (ph || em) await col("saathi_threads").updateOne({ _id: t._id }, { $set: { lead: { ...t.lead, ...(ph ? { phone: ph[0] } : {}), ...(em ? { email: em[0] } : {}) } } });
  if (!s.enabled && channel !== "test") return { silent: true, reason: "assistant_off" };
  if (t.humanOnly && channel !== "test") return { silent: true, reason: "human_has_chat" };
  if (isOptOut(text)) return { silent: true, reason: "opted_out" };
  const acc = channel === "test" ? { ok: true } : await access(orgId);
  if (!acc.ok) {
    if (acc.plan === "none") return { silent: true, reason: "no_plan" }; if (acc.used >= acc.cap || acc.expired) await alertOnce(orgId, s, acc); return { silent: true, reason: acc.expired ? "subscription_ended" : "plan_limit" }; }
  const recent = await col("saathi_msgs").countDocuments({ orgId, threadId: t._id, dir: "out", ai: true, ts: { $gte: new Date(Date.now() - HOUR).toISOString() } });
  if (recent >= 25) { await col("saathi_threads").updateOne({ _id: t._id }, { $set: { humanOnly: true, handoffAt: iso(), handoffWhy: "too many automated replies in an hour" } }); return { silent: true, reason: "loop_guard" }; }

  const docs = await col("saathi_chunks").find({ orgId }).toArray();
  const hits = retrieve(docs, text + " " + (t.lead?.need || ""), 5);
  const history = (await col("saathi_msgs").find({ orgId, threadId: t._id }).sort({ seq: -1 }).limit(9).toArray()).reverse().slice(0, -1);
  const r = await ask({ profile: s, hits, history, text });

  const lead = { ...t.lead, ...(ph ? { phone: ph[0] } : {}), ...(em ? { email: em[0] } : {}) };
  for (const k of ["name", "phone", "email", "need"]) if (r.lead?.[k]) lead[k] = String(r.lead[k]).slice(0, 200);
  const upd = { lead, lastAt: iso(), intent: r.intent || t.intent };
  let reply = String(r.reply || "").trim().slice(0, 1000);
  if (r.handoff) { upd.humanOnly = channel !== "test"; upd.handoffAt = iso(); upd.handoffWhy = r.answered === false ? "question not in your information" : "customer needs a person"; if (!reply) reply = "I'm connecting you with our team. They will reply soon."; }
  await col("saathi_threads").updateOne({ _id: t._id }, { $set: upd });

  if (r.answered === false && channel !== "test") {
    const g = await col("saathi_gaps").findOne({ orgId, status: "open", question: text.slice(0, 300) });
    if (g) await col("saathi_gaps").updateOne({ _id: g._id }, { $inc: { count: 1 } });
    else await col("saathi_gaps").insertOne({ _id: id(), orgId, question: text.slice(0, 300), threadId: t._id, channel, status: "open", count: 1, createdAt: iso() });
  }
  let booked = null;
  if (r.booking?.service && r.booking?.date && s.bookingEnabled !== false && channel !== "test") {
    const dup = await col("saathi_bookings").findOne({ orgId, threadId: t._id, service: r.booking.service, date: r.booking.date });
    if (!dup) { booked = { _id: id(), orgId, threadId: t._id, channel, name: lead.name || t.name || "", phone: lead.phone || "", service: String(r.booking.service).slice(0, 120), date: String(r.booking.date).slice(0, 40), time: String(r.booking.time || "").slice(0, 40), status: "new", createdAt: iso() }; await col("saathi_bookings").insertOne(booked); }
  }
  await log(orgId, t, "out", reply, { ai: true, engine: r.engine, answered: r.answered !== false });
  if (channel !== "test") {
    if (booked) alertOwner(orgId, s, `New booking: ${booked.service} on ${booked.date}`, `${booked.name || "A customer"} (${booked.phone || "no phone yet"}) booked ${booked.service} for ${booked.date} ${booked.time}.`);
    else if (r.handoff) alertOwner(orgId, s, "A customer needs you", `Customer on ${channel}: "${text.slice(0, 300)}"\nReason: ${upd.handoffWhy}. The assistant has stopped replying in this chat until you hand it back.`);
  }
  return { reply, handoff: !!r.handoff, answered: r.answered !== false, booked: !!booked, engine: r.engine };
}
async function alertOnce(orgId, s, acc) {
  const o = await col("orgs").findOne({ _id: orgId }), day = new Date().toISOString().slice(0, 10);
  if (o.saathiAlertDay === day) return; await col("orgs").updateOne({ _id: orgId }, { $set: { saathiAlertDay: day } });
  alertOwner(orgId, s, acc.expired ? "Your Mira subscription has ended" : "Your Mira reply limit is over", acc.expired ? "Your assistant has stopped replying. Renew your plan to switch it back on." : "Your assistant has stopped replying for this month. Upgrade your plan to continue.");
}

export async function indexDoc(orgId, docId, title, text) {
  await col("saathi_chunks").deleteMany({ orgId, docId });
  for (const c of chunk(text)) await col("saathi_chunks").insertOne({ _id: id(), orgId, docId, title, text: c });
}

// WhatsApp and Instagram/Facebook DMs that no Relay rule handled land here.
hooks.inbound = async ({ orgId, channel, senderId, name, text }) => {
  const s = await settingsOf(orgId); if (!s.enabled) return null;
  const has = await col("saathi_chunks").findOne({ orgId }); if (!has && !s.about) return null; // not set up: stay quiet
  const r = await handleMessage(orgId, { channel, senderId, name, text });
  return r.reply ? { reply: r.reply } : null;
};
