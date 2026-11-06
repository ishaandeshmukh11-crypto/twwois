"use client";
import { SOLUTIONS } from "@/lib/solutions";
export default function Solutions({ onDemo }) {
  return (
    <div className="tw-sec">
      <div className="tw-k">( ) Solutions</div>
      <h2 className="tw-giant">One platform.<br />Every channel.</h2>
      <div className="sol-grid">
        {SOLUTIONS.map((s) => (
          <div key={s.id} className={"sol-card" + (s.status === "live" ? " live" : "")} style={{ "--h": s.hue }}>
            <div className="sol-art" aria-hidden="true" />
            <span className="sol-st">{s.status === "live" ? "Live now" : "Coming soon"}</span>
            <h3>{s.name}</h3>
            <p>{s.line}</p>
            <div className="sol-tags">{s.tags.map((t) => <span key={t}>{t}</span>)}</div>
            {s.status === "live" ? <a className="pill" href={s.href}>Open {s.name} →</a> : <button className="pill d" onClick={onDemo}>Join the waitlist</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
