// Thin Twilio client (REST, no SDK). Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_BASE_URL (tests only)
import crypto from "node:crypto";
const BASE = () => (process.env.TWILIO_BASE_URL || "https://api.twilio.com").replace(/\/$/, "");
const SID = () => process.env.TWILIO_ACCOUNT_SID, TOK = () => process.env.TWILIO_AUTH_TOKEN;
export const twilioConfigured = () => !!(SID() && TOK());
const auth = () => "Basic " + Buffer.from(`${SID()}:${TOK()}`).toString("base64");
async function call(method, path, form) {
  const r = await fetch(`${BASE()}/2010-04-01/Accounts/${SID()}/${path}`, { method, headers: { Authorization: auth(), "content-type": "application/x-www-form-urlencoded" }, body: form ? new URLSearchParams(form).toString() : undefined, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || "Phone provider error"), { status: 502 });
  return j;
}
export const placeCall = ({ to, from, url, statusUrl }) => call("POST", "Calls.json", { To: to, From: from, Url: url, Method: "POST", StatusCallback: statusUrl, StatusCallbackMethod: "POST", StatusCallbackEvent: "completed", Timeout: "30" });
export async function buyNumber(country = "US", areaCode) {
  const q = new URLSearchParams({ VoiceEnabled: "true" }); if (areaCode) q.set("AreaCode", areaCode);
  const found = await call("GET", `AvailablePhoneNumbers/${encodeURIComponent(country)}/Local.json?${q}`);
  const n = found.available_phone_numbers?.[0]?.phone_number; if (!n) throw Object.assign(new Error("No numbers available there. Try another country or area code."), { status: 404 });
  const got = await call("POST", "IncomingPhoneNumbers.json", { PhoneNumber: n });
  return { number: got.phone_number || n, sid: got.sid };
}
// Twilio signs: URL + sorted POST params, HMAC-SHA1 with the auth token, base64.
export function validSig(url, params, sig) {
  if (!TOK()) return false;
  const data = url + Object.keys(params || {}).sort().map((k) => k + params[k]).join("");
  const h = crypto.createHmac("sha1", TOK()).update(data).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(sig || ""))); } catch { return false; }
}
