(function(){
var CO=window.__CO||{};
var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))},rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
var KEYS=window.__KEYS||{};
function U(k){if(k=="home")return"/";if(k.indexOf("p-")==0)return"/products/"+k.slice(2);if(k.indexOf("s-")==0)return"/services/"+k.slice(2);if(k=="case-studies")return"/case-studies";if(k.indexOf("case-")==0)return"/case-studies/"+k.slice(5);return"/"+k}
function initPage(){
 initDemos();
 $$("[data-split]").forEach(function(el){el.innerHTML=el.textContent.split(" ").map(function(w,i){return'<span class="dw rv" style="transition-delay:'+(i*60)+'ms">'+w+'&nbsp;</span>'}).join("")});
 var els=$$(".rv");if(rm||!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")})}else{var io=new IntersectionObserver(function(a){a.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}})},{threshold:.08});els.forEach(function(e){io.observe(e)});setTimeout(function(){els.forEach(function(e){e.classList.add("in")})},2500)}
 $$("[data-n]").forEach(function(el){var n=+el.dataset.n;el.textContent=n;if(rm||!("IntersectionObserver" in window))return;var o=new IntersectionObserver(function(a){if(a[0].isIntersecting){o.disconnect();var t0=performance.now();(function f(t){var p=Math.min(1,(t-t0)/1200);el.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)})(t0)}});o.observe(el)});
 var f=$("#facts");if(f){var r=function(k,v,t){return'<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;border-bottom:1px solid var(--ln);padding-bottom:10px"><dt class="mu">'+k+'</dt><dd style="margin:0;overflow-wrap:anywhere" class="'+(v?'':'todo')+'">'+(v||t)+'</dd></div>'};f.innerHTML=r("Company",CO.name)+r("CIN",CO.cin,"[add CIN]")+r("Type",CO.type)+r("Status",CO.status)+r("Incorporated",CO.incorporated)+r("Office",CO.address,"[add address]")+r("GSTIN",CO.gstin,"[add GSTIN]")+r("Contact",CO.email,"[add email]")}
 var inq=$("#inq");if(inq)inq.addEventListener("submit",function(e){e.preventDefault();var fd=new FormData(inq),body={};fd.forEach(function(v,k){body[k]=String(v)});body.page=location.pathname;var btn=inq.querySelector("button");if(btn)btn.disabled=true;
  fetch("/api/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||"fail");return j})}).then(function(){inq.outerHTML='<div class="ok"><b>Thank you.</b> Your inquiry is noted. Our team will connect with you shortly.</div>'}).catch(function(){if(btn)btn.disabled=false;var m=inq.querySelector(".err")||inq.appendChild(document.createElement("p"));m.className="err mu";m.textContent="Could not send right now. Please check the fields and try again."})});
 if($("#blob"))blob($("#blob"));
 if(rm)$$(".dg svg").forEach(function(v){if(v.pauseAnimations)v.pauseAnimations()});clearInterval(window._tk);var tk=$$("[data-tick]");if(tk.length&&!rm){window._tk=setInterval(function(){tk.forEach(function(el){var v=+el.dataset.tick+Math.ceil(Math.random()*6);el.dataset.tick=v;el.textContent=v.toLocaleString("en-US")})},1300)}
 $$("[data-rail]").forEach(function(r){var bar=r.nextElementSibling;if(!bar)return;var l=bar.querySelector("[data-rl]"),rr=bar.querySelector("[data-rr]");if(l)l.onclick=function(){r.scrollBy({left:-320,behavior:"smooth"})};if(rr)rr.onclick=function(){r.scrollBy({left:320,behavior:"smooth"})}})}
/* ===== live product demos (scripted; no network) ===== */
var DEMOS={
relay:{tag:"Simulated here · the real app is live",l:'<div class="ph2"><div class="top"><s></s><span>Ana Silva<br><small style="opacity:.6">WhatsApp</small></span></div><div class="mg"></div></div>',
 log:"What Relay did",
 run:function(S,at,lg){var m=$(".mg",S);function b(c,t,x){var d=document.createElement("div");d.className="bb "+c;d.innerHTML=t+(x?"<small>"+x+"</small>":"");m.appendChild(d);m.scrollTop=1e9;return d}
  var o;at(300,function(){o=b("o","Hi Ana, your order #1042 has shipped. Track it here: tw.io/t/1042","Sent");lg("Message sent from an approved template")});
  at(1500,function(){o.querySelector("small").textContent="Delivered ✓✓";lg("Delivered and read")});
  at(2600,function(){b("i","Thanks! When will it arrive?")});
  at(3500,function(){lg("Question picked up by the assistant")});
  at(4300,function(){b("o","Tomorrow by 6 pm. Want a reminder in the morning?","Automatic reply")});
  at(5200,function(){lg("Whole chat saved to the shared inbox")})}},
mira:{tag:"Simulated here · sample business",l:'<div class="ph2" style="width:min(360px,100%)"><div class="top"><s></s><span>Northwind Dental<br><small style="opacity:.6">AI assistant · online</small></span></div><div class="mg"></div></div><div class="ch"></div><form class="mi"><input placeholder="Ask anything, e.g. opening hours" aria-label="Ask the sample assistant"><button>Send</button></form>',
 log:"Where each answer came from",
 run:function(S,at,lg){var m=$(".mg",S),ch=$(".ch",S),f=$("form.mi",S),inp=$("input",f);
  var KBM=[[/hour|open|close|time/i,"We are open Monday to Saturday, 9 am to 6 pm.","Opening hours"],[/price|cost|fee|clean|charge/i,"A standard check-up and cleaning starts at $60. Whitening and braces are quoted after a visit.","Price list"],[/book|appoint|slot|schedule|visit/i,"I can book that. Which day works for you, and what is your phone number? I will pass it to the front desk.","Booking flow · captures a lead"],[/where|address|location|park/i,"We are at 12 Harbour Street, next to the pharmacy. Parking is free behind the building.","Location page"],[/human|person|doctor|talk|call/i,"Of course. I have asked a team member to call you today.","Hand-off to a person"]];
  function b(c,t){var d=document.createElement("div");d.className="bb "+c;d.textContent=t;m.appendChild(d);m.scrollTop=1e9}
  function q(t){b("o",t);var h=KBM.filter(function(k){return k[0].test(t)})[0];setTimeout(function(){b("i",h?h[1]:"I am not sure about that one. I will ask a team member to follow up with you.");lg(h?h[2]:"No match · escalated to a person")},rm?0:600)}
  b("i","Hello! I am the assistant for Northwind Dental. Ask me anything or tap a question.");
  ch.innerHTML=["Opening hours","Price of a cleaning","Book an appointment","Where are you?","Talk to a person"].map(function(x){return"<button type=button>"+x+"</button>"}).join("");
  ch.onclick=function(e){if(e.target.tagName=="BUTTON")q(e.target.textContent)};
  f.onsubmit=function(e){e.preventDefault();var v=inp.value.trim();if(v){inp.value="";q(v)}};
  at(900,function(){lg("Try a question on the left. Nothing is sent anywhere.")})}},
settle:{tag:"Sample walkthrough · try the real one above",l:'<div class="card3"><div class="row"><span>Invoice #2087</span><b>Acme Retail</b></div><div class="row"><span>Amount</span><b>$1,240.00</b></div><div class="row"><span>Status</span><span class="pill" id="sp">Overdue · 7 days</span></div><div class="bar"><i></i></div></div>',
 log:"What Settle did",
 run:function(S,at,lg){var bar=$(".bar i",S),sp=$(".pill",S);
  at(400,function(){lg("Day 1 · Friendly WhatsApp reminder with a payment link");bar.style.width="20%"});
  at(1800,function(){lg("Day 3 · Email sent with the invoice attached");bar.style.width="45%"});
  at(3200,function(){lg("Day 5 · Customer replied: will pay Friday. Promise logged");bar.style.width="70%"});
  at(4600,function(){lg("Friday · Reminder sent, payment link opened");bar.style.width="90%"});
  at(6000,function(){lg("Paid · Invoice closed, finance notified");bar.style.width="100%";sp.className="pill ok";sp.textContent="Paid"})}},
scribe:{tag:"Sample walkthrough · try the real one above",l:'<div class="inv"><div style="display:flex;justify-content:space-between"><b>Northline Supplies Ltd</b><span>INVOICE</span></div><div class="ln" data-f="0"><span>Invoice no.</span><b>NL-88231</b></div><div class="ln" data-f="1"><span>Date</span><b>12 Feb 2026</b></div><div class="ln" data-f="2"><span>Items</span><b>40 × Steel brackets</b></div><div class="ln" data-f="3"><span>Tax</span><b>$ 96.00</b></div><div class="ln" data-f="4"><span>Total</span><b>$ 1,296.00</b></div></div><div class="upl"><label class="upb"><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden>Try it on your own invoice</label><small>PNG, JPG or PDF · up to 4 MB · 3 tries a day · not stored</small></div>',
 log:"Fields read",
 run:function(S,at,lg){var rows=[["Supplier","Northline Supplies Ltd"],["Invoice no.","NL-88231"],["Date","12 Feb 2026"],["Items","40 × Steel brackets"],["Tax","$96.00"],["Total","$1,296.00"]];var dr=$(".dr ul",S.closest(".dm"));
  function ad(k,v,w){var li=document.createElement("li");li.innerHTML='<div class="xr" style="width:100%"><span>'+k+'</span><div>'+v+(w?' <em>'+w+'</em>':'')+'</div></div>';dr.appendChild(li)}
  lg=null;dr.innerHTML="";var lns=$$(".ln",S);
  at(300,function(){ad(rows[0][0],rows[0][1])});
  lns.forEach(function(l,i){at(900+i*900,function(){lns.forEach(function(x){x.classList.remove("hl")});l.classList.add("hl");ad(rows[i+1][0],rows[i+1][1],i==4?"":"")})});
  at(900+5*900+600,function(){lns.forEach(function(x){x.classList.remove("hl")});ad("Check","Total is $40 above the purchase order","Flagged for a person to review")})}},
vox:{tag:"Sample walkthrough · try the real one above",l:'<div class="wv"><i></i><i style="animation-delay:.1s"></i><i style="animation-delay:.2s"></i><i style="animation-delay:.3s"></i><i style="animation-delay:.15s"></i><i style="animation-delay:.25s"></i><i style="animation-delay:.05s"></i><i style="animation-delay:.35s"></i><i style="animation-delay:.12s"></i></div><div class="tr"></div>',
 log:"What Vox did",
 run:function(S,at,lg){var w=$(".wv",S),t=$(".tr",S);function L(c,who,x){var d=document.createElement("div");d.className=c;d.innerHTML="<b>"+who+"</b>"+x;t.appendChild(d)}
  at(200,function(){w.classList.add("on");lg("Call placed and connected")});
  at(900,function(){L("a","Vox","Hello, this is a reminder from Northwind about your instalment due on Friday.")});
  at(2600,function(){L("c","Customer","Oh, I forgot. Can I pay on Monday instead?")});
  at(4200,function(){lg("Intent understood: asks to pay later");L("a","Vox","Monday works. I will note that and send you a payment link now.")});
  at(6000,function(){lg("Promise to pay logged for Monday");lg("Payment link sent by message")});
  at(6800,function(){w.classList.remove("on");lg("Call summary saved to the CRM")})}}
};
function initDemos(){$$("[data-demo]").forEach(function(box){if(box._d)return;box._d=1;var D=DEMOS[box.dataset.demo];if(!D)return;var T=[];
 box.innerHTML='<div class="dm"><div class="dh"><b>Sample demo</b><span class="tg">'+D.tag+'</span></div><div class="dg2"><div class="dl"></div><div class="dr"><h4>'+D.log+'</h4><ul class="lg"></ul></div></div><div class="ft"><button type="button" data-rp>↻ Replay</button><span>Sample data only. No messages are sent and nothing is stored.</span></div></div>';
 var L=$(".dl",box),LG=$("ul.lg",box);
 function lg(t){if(!t)return;var li=document.createElement("li");li.innerHTML="<i>✓</i><span>"+t+"</span>";LG.appendChild(li)}
 function at(ms,f){T.push(setTimeout(f,rm?0:ms))}
 function go(){T.forEach(clearTimeout);T=[];L.innerHTML=D.l;LG.innerHTML="";D.run(L,at,lg)}
 $("[data-rp]",box).onclick=go;
 box.addEventListener("change",function(e){var fi=e.target;if(!fi.matches||!fi.matches('.upl input[type=file]'))return;var f=fi.files[0];fi.value="";if(f){T.forEach(clearTimeout);T=[];liveScribe(f,LG,box)}});
 if(rm||!("IntersectionObserver" in window))go();else{var io=new IntersectionObserver(function(a){if(a[0].isIntersecting){io.disconnect();go()}},{threshold:.3});io.observe(box)}})}

function liveScribe(f,LG,box){
 T_clear(box);
 function row(k,v,flag){var li=document.createElement("li");var d=document.createElement("div");d.className="xr";d.style.width="100%";var s=document.createElement("span");s.textContent=k;var c=document.createElement("div");c.textContent=v;if(flag){var em=document.createElement("em");em.textContent=" "+flag;c.appendChild(em)}d.appendChild(s);d.appendChild(c);li.appendChild(d);LG.appendChild(li)}
 function msg(t){LG.innerHTML="";var li=document.createElement("li");li.textContent=t;LG.appendChild(li)}
 var okT=["image/png","image/jpeg","image/webp","application/pdf"];
 if(okT.indexOf(f.type)<0){msg("Please choose a PNG, JPG, WebP or PDF file.");return}
 if(f.size>4*1024*1024){msg("That file is over 4 MB. Please use a smaller copy.");return}
 msg("Reading your invoice… this takes a few seconds.");
 var fr=new FileReader();fr.onerror=function(){msg("Could not open that file.")};
 fr.onload=function(){var b64=String(fr.result).split(",")[1]||"";
  fetch("/api/scribe/demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:f.type,data:b64})})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,j:j,s:r.status}})})
  .then(function(x){if(!x.ok){msg(x.j.error||(x.s==404?"The live reader works on the deployed site, not in this preview.":"Could not read that file."));return}
   var j=x.j;LG.innerHTML="";var cur=j.currency?j.currency+" ":"";var m=function(n){return n==null?"not found":cur+Number(n).toFixed(2)};
   row("Supplier",j.supplier||"not found");row("Invoice no.",j.invoice_number||"not found");row("Date",j.date||"not found");
   (j.items||[]).slice(0,8).forEach(function(i,n){row(n?"":"Items",(i.quantity!=null?i.quantity+" × ":"")+(i.description||"item")+(i.amount!=null?"  "+m(i.amount):""))});
   row("Subtotal",m(j.subtotal));row("Tax",m(j.tax));row("Total",m(j.total));
   (j.checks||[]).forEach(function(c){row("Check",c,"Flagged for review")});
   if(!(j.checks||[]).length)row("Check","Totals add up");
   row("Note","Read by AI. Always confirm important figures.")})
  .catch(function(){msg("The live reader works on the deployed site, not in this preview.")})};
 fr.readAsDataURL(f)}
function T_clear(box){}

/* ===== 3D glossy form (WebGL) ===== */
function blob(c){var gl=c.getContext("webgl",{premultipliedAlpha:true,alpha:true});if(!gl){c.style.background="radial-gradient(circle at 50% 50%,#ff5a3c,#ff2f7d 40%,transparent 66%)";return}
 var vs="attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
 var fs="precision highp float;uniform vec2 R;uniform float T;mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}"
 +"float map(vec3 p){p.xz*=rot(T*.35);p.xy*=rot(.7+sin(T*.2)*.3);float a=atan(p.z,p.x);vec2 q=vec2(length(p.xz)-1.0,p.y);q*=rot(a*2.+T*.6);float r=.34+.1*sin(a*3.+T);float d=length(q*vec2(1.,1.6))-r;return d*.7;}"
 +"vec3 nor(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}"
 +"vec3 env(vec3 n){float y=n.y*.5+.5;vec3 c=mix(vec3(.45,.02,.12),vec3(1.,.18,.1),smoothstep(.0,.5,y));c=mix(c,vec3(1.,.62,.15),smoothstep(.5,.85,y));c+=vec3(1.,.9,.85)*pow(max(n.x*.6+n.y*.7,0.),6.)*.9;return c;}"
 +"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);vec3 ro=vec3(0.,0.,-4.2),rd=normalize(vec3(uv*1.15,1.7));float t=0.,d;bool hit=false;for(int i=0;i<64;i++){d=map(ro+rd*t);if(d<.002){hit=true;break;}t+=d;if(t>9.)break;}"
 +"if(!hit){gl_FragColor=vec4(0.);return;}vec3 p=ro+rd*t,n=nor(p);vec3 r=reflect(rd,n);float f=pow(1.-max(dot(n,-rd),0.),3.);vec3 col=env(r)*.85+vec3(1.,.4,.5)*f*.6;col+=vec3(1.)*pow(max(dot(r,normalize(vec3(.5,.8,-.5))),0.),40.);gl_FragColor=vec4(col,1.);}";
 function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
 var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){c.style.background="radial-gradient(circle,#ff5a3c,#ff2f7d 40%,transparent 66%)";return}
 gl.useProgram(pr);var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);var l=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 var uR=gl.getUniformLocation(pr,"R"),uT=gl.getUniformLocation(pr,"T"),t0=performance.now();
 function size(){var s=Math.min(devicePixelRatio||1,1.5)*1;c.width=Math.max(2,c.clientWidth*s);c.height=Math.max(2,c.clientHeight*s);gl.viewport(0,0,c.width,c.height)}size();
 (function fr(){if(!document.body.contains(c))return;gl.uniform2f(uR,c.width,c.height);gl.uniform1f(uT,rm?3:(performance.now()-t0)/1000);gl.drawArrays(gl.TRIANGLES,0,3);if(!rm)requestAnimationFrame(fr)})();addEventListener("resize",size)}
/* ===== nav, search, overlays ===== */
function show(o){o.hidden=false}function hide(o){o.hidden=true}
$("#bg").onclick=function(){show($("#menu"))};
document.addEventListener("click",function(e){var g=e.target.closest("[data-go=form]");if(g){e.preventDefault();var f=$("#sform");if(f)f.scrollIntoView({behavior:"smooth"});return}if(e.target.closest("[data-mc]")||e.target.closest("#menu a"))hide($("#menu"));if(e.target.closest("[data-close]")||e.target.classList.contains("ov"))hide($("#ovs"))});
document.addEventListener("keydown",function(e){if(e.key=="Escape"){hide($("#ovs"));hide($("#menu"));hide($("#chat"))}if(e.key=="/"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();openS()}});
var IDX=window.__IDX||[];
function openS(){show($("#ovs"));$("#q").focus();rs("")}
function rs(v){v=v.toLowerCase();var r=IDX.filter(function(i){return!v||(i[1]+" "+i[2]).toLowerCase().indexOf(v)>-1}).slice(0,8);$("#res").innerHTML=r.length?r.map(function(i){return'<a href="'+U(i[0])+'"><b>'+i[1]+'</b><span>'+i[2]+'</span></a>'}).join(""):'<span class="mu">Nothing found. Try "WhatsApp", "cloud" or "support".</span>'}
$("#so").onclick=openS;$("#q").oninput=function(){rs(this.value)};$("#res").addEventListener("click",function(e){if(e.target.closest("a"))hide($("#ovs"))});
/* ===== chatbot (rule-based demo; production: connect to Mira API) ===== */
var KB=[[/price|cost|plan|pricing|quote|rupee|kitna/i,"Pricing is tailored to each business. Share a few details and our team will prepare a proposal for you."],[/relay|whatsapp|bulk|instagram|facebook/i,"Relay sends WhatsApp messages safely and answers Instagram and Facebook comments with a DM. It is live. Open the Relay page from Solutions."],[/mira|chatbot|assistant|support bot/i,"Mira is our AI assistant. It answers customers in many languages on your website and social inboxes, books appointments and captures leads."],[/settle|collection|due|payment|emi/i,"Settle follows up on dues across WhatsApp, email and calls until the payment link is paid. Launching soon. I can add you to the waitlist."],[/scribe|invoice|document|bill/i,"Scribe reads invoices and documents into clean data. Launching soon."],[/vox|voice|call/i,"Vox is our AI voice agent for reminders and bookings in many languages. Launching soon."],[/ecommerce|e-commerce|store|shop|website|app/i,"Yes, we build e-commerce sites and apps for companies, with admin, orders and payments. Share your idea and our team will call you."],[/support|maintenance|amc|technology/i,"We provide technology support: monitoring, fixes and upgrades. Tell me what you use and I will connect you with our team."],[/hello|hi\b|hey|namaste/i,"Hello! I can tell you about our products, services or case studies. What would you like to know?"]];
var chatSt=0,lead={},hist=[];
function addM(t,w){var d=document.createElement("div");d.className="m "+w;d.textContent=t;$("#msgs").appendChild(d);$("#msgs").scrollTop=1e9}
function bot(t){var m=$("#msgs"),d=document.createElement("div");d.className="dots";d.innerHTML="<i></i><i></i><i></i>";m.appendChild(d);m.scrollTop=1e9;setTimeout(function(){d.remove();addM(t,"a")},rm?0:700)}
function ask(t){addM(t,"u");if(chatSt==1){lead.n=t;chatSt=2;bot("Thanks "+t.split(" ")[0]+". What is your phone number?");return}
 if(chatSt==2){lead.p=t;chatSt=0;fetch("/api/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({n:lead.n,p:lead.p,m:"Lead from website chat",src:"chat",page:location.pathname})}).catch(function(){});bot("Done. Our person will connect with you on "+t+" shortly. Anything else?");return}
 if(/talk|human|person|team|call me|connect|waitlist|demo|inquiry|enquiry/i.test(t)){chatSt=1;bot("Happy to connect you. What is your name?");return}
 var h=KB.filter(function(k){return k[0].test(t)})[0];if(!h&&window.__AI){hist.push({role:"user",content:t});fetch("/api/site-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:hist.slice(-8)})}).then(function(r){return r.json()}).then(function(j){if(j&&j.reply){hist.push({role:"assistant",content:j.reply});bot(j.reply)}else throw 0}).catch(function(){bot("I may not have that detail. Type \"talk to team\" and our team will connect with you.")});return}
 bot(h?h[1]:"I may not have that detail. Would you like our team to connect with you? Type \"talk to team\".")}
$("#cb").onclick=function(){var c=$("#chat");c.hidden=!c.hidden;if(!c.hidden&&!$("#msgs").children.length){addM("Hello! I am the TWWIOS assistant. Ask me about products, services or case studies.","a");$("#chips").innerHTML=["Pricing","What is Mira?","E-commerce","Talk to team"].map(function(x){return'<button>'+x+'</button>'}).join("")}};
$("#cx").onclick=function(){hide($("#chat"))};
$("#chips").addEventListener("click",function(e){if(e.target.tagName=="BUTTON")ask(e.target.textContent)});
$("#cf").addEventListener("submit",function(e){e.preventDefault();var v=$("#ci").value.trim();if(!v)return;$("#ci").value="";ask(v)});
initPage();
})();
