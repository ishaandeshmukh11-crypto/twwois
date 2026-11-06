import Script from "next/script";
import { P, PAGES, IDX, CO } from "@/lib/site-data";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "TWWIOS Technologies — AI and engineering for business", template: "%s · TWWIOS" },
  description: "TWWIOS builds AI products and engineering for companies: messaging automation, AI assistants, collections, document reading and voice agents.",
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };

const href = (k) => (k === "home" ? "/" : k.startsWith("p-") ? "/products/" + k.slice(2) : "/" + k);

export default function SiteLayout({ children }) {
  const pub = { name: CO.name, cin: CO.cin, type: CO.type, status: CO.status, incorporated: CO.incorporated, address: CO.address, email: CO.email, phone: CO.phone, gstin: CO.gstin };
  const legal = "© 2026 " + CO.name + (CO.cin ? " · CIN " + CO.cin : "") + (CO.address ? " · " + CO.address : "") + " · Built for the world";
  const boot = "window.__CO=" + JSON.stringify(pub) + ";window.__IDX=" + JSON.stringify(IDX) + ";window.__AI=true;";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" />
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>
        <header className="nav full"><div className="in">
          <a className="logo" href="/"><i></i>TWWIOS</a>
          <nav className="links" id="links" aria-label="Main">{PAGES.map((p) => <a key={p[0]} href={href(p[0])}>{p[1]}</a>)}</nav>
          <button className="ib" id="so" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg></button>
          <a className="btn w" href="/contact">Contact us</a>
          <button className="ib burger" id="bg" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M3 17h18" /></svg></button>
        </div></header>
        <div className="menu" id="menu" hidden>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><span className="logo"><i></i>TWWIOS</span><button className="ib" data-mc aria-label="Close">✕</button></div>
          {PAGES.concat([["contact", "Contact"]]).map((p) => <a key={p[0]} href={href(p[0])}>{p[1]}</a>)}
        </div>
        <main id="app">{children}</main>
        <footer className="dk full"><div className="wrap">
          <div className="fgrid">
            <div><a className="logo" href="/"><i></i>TWWIOS</a><p className="mu" style={{ maxWidth: 320 }}>AI and engineering that helps businesses move faster.</p></div>
            <div><h4>Solutions</h4><div>{P.map((p) => <a key={p.id} href={"/products/" + p.id}>{p.n}</a>)}</div></div>
            <div><h4>Company</h4><div>{PAGES.slice(1).map((p) => <a key={p[0]} href={href(p[0])}>{p[1]}</a>)}<a href="/future">Future</a><a href="/transformation">Transformation</a></div></div>
            <div><h4>Legal</h4><a href="/privacy">Privacy policy</a><a href="/contact">Contact</a></div>
          </div>
          <div className="wm" aria-hidden="true">TWWIOS</div>
          <p className="legal" id="legal">{legal}</p>
        </div></footer>
        <button className="cbtn" id="cb"><i></i>Ask our AI</button>
        <div className="chat" id="chat" hidden>
          <div className="hd"><div><b>TWWIOS Assistant</b><small>● Online</small></div><button className="ib" id="cx" aria-label="Close" style={{ width: 34, height: 34 }}>✕</button></div>
          <div className="msgs" id="msgs"></div><div className="chips" id="chips"></div>
          <form id="cf"><input id="ci" placeholder="Ask about products, pricing, support…" autoComplete="off" /><button className="btn w" style={{ padding: "10px 16px" }}>Send</button></form>
        </div>
        <div className="ov" id="ovs" hidden><div className="pan"><button className="btn x" data-close>Close ✕</button><input id="q" type="search" placeholder="Search pages and products…" autoComplete="off" /><div className="res" id="res"></div></div></div>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <Script src="/site.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
