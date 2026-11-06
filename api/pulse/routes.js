import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { col, id, usingMongo } from "./store.js";
import { hashPw, checkPw, sign, requireAuth, enc } from "./auth.js";
import { PLANS, tierLimit, normalizePhone, planCampaign, lintTemplate, score, blockReason, companyKey } from "./shield.js";
import * as wa from "./wa.js";
import { getAccount, refreshAccount, handleStatus, handleInbound } from "./events.js";
import { tick } from "./sender.js";
import { sendMail, publicUrl } from "./mail.js";
import { socialPublic, social } from "./social.js";
import { createSubscription, cancelSubscription, verifyWebhook, applyWebhook, billingConfigured, PRICES } from "./billing.js";

const r = express.Router();
r.use(express.json({ limit: "6mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
r.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const iso = () => new Date().toISOString();
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
const DEMO_TEMPLATES = [
  { name: "payment_reminder", status: "APPROVED", category: "UTILITY", language: "en", body: "Hi {{1}}, a reminder from {{2}}: your invoice of Rs {{3}} is due. Reply YES if already paid." },
  { name: "festive_offer", status: "APPROVED", category: "MARKETING", language: "en", body: "Namaste {{1}}! This week only, {{2}} has 10% off for you. Reply PRICE for the catalogue. Reply STOP to unsubscribe." },
];

// ---------- auth ----------
r.post("/auth/signup", wrap(async (req, res) => {
  const b = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(100), company: z.string().trim().min(2).max(120) }).parse(req.body);
  if (await col("users").findOne({ email: b.email })) return res.status(409).json({ error: "This email already has an account. Sign in instead." });
  const orgId = id(), userId = id();
  await col("orgs").insertOne({ _id: orgId, name: b.company, plan: "trial", createdAt: iso() });
  const vt = crypto.randomBytes(24).toString("hex");
  await col("users").insertOne({ _id: userId, email: b.email, pw: hashPw(b.password), orgId, role: "owner", createdAt: iso(), verified: false, vtHash: sha(vt) });
  sendMail(b.email, "Confirm your email for Relay", `Welcome to Relay by TWWIOS.\n\nConfirm your email: ${publicUrl()}/solutions/whatsapp?verify=${vt}\n\nIf you did not sign up, ignore this email.`);
  res.status(201).json({ token: sign({ uid: userId, orgId, email: b.email }) });
}));
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const strict = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
r.post("/auth/forgot", strict, wrap(async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
  const u = await col("users").findOne({ email });
  if (u) { const t = crypto.randomBytes(24).toString("hex"); await col("users").updateOne({ _id: u._id }, { $set: { rtHash: sha(t), rtExp: Date.now() + 36e5 } });
    sendMail(email, "Reset your Relay password", `Reset your password (valid for 1 hour): ${publicUrl()}/solutions/whatsapp?reset=${t}\n\nIf you did not ask for this, ignore this email.`); }
  res.json({ ok: true, note: "If this email has an account, a reset link is on its way." }); // same answer either way
}));
r.post("/auth/reset", strict, wrap(async (req, res) => {
  const b = z.object({ token: z.string().min(20), password: z.string().min(8).max(100) }).parse(req.body);
  const u = await col("users").findOne({ rtHash: sha(b.token) });
  if (!u || !u.rtExp || u.rtExp < Date.now()) return res.status(400).json({ error: "This reset link is invalid or expired. Ask for a new one." });
  await col("users").updateOne({ _id: u._id }, { $set: { pw: hashPw(b.password), rtHash: null, rtExp: 0, verified: true } });
  res.json({ ok: true });
}));
r.post("/auth/verify", wrap(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
  const u = await col("users").findOne({ vtHash: sha(token) });
  if (!u) return res.status(400).json({ error: "This confirmation link is invalid or already used." });
  await col("users").updateOne({ _id: u._id }, { $set: { verified: true, vtHash: null } }); res.json({ ok: true });
}));
r.post("/auth/login", wrap(async (req, res) => {
  const b = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
  const u = await col("users").findOne({ email: b.email });
  if (!u || !checkPw(b.password, u.pw)) return res.status(401).json({ error: "Email or password is incorrect." });
  res.json({ token: sign({ uid: u._id, orgId: u.orgId, email: u.email }) });
}));

