import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { col, id } from "../pulse/store.js";
import { requireAuth, dec } from "../pulse/auth.js";
import * as wa from "../pulse/wa.js";
import { sendDM } from "../pulse/social.js";
import { createSubscription, cancelSubscription, billingConfigured } from "../pulse/billing.js";
import { handleMessage, access, settingsOf, indexDoc, PLANS, DEFAULTS } from "./engine.js";
import { learnSite } from "./fetchsite.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const iso = () => new Date().toISOString();
const DAY = 864e5;
const origin = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

// ---------- public: website chat widget (no login, any website) ----------
export const pub = express.Router();
pub.use(cors({ origin: true }));
pub.use(express.json({ limit: "20kb" }));
pub.use(rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }));
const orgByKey = async (key) => { const k = await col("saathi_keys").findOne({ key: String(key || "") }); return k?.orgId || null; };
pub.get("/config", wrap(async (req, res) => {
  const o = await orgByKey(req.query.key); if (!o) return res.status(404).json({ error: "Unknown key" });
  const s = await settingsOf(o); res.json({ name: s.businessName || "Chat with us", greeting: s.greeting, enabled: s.enabled !== false && (await access(o)).ok }); // bubble is hidden while there is no active subscription
}));
pub.post("/chat", wrap(async (req, res) => {
  const b = z.object({ key: z.string(), sid: z.string().min(8).max(64).regex(/^[\w-]+$/), text: z.string().trim().min(1).max(1000), name: z.string().max(80).optional() }).parse(req.body);
  const o = await orgByKey(b.key); if (!o) return res.status(404).json({ error: "Unknown key" });
  col("saathi_keys").updateOne({ key: b.key }, { $set: { used: true } }).catch(() => {});
  const r = await handleMessage(o, { channel: "web", senderId: b.sid, name: b.name, text: b.text });
  res.json({ reply: r.reply || null, human: r.reason === "human_has_chat" });
}));
pub.get("/poll", wrap(async (req, res) => {
  const o = await orgByKey(req.query.key); if (!o) return res.status(404).json({ error: "Unknown key" });
  const t = await col("saathi_threads").findOne({ orgId: o, channel: "web", senderId: String(req.query.sid || "") });
  if (!t) return res.json({ messages: [] });
  const after = String(req.query.after || "1970-01-01");
  const m = await col("saathi_msgs").find({ orgId: o, threadId: t._id, dir: "out", human: true, ts: { $gt: after } }).sort({ ts: 1 }).limit(20).toArray();
  res.json({ messages: m.map((x) => ({ text: x.text, ts: x.ts })) });
}));
export const widgetJs = (req, res) => {
  const key = String(req.query.key || "").replace(/[^\w-]/g, ""), api = origin(req) + "/api/saathi/public";
  res.type("application/javascript").set("Cache-Control", "public, max-age=300").send(`(function(){var K=${JSON.stringify(key)},A=${JSON.stringify(api)};if(window.__saathi)return;window.__saathi=1;
var sid;try{sid=localStorage.getItem("saathi_sid");if(!sid){sid="w"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("saathi_sid",sid)}}catch(e){sid="w"+Math.random().toString(36).slice(2)+Date.now().toString(36)}
var css=".sa-b{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:14px;background:#111827;color:#fff;border:0;cursor:pointer;font:600 22px system-ui;z-index:2147483000;box-shadow:0 6px 20px rgba(0,0,0,.2)}.sa-w{position:fixed;right:20px;bottom:88px;width:340px;max-width:calc(100vw - 24px);height:460px;max-height:calc(100vh - 110px);background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:none;flex-direction:column;z-index:2147483000;font:14px/1.45 system-ui,sans-serif;color:#111827;box-shadow:0 12px 40px rgba(0,0,0,.18)}.sa-w.o{display:flex}.sa-h{padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600}.sa-m{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.sa-x{max-width:85%;padding:8px 11px;border-radius:10px;background:#f3f4f6;align-self:flex-start;white-space:pre-wrap}.sa-x.u{background:#111827;color:#fff;align-self:flex-end}.sa-f{display:flex;border-top:1px solid #e5e7eb}.sa-f input{flex:1;border:0;padding:12px;font:inherit;outline:none}.sa-f button{border:0;background:none;padding:0 14px;font-weight:600;color:#d9480f;cursor:pointer}.sa-p{font-size:11px;color:#9ca3af;text-align:center;padding:4px}";
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
var b=document.createElement("button");b.className="sa-b";b.setAttribute("aria-label","Open chat");b.textContent="\\u2709";
var w=document.createElement("div");w.className="sa-w";w.innerHTML='<div class="sa-h">Chat with us</div><div class="sa-m"></div><form class="sa-f"><input placeholder="Type your message" aria-label="Message" maxlength="1000"><button>Send</button></form><div class="sa-p">Powered by Mira</div>';
document.body.appendChild(b);document.body.appendChild(w);var M=w.querySelector(".sa-m"),F=w.querySelector("form"),I=w.querySelector("input"),last=new Date().toISOString(),greeted=0;
function add(t,u){var d=document.createElement("div");d.className="sa-x"+(u?" u":"");d.textContent=t;M.appendChild(d);M.scrollTop=M.scrollHeight}
fetch(A+"/config?key="+K).then(function(r){return r.json()}).then(function(c){if(c.name)w.querySelector(".sa-h").textContent=c.name;if(c.enabled===false)b.style.display="none";w.__g=c.greeting}).catch(function(){});
b.onclick=function(){w.classList.toggle("o");if(w.classList.contains("o")&&!greeted){greeted=1;add(w.__g||"Hi! How can I help?")}if(w.classList.contains("o"))I.focus()};
F.onsubmit=function(e){e.preventDefault();var t=I.value.trim();if(!t)return;I.value="";add(t,1);fetch(A+"/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:K,sid:sid,text:t})}).then(function(r){return r.json()}).then(function(j){if(j.reply)add(j.reply);else if(j.human)add("Our team has your message and will reply here shortly.")}).catch(function(){add("Sorry, something went wrong. Please try again.")});last=new Date().toISOString()};
setInterval(function(){if(!w.classList.contains("o"))return;fetch(A+"/poll?key="+K+"&sid="+sid+"&after="+encodeURIComponent(last)).then(function(r){return r.json()}).then(function(j){(j.messages||[]).forEach(function(m){add(m.text);if(m.ts>last)last=m.ts})}).catch(function(){})},4000);
})();`);
};

