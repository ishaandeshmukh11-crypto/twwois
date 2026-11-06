import mongoose from "mongoose";
const { Schema, model } = mongoose;

export const DemoRequest = model("DemoRequest", new Schema({
  reference: { type: String, index: true },
  name: String, email: String, company: String, size: String, agent: String,
  date: String, time: String, message: String,
  status: { type: String, enum: ["new", "contacted", "scheduled", "closed"], default: "new" },
}, { timestamps: true }));

export const ChatSession = model("ChatSession", new Schema({
  messages: [{ role: String, text: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

export const WorkflowRun = model("WorkflowRun", new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession" },
  task: String, agent: String, tools: [String], output: String, confidence: Number,
  auditId: { type: String, index: true },
  decision: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  decidedAt: Date,
}, { timestamps: true }));

export const Inquiry = model("Inquiry", new Schema({
  reference: { type: String, index: true },
  name: String, company: String, email: String, phone: String,
  interest: String, message: String, page: String,
  source: { type: String, enum: ["form", "chat"], default: "form" },
  status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
}, { timestamps: true }));