// ---------- WhatsApp webhook (called by Meta, no login) ----------
r.get("/webhook", (q, s) => (q.query["hub.mode"] === "subscribe" && q.query["hub.verify_token"] && q.query["hub.verify_token"] === process.env.WA_VERIFY_TOKEN ? s.send(q.query["hub.challenge"]) : s.sendStatus(403)));
r.post("/webhook", wrap(async (req, res) => {
  const secret = process.env.WA_APP_SECRET;
  if (secret) {
    const want = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex"), got = String(req.headers["x-hub-signature-256"] || "");
    if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return res.sendStatus(401);
  } else console.warn("[pulse] WA_APP_SECRET not set: webhook signatures are NOT being verified");
  res.sendStatus(200);
  for (const ch of (req.body.entry || []).flatMap((e) => e.changes || [])) {
    const v = ch.value || {}, acc = await col("wa_accounts").findOne({ phoneId: v.metadata?.phone_number_id });
    if (ch.field === "phone_number_quality_update") { const a = await col("wa_accounts").findOne({ number: v.display_phone_number }); if (a) await refreshAccount(a.orgId).catch(() => {}); continue; }
    if (!acc) continue;
    for (const s of v.statuses || []) await handleStatus({ wamid: s.id, status: s.status, ts: s.timestamp ? new Date(+s.timestamp * 1000).toISOString() : iso(), errors: s.errors });
    for (const m of v.messages || []) await handleInbound(acc.orgId, { from: m.from, text: m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "", ts: m.timestamp ? new Date(+m.timestamp * 1000).toISOString() : iso() });
  }
}));

// Admin (you): activate or change a customer's plan after they pay. Set PULSE_ADMIN_KEY on the server.
// curl -X POST https://YOUR-API/api/pulse/admin/plan -H "x-admin-key: KEY" -H "content-type: application/json" -d '{"email":"client@co.com","plan":"starter","days":30}'
r.post("/admin/plan", wrap(async (req, res) => {
  const k = process.env.PULSE_ADMIN_KEY;
  if (!k || req.headers["x-admin-key"] !== k) return res.status(401).json({ error: "Invalid admin key" });
  const b = z.object({ email: z.string().toLowerCase(), plan: z.enum(["trial", "starter", "growth"]), days: z.number().int().min(1).max(3660).default(30), product: z.enum(["pulse", "saathi"]).default("pulse") }).parse(req.body);
  const u = await col("users").findOne({ email: b.email }); if (!u) return res.status(404).json({ error: "No user with this email" });
  const paidUntil = new Date(Date.now() + b.days * 864e5).toISOString();
  await col("orgs").updateOne({ _id: u.orgId }, { $set: b.product === "saathi" ? { saathiPlan: b.plan, saathiPaidUntil: paidUntil } : { plan: b.plan, paidUntil } });
  res.json({ ok: true, plan: b.plan, paidUntil });
}));

r.use("/social", socialPublic);
// Admin list for the /admin page (x-admin-key)
r.get("/admin/orgs", wrap(async (req, res) => {
  const k = process.env.PULSE_ADMIN_KEY;
  if (!k || req.headers["x-admin-key"] !== k) return res.status(401).json({ error: "Invalid admin key" });
  const orgs = await col("orgs").find({}).sort({ createdAt: -1 }).limit(500).toArray(), out = [];
  for (const o of orgs) {
    const u = await col("users").findOne({ orgId: o._id });
    out.push({ id: o._id, company: o.name, email: u?.email, verified: u?.verified !== false, plan: o.plan, paidUntil: o.paidUntil || null, status: o.subStatus || null, saathiPlan: o.saathiPlan || "trial", saathiPaidUntil: o.saathiPaidUntil || null, createdAt: o.createdAt, billing: o.billing || null,
      contacts: await col("contacts").countDocuments({ orgId: o._id }), campaigns: await col("campaigns").countDocuments({ orgId: o._id }), whatsapp: !!(await col("wa_accounts").findOne({ orgId: o._id })), social: !!(await col("social_accounts").findOne({ orgId: o._id })) });
  }
  res.json({ orgs: out, totals: { customers: out.length, paying: out.filter((x) => x.plan !== "trial" && x.paidUntil && new Date(x.paidUntil) > new Date()).length } });
}));

