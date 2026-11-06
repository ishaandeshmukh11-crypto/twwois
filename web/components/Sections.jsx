"use client";
import { useEffect, useRef, useState } from "react";
import { WALL } from "@/lib/agents";
import LOGOS_DATA from "@/lib/logos.json";
import { api } from "@/lib/api";

const fmt = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function Band({ items, light }) {
  const row = [...items, ...items, ...items].map((x, i) => (<span key={i}><b>{x}</b><em /></span>));
  return <div className={"tw-band" + (light ? " k" : "")}><div>{row}</div></div>;
}

export function Clients() {
  const names = ["Northwind Retail","Helix Health","Kestrel Logistics","Meridian Pharma","Atlas Finance","Zenith Hotels","Forge Industries","Orbit Telecom"];
  return (
    <div className="tw-wrap">
      <div className="tw-label">Trusted by operations teams across industries</div>
      <div className="tw-marq"><div className="tw-track">{[...names, ...names].map((n, i) => <span key={i}><i />{n}</span>)}</div></div>
    </div>
  );
}

export function StatBanner() {
  const [stats, setStats] = useState({ tasks: 12865, agents: 214 });
  useEffect(() => {
    api("/stats").then((s) => setStats({ tasks: s.tasksToday, agents: s.agentsRunning })).catch(() => {});
    const t = setInterval(() => setStats((s) => ({ ...s, tasks: s.tasks + Math.ceil(Math.random() * 4) })), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tw-wrap">
      <div className="tw-stat">
        <h2>Work that runs itself.<br />Impact that compounds.</h2>
        <div className="tw-nums">
          <div><b>{fmt(stats.tasks)}</b><small>Tasks automated today</small></div>
          <div><b>{stats.agents}</b><small>Agents running now</small></div>
          <div><b>2.4</b><small>Hours saved per task</small></div>
          <div><b>44ms</b><small>Avg latency</small></div>
        </div>
      </div>
    </div>
  );
}

function LiveCard({ a, i }) {
  const [n, setN] = useState(800 + i * 377), [p, setP] = useState(0), [t, setT] = useState(0), [ms, setMs] = useState(40), [sp, setSp] = useState(Array(14).fill(50));
  useEffect(() => {
    const s = setInterval(() => setP((x) => { if (x + 8 + Math.random() * 14 >= 100) { setN((v) => v + 1 + Math.floor(Math.random() * 3)); setT((v) => v + 1); return 0; } return x + 8 + Math.random() * 14; }), 650 + i * 90);
    const q = setInterval(() => { setSp(Array.from({ length: 14 }, () => 20 + Math.random() * 80)); setMs(28 + Math.floor(Math.random() * 60)); }, 1500);
    return () => { clearInterval(s); clearInterval(q); };
  }, [i]);
  return (
    <div className="lc">
      <span className="st">RUNNING</span><span className="ms">{ms}ms</span>
      <h4>{a.n}</h4><div className="tk">{a.tasks[t % 3]}…</div>
      <div className="n">{fmt(n)}</div><small>tasks completed today</small>
      <div className="bar"><i style={{ width: p + "%" }} /></div>
      <div className="sp">{sp.map((h, k) => <i key={k} style={{ height: h + "%" }} />)}</div>
    </div>
  );
}
export function LiveWall() {
  return (
    <div className="tw-sec">
      <div className="tw-k">( 01 ) Live now</div>
      <h2 className="tw-giant">Agents<br />at work.<br /><span style={{ color: "#d6284a" }}>Right now.</span></h2>
      <div className="tw-wall">{WALL.map((a, i) => <LiveCard key={a.n} a={a} i={i} />)}</div>
    </div>
  );
}

export function Flow() {
  const src = ["Email","WhatsApp","Voice","ERP / CRM"], sy = [70,150,230,310], out = ["Invoice posted","Customer resolved","Report delivered"], oy = [100,200,300];
  return (
    <div className="tw-sec">
      <div className="tw-k">( 02 ) The flow</div>
      <h2 className="tw-giant">Chaos in.<br />Outcomes out.</h2>
      <div className="tw-flow">
        <svg viewBox="0 0 1200 400" role="img" aria-label="Inputs flow through validate, reason, act and approve into outcomes">
          <defs><linearGradient id="fg" x1="0" x2="1"><stop offset="0" stopColor="#b01c38" stopOpacity=".9" /><stop offset="1" stopColor="#4a0612" stopOpacity=".9" /></linearGradient></defs>
          <path d="M330 40 L870 120 L870 280 L330 360 Z" fill="url(#fg)" opacity=".85" />
          {["VALIDATE","REASON","ACT","APPROVE"].map((t, i) => (<g key={t}><line x1={468 + i * 130} y1={60 + i * 20} x2={468 + i * 130} y2={340 - i * 20} stroke="rgba(255,255,255,.25)" strokeDasharray="4 6" /><text x={388 + i * 130} y="205" fontSize="15">{t}</text></g>))}
          {src.map((t, i) => (<g key={t}>
            <rect x="30" y={sy[i] - 24} width="170" height="48" rx="24" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.15)" />
            <text x="58" y={sy[i] + 5} fontSize="16">{t}</text>
            <path id={"in" + i} d={`M200 ${sy[i]} C 270 ${sy[i]} 280 200 340 200`} fill="none" stroke="rgba(255,255,255,.18)" />
            {[0,1,2].map((k) => <circle key={k} r="5" fill="#ff4560"><animateMotion dur={3 + i * 0.4 + "s"} begin={k * 1.1 + i * 0.3 + "s"} repeatCount="indefinite"><mpath href={"#in" + i} /></animateMotion></circle>)}
          </g>))}
          {out.map((t, i) => (<g key={t}>
            <rect x="1000" y={oy[i] - 24} width="170" height="48" rx="24" fill="#fff" />
            <text x="1020" y={oy[i] + 5} fontSize="14" style={{ fill: "#000" }}>{t}</text>
            <path id={"ou" + i} d={`M860 200 C 930 200 930 ${oy[i]} 1000 ${oy[i]}`} fill="none" stroke="rgba(255,255,255,.18)" />
            {[0,1].map((k) => <circle key={k} r="5" fill="#00d084"><animateMotion dur={2.4 + i * 0.3 + "s"} begin={k * 1.2 + i * 0.4 + "s"} repeatCount="indefinite"><mpath href={"#ou" + i} /></animateMotion></circle>)}
          </g>))}
        </svg>
      </div>
    </div>
  );
}

export function Compare() {
  const rows = [["Executes inside your systems","n0","y","h","y"],["Human approval + audit trail","n0","h","h","y"],["Live in 7 days","h","n0","h","y"],["Industry-trained agents","n0","n0","n0","y"],["Voice + WhatsApp native","h","n0","n0","y"],["Pay per outcome, not per seat","n0","n0","n0","y"]];
  const sym = { y: "✓", h: "Partial", n0: "—" };
  return (
    <div className="tw-sec tw-light first">
      <div className="tw-k">( 03 ) Why us</div>
      <h2 className="tw-giant">Not another<br />chatbot.</h2>
      <div className="cmp"><table>
        <thead><tr><th /><th>Chatbots</th><th>RPA</th><th>Copilots</th><th className="us">TWWIOS</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td>{r.slice(1).map((c, i) => <td key={i} className={c + (i === 3 ? " us" : "")}>{sym[c]}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}

function Brand({ k }) {
  const o = LOGOS_DATA.L[k];
  return (
    <div>
      <span className="lgo">{k === "zoho" || k === "woocommerce"
        ? <span style={{ font: "900 24px 'Inter Tight',sans-serif", color: o.c }}>{k === "zoho" ? "Z" : "W"}</span>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill={o.c} d={o.d} /></svg>}</span>
      {o.n}
    </div>
  );
}
export function Integrations() {
  return (
    <div className="tw-sec tw-light last">
      <div className="tw-k">( 04 ) Integrations</div>
      <h2 className="tw-giant">Plugs into<br />everything.</h2>
      <div className="ig">{LOGOS_DATA.order.map((k) => <Brand key={k} k={k} />)}</div>
    </div>
  );
}

export function ProductWindow() {
  const ev = [["Invoice INV-4821 posted to Tally","approved"],["23 leads called via Twilio","completed"],["Ticket #9031 resolved","completed"],["Reorder PO drafted for 6 SKUs","awaiting approval"],["Overdue reminder sent on WhatsApp","completed"],["Weekly report posted to Slack","completed"]];
  const [bars, setBars] = useState(Array(18).fill(50)), [log, setLog] = useState([]), n = useRef(0);
  useEffect(() => {
    const push = () => { const e = ev[n.current++ % ev.length]; setLog((l) => [{ t: e[0], s: e[1], at: new Date().toLocaleTimeString() }, ...l].slice(0, 5)); };
    push(); push();
    const a = setInterval(() => setBars(Array.from({ length: 18 }, () => 25 + Math.random() * 75)), 1800), b = setInterval(push, 2200);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  return (
    <div className="tw-sec">
      <div className="tw-k">( 05 ) The product</div>
      <h2 className="tw-giant">See it<br />move.</h2>
      <div className="app">
        <div className="sd">{["Overview","Agents","Workflows","Approvals","Audit log","Connectors"].map((x, i) => <span key={x} className={i ? "" : "a"}>{x}</span>)}</div>
        <div className="mn">
          <div className="kp"><div><b>12,865</b><small>Tasks today</small></div><div><b>94%</b><small>Confidence</small></div><div><b>2.4h</b><small>Saved / task</small></div></div>
          <div className="ch">{bars.map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
          <div>{log.map((r, i) => <div className="rw" key={i}><span>{r.t}</span><em>{r.s} · {r.at}</em></div>)}</div>
        </div>
      </div>
    </div>
  );
}
