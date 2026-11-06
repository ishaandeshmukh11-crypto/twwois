import Script from "next/script";
import { notFound } from "next/navigation";

const T = {
  settle: { name: "Settle", h: "Get paid on time.", sub: "Collections follow-up that stays polite." },
  scribe: { name: "Scribe", h: "Invoices in, clean data out.", sub: "Upload an invoice and watch it get read and checked." },
  vox: { name: "Vox", h: "Talk to an AI voice agent.", sub: "Play the customer. Speak or type." },
};
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(T).map((tool) => ({ tool }));
export const generateMetadata = ({ params }) => ({ title: T[params.tool] ? `Try ${T[params.tool].name}` : "Try" });

export default function Page({ params }) {
  const t = T[params.tool];
  if (!t) notFound();
  return (
    <section className="lt wt full sec" style={{ paddingTop: 140 }}>
      <div className="wrap">
        <div className="mono"><a href={"/products/" + params.tool} style={{ color: "inherit" }}>{t.name}</a> / Try it live</div>
        <h1 className="mid" style={{ margin: "16px 0 12px", maxWidth: "16ch" }}>{t.h}</h1>
        <p className="mu" style={{ margin: "0 0 32px" }}>{t.sub}</p>
        <div className="tapp" id="tool" data-tool={params.tool}></div>
      </div>
      <Script src="/tools.js" strategy="afterInteractive" />
    </section>
  );
}
