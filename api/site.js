// Website: inquiries, admin list and the site assistant.
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Inquiry } from "./models/index.js";
import { sendMail } from "./pulse/mail.js";

const r = Router();
const code = () => "IQ-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const s = (n) => z.string().trim().max(n).optional().transform((v) => v || undefined);

// The form sends: n name, c company, e email, p phone, i interest, m message (see lib/site-data.js form()).
const body = z.object({
  n: z.string().trim().min(1).max(120), c: s(160), e: z.string().trim().email().max(200).optional().or(z.literal("")),
  p: s(40), i: s(120), m: s(3000), page: s(200), src: z.enum(["form", "chat"]).optional(),
}).refine((v) => v.e || v.p, { message: "Add an email or phone so the team can reach you." });

r.post("/inquiries", async (req, res, next) => {
  try {
    const p = body.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    const d = p.data;
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database unavailable" });
    const doc = await Inquiry.create({ reference: code(), name: d.n, company: d.c, email: d.e || undefined, phone: d.p, interest: d.i, message: d.m, page: d.page, source: d.src || "form" });
    const to = process.env.INQUIRY_TO;
    if (to) sendMail(to, `New inquiry ${doc.reference} from ${d.n}`, [`Name: ${d.n}`, `Company: ${d.c || "-"}`, `Email: ${d.e || "-"}`, `Phone: ${d.p || "-"}`, `Interest: ${d.i || "-"}`, `Page: ${d.page || "-"}`, "", d.m || ""].join("\n")).catch(() => {});
    res.status(201).json({ reference: doc.reference });
  } catch (e) { next(e); }
});

r.get("/admin/inquiries", async (req, res, next) => {
  try {
    const k = process.env.PULSE_ADMIN_KEY;
    if (!k || req.get("x-admin-key") !== k) return res.status(401).json({ error: "Unauthorized" });
    res.json(await Inquiry.find().sort({ createdAt: -1 }).limit(200).lean());
  } catch (e) { next(e); }
});

const FACTS = `You are the assistant on the website of TWWIOS Technologies Private Limited, an AI and engineering company.
Products: Relay (WhatsApp, Instagram and Facebook messaging automation, live), Mira (AI sales and support assistant, live), Settle (AI collections follow-up, launching soon), Scribe (invoice and document reading, launching soon), Vox (AI voice calling agent, launching soon).
Services: cloud and DevOps, web and mobile apps, e-commerce, ERP, CRM, RPA, AI and data, security, technology support and team augmentation.
Rules: be brief and friendly; never invent prices, clients or dates; pricing is tailored, so offer to have the team connect. If asked for something you do not know, say so and suggest typing "talk to team".`;

r.post("/site-chat", async (req, res) => {
  const parsed = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) })).min(1).max(12) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "Assistant offline" });
  try {
    const rr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 300, system: FACTS, messages: parsed.data.messages }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await rr.json();
    const reply = j.content?.[0]?.text;
    if (!rr.ok || !reply) return res.status(502).json({ error: "Assistant unavailable" });
    res.json({ reply });
  } catch { res.status(502).json({ error: "Assistant unavailable" }); }
});

export default r;