// Razorpay webhook (public, signature-checked)
r.post("/billing/webhook", wrap(async (req, res) => {
  if (!verifyWebhook(req.rawBody, req.headers["x-razorpay-signature"])) return res.status(401).json({ error: "Bad signature" });
  res.json({ ok: true, result: await applyWebhook(req.body) });
}));

// Public: lets the web app know whether "Connect with Facebook" (Embedded Signup) is configured.
r.get("/config", (_q, s) => s.json({ fbAppId: process.env.FB_APP_ID || null, configId: process.env.WA_CONFIG_ID || null, graphVersion: "v21.0" }));

// ---------- everything below needs a login ----------
r.use(requireAuth);
r.use("/social", social);
r.post("/auth/resend", wrap(async (req, res) => {
  const u = await col("users").findOne({ _id: req.user.uid }); if (u.verified) return res.json({ ok: true });
  const vt = crypto.randomBytes(24).toString("hex"); await col("users").updateOne({ _id: u._id }, { $set: { vtHash: sha(vt) } });
  await sendMail(u.email, "Confirm your email for Relay", `Confirm your email: ${publicUrl()}/solutions/whatsapp?verify=${vt}`); res.json({ ok: true });
}));
r.get("/billing", wrap(async (req, res) => {
  const o = await col("orgs").findOne({ _id: req.user.orgId });
  res.json({ configured: billingConfigured(), prices: PRICES, plan: o.plan, paidUntil: o.paidUntil || null, status: o.subStatus || null, cancelling: !!o.cancelling });
}));
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
r.get("/billing/details", wrap(async (req, res) => res.json({ details: (await col("orgs").findOne({ _id: req.user.orgId })).billing || {} })));
r.put("/billing/details", wrap(async (req, res) => {
  const b = z.object({ legalName: z.string().trim().min(2).max(160), gstin: z.string().trim().toUpperCase().regex(GSTIN, "Enter a valid 15-character GSTIN").optional().or(z.literal("")), address: z.string().trim().min(5).max(400), state: z.string().trim().min(2).max(60), phone: z.string().trim().max(20).optional() }).parse(req.body);
  await col("orgs").updateOne({ _id: req.user.orgId }, { $set: { billing: b } }); res.json({ ok: true });
}));
r.post("/billing/checkout", wrap(async (req, res) => {
  const b = z.object({ plan: z.enum(["starter", "growth"]) }).parse(req.body);
  const o = await col("orgs").findOne({ _id: req.user.orgId });
  if (!o.billing?.legalName) return res.status(400).json({ error: "Please save your billing details (company name, address, GSTIN) first." });
  const out = await createSubscription(o, b.plan, req.user.email);
  if (!out.configured) return res.status(503).json({ error: "Online payment is not switched on yet. Contact TWWIOS to activate your plan." });
  res.json(out);
}));
r.post("/billing/cancel", wrap(async (req, res) => {
  const o = await col("orgs").findOne({ _id: req.user.orgId });
  res.json({ ok: await cancelSubscription(o), note: "Your plan stays active until the end of the paid month." });
}));
const org = (req) => col("orgs").findOne({ _id: req.user.orgId });

