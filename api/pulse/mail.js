// Transactional email through Resend's HTTP API (no SDK). Env: RESEND_API_KEY, MAIL_FROM ("Relay <no-reply@yourdomain.com>"), PUBLIC_URL.
// Without a key, emails are only logged to the server console (dev).
export const publicUrl = () => (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
export async function sendMail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`); return { sent: false }; }
  try {
    const r = await fetch((process.env.RESEND_BASE || "https://api.resend.com") + "/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM || "Relay <onboarding@resend.dev>", to: [to], subject, text }) });
    return { sent: r.ok };
  } catch { return { sent: false }; }
}