// ---------- logged in ----------
export const api = express.Router();
api.use(express.json({ limit: "3mb" }));
api.use(requireAuth);
api.use(rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }));
const O = (req) => req.user.orgId;

api.get("/overview", wrap(async (req, res) => {
  const o = O(req), since = new Date(Date.now() - 30 * DAY).toISOString(), acc = await access(o), s = await col("saathi_settings").findOne({ orgId: o });
  const threads = (await col("saathi_threads").find({ orgId: o }).toArray()).filter((t) => t.channel !== "test" && (t.lastAt || "") >= since);
  const leads = threads.filter((t) => t.lead?.phone || t.lead?.email);
  res.json({
    acc: { ...acc, label: PLANS[acc.plan]?.label }, conversations: threads.length, leads: leads.length, handoffs: threads.filter((t) => t.humanOnly).length,
    bookings: await col("saathi_bookings").countDocuments({ orgId: o, createdAt: { $gte: since } }), gaps: await col("saathi_gaps").countDocuments({ orgId: o, status: "open" }),
    setup: { profile: !!(s?.businessName && s?.about), knowledge: !!(await col("saathi_chunks").findOne({ orgId: o })), tested: !!(await col("saathi_msgs").findOne({ orgId: o, channel: "test" })),
      channel: !!(await col("saathi_keys").findOne({ orgId: o, used: true })) || !!(await col("wa_accounts").findOne({ orgId: o })) || !!(await col("social_accounts").findOne({ orgId: o })), paid: acc.plan !== "none" },
    aiLive: !!process.env.ANTHROPIC_API_KEY,
  });
}));
api.get("/settings", wrap(async (req, res) => res.json({ settings: await settingsOf(O(req)) })));
api.put("/settings", wrap(async (req, res) => {
  const b = z.object({ businessName: z.string().trim().min(2).max(100), about: z.string().trim().min(10).max(2000), hours: z.string().trim().max(300).optional().or(z.literal("")), tone: z.enum(["friendly", "formal"]).default("friendly"), greeting: z.string().trim().max(300).optional().or(z.literal("")), ownerEmail: z.string().trim().email().optional().or(z.literal("")), bookingEnabled: z.boolean().default(true), enabled: z.boolean().default(true) }).parse(req.body);
  await col("saathi_settings").updateOne({ orgId: O(req) }, { $set: { ...b, orgId: O(req) } }, { upsert: true }); res.json({ ok: true });
}));