r.get("/me", wrap(async (req, res) => {
  const o = await org(req), acc = await getAccount(o._id), plan = PLANS[o.plan] || PLANS.trial;
  const used = (await col("messages").find({ orgId: o._id, sentAt: { $gte: monthStart() } }).toArray()).length;
  res.json({
    email: req.user.email, verified: (await col("users").findOne({ _id: req.user.uid }))?.verified !== false, company: o.name, plan: { id: o.plan, ...plan, paidUntil: o.paidUntil || null },
    usage: { contacts: await col("contacts").countDocuments({ orgId: o._id }), marketingThisMonth: used },
    wa: acc ? { connected: true, demo: false, number: acc.number, name: acc.verifiedName, quality: acc.quality, tier: acc.tier, limit: tierLimit(acc.tier) } : { connected: false, demo: true },
    storage: usingMongo() ? "mongodb" : "memory",
  });
}));

r.post("/wa/connect", wrap(async (req, res) => {
  const b = z.object({ phoneId: z.string().trim().regex(/^\d+$/), wabaId: z.string().trim().regex(/^\d+$/), token: z.string().trim().min(20) }).parse(req.body);
  let p; try { p = await wa.getPhone({ phoneId: b.phoneId, token: b.token }); } catch (e) { return res.status(400).json({ error: "WhatsApp rejected these details: " + e.message }); }
  const doc = { orgId: req.user.orgId, phoneId: b.phoneId, wabaId: b.wabaId, token: enc(b.token), quality: p.quality_rating || "UNKNOWN", tier: p.messaging_limit_tier || "TIER_250", number: p.display_phone_number, verifiedName: p.verified_name, checkedAt: iso() };
  await col("wa_accounts").updateOne({ orgId: req.user.orgId }, { $set: doc }, { upsert: true });
  res.json({ ok: true, number: doc.number, name: doc.verifiedName, quality: doc.quality, tier: doc.tier, limit: tierLimit(doc.tier) });
}));
// Embedded Signup: the client logs in with Facebook inside our page; we get a one-time code plus their WABA and phone IDs.
r.post("/wa/embedded", wrap(async (req, res) => {
  const b = z.object({ code: z.string().min(5), wabaId: z.string().regex(/^\d+$/), phoneId: z.string().regex(/^\d+$/) }).parse(req.body);
  if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) return res.status(501).json({ error: "Facebook sign-in is not configured on this server yet." });
  try {
    const t = await wa.exchangeCode(b.code); // server-to-server: code -> business token
    const acc = { phoneId: b.phoneId, wabaId: b.wabaId, token: t.access_token };
    await wa.subscribeApp(acc);               // send this customer's webhooks to our app
    const pin = String(100000 + crypto.randomInt(900000));
    await wa.registerPhone(acc, pin).catch((e) => { if (e.code !== 131070 && !/already/i.test(e.message)) throw e; });
    const p = await wa.getPhone(acc);
    await col("wa_accounts").updateOne({ orgId: req.user.orgId }, { $set: { orgId: req.user.orgId, phoneId: b.phoneId, wabaId: b.wabaId, token: enc(acc.token), pin: enc(pin), via: "embedded_signup", quality: p.quality_rating || "UNKNOWN", tier: p.messaging_limit_tier || "TIER_250", number: p.display_phone_number, verifiedName: p.verified_name, checkedAt: iso() } }, { upsert: true });
    await col("audit").insertOne({ _id: id(), orgId: req.user.orgId, at: iso(), who: req.user.email, what: "Connected WhatsApp via Embedded Signup" });
    res.json({ ok: true, number: p.display_phone_number, name: p.verified_name, quality: p.quality_rating, tier: p.messaging_limit_tier, limit: tierLimit(p.messaging_limit_tier) });
  } catch (e) { res.status(400).json({ error: "Could not finish connecting WhatsApp: " + e.message }); }
}));
r.post("/wa/refresh", wrap(async (req, res) => { const a = await refreshAccount(req.user.orgId).catch((e) => { res.status(400).json({ error: e.message }); }); if (a) res.json({ quality: a.quality, tier: a.tier, limit: tierLimit(a.tier) }); }));
r.delete("/wa", wrap(async (req, res) => { await col("wa_accounts").deleteMany({ orgId: req.user.orgId }); res.json({ ok: true }); }));

