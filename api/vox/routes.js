// Vox: self-serve AI calling. Clients sign up (same account as Relay), upload a sheet, get a number, pay, and the agent calls.
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { col, id } from "../pulse/store.js";
import { requireAuth } from "../pulse/auth.js";
import { createSubscription, cancelSubscription, billingConfigured, PRICES } from "../pulse/billing.js";
import { placeCall, buyNumber, validSig, twilioConfigured } from "./twilio.js";
import { reply, summarize, opening, TYPES } from "./brain.js";

const r = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const iso = () => new Date().toISOString();
const month = () => new Date().toISOString().slice(0, 7);
const origin = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

export const PLANS = {
  trial: { label: "Trial", contacts: 100, minutes: 0, testCalls: 3 },
  starter: { label: "Starter", contacts: 2000, minutes: 1000, testCalls: 20 },
  growth: { label: "Growth", contacts: 20000, minutes: 10000, testCalls: 50 },
};
const planOf = (o) => { const p = o.voxPlan || "trial"; return p !== "trial" && o.voxPaidUntil && new Date(o.voxPaidUntil) > new Date() ? p : "trial"; };
const usedSeconds = async (orgId) => (await col("vox_usage").findOne({ orgId, month: month() }))?.seconds || 0;

// ---------- phone helpers ----------
export function normalizePhone(raw, cc = "91") {
  let d = String(raw || "").replace(/[^\d+]/g, ""); if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (d.length === 10) d = cc + d; else if (d.startsWith("0") && d.length === 11) d = cc + d.slice(1);
  return /^\d{9,15}$/.test(d) ? "+" + d : null;
}
// Is "now" inside the calling window in the org's timezone?
export function inWindow(win, tz = "Asia/Kolkata", now = new Date()) {
  const hh = +new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now) % 24;
  const [a, b] = [win?.from ?? 9, win?.to ?? 20]; return hh >= a && hh < b;
}

