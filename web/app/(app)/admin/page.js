"use client";
import { useState } from "react";
export default function Admin() {
  const [key, setKey] = useState(""), [d, setD] = useState(null), [err, setErr] = useState(""), [msg, setMsg] = useState("");
  const h = { "x-admin-key": key, "content-type": "application/json" };
  const load = () => { setErr(""); fetch("/api/pulse/admin/orgs", { headers: h }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message)); };
  const setPlan = (email, plan, days, product = "pulse") => fetch("/api/pulse/admin/plan", { method: "POST", headers: h, body: JSON.stringify({ email, plan, days, product }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsg(`${email}: ${j.plan} until ${new Date(j.paidUntil).toLocaleDateString()}`); load(); }).catch((e) => setErr(e.message));
  const S = { font: "14px system-ui, sans-serif", padding: 24, maxWidth: 1200, margin: "0 auto", color: "#0f172a" };
  const td = { fontSize: 13, padding: "8px 10px", borderTop: "1px solid #e2e8f0", textAlign: "left", verticalAlign: "top" };
  return (<main style={S}><h1 style={{ fontSize: 24 }}>Relay admin</h1>
    {!d && <div><input type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, marginRight: 8 }} /><button onClick={load} style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#2457f5", color: "#fff" }}>Open</button></div>}
    {err && <p style={{ color: "#dc2626" }}>{err}</p>}{msg && <p style={{ color: "#0a8f5c" }}>{msg}</p>}
    {d && <><p><b>{d.totals.customers}</b> customers · <b>{d.totals.paying}</b> paying now</p>
      <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}><thead><tr>{["Company", "Email", "Relay plan", "Mira plan", "Usage", "Billing", "Set Relay plan", "Set Mira plan"].map((x) => <th key={x} style={{ ...td, borderTop: 0 }}>{x}</th>)}</tr></thead><tbody>
        {d.orgs.map((o) => <tr key={o.id}><td style={td}>{o.company}</td><td style={td}>{o.email}{o.verified ? "" : " (unverified)"}</td><td style={td}>{o.plan}{o.status ? ` · ${o.status}` : ""}</td><td style={td}>{o.paidUntil ? "until " + new Date(o.paidUntil).toLocaleDateString() : ""}</td><td style={td}>{o.saathiPlan}{o.saathiPaidUntil ? " until " + new Date(o.saathiPaidUntil).toLocaleDateString() : ""}</td>
          <td style={td}>{o.contacts} contacts · {o.campaigns} campaigns{o.whatsapp ? " · WhatsApp" : ""}{o.social ? " · Social" : ""}</td><td style={td}>{o.billing ? `${o.billing.legalName}${o.billing.gstin ? " · " + o.billing.gstin : ""}` : "-"}</td>
          <td style={td}>{["starter", "growth"].map((p) => <button key={p} onClick={() => setPlan(o.email, p, 30)} style={{ marginRight: 6, padding: "4px 8px" }}>{p} 30d</button>)}<button onClick={() => setPlan(o.email, "trial", 1)} style={{ padding: "4px 8px" }}>Reset</button></td><td style={td}>{["starter", "growth"].map((p) => <button key={p} onClick={() => setPlan(o.email, p, 30, "saathi")} style={{ marginRight: 6, padding: "4px 8px" }}>{p} 30d</button>)}<button onClick={() => setPlan(o.email, "trial", 1, "saathi")} style={{ padding: "4px 8px" }}>Reset</button></td></tr>)}</tbody></table></div></>}
  </main>);
}