// ---------- templates ----------
r.get("/templates", wrap(async (req, res) => {
  const acc = await getAccount(req.user.orgId);
  if (!acc) { const own = await col("demo_templates").find({ orgId: req.user.orgId }).toArray(); return res.json({ demo: true, templates: [...DEMO_TEMPLATES, ...own] }); }
  try { const j = await wa.listTemplates(acc); res.json({ demo: false, templates: (j.data || []).map((t) => ({ name: t.name, status: t.status, category: t.category, language: t.language, body: t.components?.find((c) => c.type === "BODY")?.text || "", reason: t.rejected_reason })) }); }
  catch (e) { res.status(502).json({ error: "Could not load templates from WhatsApp: " + e.message }); }
}));
const tplSchema = z.object({ name: z.string().trim(), category: z.enum(["MARKETING", "UTILITY"]), language: z.string().trim().default("en"), body: z.string(), footer: z.string().max(60).optional(), example: z.array(z.string()).optional() });
r.post("/templates/lint", wrap(async (req, res) => res.json(lintTemplate(tplSchema.parse(req.body)))));
r.post("/templates", wrap(async (req, res) => {
  const t = tplSchema.parse(req.body), l = lintTemplate(t);
  if (!l.ok) return res.status(400).json({ error: l.errors[0], ...l });
  const acc = await getAccount(req.user.orgId);
  if (!acc) { await col("demo_templates").insertOne({ _id: id(), orgId: req.user.orgId, ...t, status: "APPROVED" }); return res.status(201).json({ demo: true, status: "APPROVED", warnings: l.warnings }); }
  try { const j = await wa.createTemplate(acc, t); res.status(201).json({ status: j.status || "PENDING", id: j.id, warnings: l.warnings }); }
  catch (e) { res.status(400).json({ error: "WhatsApp did not accept this template: " + (e.details || e.message) }); }
}));

// ---------- contacts ----------
r.post("/contacts/import", wrap(async (req, res) => {
  const b = z.object({ contacts: z.array(z.object({ name: z.string().optional(), phone: z.string() }).passthrough()).max(5000), source: z.string().trim().min(2).max(80), proof: z.string().max(300).optional(), attest: z.literal(true, { errorMap: () => ({ message: "Confirm that these people agreed to receive WhatsApp messages from you." }) }) }).parse(req.body);
  const o = await org(req), cap = (PLANS[o.plan] || PLANS.trial).contacts;
  let have = await col("contacts").countDocuments({ orgId: o._id }), added = 0, updated = 0, invalid = 0, limitHit = 0;
  for (const row of b.contacts) {
    const phone = normalizePhone(row.phone); if (!phone) { invalid++; continue; }
    const { name = "", phone: _p, ...fields } = row;
    const ex = await col("contacts").findOne({ orgId: o._id, phone });
    if (ex) { await col("contacts").updateOne({ _id: ex._id }, { $set: { name: name || ex.name, fields: { ...ex.fields, ...fields } } }); updated++; continue; }
    if (have >= cap) { limitHit++; continue; }
    await col("contacts").insertOne({ _id: id(), orgId: o._id, phone, name, fields, optIn: { source: b.source, at: iso(), proof: b.proof || "" }, createdAt: iso() }); have++; added++;
  }
  res.json({ added, updated, invalid, overPlanLimit: limitHit, planLimit: cap });
}));
r.get("/contacts", wrap(async (req, res) => {
  const all = await col("contacts").find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).toArray();
  res.json({ total: all.length, optedOut: all.filter((c) => c.optedOut).length, contacts: all.slice(0, 300).map((c) => ({ id: c._id, name: c.name, phone: c.phone, source: c.optIn?.source, optedOut: !!c.optedOut, fatigued: (c.unreadStreak || 0) >= 4, fields: c.fields })), columns: [...new Set(all.flatMap((c) => Object.keys(c.fields || {})))] });
}));
r.post("/contacts/:id/optout", wrap(async (req, res) => { await col("contacts").updateOne({ _id: req.params.id, orgId: req.user.orgId }, { $set: { optedOut: true, optedOutAt: iso() } }); res.json({ ok: true }); }));

