// Razorpay subscriptions (monthly). Uses the REST API directly, no SDK.
// Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PLAN_STARTER, RAZORPAY_PLAN_GROWTH, RAZORPAY_BASE (tests only)
import crypto from "node:crypto";
import { col } from "./store.js";

const BASE = () => process.env.RAZORPAY_BASE || "https://api.razorpay.com/v1";
const auth = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
export const billingConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const PRICES = { starter: Number(process.env.PRICE_STARTER || 1999), growth: Number(process.env.PRICE_GROWTH || 4999) }; // INR per month, display only; real price lives in the Razorpay plan
const planId = (p, product) => process.env[(product === "saathi" ? "RAZORPAY_PLAN_SAATHI_" : product === "vox" ? "RAZORPAY_PLAN_VOX_" : "RAZORPAY_PLAN_") + p.toUpperCase()];

export async function createSubscription(org, plan, email, product = "pulse") {
  const pid = planId(plan, product);
  if (!billingConfigured() || !pid) return { configured: false };
  const res = await fetch(BASE() + "/subscriptions", {
    method: "POST", headers: { Authorization: auth(), "content-type": "application/json" },
    body: JSON.stringify({ plan_id: pid, total_count: 120, customer_notify: 1, notes: { orgId: org._id, plan, email, product, gstin: org.billing?.gstin || "", legalName: org.billing?.legalName || "" } }),
  });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(j?.error?.description || "Payment provider error"), { status: 502 });
  await col("orgs").updateOne({ _id: org._id }, { $set: product === "saathi" ? { saathiSubId: j.id, saathiPending: plan } : product === "vox" ? { voxSubId: j.id, voxPending: plan } : { subId: j.id, pendingPlan: plan } });
  return { configured: true, subscriptionId: j.id, keyId: process.env.RAZORPAY_KEY_ID };
}

export async function cancelSubscription(org, product = "pulse") {
  const sid = product === "saathi" ? org.saathiSubId : product === "vox" ? org.voxSubId : org.subId;
  if (!sid || !billingConfigured()) return false;
  await fetch(BASE() + `/subscriptions/${sid}/cancel`, { method: "POST", headers: { Authorization: auth(), "content-type": "application/json" }, body: JSON.stringify({ cancel_at_cycle_end: 1 }) });
  await col("orgs").updateOne({ _id: org._id }, { $set: product === "saathi" ? { saathiCancelling: true } : product === "vox" ? { voxCancelling: true } : { cancelling: true } });
  return true;
}

export function verifyWebhook(raw, sig) {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET; if (!s || !sig || !raw) return false;
  const h = crypto.createHmac("sha256", s).update(raw).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(sig))); } catch { return false; }
}

// Called with the parsed webhook body. Idempotent: charging the same cycle twice just sets the same paidUntil.
export async function applyWebhook(ev) {
  const sub = ev?.payload?.subscription?.entity; if (!sub) return "ignored";
  const saathi = sub.notes?.product === "saathi", vox = sub.notes?.product === "vox";
  const org = (sub.notes?.orgId && await col("orgs").findOne({ _id: sub.notes.orgId })) || await col("orgs").findOne(saathi ? { saathiSubId: sub.id } : vox ? { voxSubId: sub.id } : { subId: sub.id });
  if (!org) return "unknown_org";
  const plan = sub.notes?.plan || (saathi ? org.saathiPending : vox ? org.voxPending : org.pendingPlan) || org.plan;
  if (ev.event === "subscription.charged" || ev.event === "subscription.activated") {
    const end = sub.current_end ? new Date(sub.current_end * 1000) : new Date(Date.now() + 31 * 864e5);
    const paidUntil = new Date(end.getTime() + 2 * 864e5).toISOString(); // 2 days grace for bank delays
    await col("orgs").updateOne({ _id: org._id }, { $set: saathi ? { saathiPlan: plan, saathiPaidUntil: paidUntil, saathiSubId: sub.id, saathiStatus: "active", saathiCancelling: false } : vox ? { voxPlan: plan, voxPaidUntil: paidUntil, voxSubId: sub.id, voxStatus: "active", voxCancelling: false } : { plan, paidUntil, subId: sub.id, subStatus: "active", cancelling: false } });
    return "activated";
  }
  if (["subscription.cancelled", "subscription.halted", "subscription.completed", "subscription.expired"].includes(ev.event)) {
    await col("orgs").updateOne({ _id: org._id }, { $set: saathi ? { saathiStatus: ev.event.split(".")[1] } : vox ? { voxStatus: ev.event.split(".")[1] } : { subStatus: ev.event.split(".")[1] } }); // access continues until paidUntil, then sends are blocked
    return "ended";
  }
  return "ignored";
}
