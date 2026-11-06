// "Learn from my website": fetches pages safely (no internal network access) and turns them into plain text.
import dns from "node:dns/promises";
import net from "node:net";

const priv = (ip) => {
  if (net.isIPv6(ip)) { const x = ip.toLowerCase(); return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168.") || x === "::"; }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
async function safeUrl(u) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https links are allowed.");
  if (process.env.SAATHI_ALLOW_PRIVATE_URLS === "1") return url;
  const addrs = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => priv(a.address))) throw new Error("This address is not allowed.");
  return url;
}
async function get(u, hops = 0) {
  const url = await safeUrl(u), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "TriosSaathiBot/1.0 (+learn from your own website)" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { if (hops >= 3) throw new Error("Too many redirects."); return get(new URL(r.headers.get("location"), url).toString(), hops + 1); }
    if (!r.ok) throw new Error(`The page answered ${r.status}.`);
    const ct = r.headers.get("content-type") || ""; if (!/text\/(html|plain)/.test(ct)) throw new Error("This link is not a web page.");
    const reader = r.body.getReader(); let size = 0; const parts = [];
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1_500_000) { ctl.abort(); break; } parts.push(value); }
    return { url, html: Buffer.concat(parts).toString("utf8") };
  } finally { clearTimeout(t); }
}
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "-", "&mdash;": "-", "&rupee;": "Rs", "&#8377;": "Rs" };
export const htmlToText = (h) => String(h)
  .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&[#\w]+;/g, (m) => ENT[m] ?? " ").replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
const links = (html, base) => [...new Set([...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)].map((m) => { try { const u = new URL(m[1], base); u.hash = ""; return u.host === base.host && /^https?:$/.test(u.protocol) && !/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js)$/i.test(u.pathname) ? u.toString() : null; } catch { return null; } }).filter(Boolean))];

export async function learnSite(start, maxPages = 6) {
  const first = await get(start), pages = [{ url: first.url.toString(), text: htmlToText(first.html) }];
  for (const l of links(first.html, first.url).slice(0, maxPages - 1)) { try { const p = await get(l); pages.push({ url: p.url.toString(), text: htmlToText(p.html) }); } catch { /* skip broken pages */ } }
  return pages.filter((p) => p.text.length > 80);
}