r.post("/contacts/:id/delete", wrap(async (req, res) => { await col("contacts").deleteMany({ _id: req.params.id, orgId: req.user.orgId }); res.json({ ok: true }); }));

// ---------- delete my account and all data (also what Meta asks for as a data-deletion route) ----------
r.delete("/account", wrap(async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const u = await col("users").findOne({ _id: req.user.uid });
  if (!u || !checkPw(password, u.pw)) return res.status(401).json({ error: "Password is incorrect." });
  const o = req.user.orgId;
  for (const c of ["messages", "campaigns", "contacts", "inbox", "rules", "wa_accounts", "api_keys", "demo_templates", "audit", "users", "social_accounts", "autos", "social_threads", "social_msgs", "social_log", "saathi_settings", "saathi_docs", "saathi_chunks", "saathi_threads", "saathi_msgs", "saathi_gaps", "saathi_bookings", "saathi_keys"]) await col(c).deleteMany({ orgId: o });
  await col("orgs").deleteMany({ _id: o });
  res.json({ ok: true });
}));

// ---------- auto-reply rules ----------
r.get("/rules", wrap(async (req, res) => res.json({ rules: (await col("rules").findOne({ orgId: req.user.orgId }))?.rules || [] })));
r.put("/rules", wrap(async (req, res) => {
  const { rules } = z.object({ rules: z.array(z.object({ keyword: z.string().trim().max(40), reply: z.string().trim().max(1000) })).max(30) }).parse(req.body);
  await col("rules").updateOne({ orgId: req.user.orgId }, { $set: { rules: rules.filter((x) => x.keyword && x.reply) } }, { upsert: true });
  res.json({ ok: true });
}));