// ---------- Twilio webhooks (signature checked; no login) ----------
const hook = express.Router();
hook.use(express.urlencoded({ extended: false }));
const sigOk = (req) => process.env.VOX_SKIP_SIG === "1" || validSig(origin(req) + req.originalUrl, req.body, req.get("x-twilio-signature"));
const esc = (t) => String(t).replace(/[<>&"']/g, " ");
const LANG = (c) => esc(c.language || "en-US");
async function finalize(call, camp) {
  if (call.finalized) return; await col("vox_calls").updateOne({ _id: call._id }, { $set: { finalized: true } });
  const s = await summarize(camp, call.turns || []);
  await col("vox_calls").updateOne({ _id: call._id }, { $set: { result: s } });
}
hook.post("/twiml/:callId", wrap(async (req, res) => {
  if (!sigOk(req)) return res.status(403).send("Forbidden");
  const call = await col("vox_calls").findOne({ _id: req.params.callId }); if (!call) return res.status(404).send("Not found");
  const camp = await col("vox_campaigns").findOne({ _id: call.campaignId }), org = await col("orgs").findOne({ _id: call.orgId });
  const contact = { name: call.name, amount: call.amount, dueDate: call.dueDate, note: call.note }, biz = camp.business || org.name;
  const url = `${origin(req)}/api/vox/hook/twiml/${call._id}`, L = LANG(camp);
  const gather = (t) => `<Gather input="speech" language="${L}" speechTimeout="auto" timeout="6" action="${url}" method="POST"><Say language="${L}">${esc(t)}</Say></Gather>`;
  res.type("text/xml");
  const said = (req.body.SpeechResult || "").trim(), turns = call.turns || [];
  if (!turns.length) { const o = opening(camp, contact, biz); await col("vox_calls").updateOne({ _id: call._id }, { $set: { turns: [{ r: "a", t: o }], silent: 0, answeredAt: iso() } }); return res.send(`<Response>${gather(o)}<Say language="${L}">Sorry, I could not hear you. Goodbye.</Say><Hangup/></Response>`); }
  if (!said) { const silent = (call.silent || 0) + 1; await col("vox_calls").updateOne({ _id: call._id }, { $set: { silent } }); if (silent >= 2) { await finalize({ ...call }, camp); return res.send(`<Response><Say language="${L}">I could not hear you. We will try again later. Goodbye.</Say><Hangup/></Response>`); } return res.send(`<Response>${gather("Sorry, I did not catch that. Are you there?")}<Hangup/></Response>`); }
  const t2 = [...turns, { r: "c", t: said.slice(0, 500) }], out = await reply(camp, contact, biz, t2); t2.push({ r: "a", t: out.text });
  await col("vox_calls").updateOne({ _id: call._id }, { $set: { turns: t2, silent: 0 } });
  if (out.dnc) await col("vox_dnc").updateOne({ orgId: call.orgId, phone: call.phone }, { $set: { orgId: call.orgId, phone: call.phone, at: iso() } }, { upsert: true });
  if (out.end) { await finalize({ ...call, turns: t2 }, camp); return res.send(`<Response><Say language="${L}">${esc(out.text)}</Say><Hangup/></Response>`); }
  res.send(`<Response>${gather(out.text)}<Say language="${L}">Goodbye.</Say><Hangup/></Response>`);
}));
hook.post("/status/:callId", wrap(async (req, res) => {
  if (!sigOk(req)) return res.status(403).send("Forbidden");
  const call = await col("vox_calls").findOne({ _id: req.params.callId }); if (!call) return res.sendStatus(404);
  const st = req.body.CallStatus, secs = +req.body.CallDuration || 0;
  const map = { completed: call.turns?.some((x) => x.r === "c") ? "answered" : "no_answer", busy: "busy", "no-answer": "no_answer", failed: "failed", canceled: "failed" };
  await col("vox_calls").updateOne({ _id: call._id }, { $set: { status: map[st] || "failed", seconds: secs, endedAt: iso() } });
  if (secs) await col("vox_usage").updateOne({ orgId: call.orgId, month: month() }, { $inc: { seconds: secs }, $set: { orgId: call.orgId, month: month() } }, { upsert: true });
  const camp = await col("vox_campaigns").findOne({ _id: call.campaignId }); if (camp && !call.finalized && call.turns?.length) await finalize(call, camp);
  res.sendStatus(204);
}));
r.use("/hook", hook);

// ---------- authenticated API ----------
r.use(express.json({ limit: "6mb" }));
r.use(rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }));
r.post("/admin/plan", wrap(async (req, res) => {
  const k = process.env.PULSE_ADMIN_KEY; if (!k || req.headers["x-admin-key"] !== k) return res.status(401).json({ error: "Invalid admin key" });
  const b = z.object({ email: z.string().toLowerCase(), plan: z.enum(["trial", "starter", "growth"]), days: z.number().int().min(1).max(3660).default(30) }).parse(req.body);
  const u = await col("users").findOne({ email: b.email }); if (!u) return res.status(404).json({ error: "No user with this email" });
  const paidUntil = new Date(Date.now() + b.days * 864e5).toISOString(); await col("orgs").updateOne({ _id: u.orgId }, { $set: { voxPlan: b.plan, voxPaidUntil: paidUntil } }); res.json({ ok: true, plan: b.plan, paidUntil });
}));
r.use(requireAuth);
const org = (req) => col("orgs").findOne({ _id: req.user.orgId });

r.get("/me", wrap(async (req, res) => {
  const o = await org(req), plan = planOf(o), P = PLANS[plan];
  res.json({ email: req.user.email, company: o.name, plan, label: P.label, limits: P, paidUntil: o.voxPaidUntil || null, usedMinutes: Math.ceil((await usedSeconds(o._id)) / 60), number: o.voxNumber || null, testNumber: o.voxTestNumber || null, testCallsUsed: o.voxTestCalls || 0, tz: o.voxTz || "Asia/Kolkata", telephony: twilioConfigured(), billing: billingConfigured(), prices: PRICES, types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label])), cancelling: !!o.voxCancelling });
}));
r.put("/settings", wrap(async (req, res) => { const b = z.object({ tz: z.string().max(60) }).parse(req.body); try { new Intl.DateTimeFormat("en", { timeZone: b.tz }); } catch { return res.status(400).json({ error: "Unknown time zone." }); } await col("orgs").updateOne({ _id: req.user.orgId }, { $set: { voxTz: b.tz } }); res.json({ ok: true }); }));
r.post("/number/provision", wrap(async (req, res) => {
  const o = await org(req); if (planOf(o) === "trial") return res.status(402).json({ error: "Choose a plan to get your calling number." });
  if (o.voxNumber) return res.status(409).json({ error: "You already have a number." });
  if (!twilioConfigured()) return res.status(503).json({ error: "Calling is not switched on yet. TWWIOS will activate it." });
  const b = z.object({ country: z.string().length(2).default("US"), areaCode: z.string().max(6).optional() }).parse(req.body);
  const n = await buyNumber(b.country.toUpperCase(), b.areaCode); await col("orgs").updateOne({ _id: o._id }, { $set: { voxNumber: n.number, voxNumberSid: n.sid } }); res.json({ number: n.number });
}));

