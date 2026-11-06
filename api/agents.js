export const AGENTS = [
  { name: "Finance & Invoice", re: /invoice|bill|gst|tally|voucher|payment|reconcil|expense|ledger|books/g, tools: ["Tally","SAP","Gmail"], output: "Invoice #INV-4821 matched to PO, posted to Tally as voucher TV-1847" },
  { name: "Voice & Calling", re: /call|calls|dial|phone|lead|leads|follow.?up|outbound|ivr/g, tools: ["Twilio Voice","WhatsApp Business","Slack"], output: "23 calls placed, 19 connected, 7 follow-ups scheduled, summary sent to Slack" },
  { name: "Collections", re: /collect|overdue|due|remind|outstanding|recover|dues/g, tools: ["WhatsApp Business","Tally","Slack"], output: "12 overdue customers reminded on WhatsApp, 3 promised payment by Friday" },
  { name: "Customer Support", re: /support|ticket|complaint|refund|customer|helpdesk|issue/g, tools: ["Salesforce","Gmail","Slack"], output: "Ticket #9031 resolved, refund approved under policy, customer notified" },
  { name: "Sales", re: /sales|deal|pipeline|crm|quote|proposal|prospect/g, tools: ["Salesforce","Gmail","Slack"], output: "14 stale deals re-engaged, 2 proposals drafted and queued for approval" },
  { name: "Inventory", re: /inventory|stock|warehouse|reorder|sku|supply/g, tools: ["SAP","Slack","Gmail"], output: "6 SKUs below threshold, reorder POs drafted for approval" },
  { name: "Procurement", re: /procure|vendor|supplier|purchase|rfq/g, tools: ["SAP","Gmail","Slack"], output: "3 supplier quotes compared, best landed cost selected, PO drafted" },
  { name: "HR", re: /\bhr\b|resume|candidate|hiring|recruit|interview|payroll|leave|onboard/g, tools: ["Gmail","Slack","Salesforce"], output: "18 resumes screened, 4 shortlisted, interviews proposed" },
  { name: "Reporting & BI", re: /report|dashboard|kpi|analytics|summary|weekly|insight/g, tools: ["SAP","Tally","Slack"], output: "Weekly ops report compiled from 3 systems and posted to Slack" },
  { name: "Email", re: /email|inbox|mail|reply|draft/g, tools: ["Gmail","Slack","Salesforce"], output: "42 emails triaged, 11 replies drafted, 2 flagged for you" },
];

export function route(message) {
  const l = message.toLowerCase();
  if (/demo|book|talk|meeting|contact|sales team/.test(l) && !/call \d|leads/.test(l)) return { type: "reply", action: "demo", reply: "Happy to. Opening the booking form." };
  if (/differ|competit|uipath|zapier|chatbot|copilot|why you|\bvs\b|better/.test(l)) return { type: "reply", action: "scroll:why", reply: "Three things: <b>1)</b> we execute inside your ERP, CRM and WhatsApp instead of just replying; <b>2)</b> every action waits for human approval and is audit-logged; <b>3)</b> you go live in 7 days with industry-trained agents. Taking you to the comparison." };
  if (/secur|soc|privacy|safe|complian/.test(l)) return { type: "reply", reply: "Human approval is built in, every action is audit-logged, and the platform is built SOC 2 Type II ready. Nothing executes without a person signing off." };
  if (/connector|integrat/.test(l) && !/post|invoice|reconcil/.test(l)) return { type: "reply", action: "scroll:ig", reply: "20 connectors live including Tally, SAP, Salesforce, Gmail, Slack, WhatsApp Business and Twilio Voice." };
  let best = null, score = 0;
  for (const a of AGENTS) { const m = l.match(a.re); if (m && m.length > score) { score = m.length; best = a; } }
  if (!best) return { type: "reply", reply: "I didn't catch the task. Try <i>“post this invoice to Tally”</i>, <i>“call 23 leads”</i> or <i>“send overdue reminders”</i>." };
  return { type: "run", agent: best };
}