// ---------- campaigns ----------
function accountSafe(plan, on) { // B2B: message at most one person per company so a team never gets hit by the same offer five times
  if (!on) return plan; const seen = new Set(), keep = [];
  for (const c of plan.eligible) { const k = companyKey(c); if (k && seen.has(k)) { plan.blocked.push({ phone: c.phone, reason: "same_company" }); plan.reasons.same_company = (plan.reasons.same_company || 0) + 1; } else { if (k) seen.add(k); keep.push(c); } }
  plan.eligible = keep; plan.canary = Math.min(keep.length, Math.max(5, Math.ceil(keep.length * 0.05))); return plan;
}
async function capacityInfo(orgId) {
  const acc = await getAccount(orgId), limit = acc ? tierLimit(acc.tier) : 1000;
  const recent = await col("messages").find({ orgId, sentAt: { $gte: new Date(Date.now() - 864e5).toISOString() } }).toArray();
  return { acc, limit, free: Math.max(0, limit - new Set(recent.map((m) => m.phone)).size) };
}
r.post("/campaigns/preview", wrap(async (req, res) => {
  const o = await org(req), cs = await col("contacts").find({ orgId: o._id }).toArray(), cap = await capacityInfo(o._id);
  const plan = accountSafe(planCampaign(cs, { dailyCapacity: cap.limit }), req.body?.onePerCompany);
  const used = (await col("messages").find({ orgId: o._id, sentAt: { $gte: monthStart() } }).toArray()).length, quota = (PLANS[o.plan] || PLANS.trial).marketingPerMonth;
  res.json({ contacts: cs.length, eligible: plan.eligible.length, blocked: plan.blocked.length, reasons: plan.reasons, canary: plan.canary, daysNeeded: plan.days, dailyLimit: cap.limit === Infinity ? null : cap.limit, quotaLeft: Math.max(0, quota - used), demo: !cap.acc });
}));
r.post("/campaigns", wrap(async (req, res) => {
  const b = z.object({ name: z.string().trim().min(2).max(100), templateName: z.string().trim().min(1), lang: z.string().default("en"), varCols: z.array(z.string()).default([]), onePerCompany: z.boolean().optional(), consent: z.literal(true, { errorMap: () => ({ message: "Confirm that everyone on the list agreed to receive these messages." }) }) }).parse(req.body);
  const o = await org(req), cap = await capacityInfo(o._id);
  if (o.paidUntil && new Date(o.paidUntil) < new Date()) return res.status(402).json({ error: "Your subscription has ended. Renew to send campaigns." });
  const cs = await col("contacts").find({ orgId: o._id }).toArray(), plan = accountSafe(planCampaign(cs, { dailyCapacity: cap.limit }), b.onePerCompany);
  if (!plan.eligible.length) return res.status(400).json({ error: "No one on your list can be messaged right now. Check consent, opt-outs and frequency limits.", reasons: plan.reasons });
  const used = (await col("messages").find({ orgId: o._id, sentAt: { $gte: monthStart() } }).toArray()).length, quota = (PLANS[o.plan] || PLANS.trial).marketingPerMonth;
  if (used + plan.eligible.length > quota) return res.status(402).json({ error: `This campaign needs ${plan.eligible.length} messages but your ${PLANS[o.plan]?.label || "Trial"} plan has ${Math.max(0, quota - used)} left this month. Upgrade your plan.` });
  const cid = id(), now = iso();
  await col("campaigns").insertOne({ _id: cid, orgId: o._id, name: b.name, templateName: b.templateName, lang: b.lang, varCols: b.varCols, status: "running", stage: "canary", canary: plan.canary, total: plan.eligible.length, blocked: plan.reasons, demo: !cap.acc, createdAt: now });
  await col("messages").insertMany(plan.eligible.map((c) => ({ _id: id(), orgId: o._id, campaignId: cid, contactId: c._id, phone: c.phone, status: "queued", score: score(c), createdAt: now })));
  await col("audit").insertOne({ _id: id(), orgId: o._id, at: now, who: req.user.email, what: `Started campaign "${b.name}" for ${plan.eligible.length} people (consent confirmed)` });
  tick().catch(() => {});
  res.status(201).json({ id: cid, total: plan.eligible.length, blocked: plan.reasons, canary: plan.canary, daysNeeded: plan.days });
}));
const summarize = async (c) => {
  const ms = await col("messages").find({ campaignId: c._id }).toArray(), n = (f) => ms.filter(f).length;
  return { id: c._id, name: c.name, status: c.status, stage: c.stage, note: c.note, pauseReason: c.pauseReason, demo: c.demo, total: c.total, blocked: c.blocked, createdAt: c.createdAt,
    counts: { queued: n((m) => m.status === "queued"), sent: n((m) => m.sentAt), delivered: n((m) => ["delivered", "read"].includes(m.status)), read: n((m) => m.status === "read"), replied: n((m) => m.replied), failed: n((m) => m.status === "failed"), skipped: n((m) => m.status === "skipped") } };
};
r.get("/campaigns", wrap(async (req, res) => { const cs = await col("campaigns").find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).limit(30).toArray(); res.json({ campaigns: await Promise.all(cs.map(summarize)) }); }));
r.get("/campaigns/:id", wrap(async (req, res) => {
  const c = await col("campaigns").findOne({ _id: req.params.id, orgId: req.user.orgId }); if (!c) return res.sendStatus(404);
  const ms = await col("messages").find({ campaignId: c._id }).sort({ createdAt: 1 }).limit(300).toArray(), cs = {};
  for (const m of ms) cs[m.contactId] = (await col("contacts").findOne({ _id: m.contactId }))?.name || "";
  res.json({ ...(await summarize(c)), messages: ms.map((m) => ({ name: cs[m.contactId], phone: m.phone, status: m.replied ? "replied" : m.status, error: m.error, reply: m.replyText })) });
}));
r.post("/campaigns/:id/:act(pause|resume)", wrap(async (req, res) => {
  const resume = req.params.act === "resume", set = resume ? { status: "running", pauseReason: "", ...(await col("campaigns").findOne({ _id: req.params.id })).stage === "canary_wait" ? { stage: "main" } : {} } : { status: "paused", pauseReason: "Paused by you." };
  await col("campaigns").updateOne({ _id: req.params.id, orgId: req.user.orgId }, { $set: set });
  await col("audit").insertOne({ _id: id(), orgId: req.user.orgId, at: iso(), who: req.user.email, what: `${resume ? "Resumed" : "Paused"} campaign ${req.params.id}` });
  if (resume) tick().catch(() => {}); res.json({ ok: true });
}));
r.get("/inbox", wrap(async (req, res) => res.json({ messages: await col("inbox").find({ orgId: req.user.orgId }).sort({ at: -1 }).limit(100).toArray() })));
r.get("/audit", wrap(async (req, res) => res.json({ log: await col("audit").find({ orgId: req.user.orgId }).sort({ at: -1 }).limit(100).toArray() })));