// contacts
r.post("/contacts/import", wrap(async (req, res) => {
  const o = await org(req), cap = PLANS[planOf(o)].contacts;
  const rows = z.array(z.object({ name: z.any().optional(), phone: z.any(), amount: z.any().optional(), dueDate: z.any().optional(), note: z.any().optional() })).max(5000).parse(req.body.rows);
  const cc = String(req.body.countryCode || "91").replace(/\D/g, "").slice(0, 3) || "91";
  let added = 0, updated = 0, invalid = 0, over = false; let have = await col("vox_contacts").countDocuments({ orgId: o._id });
  const dnc = new Set((await col("vox_dnc").find({ orgId: o._id }).toArray()).map((d) => d.phone)); let blocked = 0;
  for (const x of rows) {
    const phone = normalizePhone(x.phone, cc); if (!phone) { invalid++; continue; } if (dnc.has(phone)) { blocked++; continue; }
    const doc = { name: String(x.name ?? "").slice(0, 100), amount: String(x.amount ?? "").slice(0, 30), dueDate: String(x.dueDate ?? "").slice(0, 30), note: String(x.note ?? "").slice(0, 200) };
    const ex = await col("vox_contacts").findOne({ orgId: o._id, phone });
    if (ex) { await col("vox_contacts").updateOne({ _id: ex._id }, { $set: doc }); updated++; continue; }
    if (have >= cap) { over = true; continue; }
    await col("vox_contacts").insertOne({ _id: id(), orgId: o._id, phone, ...doc, createdAt: iso() }); added++; have++;
  }
  res.json({ added, updated, invalid, blockedDnc: blocked, overPlanLimit: over, planLimit: cap });
}));
r.get("/contacts", wrap(async (req, res) => res.json({ contacts: await col("vox_contacts").find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).limit(500).toArray(), total: await col("vox_contacts").countDocuments({ orgId: req.user.orgId }), dnc: await col("vox_dnc").countDocuments({ orgId: req.user.orgId }) })));
r.delete("/contacts/:id", wrap(async (req, res) => { await col("vox_contacts").deleteMany({ _id: req.params.id, orgId: req.user.orgId }); res.json({ ok: true }); }));
r.post("/contacts/:id/dnc", wrap(async (req, res) => { const c = await col("vox_contacts").findOne({ _id: req.params.id, orgId: req.user.orgId }); if (!c) return res.sendStatus(404); await col("vox_dnc").updateOne({ orgId: c.orgId, phone: c.phone }, { $set: { orgId: c.orgId, phone: c.phone, at: iso() } }, { upsert: true }); res.json({ ok: true }); }));

