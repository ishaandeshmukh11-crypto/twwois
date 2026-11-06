import http from "node:http"; import { spawn, spawnSync } from "node:child_process";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const g=spawnSync("node",["server.js"],{env:{...process.env,NODE_ENV:"production",PORT:"4405"},encoding:"utf8",timeout:8000});
let f=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)f++};
ok(g.status===1&&/Refusing to start/.test(g.stderr),"production refuses to start without secrets");
const mock=http.createServer((q,s)=>{let b="";q.on("data",d=>b+=d);q.on("end",()=>{s.writeHead(200,{"content-type":"application/json"});s.end(JSON.stringify({id:"sub_A"}))})}).listen(4906);
const srv=spawn("node",["server.js"],{env:{...process.env,PORT:"4405",AUTH_SECRET:"t".repeat(40),PULSE_ADMIN_KEY:"adminkey-1234567890",MONGODB_URI:"mongodb://127.0.0.1:1/none",RAZORPAY_KEY_ID:"k",RAZORPAY_KEY_SECRET:"s",RAZORPAY_PLAN_STARTER:"p",RAZORPAY_BASE:"http://127.0.0.1:4906"},stdio:"ignore"});await sleep(1800);
const A="http://127.0.0.1:4405/api/pulse";const api=async(p,body,tok,h={},m)=>{const r=await fetch(A+p,{method:m||(body!==undefined?"POST":"GET"),headers:{"content-type":"application/json",...(tok?{authorization:"Bearer "+tok}:{}),...h},body:body!==undefined?JSON.stringify(body):undefined});return{s:r.status,j:await r.json().catch(()=>null)}};
const t=(await api("/auth/signup",{email:"g@x.com",password:"password123",company:"GST Co"})).j.token;
ok((await api("/billing/checkout",{plan:"starter"},t)).s===400,"checkout blocked until billing details saved");
ok((await api("/billing/details",{legalName:"GST Co Pvt Ltd",gstin:"BADGSTIN",address:"12 MG Road Pune",state:"Maharashtra"},t,{},"PUT")).s===400,"invalid GSTIN rejected");
ok((await api("/billing/details",{legalName:"GST Co Pvt Ltd",gstin:"27AAPFU0939F1ZV",address:"12 MG Road Pune",state:"Maharashtra"},t,{},"PUT")).j.ok,"valid GSTIN saved");
ok((await api("/billing/checkout",{plan:"starter"},t)).j.subscriptionId==="sub_A","checkout works after details");
ok((await api("/admin/orgs")).s===401&&(await api("/admin/orgs",undefined,null,{"x-admin-key":"wrong"})).s===401,"admin list needs the key");
const L=(await api("/admin/orgs",undefined,null,{"x-admin-key":"adminkey-1234567890"})).j;ok(L.totals.customers===1&&L.orgs[0].billing.gstin==="27AAPFU0939F1ZV"&&L.orgs[0].email==="g@x.com","admin sees customer with GSTIN");
await api("/admin/plan",{email:"g@x.com",plan:"growth",days:30},null,{"x-admin-key":"adminkey-1234567890"});
ok((await api("/admin/orgs",undefined,null,{"x-admin-key":"adminkey-1234567890"})).j.totals.paying===1,"admin set plan, counted as paying");
srv.kill();mock.close();console.log(f?"FAILS "+f:"ALL PASS");process.exit(f?1:0)
