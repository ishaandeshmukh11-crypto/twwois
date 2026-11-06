"use client";
import { useEffect, useRef, useState } from "react";

const pageY = () => (typeof window === "undefined" ? 0 : window.scrollY || document.documentElement.scrollTop || 0);

/** One rAF loop drives: hero headline drift, giant headings, ticker bands (speed follows scroll velocity), spinning arrows. */
export function useKinetic() {
  useEffect(() => {
    let last = pageY(), vel = 0, raf, vh = innerHeight;
    const pos = new Map();
    const onResize = () => (vh = innerHeight);
    addEventListener("resize", onResize);
    const loop = () => {
      const y = pageY(), vw = innerWidth;
      vel += (y - last - vel) * 0.12; last = y;
      const h1 = document.querySelector(".hero h1");
      if (h1) h1.style.translate = Math.max(-vw * 0.06, -y * 0.09) + "px 0";
      document.querySelectorAll(".tw-giant").forEach((e, i) => {
        const r = e.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const c = r.top + r.height / 2 - vh / 2, dir = i % 2 ? 1 : -1;
        e.style.translate = Math.max(-vw * 0.2, Math.min(vw * 0.2, dir * c * 0.28)) + "px 0";
      });
      document.querySelectorAll(".tw-band").forEach((b) => {
        const d = b.firstElementChild, w = d.scrollWidth / 4, dir = +b.dataset.dir || (b.classList.contains("k") ? 1 : -1);
        let p = (pos.get(b) || 0) + dir * (1.2 + Math.min(Math.abs(vel) * 0.9, 40));
        if (p < -w) p += w; if (p > 0) p -= w;
        pos.set(b, p); d.style.transform = `translateX(${p}px)`;
      });
      document.querySelectorAll(".pn-c").forEach((a) => (a.style.transform = `rotate(${y * 0.25}deg)`));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, []);
}

export function XlBand({ items, outline, dir }) {
  const row = [0, 1, 2, 3].flatMap(() => items).map((x, i) => (<span key={i}><b>{x}</b><em /></span>));
  return <div className={"tw-band xl" + (outline ? " o" : "")} data-dir={dir}><div>{row}</div></div>;
}

export function Numerals() {
  const ref = useRef(null), [vals, setVals] = useState([0, 0, 0]);
  const items = [[20, "", "Connectors live"], [7, "", "Days to go live"], [94, "%", "Avg. confidence"]];
  useEffect(() => {
    const el = ref.current; let done = false;
    const run = () => { if (done) return; done = true; const t0 = performance.now();
      const f = (t) => { const p = Math.min((t - t0) / 1800, 1), e = 1 - Math.pow(1 - p, 4); setVals(items.map((x) => Math.round(x[0] * e))); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f); };
    const io = new IntersectionObserver((en) => en[0].isIntersecting && (run(), io.disconnect()), { threshold: 0.2 });
    io.observe(el); const t = setTimeout(run, 6000);
    return () => { io.disconnect(); clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="pn" ref={ref}>
      {items.map((x, i) => (
        <div className="pn-b" key={x[2]}>
          <div className="pn-n">{vals[i]}{x[1]}<sup>&reg;</sup></div>
          <div className="pn-l"><span>{x[2]}</span><span className="pn-c">&rarr;</span></div>
        </div>
      ))}
    </div>
  );
}
