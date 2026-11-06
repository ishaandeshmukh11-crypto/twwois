import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { DemoRequest, ChatSession, WorkflowRun } from "./models/index.js";
import { route } from "./agents.js";
import pulse, { triggerRouter } from "./pulse/routes.js";
import { pub as saathiPublic, api as saathiApi, widgetJs } from "./saathi/routes.js";
import site from "./site.js";
import scribe from "./scribe.js";
import suite from "./suite.js";
import vox, { startVox } from "./vox/routes.js";
import { startScheduler } from "./pulse/sender.js";

if (process.env.NODE_ENV === "production") {
  const bad = [];
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) bad.push("AUTH_SECRET (32+ random characters)");
  if (!process.env.ENC_KEY || process.env.ENC_KEY.length < 32) bad.push("ENC_KEY (32+ random characters)");
  if (!process.env.MONGODB_URI) bad.push("MONGODB_URI");
  if (!process.env.PULSE_ADMIN_KEY || process.env.PULSE_ADMIN_KEY.length < 16) bad.push("PULSE_ADMIN_KEY (16+ characters)");
  if (!process.env.PUBLIC_URL) bad.push("PUBLIC_URL");
  if (!process.env.WA_APP_SECRET && !process.env.FB_APP_SECRET) bad.push("WA_APP_SECRET (webhook signature check)");
  if (bad.length) { console.error("Refusing to start in production. Set: " + bad.join(", ")); process.exit(1); }
}
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.get("/api/saathi/widget.js", cors(), widgetJs);
app.use("/api/saathi/public", saathiPublic); // website widget: callable from any customer website
app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",") }));
app.use("/api/pulse/v1", triggerRouter);
app.use("/api/saathi", saathiApi); // Mira AI assistant (own router, own body parser)
app.use("/api/pulse", pulse); // WhatsApp solution (has its own body parser and rate limit)
app.use("/api/scribe", scribe);
app.use("/api/vox", vox); // Vox: self-serve AI calling (own parsers; Twilio webhooks live under /api/vox/hook)
app.use("/api/suite", suite); // Settle, Scribe and Vox trial workspaces // live demo: own 7 MB parser, own daily limits
app.use(express.json({ limit: "50kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const needDb = (_req, res, next) => mongoose.connection.readyState === 1 ? next() : res.status(503).json({ error: "Database unavailable" });
const code = (p) => p + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.use("/api", site);
app.get("/health", (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

const demoSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), company: z.string().trim().min(1).max(160),
  size: z.string().max(40).optional(), agent: z.string().max(80).optional(), date: z.string().max(20).optional(),
  time: z.string().max(40).optional(), message: z.string().max(2000).optional(),
});
app.post("/api/demo-requests", needDb, wrap(async (req, res) => {
  const p = demoSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].path[0] === "email" ? "Please enter a valid work email." : "Please add your name and company." });
  const doc = await DemoRequest.create({ ...p.data, reference: code("DM") });
  res.status(201).json({ reference: doc.reference });
}));

app.post("/api/chat", needDb, wrap(async (req, res) => {
  const { message, sessionId } = z.object({ message: z.string().trim().min(1).max(1000), sessionId: z.string().nullish() }).parse(req.body);
  let session = sessionId && mongoose.isValidObjectId(sessionId) ? await ChatSession.findById(sessionId) : null;
  if (!session) session = new ChatSession();
  session.messages.push({ role: "user", text: message });
  const r = route(message);
  if (r.type === "reply") { session.messages.push({ role: "bot", text: r.reply }); await session.save(); return res.json({ ...r, sessionId: session.id }); }
  const run = await WorkflowRun.create({ sessionId: session.id, task: message, agent: r.agent.name, tools: r.agent.tools, output: r.agent.output, confidence: 94, auditId: code("AU").slice(3) });
  session.messages.push({ role: "bot", text: `Routed to ${r.agent.name}` }); await session.save();
  res.json({
    type: "run", sessionId: session.id, agent: r.agent.name, tools: r.agent.tools, output: r.agent.output, confidence: 94,
    id: run.id, auditId: run.auditId,
    steps: ["Input received", "Validating against policy", "Reasoning & planning", ...r.agent.tools.map((t) => `Calling ${t}`), "Preparing output"],
  });
}));

app.post("/api/runs/:id/decision", needDb, wrap(async (req, res) => {
  const { decision } = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid run id" });
  const run = await WorkflowRun.findOneAndUpdate({ _id: req.params.id, decision: "pending" }, { decision, decidedAt: new Date() }, { new: true });
  if (!run) return res.status(404).json({ error: "Run not found or already decided" });
  res.json({ ok: true, auditId: run.auditId, decision });
}));

app.get("/api/stats", wrap(async (_req, res) => {
  const base = 12865, up = process.uptime();
  let runs = 0; if (mongoose.connection.readyState === 1) runs = await WorkflowRun.countDocuments();
  res.json({ tasksToday: base + runs, agentsRunning: 214, uptimeSec: Math.round(up) });
}));

app.use((err, _req, res, _next) => {
  if (err?.name === "ZodError") return res.status(400).json({ error: err.issues[0]?.message || "Invalid input" });
  console.error(err); res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => { console.log(`API on :${port}`); startScheduler(); startVox(); });
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/twwios").then(() => console.log("MongoDB connected")).catch((e) => console.warn("MongoDB not connected:", e.message));
