"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AGENT_LIST } from "@/lib/agents";

export default function DemoModal({ open, onClose }) {
  const [state, setState] = useState({ status: "idle", err: "", ref: "", name: "" });
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; if (open) setState({ status: "idle", err: "", ref: "", name: "" }); }, [open]);
  if (!open) return null;
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setState((s) => ({ ...s, status: "loading", err: "" }));
    try { const r = await api("/demo-requests", { method: "POST", body: f }); setState({ status: "done", err: "", ref: r.reference, name: f.name }); }
    catch (er) { setState((s) => ({ ...s, status: "idle", err: er.message })); }
  }
  return (
    <div id="tw-modal" className="open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div id="tw-card">
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
        {state.status === "done" ? (
          <div className="ok"><i>✓</i><h3>Request received</h3><p className="s">Thanks, {state.name}. We will confirm your slot by email.<br />Reference <b>{state.ref}</b></p><button className="go" style={{ maxWidth: 220 }} onClick={onClose}>Done</button></div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3>Book a demo</h3><p className="s">A 30-minute walkthrough tailored to your team and workflows.</p>
            <div className="r2"><div><label>Full name *</label><input name="name" autoComplete="name" /></div><div><label>Work email *</label><input name="email" type="email" autoComplete="email" /></div></div>
            <div className="r2"><div><label>Company *</label><input name="company" autoComplete="organization" /></div><div><label>Team size</label><select name="size"><option>1–50</option><option>51–200</option><option>201–1,000</option><option>1,000+</option></select></div></div>
            <label>Agent you want to see</label><select name="agent">{AGENT_LIST.map((a) => <option key={a}>{a}</option>)}</select>
            <div className="r2"><div><label>Preferred date</label><input name="date" type="date" min={tomorrow} defaultValue={tomorrow} /></div><div><label>Time</label><select name="time"><option>Morning (9–12)</option><option>Afternoon (12–5)</option><option>Evening (5–8)</option></select></div></div>
            <label>Anything we should know?</label><textarea name="message" rows={3} />
            <div className="err">{state.err}</div>
            <button type="submit" className="go" disabled={state.status === "loading"}>{state.status === "loading" ? "Sending…" : "Request demo"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
