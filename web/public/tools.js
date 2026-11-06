(function(){
var root=document.getElementById("tool");if(!root)return;var tool=root.dataset.tool;
var ws;try{ws=localStorage.getItem("tw_ws");if(!ws){ws="w"+Array.from(crypto.getRandomValues(new Uint8Array(12))).map(function(b){return b.toString(16).padStart(2,"0")}).join("");localStorage.setItem("tw_ws",ws)}}catch(e){ws="w"+Math.random().toString(16).slice(2)+Date.now().toString(16)}
function api(m,p,b){return fetch("/api/suite"+p,{method:m,headers:{"Content-Type":"application/json","x-ws":ws},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||"Something went wrong");return j})})}
function h(t,a,k){var e=document.createElement(t);a=a||{};for(var x in a){if(x=="class")e.className=a[x];else if(x=="text")e.textContent=a[x];else if(x.slice(0,2)=="on")e[x]=a[x];else e.setAttribute(x,a[x])}(k||[]).forEach(function(c){if(c!=null)e.appendChild(typeof c=="string"?document.createTextNode(c):c)});return e}
function money(c,n){return (c||"")+" "+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function note(box,t,bad){box.textContent=t;box.className="tnote"+(bad?" bad":"")}
function copy(t,btn){try{navigator.clipboard.writeText(t).then(function(){btn.textContent="Copied"})}catch(e){}}

/* ---------------- SETTLE ---------------- */
function settle(){
 var stats=h("div",{class:"tstats"}),list=h("div",{class:"tlist"}),msg=h("div",{class:"tnote"});
 var f=h("form",{class:"tform"});
 function fld(n,l,t,ph,req){return h("label",{},[l,h("input",{name:n,type:t||"text",placeholder:ph||"",required:req?"":null})])}
 var due=fld("due","Due date","date","",1);due.querySelector("input").value=new Date(Date.now()-3*864e5).toISOString().slice(0,10);
 f.appendChild(h("div",{class:"tgrid"},[fld("name","Customer","text","Acme Retail",1),fld("contact","Email or phone","text","accounts@acme.com"),fld("amount","Amount","number","1200",1),fld("currency","Currency","text","USD"),due,fld("note","Invoice / note","text","Invoice #101"),fld("payUrl","Payment link (optional)","url","https://pay.example.com/abc")]));
 f.appendChild(h("button",{class:"btn w",type:"submit",text:"Add due"}));
 f.onsubmit=function(e){e.preventDefault();var d={};new FormData(f).forEach(function(v,k){if(v!=="")d[k]=v});api("POST","/settle/dues",d).then(function(){f.reset();load()}).catch(function(er){note(msg,er.message,1)})};
 function card(d){
  var out=h("div",{class:"tout",hidden:""});
  var tone=h("select",{},["friendly","firm","final"].map(function(t){var o=h("option",{value:t,text:t[0].toUpperCase()+t.slice(1)});if(t==d.suggestedTone)o.selected=true;return o}));
  var ch=h("select",{},[["whatsapp","WhatsApp"],["email","Email"]].map(function(c){return h("option",{value:c[0],text:c[1]})}));
  var prep=h("button",{class:"btn h",text:"Prepare reminder",onclick:function(){prep.disabled=true;prep.textContent="Writing…";api("POST","/settle/dues/"+d.id+"/remind",{tone:tone.value,channel:ch.value}).then(function(j){out.hidden=false;out.innerHTML="";var cp=h("button",{class:"cp",text:"Copy"});cp.onclick=function(){copy(j.text,cp)};out.appendChild(h("pre",{text:j.text}));out.appendChild(h("div",{class:"tmeta"},[j.aiMade?"Written by AI":"Template (AI key not set)"," · "+j.note,cp]))}).catch(function(er){out.hidden=false;out.textContent=er.message}).then(function(){prep.disabled=false;prep.textContent="Prepare reminder"})}});
  var rep=h("input",{placeholder:"Paste the customer's reply, e.g. I will pay on Friday",class:"rep"}),res=h("div",{class:"tmeta"});
  var rb=h("button",{class:"btn h",text:"Read reply",onclick:function(){if(!rep.value.trim())return;api("POST","/settle/dues/"+d.id+"/reply",{text:rep.value}).then(function(j){res.textContent=j.result;rep.value="";setTimeout(load,1800)}).catch(function(er){res.textContent=er.message})}});
  var ev=d.events.length?h("div",{class:"tmeta"},["Last: "+d.events[d.events.length-1].kind+(d.events[d.events.length-1].channel?" via "+d.events[d.events.length-1].channel:"")+" · "+new Date(d.events[d.events.length-1].at).toLocaleString()]):null;
  return h("div",{class:"zc "+(d.status=="paid"?"paid":"")},[
   h("div",{class:"zc1"},[h("div",{},[h("b",{text:d.name}),h("div",{class:"tmeta",text:(d.note||"")+(d.contact?" · "+d.contact:"")})]),h("div",{class:"zr"},[h("b",{text:money(d.currency,d.amount)}),h("div",{class:"tmeta",text:"Due "+d.due+(d.daysLate?" · "+d.daysLate+" days late":"")})]),h("span",{class:"tpill s-"+d.stage.replace(" ","").toLowerCase(),text:d.stage+(d.promiseDate?" "+d.promiseDate:"")})]),
   d.status=="paid"?null:h("div",{class:"tact"},[tone,ch,prep]),out,
   d.status=="paid"?null:h("div",{class:"tact"},[rep,rb]),res,ev,
   h("div",{class:"tact"},[d.status=="paid"?null:h("button",{class:"btn h",text:"Mark paid",onclick:function(){api("POST","/settle/dues/"+d.id+"/paid").then(load)}}),h("button",{class:"lnk",text:"Delete",onclick:function(){api("DELETE","/settle/dues/"+d.id).then(load)}})])]);
 }
 function load(){api("GET","/settle/dues").then(function(j){var s=j.summary;stats.innerHTML="";[["Outstanding",money("",s.outstanding)],["Open dues",s.open],["Overdue",s.overdue],["Collected",money("",s.collected)]].forEach(function(x){stats.appendChild(h("div",{class:"tstat"},[h("small",{text:x[0]}),h("b",{text:String(x[1])})]))});list.innerHTML="";if(!j.dues.length){list.appendChild(h("div",{class:"tempty"},["No dues yet. ",h("button",{class:"btn w",text:"Load sample dues",onclick:function(){api("POST","/settle/sample").then(load)}})," or add your own below."]))}j.dues.forEach(function(d){list.appendChild(card(d))})}).catch(function(er){note(msg,er.message,1)})}
 root.append(h("p",{class:"tint",text:"Add what customers owe. Settle suggests the right tone for each, writes the reminder, and reads their replies to update the status."}),stats,list,h("h3",{text:"Add a due"}),f,msg,h("p",{class:"tfoot",text:"Trial workspace: reminders are prepared for you to copy, and are not sent from here. Your data stays in this browser's workspace."}));load();
}

/* ---------------- SCRIBE ---------------- */
function scribe(){
 var list=h("div",{class:"tlist"}),msg=h("div",{class:"tnote"}),docs=[];
 var fi=h("input",{type:"file",accept:"image/png,image/jpeg,image/webp,application/pdf",multiple:"",hidden:""});
 var drop=h("label",{class:"tdrop"},[fi,h("b",{text:"Drop invoices here or click to choose"}),h("small",{text:"PNG, JPG, WebP or PDF · up to 4 MB each"})]);
 function one(f){return new Promise(function(ok,no){if(f.size>4*1048576)return no(new Error(f.name+" is over 4 MB"));var fr=new FileReader();fr.onload=function(){api("POST","/scribe/read",{type:f.type,data:String(fr.result).split(",")[1],name:f.name}).then(ok,no)};fr.onerror=function(){no(new Error("Could not open "+f.name))};fr.readAsDataURL(f)})}
 function run(files){var q=[].slice.call(files),n=0,bad=null;(function nx(){var f=q.shift();if(!f){if(bad)note(msg,bad,1);else note(msg,n?"Done.":"Nothing read.");load();return}note(msg,"Reading "+f.name+"…");one(f).then(function(){n++;load()},function(er){bad=er.message}).then(nx)})()}
 fi.onchange=function(){run(fi.files);fi.value=""};
 ["dragover","drop"].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();if(ev=="drop")run(e.dataTransfer.files)})});
 function card(d){var rows=[["Supplier",d.supplier],["Invoice no.",d.invoice_number],["Date",d.date],["Subtotal",d.subtotal],["Tax",d.tax],["Total",d.total]];
  return h("div",{class:"zc"},[h("div",{class:"zc1"},[h("b",{text:d.file}),h("button",{class:"lnk",text:"Delete",onclick:function(){api("DELETE","/scribe/docs/"+d._id).then(load)}})]),
   h("div",{class:"tkv"},rows.map(function(r){return h("div",{},[h("span",{text:r[0]}),h("b",{text:r[1]==null?"not found":(typeof r[1]=="number"?(d.currency||"")+" "+r[1].toFixed(2):String(r[1]))})])})),
   (d.items||[]).length?h("div",{class:"tmeta",text:d.items.map(function(i){return (i.quantity!=null?i.quantity+" × ":"")+i.description+(i.amount!=null?" ("+i.amount+")":"")}).join(" · ")}):null,
   (d.checks||[]).length?h("div",{class:"tflag",text:"Needs review: "+d.checks.join(" ")}):h("div",{class:"tok",text:"Totals add up"})])}
 function csv(){var c=function(v){return '"'+String(v==null?"":v).replace(/"/g,'""')+'"'};var t=["file,supplier,invoice_no,date,currency,subtotal,tax,total,needs_review"].concat(docs.map(function(d){return [d.file,d.supplier,d.invoice_number,d.date,d.currency,d.subtotal,d.tax,d.total,(d.checks||[]).join(" ")].map(c).join(",")})).join("\n");var a=h("a",{href:URL.createObjectURL(new Blob([t],{type:"text/csv"})),download:"scribe-invoices.csv"});document.body.appendChild(a);a.click();a.remove()}
 function load(){api("GET","/scribe/docs").then(function(j){docs=j.docs;list.innerHTML="";if(!docs.length)list.appendChild(h("div",{class:"tempty",text:"No invoices yet. Upload one above."}));docs.forEach(function(d){list.appendChild(card(d))})}).catch(function(er){note(msg,er.message,1)})}
 root.append(h("p",{class:"tint",text:"Upload invoices and Scribe reads them into clean data, then checks the arithmetic and flags anything that does not add up."}),drop,msg,h("div",{class:"tact"},[h("button",{class:"btn h",text:"Download CSV",onclick:function(){docs.length?csv():note(msg,"Read an invoice first.",1)}})]),list,h("p",{class:"tfoot",text:"AI reading can make mistakes. Always confirm important figures. Trial: 12 reads a day. Uploaded files are not kept; only the extracted fields are saved in your workspace."}));load();
}

/* ---------------- VOX ---------------- */
function vox(){
 var SR=window.SpeechRecognition||window.webkitSpeechRecognition,syn=window.speechSynthesis;
 var setup=h("form",{class:"tform"}),call=h("div",{class:"tcall",hidden:""}),tr=h("div",{class:"ttr"}),msg=h("div",{class:"tnote"}),sum=h("div",{class:"tcard",hidden:""});
 var goal=h("select",{name:"goal"},[["payment","Payment reminder"],["appointment","Appointment confirmation"],["lead","Lead qualification"]].map(function(g){return h("option",{value:g[0],text:g[1]})}));
 var detail=h("input",{name:"detail",placeholder:"e.g. invoice 1042, $380 due last Friday",value:"invoice 1042, $380 due last Friday"});
 setup.append(h("div",{class:"tgrid"},[h("label",{},["Your business",h("input",{name:"business",value:"Northwind"})]),h("label",{},["Customer's name (you)",h("input",{name:"customer",value:"Mr Rao"})]),h("label",{},["What is the call for?",goal]),h("label",{},["Details the agent may use",detail])]),h("button",{class:"btn w",type:"submit",text:"Start the call"}));
 var sc,hist=[],rec=null,muted=false,ended=false,busy=false;
 var inp=h("input",{placeholder:"Type your reply and press Enter",class:"rep"}),mic=h("button",{class:"btn h",type:"button",text:SR?"🎙 Speak":"Voice not supported here"}),spk=h("button",{class:"btn h",type:"button",text:"🔊 Voice on"}),end=h("button",{class:"btn w",type:"button",text:"End call"});
 if(!SR)mic.disabled=true;
 function line(w,t){tr.appendChild(h("div",{class:w=="a"?"va":"vc"},[h("b",{text:w=="a"?"Vox":"You"}),t]));tr.scrollTop=1e9}
 function say(t,cb){if(muted||!syn){cb&&cb();return}try{syn.cancel();var u=new SpeechSynthesisUtterance(t);u.onend=u.onerror=function(){cb&&cb()};syn.speak(u)}catch(e){cb&&cb()}}
 function listen(){if(!SR||ended||busy||muted===null)return;try{rec=new SR();rec.lang="en-US";rec.interimResults=false;rec.onresult=function(e){var t=e.results[0][0].transcript;send(t)};rec.onerror=function(){mic.textContent="🎙 Speak"};rec.onend=function(){mic.textContent="🎙 Speak"};mic.textContent="🎙 Listening…";rec.start()}catch(e){}}
 function agent(t){hist.push({role:"assistant",content:t});line("a",t);say(t,function(){if(!ended&&micOn)listen()})}
 var micOn=false;
 function send(t){t=t.trim();if(!t||busy||ended)return;busy=true;try{rec&&rec.abort()}catch(e){}hist.push({role:"user",content:t});line("c",t);api("POST","/vox/turn",{scenario:sc,messages:hist}).then(function(j){busy=false;if(j.done){hist.push({role:"assistant",content:j.reply});line("a",j.reply);say(j.reply,finish)}else agent(j.reply)}).catch(function(er){busy=false;note(msg,er.message,1)})}
 function finish(){if(ended)return;ended=true;try{rec&&rec.abort();syn&&syn.cancel()}catch(e){}inp.disabled=true;mic.disabled=true;api("POST","/vox/summary",{scenario:sc,messages:hist}).then(function(o){sum.hidden=false;sum.innerHTML="";sum.append(h("h3",{text:"Call summary"}),h("div",{class:"tkv"},[["Outcome",o.outcome],["Promise / date",o.promise_date||"none"],["Sentiment",o.sentiment],["Next step",o.next_action],["Needs a person",o.needs_human?"Yes":"No"]].map(function(r){return h("div",{},[h("span",{text:r[0]}),h("b",{text:String(r[1])})])})),h("button",{class:"btn w",text:"Start another call",onclick:function(){location.reload()}}))})}
 setup.onsubmit=function(e){e.preventDefault();var fd=new FormData(setup);sc={business:fd.get("business"),customer:fd.get("customer"),goal:fd.get("goal"),detail:fd.get("detail")};setup.hidden=true;call.hidden=false;api("POST","/vox/start",{scenario:sc}).then(function(j){agent(j.reply)}).catch(function(er){note(msg,er.message,1)})};
 mic.onclick=function(){micOn=true;listen()};spk.onclick=function(){muted=!muted;spk.textContent=muted?"🔇 Voice off":"🔊 Voice on";if(muted&&syn)syn.cancel()};end.onclick=finish;
 inp.onkeydown=function(e){if(e.key=="Enter"){e.preventDefault();var v=inp.value;inp.value="";send(v)}};
 call.append(h("div",{class:"twv"},[1,2,3,4,5,6,7].map(function(){return h("i")})),tr,h("div",{class:"tact"},[inp,mic,spk,end]));
 root.append(h("p",{class:"tint",text:"Vox is an AI phone agent. Start a call and you play the customer: speak with your microphone or type. At the end Vox writes the call summary."}),setup,call,msg,sum,h("p",{class:"tfoot",text:"This runs in your browser with your microphone (Chrome or Edge work best; typing works everywhere). Real phone calls use a phone line from your account."}));
}
({settle:settle,scribe:scribe,vox:vox})[tool]&&({settle:settle,scribe:scribe,vox:vox})[tool]();
})();