// campaigns
const campIn = z.object({ name: z.string().trim().min(2).max(80), type: z.enum(["emi", "insurance", "promo", "appointment", "lead", "custom"]), business: z.string().trim().max(80).optional(), prompt: z.string().trim().max(1500).optional(), language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default("en-US"), from: z.number().int().min(0).max(23).default(9), to: z.number().int().min(1).max(24).default(20) });
r.post("/campaigns", wrap(async (req, res) => {
  const b = campIn.parse(req.body); if (b.type === "custom" && !b.prompt) return res.status(400).json({ error: "Write your instructions for the custom script." });
  const c = { _id: id(), orgId: req.user.orgId, name: b.name, type: b.type, business: b.business, prompt: b.prompt, language: b.language, window: { from: b.from, to: b.to }, status: "draft", createdAt: iso() };
  await col("vox_campaigns").insertOne(c); res.status(201).json(c);
}));
const counts = async (c) => { const calls = await col("vox_calls").find({ campaignId: c._id }).toArray(); const n = (f) => calls.filter(f).length; return { ...c, total: calls.length, queued: n((x) => x.status === "queued"), calling: n((x) => x.status === "calling"), answered: n((x) => x.status === "answered"), noAnswer: n((x) => ["no_answer", "busy", "failed"].includes(x.status)), promises: n((x) => ["promise_to_pay", "will_renew", "interested", "confirmed", "qualified", "rescheduled"].includes(x.result?.outcome)), needsHuman: n((x) => x.result?.needs_human) }; };
r.get("/campaigns", wrap(async (req, res) => res.json({ campaigns: await Promise.all((await col("vox_campaigns").find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).limit(50).toArray()).map(counts)) })));
r.post("/campaigns/:id/start", wrap(async (req, res) => {
  const o = await org(req), plan = planOf(o), c = await col("vox_campaigns").findOne({ _id: req.params.id, orgId: o._id }); if (!c) return res.sendStatus(404);
  if (plan === "trial") return res.status(402).json({ error: "Choose a plan to start a calling campaign. You can try one call to your own phone for free." });
  if (!o.voxNumber) return res.status(409).json({ error: "Get your calling number first (Setup tab)." });
  if (c.status === "running") return res.json({ ok: true });
  const dnc = new Set((await col("vox_dnc").find({ orgId: o._id }).toArray()).map((d) => d.phone));
  const have = await col("vox_calls").countDocuments({ campaignId: c._id });
  if (!have) { const ct = (await col("vox_contacts").find({ orgId: o._id }).toArray()).filter((x) => !dnc.has(x.phone)); if (!ct.length) return res.status(400).json({ error: "Upload contacts first." }); for (const x of ct) await col("vox_calls").insertOne({ _id: id(), orgId: o._id, campaignId: c._id, contactId: x._id, phone: x.phone, name: x.name, amount: x.amount, dueDate: x.dueDate, note: x.note, status: "queued", createdAt: iso() }); }
  await col("vox_campaigns").updateOne({ _id: c._id }, { $set: { status: "running", startedAt: iso() } }); res.json({ ok: true });
}));
r.post("/campaigns/:id/:act(pause|resume)", wrap(async (req, res) => { await col("vox_campaigns").updateOne({ _id: req.params.id, orgId: req.user.orgId }, { $set: { status: req.params.act === "pause" ? "paused" : "running" } }); res.json({ ok: true }); }));
r.get("/campaigns/:id/calls", wrap(async (req, res) => { const c = await col("vox_campaigns").findOne({ _id: req.params.id, orgId: req.user.orgId }); if (!c) return res.sendStatus(404); res.json({ campaign: await counts(c), calls: await col("vox_calls").find({ campaignId: c._id }).sort({ createdAt: -1 }).limit(500).toArray() }); }));

// one test call to your own phone (free to try)
r.post("/test-call", wrap(async (req, res) => {
  const o = await org(req), P = PLANS[planOf(o)];
  if (!twilioConfigured()) return res.status(503).json({ error: "Phone calling is not switched on yet. Use the browser demo for now." });
  const b = z.object({ to: z.string(), type: z.enum(["emi", "insurance", "promo", "appointment", "lead"]).default("emi"), name: z.string().max(60).default(""), business: z.string().max(80).optional(), detail: z.string().max(200).optional() }).parse(req.body);
  const to = normalizePhone(b.to, req.body.countryCode || "91"); if (!to) return res.status(400).json({ error: "Enter a valid phone number with country code." });
  if (o.voxTestNumber && o.voxTestNumber !== to) return res.status(403).json({ error: "Test calls can only go to the first number you used. Choose a plan to call others." });
  if ((o.voxTestCalls || 0) >= P.testCalls) return res.status(429).json({ error: "You have used all your test calls." });
  const from = o.voxNumber || process.env.TWILIO_TEST_FROM; if (!from) return res.status(503).json({ error: "No calling number is set up yet." });
  const camp = { _id: id(), orgId: o._id, name: "Test call", type: b.type, business: b.business, prompt: b.detail, language: "en-US", window: { from: 0, to: 24 }, status: "test", createdAt: iso() }; await col("vox_campaigns").insertOne(camp);
  const call = { _id: id(), orgId: o._id, campaignId: camp._id, phone: to, name: b.name, amount: "", dueDate: "", note: b.detail || "", status: "calling", createdAt: iso(), test: true }; await col("vox_calls").insertOne(call);
  try { await placeCall({ to, from, url: `${origin(req)}/api/vox/hook/twiml/${call._id}`, statusUrl: `${origin(req)}/api/vox/hook/status/${call._id}` }); }
  catch (e) { await col("vox_calls").updateOne({ _id: call._id }, { $set: { status: "failed", error: e.message } }); return res.status(502).json({ error: e.message }); }
  await col("orgs").updateOne({ _id: o._id }, { $set: { voxTestNumber: to }, $inc: { voxTestCalls: 1 } }); res.json({ callId: call._id });
}));
r.get("/calls/:id", wrap(async (req, res) => { const c = await col("vox_calls").findOne({ _id: req.params.id, orgId: req.user.orgId }); c ? res.json(c) : res.sendStatus(404); }));

