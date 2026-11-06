"use client";
import { useState } from "react";
import DemoModal from "@/components/DemoModal";
import data from "@/lib/company.json";

function useDelegate(setDemo) {
  return (e) => {
    const a = e.target.closest("[data-act],[data-go]"); if (!a) return;
    const act = a.getAttribute("data-act"), go = a.getAttribute("data-go");
    if (act === "demo") { e.preventDefault(); setDemo(true); }
    else if (act === "bot") { e.preventDefault(); window.dispatchEvent(new Event("tw-open-bot")); }
    else if (go) {
      e.preventDefault();
      const el = document.getElementById(go);
      if (el) el.scrollIntoView({ behavior: "smooth" }); else window.location.href = "/#" + go;
    }
  };
}

export function Footer({ onDemo }) {
  const h = useDelegate((v) => v && onDemo && onDemo());
  return <div onClick={h} dangerouslySetInnerHTML={{ __html: data.footer }} />;
}

export function ExtraSections() {
  return <div dangerouslySetInnerHTML={{ __html: data.extra }} />;
}

export function PageShell({ html }) {
  const [demo, setDemo] = useState(false);
  const h = useDelegate(setDemo);
  return (
    <div className="co-page" onClick={h}>
      <div className="co-ov">
        <div className="co-top"><a className="back" href="/">← Back to site</a><span className="nm">TWWIOS</span><button className="co-pill" data-act="demo" style={{ height: 38, padding: "0 16px" }}>Book a Demo</button></div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <div className="co-end" />
        <div dangerouslySetInnerHTML={{ __html: data.footer }} />
      </div>
      <DemoModal open={demo} onClose={() => setDemo(false)} />
    </div>
  );
}
