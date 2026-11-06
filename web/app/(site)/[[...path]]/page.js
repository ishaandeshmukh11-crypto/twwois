import { notFound } from "next/navigation";
import { R, render, keyOf, P, SV, CASES } from "@/lib/site-data";

export const dynamicParams = false;

function paths() {
  const a = [[]];
  Object.keys(R).forEach((k) => {
    if (k === "home" || k.startsWith("p-") || k.startsWith("s-") || (k.startsWith("case-") && k !== "case-studies")) return;
    a.push([k]);
  });
  P.forEach((p) => a.push(["products", p.id]));
  SV.forEach((s) => a.push(["services", s.id]));
  CASES.forEach((c) => a.push(["case-studies", c.id]));
  return a;
}
export function generateStaticParams() { return paths().map((p) => ({ path: p })); }

function titleOf(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : null;
}
export function generateMetadata({ params }) {
  const k = keyOf(params.path || []);
  if (!k || !R[k]) return {};
  if (k === "home") return { title: { absolute: "TWWIOS Technologies — AI and engineering for business" } };
  return { title: titleOf(render(k)) || "TWWIOS" };
}
export default function Page({ params }) {
  const k = keyOf(params.path || []);
  if (!k || !R[k]) notFound();
  return <div id="page" dangerouslySetInnerHTML={{ __html: render(k) }} />;
}