// knowledge
api.get("/kb", wrap(async (req, res) => {
  const docs = await col("saathi_docs").find({ orgId: O(req) }).sort({ createdAt: -1 }).toArray();
  res.json({ docs: docs.map((d) => ({ id: d._id, title: d.title, source: d.source, chars: d.text.length, createdAt: d.createdAt })) });
}));
const addDoc = async (orgId, title, text, source) => {
  if ((await col("saathi_docs").countDocuments({ orgId })) >= 60) throw Object.assign(new Error("You have reached 60 items. Delete some to add more."), { status: 400 });
  const doc = { _id: id(), orgId, title: title.slice(0, 120), text: text.slice(0, 120000), source, createdAt: iso() }; await col("saathi_docs").insertOne(doc); await indexDoc(orgId, doc._id, doc.title, doc.text); return doc;
};
api.post("/kb", wrap(async (req, res) => {
  const b = z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().min(10).max(120000) }).parse(req.body);
  res.status(201).json({ id: (await addDoc(O(req), b.title, b.text, "text"))._id });
}));
api.post("/kb/url", wrap(async (req, res) => {
  const { url } = z.object({ url: z.string().trim().url() }).parse(req.body); let pages;
  try { pages = await learnSite(url); } catch (e) { return res.status(400).json({ error: "Could not read this website: " + e.message }); }
  if (!pages.length) return res.status(400).json({ error: "No readable text found on this page." });
  let n = 0; for (const p of pages) { await addDoc(O(req), new URL(p.url).pathname === "/" ? new URL(p.url).host : new URL(p.url).host + new URL(p.url).pathname, p.text, "website"); n++; }
  res.json({ ok: true, pages: n });
}));
api.post("/kb/:id/delete", wrap(async (req, res) => { await col("saathi_docs").deleteMany({ _id: req.params.id, orgId: O(req) }); await col("saathi_chunks").deleteMany({ docId: req.params.id, orgId: O(req) }); res.json({ ok: true }); }));

// try it
api.post("/test", wrap(async (req, res) => {
  const b = z.object({ text: z.string().trim().min(1).max(1000), sid: z.string().min(4).max(40) }).parse(req.body), o = O(req);
  const today = await col("saathi_msgs").countDocuments({ orgId: o, channel: "test", dir: "in", ts: { $gte: new Date(Date.now() - DAY).toISOString() } });
  if (today >= 40) return res.status(429).json({ error: "Test limit reached for today (40 messages). Try again tomorrow." });
  const r = await handleMessage(o, { channel: "test", senderId: b.sid, name: "Test customer", text: b.text });
  res.json({ reply: r.reply || null, answered: r.answered, handoff: r.handoff, engine: r.engine, silent: r.reason || null });
}));
api.post("/test/reset", wrap(async (req, res) => { const t = await col("saathi_threads").findOne({ orgId: O(req), channel: "test", senderId: String(req.body?.sid || "") }); if (t) { await col("saathi_msgs").deleteMany({ threadId: t._id }); await col("saathi_threads").deleteMany({ _id: t._id }); } res.json({ ok: true }); }));

// unanswered questions
api.get("/gaps", wrap(async (req, res) => res.json({ gaps: await col("saathi_gaps").find({ orgId: O(req), status: "open" }).sort({ count: -1 }).limit(100).toArray() })));
api.post("/gaps/:id/answer", wrap(async (req, res) => {
  const b = z.object({ answer: z.string().trim().min(2).max(2000) }).parse(req.body), g = await col("saathi_gaps").findOne({ _id: req.params.id, orgId: O(req) });
  if (!g) return res.status(404).json({ error: "Not found" });
  await addDoc(O(req), "Q: " + g.question.slice(0, 80), `Question: ${g.question}\nAnswer: ${b.answer}`, "answered_gap"); await col("saathi_gaps").updateOne({ _id: g._id }, { $set: { status: "answered" } }); res.json({ ok: true });
}));
api.post("/gaps/:id/dismiss", wrap(async (req, res) => { await col("saathi_gaps").updateOne({ _id: req.params.id, orgId: O(req) }, { $set: { status: "dismissed" } }); res.json({ ok: true }); }));

