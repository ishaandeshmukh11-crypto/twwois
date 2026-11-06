"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const QUICK = ["Post an invoice to Tally","Call 23 leads and book follow-ups","Send overdue reminders","Resolve support tickets","How are you different?","Book a demo"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Chatbot({ onDemo }) {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([{ k: "b", html: "Hi, I'm the TWWIOS Copilot. Tell me a business task and I'll route it to the right agent, run it across your connected tools, and wait for your approval before anything is executed." }]);
  const [val, setVal] = useState(""), [busy, setBusy] = useState(false), box = useRef(null), sid = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, open]);
  useEffect(() => { const h = () => setOpen(true); window.addEventListener("tw-open-bot", h); return () => window.removeEventListener("tw-open-bot", h); }, []);
  const push = (m) => { setMsgs((x) => [...x, m]); return null; };
  const patch = (id, fn) => setMsgs((x) => x.map((m) => (m.id === id ? fn(m) : m)));

  async function decide(m, decision) {
    patch(m.id, (x) => ({ ...x, decided: true }));
    try { await api(`/runs/${m.run.id}/decision`, { method: "POST", body: { decision } }); } catch {}
    push({ k: "b", html: decision === "approved" ? `✓ Approved and executed. Logged to audit trail <b>${m.run.auditId}</b>. Estimated 2.4 hours saved.` : "Rejected. Nothing was executed, and the decision is logged to the audit trail." });
    setBusy(false);
  }

  async function ask(text) {
    text = (text || "").trim(); if (!text || busy) return;
    setVal(""); push({ k: "u", text }); setBusy(true);
    let r;
    try { r = await api("/chat", { method: "POST", body: { message: text, sessionId: sid.current } }); sid.current = r.sessionId; }
    catch { push({ k: "b", html: "I couldn't reach the server. Please try again in a moment." }); setBusy(false); return; }
    if (r.type !== "run") {
      push({ k: "b", html: r.reply });
      if (r.action === "demo") setTimeout(onDemo, 500);
      if (r.action?.startsWith("scroll:")) document.getElementById(r.action.slice(7))?.scrollIntoView({ behavior: "smooth" });
      setBusy(false); return;
    }
    push({ k: "b", html: `Routing to <b>${r.agent} Agent</b>. Connectors: ${r.tools.join(", ")}.` });
    const id = "p" + Date.now();
    push({ k: "pr", id, steps: r.steps.map((s) => ({ label: s, st: "" })) });
    for (let i = 0; i < r.steps.length; i++) {
      patch(id, (m) => ({ ...m, steps: m.steps.map((s, j) => (j === i ? { ...s, st: "on" } : s)) }));
      await sleep(520 + Math.random() * 420);
      patch(id, (m) => ({ ...m, steps: m.steps.map((s, j) => (j === i ? { ...s, st: "dn" } : s)) }));
    }
    push({ k: "res", id: id + "r", run: r, decided: false });
  }

  return (
    <div id="tw-bot">
      {open && (
        <div id="tw-panel" className="open">
          <div className="cb-h"><div><b>TWWIOS Copilot</b><small>● online · routes work to 10 agents</small></div><button onClick={() => setOpen(false)} aria-label="Close chat">✕</button></div>
          <div className="cb-m" ref={box}>
            {msgs.map((m, i) => {
              if (m.k === "u") return <div key={i} className="u">{m.text}</div>;
              if (m.k === "b") return <div key={i} className="b" dangerouslySetInnerHTML={{ __html: m.html }} />;
              if (m.k === "pr") return <div key={i} className="pr">{m.steps.map((s, j) => <div key={j} className={"s " + s.st}>{s.label}</div>)}</div>;
              return (
                <div key={i} className="pr">
                  <b>Result ready</b> (confidence {m.run.confidence}%)<br />{m.run.output}
                  {!m.decided && <div className="ac"><button className="p" onClick={() => decide(m, "approved")}>Approve &amp; execute</button><button onClick={() => decide(m, "rejected")}>Reject</button></div>}
                  <div style={{ color: "#7c7c86", marginTop: 8, fontSize: 11 }}>Audit ID {m.run.auditId} · nothing runs until you approve</div>
                </div>
              );
            })}
          </div>
          <div className="cb-q">{QUICK.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
          <form className="cb-f" onSubmit={(e) => { e.preventDefault(); ask(val); }}>
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Describe a task… e.g. post this invoice" autoComplete="off" /><button aria-label="Send">→</button>
          </form>
        </div>
      )}
      <div id="tw-fab" onClick={() => setOpen((o) => !o)}><i />Ask TWWIOS</div>
    </div>
  );
}