// ---------- hot leads ----------
r.get("/leads", wrap(async (req, res) => {
  const cs = (await col("contacts").find({ orgId: req.user.orgId }).toArray()).filter((c) => c.lead && ["hot", "later", "cold"].includes(c.lead.intent));
  const order = { hot: 0, later: 1, cold: 2 };
  cs.sort((a, b) => order[a.lead.intent] - order[b.lead.intent] || new Date(b.lead.at) - new Date(a.lead.at));
  res.json({ leads: cs.slice(0, 100).map((c) => ({ name: c.name, phone: c.phone, company: c.fields?.company || "", intent: c.lead.intent, text: c.lead.text, at: c.lead.at })) });
}));

// ---------- API key: send a template from your own system (ERP, billing, CRM) ----------
r.post("/api-key", wrap(async (req, res) => {
  const key = "tw_" + crypto.randomBytes(24).toString("hex");
  await col("api_keys").deleteMany({ orgId: req.user.orgId });
  await col("api_keys").insertOne({ _id: id(), orgId: req.user.orgId, hash: crypto.createHash("sha256").update(key).digest("hex"), createdAt: iso() });
  res.json({ key, note: "Copy it now. It is shown only once." });
}));

export const triggerRouter = express.Router();
triggerRouter.use(express.json({ limit: "100kb" }));
triggerRouter.use(rateLimit({ windowMs: 60_000, limit: 600 }));
// POST /api/pulse/v1/send  header: x-api-key  body: { to, template, lang, vars: [..] }
// For transactional events (invoice due, order shipped). Needs consent on file; STOP is always honoured.
triggerRouter.post("/send", wrap(async (req, res) => {
  const k = await col("api_keys").findOne({ hash: crypto.createHash("sha256").update(String(req.headers["x-api-key"] || "")).digest("hex") });
  if (!k) return res.status(401).json({ error: "Invalid API key" });
  const b = z.object({ to: z.string(), template: z.string(), lang: z.string().default("en"), vars: z.array(z.union([z.string(), z.number()])).default([]), name: z.string().optional() }).parse(req.body);
  const phone = normalizePhone(b.to); if (!phone) return res.status(400).json({ error: "Invalid phone number" });
  let c = await col("contacts").findOne({ orgId: k.orgId, phone });
  if (!c) return res.status(403).json({ error: "No consent on file for this number. Import it with its opt-in source first." });
  const why = blockReason({ ...c, mkt: [] });
  if (why) return res.status(403).json({ error: "Not sent: " + why, reason: why });
  const acc = await getAccount(k.orgId); let wamid;
  if (!acc) wamid = "demo." + id();
  else { try { wamid = (await wa.sendTemplate(acc, phone, { name: b.template, lang: b.lang, vars: b.vars })).messages?.[0]?.id; } catch (e) { return res.status(502).json({ error: e.message, code: e.code }); } }
  await col("messages").insertOne({ _id: id(), orgId: k.orgId, campaignId: "api", contactId: c._id, phone, wamid, status: "sent", sentAt: iso(), createdAt: iso(), kind: "api" });
  res.json({ ok: true, id: wamid, demo: !acc });
}));
export default r;
