"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./saathi.css";
import "./product-theme.css";
import { NAME, TAGLINE } from "@/lib/saathi";
import ART from "@/lib/art-saathi.json";
const Art = ({ k }) => <div dangerouslySetInnerHTML={{ __html: ART[k] }} style={{ display: "contents" }} />;

const tok = () => { try { return localStorage.getItem("wa_token"); } catch { return null; } }; // one TWWIOS account for all products
async function req(base, path, { method, body } = {}) {
  const r = await fetch(base + path, { method: method || (body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(tok() ? { authorization: "Bearer " + tok() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && tok()) { try { localStorage.removeItem("wa_token"); } catch {} window.dispatchEvent(new Event("wa-out")); }
  if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong"), { data: j });
  return j;
}
const call = (p, o) => req("/api/saathi", p, o), pcall = (p, o) => req("/api/pulse", p, o);
const when = (t) => (t ? new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const CH = { web: "Website", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", test: "Test" };

/* ---------- illustrations: line drawings in ink and orange ---------- */
const Ill = ({ kind }) => {
  const s = { fill: "none", stroke: "#15171c", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, o = { ...s, stroke: "#d9480f" };
  return (<svg viewBox="0 0 300 150" role="img" aria-hidden="true">
    {kind === "teach" && <><rect x="40" y="30" width="90" height="90" rx="6" {...s} /><path d="M56 56h58M56 72h58M56 88h38" {...s} /><path d="M150 75h48" {...o} /><path d="M188 65l12 10-12 10" {...o} /><circle cx="236" cy="75" r="30" {...s} /><path d="M224 70h24M224 80h14" {...o} /></>}
    {kind === "chat" && <><rect x="50" y="26" width="130" height="44" rx="8" {...s} /><path d="M70 48h70" {...s} /><rect x="120" y="82" width="130" height="44" rx="8" {...o} /><path d="M140 104h70" {...o} /><circle cx="36" cy="48" r="9" {...s} /><circle cx="264" cy="104" r="9" {...o} /></>}
    {kind === "grow" && <><path d="M40 118h220" {...s} /><path d="M56 104l50-28 40 14 70-52" {...o} /><circle cx="106" cy="76" r="5" {...s} /><circle cx="146" cy="90" r="5" {...s} /><circle cx="216" cy="38" r="6" {...o} /><path d="M56 118v-8M106 118v-8M146 118v-8M216 118v-8" {...s} /></>}
    {kind === "hero" && <><rect x="30" y="20" width="150" height="46" rx="8" {...s} /><path d="M48 38h80M48 50h50" {...s} /><rect x="120" y="78" width="150" height="46" rx="8" fill="#fff1e8" stroke="#d9480f" strokeWidth="2" /><path d="M138 96h90M138 108h60" {...o} /><circle cx="48" cy="100" r="12" {...s} /><path d="M42 100h12" {...s} /></>}
  </svg>);
};

/* ---------- sign in ---------- */
function Auth({ onIn }) {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams(), rt = q.get("reset");
  const [mode, setMode] = useState("signup"), [f, setF] = useState({ email: "", password: "", company: "" }), [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => { const v = q.get("verify"); if (v) pcall("/auth/verify", { body: { token: v } }).then(() => setNote("Email confirmed. You can sign in.")).catch((x) => setErr(x.message)); }, []);
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr(""); setNote("");
    try {
      if (rt) { await pcall("/auth/reset", { body: { token: rt, password: f.password } }); setNote("Password changed. Sign in with the new password."); window.history.replaceState({}, "", window.location.pathname); setMode("login"); }
      else if (mode === "forgot") setNote((await pcall("/auth/forgot", { body: { email: f.email } })).note);
      else { const j = await pcall("/auth/" + mode, { body: f }); localStorage.setItem("wa_token", j.token); onIn(); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<form className="st-card" onSubmit={go} id="start" style={{ marginBottom: 0 }}>
    <h2 style={{ fontSize: 22 }}>{rt ? "Set a new password" : mode === "login" ? "Sign in" : mode === "forgot" ? "Reset password" : "Create your account"}</h2>
    <p className="st-note" style={{ margin: "4px 0 0" }}>{mode === "signup" ? "Set up and test your assistant first. Subscribe when you are ready to switch it on for customers." : "Use your TWWIOS account."}</p>
    {mode === "signup" && !rt && <><label className="l" htmlFor="sc">Business name</label><input id="sc" value={f.company} onChange={set("company")} required minLength={2} /></>}
    {!rt && <><label className="l" htmlFor="se">Work email</label><input id="se" type="email" value={f.email} onChange={set("email")} required /></>}
    {mode !== "forgot" && <><label className="l" htmlFor="sp">{rt ? "New password" : "Password"}</label><input id="sp" type="password" value={f.password} onChange={set("password")} minLength={8} required /></>}
    {note && <div className="st-ok">{note}</div>}{err && <div className="st-err">{err}</div>}
    <div className="st-row" style={{ marginTop: 16 }}>
      <button className="st-btn ac" disabled={busy}>{rt ? "Save password" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}</button>
      {!rt && <button type="button" className="st-btn o" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "I have an account" : "New here"}</button>}
      {mode === "login" && !rt && <button type="button" className="st-btn o" onClick={() => setMode("forgot")}>Forgot password</button>}
    </div></form>);
}

/* ---------- landing ---------- */
function Landing({ onIn }) {
  const words = ["Answer", "Book", "Capture leads", "Follow up", "Never sleep"];
  return (<div className="st-wrap">
    <div className="st-hero"><div><div className="st-eyebrow">{NAME} by TWWIOS · {TAGLINE}</div>
      <h1>Your best salesperson <em>never sleeps.</em></h1>
      <p className="st-sub">Teach {NAME} your business in 10 minutes. It answers customers on WhatsApp, Instagram, Facebook and your website, in Hindi, English and Hinglish, and hands you the leads and bookings.</p>
      <a className="st-btn" href="#start">Get started</a> <a className="st-btn o" href="#price">See pricing</a>
      <div className="st-chans">{["WhatsApp", "Instagram", "Facebook", "Website chat"].map((c) => <span key={c} className="st-chip">{c}</span>)}</div></div>
      <div className="st-art"><Art k="orbs" /><div className="st-phone" aria-hidden="true"><div className="st-ph-h"><i></i>Sharma Dental</div><div className="st-ph-b">
        <div className="st-bub in">Teeth whitening ka rate kya hai?<small>10:02</small></div>
        <div className="st-bub">Whitening costs Rs 4,500 and takes about an hour. Want me to book a slot this week?<small>10:02 ✓✓</small></div>
        <div className="st-bub in">Haan, Friday 5pm. Naam Priya, 98765 12345<small>10:03</small></div>
        <div className="st-bub">Booked, Priya! See you Friday at 5pm.<small>10:03 ✓✓</small></div></div></div></div></div>
    <div className="st-band" aria-hidden="true"><div>{[...words, ...words, ...words, ...words].map((w, i) => <span key={i}>{w}</span>)}</div></div>
    <div className="st-steps3">{[["Teach it", "Paste your website link or upload your price list. It learns your services, prices and timings.", "wave"], ["Connect", "Add one line to your website, and connect WhatsApp, Instagram and Facebook.", "lines"], ["Collect", "Names, phone numbers and bookings arrive in your dashboard. You get an email when someone needs you.", "grid"]].map(([t, d, k], n) => <div key={t} className="st-s3"><div className="im"><Art k={k} /><b>{n + 1}</b></div><div className="t"><h3>{t}</h3><p>{d}</p></div></div>)}</div>
    <div className="st-sec"><h2>Why businesses pick {NAME}</h2><p>Built to be simpler and cheaper than the usual WhatsApp chatbot tools.</p>
      <table className="st-cmp"><thead><tr><th></th><th>Typical chatbot tools</th><th>{NAME}</th></tr></thead><tbody>
        {[["Setup", "Build question-and-answer flows by hand", "Paste your website link. Done in minutes"], ["Channels", "WhatsApp only, others cost extra", "WhatsApp, Instagram, Facebook and website chat in one price"], ["Team", "Fees per user or per agent", "No per-user or per-agent fees"], ["Language", "Hindi often needs separate flows", "Understands Hindi, English and Hinglish"], ["When it does not know", "Guesses or loops", "Says it will check, tells you, and you teach the answer in one tap"], ["Starts at", "Rs 3,000 to Rs 10,000 a month*", "Rs 1,499 a month"]].map((r) => <tr key={r[0]}><td><b>{r[0]}</b></td><td className="x">{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table>
      <p className="st-note" style={{ marginTop: 10 }}>*Public list prices of popular tools in India, which usually add user fees and message charges. Check current prices before you compare.</p></div>
    <div className="st-sec"><h2>Honest AI, not a guessing bot</h2><p>{NAME} answers only from what you taught it. If a customer asks something new, it does not make up an answer. It tells the customer you will reply, pings you, and adds the question to your "Unanswered" list. Type the answer once and it knows it forever.</p></div>
    <div className="st-sec" id="price"><h2>Simple pricing</h2><p>Prices exclude GST. Cancel any time. No setup fee. Set up and test your assistant first, pay only to switch it on for customers.</p>
      <div className="st-grid3">{[["Starter", "Rs 1,499", "2,000 customer replies a month", ["WhatsApp, Instagram, Facebook, website chat", "Leads and bookings", "Email alerts", "Take over any chat"], false], ["Growth", "Rs 3,499", "8,000 customer replies a month", ["Everything in Starter", "4 times the replies", "Best for busy shops and clinics"], true]].map(([n, p, r, l, h]) => <div key={n} className={"st-price" + (h ? " hot" : "")}><h3>{n}</h3><div><b>{p}</b> <small>/ month</small></div><p className="st-note" style={{ margin: "4px 0 0" }}>{r}</p><ul>{l.map((x) => <li key={x}>{x}</li>)}</ul><a className="st-btn" href="#start">Get started</a></div>)}</div></div>
    <div className="st-sec"><div className="st-start"><Auth onIn={onIn} /></div></div>
    <div className="st-foot"><span>{NAME} by TWWIOS Technologies Private Limited</span><span><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a></span></div></div>);
}

/* ---------- pages ---------- */
function Overview({ ov, go }) {
  const a = ov.acc, pct = Math.min(100, Math.round((a.used / a.cap) * 100)), S = ov.setup;
  const todo = [["Tell us about your business", S.profile, "teach"], ["Teach your assistant", S.knowledge, "teach"], ["Try it in the test chat", S.tested, "test"], ["Connect a channel", S.channel, "channels"], ["Subscribe to switch it on for customers", S.paid, "plan"]];
  return (<><h1>Overview</h1><p className="lead">Last 30 days.</p>
    {!ov.aiLive && <div className="st-card" style={{ background: "var(--tint)" }}><b>AI is not switched on for this server yet.</b> Answers use a basic matcher until the TWWIOS team adds the AI key. Replies will be much smarter once it is on.</div>}
    {a.plan === "none" && <div className="st-card" style={{ background: "var(--tint)" }}><b>Your assistant is not live yet.</b> Finish setting up and testing, then subscribe to switch it on for your customers. <button className="st-btn sm" onClick={() => go("plan")}>Choose a plan</button></div>}
    {a.plan !== "none" && !a.ok && <div className="st-card" style={{ background: "var(--tint)" }}><b>{a.expired ? "Your subscription has ended." : "You reached this month's reply limit."}</b> Your assistant is not replying. <button className="st-btn sm ac" onClick={() => go("plan")}>{a.expired ? "Renew" : "Upgrade"}</button></div>}
    <div className="st-stats">{[["Conversations", ov.conversations], ["Leads", ov.leads], ["Bookings", ov.bookings], ["Waiting for you", ov.handoffs]].map(([k, v]) => <div key={k} className="st-stat"><b>{v}</b><span>{k}</span></div>)}</div>
    {a.plan !== "none" && <div className="st-card"><b>{a.used} of {a.cap}</b> replies used this month <span className="st-tag ac">{a.label}</span><div className="st-meter"><i style={{ width: pct + "%" }} /></div></div>}
    <div className="st-card"><h3 style={{ marginBottom: 6 }}>Get live</h3>{todo.map(([t, d, tab]) => <div key={t} className={"st-todo" + (d ? " on" : "")}><i>{d ? "✓" : ""}</i><span>{t}</span>{!d && <button className="st-btn o sm" onClick={() => go(tab)}>Open</button>}</div>)}</div>
    {ov.gaps > 0 && <div className="st-card"><b>{ov.gaps} customer question{ov.gaps > 1 ? "s" : ""} your assistant could not answer.</b> <button className="st-btn sm" onClick={() => go("gaps")}>Teach the answers</button></div>}</>);
}

function Teach({ reload }) {
  const [s, setS] = useState(null), [docs, setDocs] = useState([]), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [url, setUrl] = useState(""), [t, setT] = useState({ title: "", text: "" }), [busy, setBusy] = useState(false);
  const load = () => { call("/settings").then((j) => setS(j.settings)); call("/kb").then((j) => setDocs(j.docs)); };
  useEffect(load, []);
  const up = (k) => (e) => setS({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = () => { setErr(""); setMsg(""); call("/settings", { method: "PUT", body: { businessName: s.businessName || "", about: s.about || "", hours: s.hours || "", tone: s.tone, greeting: s.greeting || "", ownerEmail: s.ownerEmail || "", bookingEnabled: s.bookingEnabled !== false, enabled: s.enabled !== false } }).then(() => { setMsg("Saved."); reload(); }).catch((x) => setErr(x.message)); };
  const learn = () => { setErr(""); setMsg(""); setBusy(true); call("/kb/url", { body: { url } }).then((j) => { setMsg(`Learned ${j.pages} page${j.pages > 1 ? "s" : ""} from your website.`); setUrl(""); load(); reload(); }).catch((x) => setErr(x.message)).finally(() => setBusy(false)); };
  const addText = () => { setErr(""); call("/kb", { body: t }).then(() => { setT({ title: "", text: "" }); setMsg("Added."); load(); reload(); }).catch((x) => setErr(x.message)); };
  const file = (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return; setErr("");
    const done = (text) => call("/kb", { body: { title: f.name, text } }).then(() => { setMsg(`Added ${f.name}.`); load(); reload(); }).catch((x) => setErr(x.message));
    if (/\.xlsx$/i.test(f.name)) import("read-excel-file").then(({ default: rx }) => rx(f)).then((rows) => done(rows.map((r) => r.filter((c) => c !== null && c !== "").join(", ")).filter(Boolean).join("\n\n"))).catch(() => setErr("Could not read this Excel file."));
    else if (/\.(txt|md|csv)$/i.test(f.name)) f.text().then(done);
    else setErr("Please upload .xlsx, .csv or .txt. For a PDF, copy the text and paste it below.");
  };
  if (!s) return null;
  return (<><h1>Teach your assistant</h1><p className="lead">It answers only from what you put here.</p>
    <div className="st-card"><h3>1. Your business</h3>
      <label className="l" htmlFor="bn">Business name</label><input id="bn" value={s.businessName || ""} onChange={up("businessName")} />
      <label className="l" htmlFor="ba">What you do, in two or three lines</label><textarea id="ba" value={s.about || ""} onChange={up("about")} placeholder="Family dental clinic in Pune Camp. Whitening, root canal, implants and braces." />
      <label className="l" htmlFor="bh">Opening hours</label><input id="bh" value={s.hours || ""} onChange={up("hours")} placeholder="Mon to Sat, 10am to 7pm" />
      <label className="l" htmlFor="bt">Tone</label><select id="bt" value={s.tone} onChange={up("tone")}><option value="friendly">Warm and friendly</option><option value="formal">Polite and formal</option></select>
      <label className="l" htmlFor="bg">First message on your website chat</label><input id="bg" value={s.greeting || ""} onChange={up("greeting")} />
      <label className="l" htmlFor="bo">Email for alerts (bookings, customers who need you)</label><input id="bo" type="email" value={s.ownerEmail || ""} onChange={up("ownerEmail")} placeholder="Defaults to your login email" />
      <label className="st-row" style={{ marginTop: 14 }}><input type="checkbox" style={{ width: "auto" }} checked={s.bookingEnabled !== false} onChange={up("bookingEnabled")} /> Take bookings in chat</label>
      <label className="st-row" style={{ marginTop: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={s.enabled !== false} onChange={up("enabled")} /> Assistant is on (turn off to pause all replies)</label>
      <div style={{ marginTop: 14 }}><button className="st-btn" onClick={save}>Save</button></div></div>
    <div className="st-card"><h3>2. What it should know</h3>
      <label className="l" htmlFor="ul">Learn from your website (fastest)</label><div className="st-row"><input id="ul" style={{ flex: 1, minWidth: 220 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourclinic.in" /><button className="st-btn ac" disabled={busy || !url} onClick={learn}>{busy ? "Reading…" : "Learn"}</button></div>
      <label className="l" htmlFor="fl">Or upload a price list or FAQ (.xlsx, .csv, .txt)</label><input id="fl" type="file" accept=".xlsx,.csv,.txt,.md" onChange={file} />
      <label className="l" htmlFor="tt">Or paste text</label><input id="tt" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="Title, for example Price list" /><textarea value={t.text} onChange={(e) => setT({ ...t, text: e.target.value })} aria-label="Text to learn" placeholder="Teeth whitening costs Rs 4500 and takes one hour." style={{ marginTop: 6 }} />
      <div style={{ marginTop: 10 }}><button className="st-btn" disabled={!t.title || t.text.length < 10} onClick={addText}>Add</button></div></div>
    {msg && <div className="st-ok">{msg}</div>}{err && <div className="st-err">{err}</div>}
    <div className="st-card" style={{ marginTop: 16 }}><h3 style={{ marginBottom: 8 }}>Learned so far ({docs.length})</h3>{docs.length === 0 && <p className="st-note" style={{ margin: 0 }}>Nothing yet.</p>}
      {docs.map((d) => <div key={d.id} className="st-todo"><span><b>{d.title}</b> <span className="st-tag">{d.source}</span><span className="st-note"> {d.chars.toLocaleString()} characters</span></span><button className="st-btn o sm" onClick={() => call("/kb/" + d.id + "/delete", { body: {} }).then(() => { load(); reload(); })}>Delete</button></div>)}</div></>);
}

function Test({ reload }) {
  const [sid, setSid] = useState(() => "t" + Math.random().toString(36).slice(2, 10)), [log, setLog] = useState([]), [v, setV] = useState(""), [busy, setBusy] = useState(false), end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [log]);
  const send = async (e) => { e.preventDefault(); const text = v.trim(); if (!text) return; setV(""); setLog((l) => [...l, { me: true, text }]); setBusy(true);
    try { const r = await call("/test", { body: { text, sid } }); setLog((l) => [...l, { text: r.reply || "(no reply: " + (r.silent || "silent").replace(/_/g, " ") + ")", meta: r.answered === false ? "Not in your information, would be handed to you" : r.engine === "basic" ? "Basic matcher (AI key not set)" : "" }]); reload(); } catch (x) { setLog((l) => [...l, { text: x.message, meta: "error" }]); }
    setBusy(false); };
  return (<><h1>Test your assistant</h1><p className="lead">Chat as a customer would. Test chats never reach your real customers.</p>
    <div className="st-card" style={{ padding: 0 }}><div className="st-chat" style={{ minHeight: 280 }}>{log.length === 0 && <span className="st-note">Try: "What are your timings?" or "Teeth whitening ka kya rate hai?"</span>}
      {log.map((m, i) => <div key={i} className={"st-msg" + (m.me ? " out" : "")}>{m.text}{m.meta && <small>{m.meta}</small>}</div>)}<div ref={end} /></div>
      <form onSubmit={send} className="st-row" style={{ padding: 12, borderTop: "1px solid var(--line)", flexWrap: "nowrap" }}><input aria-label="Message" value={v} onChange={(e) => setV(e.target.value)} placeholder="Type a customer message" /><button className="st-btn" disabled={busy}>Send</button><button type="button" className="st-btn o" onClick={() => { call("/test/reset", { body: { sid } }); setSid("t" + Math.random().toString(36).slice(2, 10)); setLog([]); }}>New chat</button></form></div></>);
}

function Gaps({ reload }) {
  const [g, setG] = useState(null), [ans, setAns] = useState({}), [err, setErr] = useState("");
  const load = () => call("/gaps").then((j) => setG(j.gaps));
  useEffect(() => { load(); }, []);
  if (!g) return null;
  return (<><h1>Unanswered questions</h1><p className="lead">Things customers asked that your assistant did not know. Type the answer once and it learns it.</p>
    {g.length === 0 && <div className="st-card">Nothing here. Your assistant answered everything it was asked.</div>}{err && <div className="st-err">{err}</div>}
    {g.map((x) => <div key={x._id} className="st-card"><b>"{x.question}"</b> <span className="st-tag">{CH[x.channel]}</span>{x.count > 1 && <span className="st-tag ac">asked {x.count} times</span>}
      <textarea aria-label={"Answer to " + x.question} style={{ marginTop: 10, minHeight: 70 }} value={ans[x._id] || ""} onChange={(e) => setAns({ ...ans, [x._id]: e.target.value })} placeholder="Type the answer" />
      <div className="st-row" style={{ marginTop: 8 }}><button className="st-btn ac" disabled={(ans[x._id] || "").trim().length < 2} onClick={() => call("/gaps/" + x._id + "/answer", { body: { answer: ans[x._id] } }).then(() => { load(); reload(); }).catch((e) => setErr(e.message))}>Teach this answer</button><button className="st-btn o" onClick={() => call("/gaps/" + x._id + "/dismiss", { body: {} }).then(() => { load(); reload(); })}>Ignore</button></div></div>)}</>);
}

function Inbox() {
  const [ts, setTs] = useState(null), [sel, setSel] = useState(null), [txt, setTxt] = useState(""), [err, setErr] = useState("");
  const load = useCallback(() => call("/threads").then((j) => { setTs(j.threads); setSel((s) => s || j.threads[0]?._id || null); }), []);
  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  if (!ts) return null;
  const t = ts.find((x) => x._id === sel);
  return (<><h1>Conversations</h1><p className="lead">Chats where the assistant stopped are marked "Needs you". Reply to take over, then hand back.</p>
    {ts.length === 0 ? <div className="st-card">No conversations yet. Connect a channel or add the chat to your website.</div> :
      <div className="st-inbox"><div className="st-tl">{ts.map((x) => <button key={x._id} aria-current={x._id === sel} onClick={() => { setSel(x._id); setErr(""); }}><b>{x.lead?.name || x.name || "Customer"}</b> <span className="st-tag">{CH[x.channel]}</span>{x.humanOnly && <span className="st-tag ac">Needs you</span>}<div className="st-note" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.messages[x.messages.length - 1]?.text}</div></button>)}</div>
        {t && <div><div className="st-chat">{(t.lead?.phone || t.lead?.email || t.lead?.need) && <div className="st-note">{[t.lead.phone, t.lead.email, t.lead.need && "Wants: " + t.lead.need].filter(Boolean).join(" · ")}</div>}{t.handoffWhy && t.humanOnly && <div className="st-note"><b>Why:</b> {t.handoffWhy}</div>}
          {t.messages.map((m) => <div key={m._id} className={"st-msg" + (m.dir === "out" ? " out" : "")}>{m.text}<small>{m.dir === "out" ? (m.human ? "You" : "Assistant") : "Customer"} · {when(m.ts)}</small></div>)}</div>
          <div style={{ padding: 12, borderTop: "1px solid var(--line)" }}><div className="st-row" style={{ flexWrap: "nowrap" }}><input aria-label="Your reply" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Reply as yourself" /><button className="st-btn" disabled={!txt.trim()} onClick={() => call("/reply", { body: { threadId: t._id, text: txt } }).then(() => { setTxt(""); setErr(""); load(); }).catch((x) => setErr(x.message))}>Send</button></div>
            <div className="st-row" style={{ marginTop: 8 }}>{t.humanOnly ? <button className="st-btn o sm" onClick={() => call(`/threads/${t._id}/takeover`, { body: { on: false } }).then(load)}>Hand back to assistant</button> : <button className="st-btn o sm" onClick={() => call(`/threads/${t._id}/takeover`, { body: { on: true } }).then(load)}>Take over this chat</button>}</div>{err && <div className="st-err">{err}</div>}</div></div>}</div>}</>);
}

function Leads() {
  const [l, setL] = useState(null), [b, setB] = useState([]);
  const load = () => { call("/leads").then((j) => setL(j.leads)); call("/bookings").then((j) => setB(j.bookings)); };
  useEffect(load, []);
  const csv = () => { const rows = [["Name", "Phone", "Email", "Wants", "Channel", "Last seen"], ...l.map((x) => [x.name, x.phone, x.email, x.need, CH[x.channel], x.at])]; const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "saathi-leads.csv"; a.click(); };
  if (!l) return null;
  return (<><h1>Leads and bookings</h1><p className="lead">Collected automatically from chats.</p>
    <div className="st-card"><div className="st-row" style={{ justifyContent: "space-between" }}><h3>Bookings ({b.length})</h3></div>
      {b.length === 0 ? <p className="st-note">No bookings yet.</p> : <div style={{ overflowX: "auto" }}><table className="st-table"><thead><tr><th>Customer</th><th>Service</th><th>When</th><th>Status</th></tr></thead><tbody>{b.map((x) => <tr key={x._id}><td>{x.name || "-"}<div className="st-note">{x.phone}</div></td><td>{x.service}</td><td>{x.date} {x.time}</td><td><select aria-label="Status" value={x.status} onChange={(e) => call(`/bookings/${x._id}/status`, { body: { status: e.target.value } }).then(load)} style={{ width: "auto" }}>{["new", "confirmed", "done", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>}</div>
    <div className="st-card"><div className="st-row" style={{ justifyContent: "space-between" }}><h3>Leads ({l.length})</h3>{l.length > 0 && <button className="st-btn o sm" onClick={csv}>Download Excel/CSV</button>}</div>
      {l.length === 0 ? <p className="st-note">No leads yet. They appear when a customer shares a name, phone or email.</p> : <div style={{ overflowX: "auto" }}><table className="st-table"><thead><tr><th>Name</th><th>Contact</th><th>Wants</th><th>From</th></tr></thead><tbody>{l.map((x) => <tr key={x.id}><td>{x.name || "-"}</td><td>{x.phone}<div className="st-note">{x.email}</div></td><td>{x.need}</td><td><span className="st-tag">{CH[x.channel]}</span></td></tr>)}</tbody></table></div>}</div></>);
}

function loadFB(cfg) { return new Promise((ok) => { if (window.FB) return ok(); window.fbAsyncInit = () => { window.FB.init({ appId: cfg.fbAppId, version: cfg.graphVersion, xfbml: false }); ok(); }; const s = document.createElement("script"); s.src = "https://connect.facebook.net/en_US/sdk.js"; s.async = true; document.body.appendChild(s); }); }
function Channels({ reload }) {
  const [w, setW] = useState(null), [me, setMe] = useState(null), [soc, setSoc] = useState(null), [cfg, setCfg] = useState(null), [pages, setPages] = useState(null), [ut, setUt] = useState(""), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [man, setMan] = useState({ phoneId: "", wabaId: "", token: "" }), [copied, setCopied] = useState(false);
  const load = () => { call("/widget").then(setW); pcall("/me").then(setMe); pcall("/social").then(setSoc); pcall("/config").then(setCfg); };
  useEffect(load, []);
  const oneClick = !!(cfg?.fbAppId && cfg?.configId);
  const waFb = async () => { setErr(""); await loadFB(cfg); const ids = {}; const on = (e) => { try { if (!new URL(e.origin).hostname.endsWith("facebook.com")) return; const d = JSON.parse(e.data); if (d.type === "WA_EMBEDDED_SIGNUP" && d.event === "FINISH") Object.assign(ids, d.data); } catch {} }; window.addEventListener("message", on);
    window.FB.login((r) => { const code = r.authResponse?.code; if (!code) { window.removeEventListener("message", on); return setErr("Facebook sign-in was cancelled."); } let n = 0; const t = setInterval(async () => { n++; if (ids.phone_number_id || n > 20) { clearInterval(t); window.removeEventListener("message", on); if (!ids.phone_number_id) return setErr("Setup did not finish. Please try again."); try { const j = await pcall("/wa/embedded", { body: { code, wabaId: ids.waba_id, phoneId: ids.phone_number_id } }); setMsg(`WhatsApp connected: ${j.number}.`); load(); reload(); } catch (x) { setErr(x.message); } } }, 300); }, { config_id: cfg.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "", sessionInfoVersion: "3" } }); };
  const waMan = () => { setErr(""); pcall("/wa/connect", { body: man }).then((j) => { setMsg(`WhatsApp connected: ${j.number}.`); load(); reload(); }).catch((x) => setErr(x.message)); };
  const socFb = async () => { setErr(""); await loadFB(cfg); window.FB.login((r) => { const t = r.authResponse?.accessToken; if (!t) return setErr("Facebook sign-in was cancelled."); setUt(t); pcall("/social/fb/pages", { body: { userToken: t } }).then((j) => setPages(j.pages)).catch((x) => setErr(x.message)); }, { scope: "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_manage_engagement,instagram_basic,instagram_manage_messages,instagram_manage_comments,business_management" }); };
  const pick = (id) => pcall("/social/connect", { body: { pageId: id, userToken: ut } }).then((j) => { setMsg(`Connected ${j.page}${j.instagram ? " and Instagram @" + j.instagram : ""}.`); setPages(null); load(); reload(); }).catch((x) => setErr(x.message));
  return (<><h1>Channels</h1><p className="lead">Where your assistant talks to customers. All included in your plan.</p>
    <div className="st-card"><h3>Website chat <span className="st-tag ac">Works right away</span></h3><p className="st-note">Paste this line before the closing body tag of your website. Works on any site, including WordPress, Shopify and Wix.</p>
      {w && <><pre>{w.snippet}</pre><button className="st-btn o sm" onClick={() => { navigator.clipboard?.writeText(w.snippet); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></>}</div>
    <div className="st-card"><h3>WhatsApp {me?.wa?.connected && <span className="st-tag ac">Connected {me.wa.number}</span>}</h3>
      <p className="st-note">Your assistant replies when a customer messages your WhatsApp Business number first. Bulk sending is a separate product, Relay.</p>
      {!me?.wa?.connected && oneClick && <button className="st-btn ac" onClick={waFb}>Connect WhatsApp</button>}
      {!me?.wa?.connected && <details style={{ marginTop: 10 }} open={!oneClick}><summary style={{ cursor: "pointer", fontWeight: 600 }}>Connect with tokens (advanced)</summary>
        <label className="l" htmlFor="wp">Phone number ID</label><input id="wp" value={man.phoneId} onChange={(e) => setMan({ ...man, phoneId: e.target.value })} /><label className="l" htmlFor="ww">WhatsApp Business Account ID</label><input id="ww" value={man.wabaId} onChange={(e) => setMan({ ...man, wabaId: e.target.value })} /><label className="l" htmlFor="wt">Access token</label><input id="wt" type="password" autoComplete="off" value={man.token} onChange={(e) => setMan({ ...man, token: e.target.value })} />
        <div style={{ marginTop: 10 }}><button className="st-btn" onClick={waMan}>Connect</button></div><p className="st-note">Webhook for Meta: <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/pulse/webhook</code></p></details>}</div>
    <div className="st-card"><h3>Instagram and Facebook {soc?.connected && <span className="st-tag ac">Connected {soc.page?.name}{soc.page?.igUsername ? " · @" + soc.page.igUsername : ""}</span>}</h3>
      <p className="st-note">Replies to people who message your Instagram or Facebook Page. (Comment-to-DM campaigns are in Relay.)</p>
      {!soc?.connected && cfg?.fbAppId && <button className="st-btn ac" onClick={socFb}>Connect Facebook and Instagram</button>}
      {!soc?.connected && !cfg?.fbAppId && <p className="st-note">One-click connect is not switched on yet. Ask the TWWIOS team to finish Meta setup.</p>}
      {pages && <div style={{ marginTop: 10 }}>{pages.map((p) => <div key={p.id} className="st-todo"><span>{p.name}{p.ig ? ` · Instagram @${p.ig}` : ""}</span><button className="st-btn o sm" onClick={() => pick(p.id)}>Use this</button></div>)}</div>}</div>
    {msg && <div className="st-ok">{msg}</div>}{err && <div className="st-err">{err}</div>}</>);
}

function Plan({ ov, reload }) {
  const [b, setB] = useState(null), [d, setD] = useState({ legalName: "", gstin: "", address: "", state: "" }), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const load = () => call("/billing").then(setB);
  useEffect(() => { load(); pcall("/billing/details").then((j) => setD((x) => ({ ...x, ...j.details }))).catch(() => {}); }, []);
  const saveD = () => { setErr(""); pcall("/billing/details", { method: "PUT", body: d }).then(() => { setMsg("Billing details saved."); load(); }).catch((x) => setErr(x.message)); };
  async function buy(plan) {
    setErr(""); setMsg("");
    try {
      const j = await call("/billing/checkout", { body: { plan } });
      await new Promise((ok, no) => { if (window.Razorpay) return ok(); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = () => no(new Error("Could not load the payment window.")); document.body.appendChild(s); });
      new window.Razorpay({ key: j.keyId, subscription_id: j.subscriptionId, name: NAME + " by TWWIOS", description: plan + " plan, monthly", handler: () => { setMsg("Payment received. Your plan switches on in a few seconds."); setTimeout(() => { reload(); load(); }, 4000); }, theme: { color: "#d9480f" } }).open();
    } catch (x) { setErr(x.message); }
  }
  if (!b) return null;
  const c = b.current, until = c.paidUntil ? new Date(c.paidUntil).toLocaleDateString() : null;
  return (<><h1>Plan and billing</h1><p className="lead">{NAME} has its own subscription, separate from other TWWIOS products.</p>
    <div className="st-card"><b>{b.plans[c.plan]?.label}</b>{until ? ` · paid until ${until}` : ""}{b.cancelling ? " · will not renew" : ""}<div className="st-meter"><i style={{ width: Math.min(100, (c.used / c.cap) * 100) + "%" }} /></div>{c.plan !== "none" ? <span className="st-note">{c.used} of {c.cap} replies used this month</span> : <span className="st-note">Subscribe to switch your assistant on for customers.</span>}</div>
    <div className="st-grid3">{["starter", "growth"].map((p) => <div key={p} className={"st-price" + (c.plan === p ? " hot" : "")}><h3>{b.plans[p].label}</h3><div><b>Rs {b.plans[p].price.toLocaleString()}</b> <small>/ month + GST</small></div><p className="st-note">{b.plans[p].replies.toLocaleString()} replies a month, all channels</p><button className="st-btn ac" onClick={() => buy(p)}>{c.plan === p && until ? "Renew" : "Choose"} {b.plans[p].label}</button></div>)}</div>
    {c.plan !== "trial" && !b.cancelling && <p><button className="st-btn o sm" onClick={() => call("/billing/cancel", { body: {} }).then((j) => { setMsg(j.note); load(); })}>Cancel renewal</button></p>}
    <div className="st-card" style={{ marginTop: 16 }}><h3>Billing details (for your GST invoice)</h3>
      <label className="l" htmlFor="gl">Company legal name</label><input id="gl" value={d.legalName} onChange={(e) => setD({ ...d, legalName: e.target.value })} />
      <label className="l" htmlFor="gg">GSTIN (optional)</label><input id="gg" maxLength={15} value={d.gstin} onChange={(e) => setD({ ...d, gstin: e.target.value.toUpperCase() })} />
      <label className="l" htmlFor="ga">Address</label><input id="ga" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
      <label className="l" htmlFor="gs">State</label><input id="gs" value={d.state} onChange={(e) => setD({ ...d, state: e.target.value })} />
      <div style={{ marginTop: 12 }}><button className="st-btn" onClick={saveD}>Save details</button></div></div>
    {msg && <div className="st-ok">{msg}</div>}{err && <div className="st-err">{err}</div>}</>);
}

/* ---------- app ---------- */
export default function SaathiApp() {
  const [authed, setAuthed] = useState(null), [tab, setTab] = useState("overview"), [ov, setOv] = useState(null), [email, setEmail] = useState("");
  const reload = useCallback(() => call("/overview").then((j) => { setOv(j); setAuthed(true); }).catch(() => setAuthed(false)), []);
  useEffect(() => { reload(); pcall("/me").then((m) => setEmail(m.email)).catch(() => {}); const o = () => setAuthed(false); window.addEventListener("wa-out", o); return () => window.removeEventListener("wa-out", o); }, [reload]);
  useEffect(() => { if (authed) reload(); }, [tab]); // eslint-disable-line
  const nav = [["overview", "Overview"], ["teach", "Teach"], ["test", "Test chat"], ["inbox", "Conversations", ov?.handoffs], ["leads", "Leads and bookings"], ["gaps", "Unanswered", ov?.gaps], ["channels", "Channels"], ["plan", "Plan and billing"]];
  return (<div className="st"><header className="st-top"><a className="st-brand" href="/solutions/saathi"><i></i>{NAME} <small>by TWWIOS</small></a>
    <div className="st-row">{authed ? <><span className="st-note">{email}</span><button className="st-btn o sm" onClick={() => { try { localStorage.removeItem("wa_token"); } catch {} setAuthed(false); }}>Sign out</button></> : <a className="st-btn o sm" href="/">TWWIOS home</a>}</div></header>
    {authed === null && <div className="st-wrap" style={{ padding: 40 }}>Loading…</div>}
    {authed === false && <Landing onIn={() => { reload(); }} />}
    {authed && ov && <div className="st-app"><nav className="st-nav" aria-label="Mira sections">{nav.map(([k, l, n]) => <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>{l}{n > 0 && <span className="n">{n}</span>}</button>)}</nav>
      <main className="st-main">{tab === "overview" && <Overview ov={ov} go={setTab} />}{tab === "teach" && <Teach reload={reload} />}{tab === "test" && <Test reload={reload} />}{tab === "inbox" && <Inbox />}{tab === "leads" && <Leads />}{tab === "gaps" && <Gaps reload={reload} />}{tab === "channels" && <Channels reload={reload} />}{tab === "plan" && <Plan ov={ov} reload={reload} />}</main></div>}
  </div>);
}