// billing
r.post("/billing/checkout", wrap(async (req, res) => {
  const b = z.object({ plan: z.enum(["starter", "growth"]) }).parse(req.body); const o = await org(req);
  if (!o.billing?.legalName) return res.status(400).json({ error: "Please save your billing details (company name, address, GSTIN) in Relay > Billing first." });
  const out = await createSubscription(o, b.plan, req.user.email, "vox"); if (!out.configured) return res.status(503).json({ error: "Online payment is not switched on yet. Contact TWWIOS to activate your plan." }); res.json(out);
}));
r.post("/billing/cancel", wrap(async (req, res) => res.json({ ok: await cancelSubscription(await org(req), "vox") })));

// ---------- dialer worker ----------
const busy = new Set();
export async function tick() {
  if (!twilioConfigured()) return;
  for (const c of await col("vox_campaigns").find({ status: "running" }).toArray()) {
    if (busy.has(c._id)) continue; busy.add(c._id);
    (async () => {
      const o = await col("orgs").findOne({ _id: c.orgId }); if (!o?.voxNumber || planOf(o) === "trial") return;
      if (!inWindow(c.window, o.voxTz || "Asia/Kolkata")) return;
      const P = PLANS[planOf(o)]; if ((await usedSeconds(o._id)) / 60 >= P.minutes) { await col("vox_campaigns").updateOne({ _id: c._id }, { $set: { status: "paused", note: "Monthly minutes used up" } }); return; }
      const active = await col("vox_calls").countDocuments({ campaignId: c._id, status: "calling" }); const slots = Math.max(0, +(process.env.VOX_CONCURRENCY || 3) - active);
      const next = (await col("vox_calls").find({ campaignId: c._id, status: "queued" }).limit(slots).toArray());
      const dnc = new Set((await col("vox_dnc").find({ orgId: o._id }).toArray()).map((d) => d.phone));
      for (const call of next) {
        if (dnc.has(call.phone)) { await col("vox_calls").updateOne({ _id: call._id }, { $set: { status: "skipped_dnc" } }); continue; }
        await col("vox_calls").updateOne({ _id: call._id }, { $set: { status: "calling", startedAt: iso() } });
        try { const base = (process.env.PUBLIC_URL || "").replace(/\/$/, ""); await placeCall({ to: call.phone, from: o.voxNumber, url: `${base}/api/vox/hook/twiml/${call._id}`, statusUrl: `${base}/api/vox/hook/status/${call._id}` }); }
        catch (e) { await col("vox_calls").updateOne({ _id: call._id }, { $set: { status: "failed", error: e.message } }); }
      }
      if (!(await col("vox_calls").countDocuments({ campaignId: c._id, status: { $in: ["queued", "calling"] } }))) await col("vox_campaigns").updateOne({ _id: c._id }, { $set: { status: "done", finishedAt: iso() } });
    })().catch((e) => console.error("[vox] campaign", c._id, e.message)).finally(() => busy.delete(c._id));
  }
}
export function startVox() { setInterval(() => tick().catch((e) => console.error("[vox] tick", e.message)), +(process.env.VOX_TICK_MS ?? 5000)); }
export default r;