// conversations
api.get("/threads", wrap(async (req, res) => {
  const o = O(req), ts = (await col("saathi_threads").find({ orgId: o }).sort({ lastAt: -1 }).limit(80).toArray()).filter((t) => t.channel !== "test"), out = [];
  for (const t of ts) { const m = await col("saathi_msgs").find({ orgId: o, threadId: t._id }).sort({ seq: -1 }).limit(30).toArray(); out.push({ ...t, messages: m.reverse() }); }
  res.json({ threads: out });
}));
api.post("/threads/:id/takeover", wrap(async (req, res) => { const { on } = z.object({ on: z.boolean() }).parse(req.body); await col("saathi_threads").updateOne({ _id: req.params.id, orgId: O(req) }, { $set: { humanOnly: on } }); res.json({ ok: true }); }));
api.post("/reply", wrap(async (req, res) => {
  const b = z.object({ threadId: z.string(), text: z.string().trim().min(1).max(1000) }).parse(req.body), o = O(req);
  const t = await col("saathi_threads").findOne({ _id: b.threadId, orgId: o }); if (!t) return res.status(404).json({ error: "Conversation not found" });
  const fresh = t.lastInboundAt && Date.now() - new Date(t.lastInboundAt) < DAY;
  try {
    if (t.channel === "whatsapp") {
      if (!fresh) return res.status(400).json({ error: "WhatsApp allows replies only within 24 hours of the customer's last message." });
      const a = await col("wa_accounts").findOne({ orgId: o }); if (a) await wa.sendText({ ...a, token: dec(a.token) }, t.senderId, b.text);
    } else if (t.channel === "instagram" || t.channel === "facebook") {
      if (!fresh) return res.status(400).json({ error: "Meta allows replies only within 24 hours of the customer's last message." });
      await sendDM(o, t.channel, t.senderId, b.text);
    }
  } catch (e) { return res.status(502).json({ error: e.message }); }
  await col("saathi_msgs").insertOne({ _id: id(), orgId: o, threadId: t._id, channel: t.channel, dir: "out", text: b.text, ts: iso(), seq: Date.now() * 1000 + 999, human: true });
  await col("saathi_threads").updateOne({ _id: t._id }, { $set: { humanOnly: true, lastAt: iso() } }); res.json({ ok: true });
}));

// leads and bookings
api.get("/leads", wrap(async (req, res) => {
  const ts = (await col("saathi_threads").find({ orgId: O(req) }).sort({ lastAt: -1 }).toArray()).filter((t) => t.channel !== "test" && (t.lead?.phone || t.lead?.email || t.lead?.name));
  res.json({ leads: ts.map((t) => ({ id: t._id, channel: t.channel, name: t.lead.name || t.name || "", phone: t.lead.phone || "", email: t.lead.email || "", need: t.lead.need || "", intent: t.intent || "", at: t.lastAt })) });
}));
api.get("/bookings", wrap(async (req, res) => res.json({ bookings: await col("saathi_bookings").find({ orgId: O(req) }).sort({ createdAt: -1 }).limit(200).toArray() })));
api.post("/bookings/:id/status", wrap(async (req, res) => { const { status } = z.object({ status: z.enum(["new", "confirmed", "done", "cancelled"]) }).parse(req.body); await col("saathi_bookings").updateOne({ _id: req.params.id, orgId: O(req) }, { $set: { status } }); res.json({ ok: true }); }));

// website widget
api.get("/widget", wrap(async (req, res) => {
  let k = await col("saathi_keys").findOne({ orgId: O(req) });
  if (!k) { k = { _id: id(), orgId: O(req), key: "sk_" + crypto.randomBytes(12).toString("hex"), createdAt: iso() }; await col("saathi_keys").insertOne(k); }
  res.json({ key: k.key, snippet: `<script async src="${origin(req)}/api/saathi/widget.js?key=${k.key}"></script>` });
}));
api.post("/widget/installed", wrap(async (req, res) => { await col("saathi_keys").updateOne({ orgId: O(req) }, { $set: { used: true } }); res.json({ ok: true }); }));

// billing for this product (own subscription)
api.get("/billing", wrap(async (req, res) => {
  const o = await col("orgs").findOne({ _id: O(req) }), acc = await access(O(req));
  res.json({ configured: billingConfigured(), plans: Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, { label: v.label, price: v.price, replies: v.replies }])), current: acc, status: o.saathiStatus || null, cancelling: !!o.saathiCancelling, hasDetails: !!o.billing?.legalName });
}));
api.post("/billing/checkout", wrap(async (req, res) => {
  const b = z.object({ plan: z.enum(["starter", "growth"]) }).parse(req.body), o = await col("orgs").findOne({ _id: O(req) });
  if (!o.billing?.legalName) return res.status(400).json({ error: "Please save your billing details (company name, address, GSTIN) first." });
  const out = await createSubscription(o, b.plan, req.user.email, "saathi");
  if (!out.configured) return res.status(503).json({ error: "Online payment is not switched on yet. Contact TWWIOS to activate your plan." });
  res.json(out);
}));
api.post("/billing/cancel", wrap(async (req, res) => { const o = await col("orgs").findOne({ _id: O(req) }); res.json({ ok: await cancelSubscription(o, "saathi"), note: "Your plan stays active until the end of the paid month." }); }));
