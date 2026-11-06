// Tiny collection store. Same API as the MongoDB driver subset we use, so code runs unchanged on both.
// Uses MongoDB when mongoose is connected; otherwise an in-memory store (dev/demo only, lost on restart).
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const mem = {};
const get = (o, k) => o?.[k];
function match(doc, f) {
  return Object.entries(f).every(([k, c]) => {
    const v = get(doc, k);
    if (c && typeof c === "object" && !Array.isArray(c) && !(c instanceof Date)) {
      return Object.entries(c).every(([op, x]) => ({ $in: () => x.includes(v), $nin: () => !x.includes(v), $ne: () => v !== x, $gt: () => v > x, $gte: () => v >= x, $lt: () => v < x, $lte: () => v <= x, $exists: () => (v !== undefined) === x }[op]?.() ?? false));
    }
    return v === c;
  });
}
function memCol(name) {
  const rows = (mem[name] ||= []);
  const cursor = (list) => { let l = list, s = null, n = 0; const c = { sort(o) { s = o; return c; }, limit(x) { n = x; return c; }, async toArray() { let r = [...l]; if (s) { const [k, d] = Object.entries(s)[0]; r.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d); } return (n ? r.slice(0, n) : r).map((x) => structuredClone(x)); } }; return c; };
  const apply = (d, u) => { if (u.$set) Object.assign(d, u.$set); if (u.$inc) for (const [k, v] of Object.entries(u.$inc)) d[k] = (d[k] || 0) + v; if (u.$push) for (const [k, v] of Object.entries(u.$push)) (d[k] ||= []).push(v); };
  return {
    async insertOne(d) { d._id ||= randomUUID(); rows.push(structuredClone(d)); return { insertedId: d._id }; },
    async insertMany(ds) { for (const d of ds) { d._id ||= randomUUID(); rows.push(structuredClone(d)); } return { insertedCount: ds.length }; },
    find(f = {}) { return cursor(rows.filter((d) => match(d, f))); },
    async findOne(f = {}) { const d = rows.find((x) => match(x, f)); return d ? structuredClone(d) : null; },
    async updateOne(f, u, o = {}) { const d = rows.find((x) => match(x, f)); if (d) apply(d, u); else if (o.upsert) { const n = { _id: randomUUID(), ...f }; apply(n, u); rows.push(n); } return { matchedCount: d ? 1 : 0 }; },
    async updateMany(f, u) { let n = 0; for (const d of rows) if (match(d, f)) { apply(d, u); n++; } return { matchedCount: n }; },
    async countDocuments(f = {}) { return rows.filter((d) => match(d, f)).length; },
    async deleteMany(f = {}) { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], f)) rows.splice(i, 1); return {}; },
  };
}
export const usingMongo = () => mongoose.connection.readyState === 1;
export const col = (name) => (usingMongo() ? mongoose.connection.collection(name) : memCol(name));
export const id = () => randomUUID();
