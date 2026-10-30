var sb=null, cloudReady=false;
try {
 if(window.supabase && SUPABASE_URL.indexOf("YOUR_")!==0 && SUPABASE_ANON_KEY.indexOf("YOUR_")!==0){
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); cloudReady=true;
 }
} catch(e){console.error("Supabase initialization failed",e);}
var GROUPS={f:"Formators",M:"Major Seminarians",m:"Minor Seminarians"};
var BATCHES=["Deacons","Third year Theology","Second year Theology","First year Theology","Regency","Third year Philosophy","Second year Philosophy","First year Philosophy","PG Students"];
var PAGE_OF={formators:"f",major:"M",minor:"m"};
var P=[],page="home",user=null,photo=null,majorQuery="",IX={a:0,b:0,m:0},TM=[];
var C={a:[],b:[],m:[]};
function setStatus(message,isError){
 var el=document.getElementById("cloud-status");
 if(!el){el=document.createElement("div");el.id="cloud-status";el.style.cssText="position:fixed;top:10px;left:12px;right:12px;z-index:50;padding:10px 14px;border-radius:12px;background:rgba(10,31,61,.97);border:1px solid rgba(255,255,255,.3);color:#F4F9FF;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.25)";document.body.appendChild(el);}
 el.style.borderColor=isError?"#FFC2C2":"#92FE9D";el.textContent=message;el.style.display=message?"block":"none";
 if(message&&!isError)setTimeout(function(){if(el.textContent===message)el.style.display="none"},4500);
}
function save(){return savePeopleToCloud();}
function saveC(){return saveCarouselToCloud();}
async function loadCloudData(){
 if(!cloudReady){P=[];C={a:[],b:[],m:[]};setStatus("Supabase is not configured. No directory data is available.",true);render();return;}
 try{
  var pr=await sb.from("directory_people").select("id,group_key,data,auth_user_id").order("name",{ascending:true});
  if(pr.error)throw pr.error;
  P=(pr.data||[]).map(function(r){var d=r.data||{};d.id=r.id;d.g=r.group_key;if(r.auth_user_id)d.auth_user_id=r.auth_user_id;return d;});
  var cr=await sb.from("directory_carousels").select("key,items");
  if(cr.error)throw cr.error;
  C={a:[],b:[],m:[]};(cr.data||[]).forEach(function(r){if(["a","b","m"].indexOf(r.key)>=0)C[r.key]=Array.isArray(r.items)?r.items:[];});
  render();
 }catch(e){console.error(e);setStatus("Could not load cloud data: "+(e.message||"Check SQL setup and access policies."),true);}
}
async function savePeopleToCloud(){
 if(!cloudReady||!user){setStatus("Configure Supabase and sign in before saving.",true);return false;}
 try{
  var rows=P.map(function(p){return {id:String(p.id),group_key:p.g,name:p.name,data:p,auth_user_id:p.auth_user_id||null};});
  if(rows.length){var r=await sb.from("directory_people").upsert(rows,{onConflict:"id"});if(r.error)throw r.error;}
  return true;
 }catch(e){console.error(e);setStatus("Save failed: "+(e.message||"Check permissions."),true);return false;}
}
async function saveOnePersonCloud(p,isNew){
 if(!cloudReady||!user){setStatus("Configure Supabase and sign in before saving.",true);return false;}
 var row={id:String(p.id),group_key:p.g,name:p.name,data:p,auth_user_id:p.auth_user_id||null};
 try{
  var r;
  if(isNew) r=await sb.from("directory_people").insert(row);
  else r=await sb.from("directory_people").update({group_key:row.group_key,name:row.name,data:p,auth_user_id:row.auth_user_id}).eq("id",row.id);
  if(r.error)throw r.error;
  return true;
 }catch(e){console.error(e);setStatus("Save failed: "+(e.message||"Check permissions."),true);return false;}
}
async function saveCarouselToCloud(){
 if(!cloudReady||!user){setStatus("Configure Supabase and sign in before saving.",true);return false;}
 try{var rows=["a","b","m"].map(function(k){return {key:k,items:C[k]||[]};});var r=await sb.from("directory_carousels").upsert(rows,{onConflict:"key"});if(r.error)throw r.error;return true;}
 catch(e){console.error(e);setStatus("Carousel save failed: "+(e.message||"Check permissions."),true);return false;}
}
async function restoreSession(){
 if(!cloudReady){await loadCloudData();return;}
 try{
  var r=await sb.auth.getSession();if(r.error)throw r.error;
  if(r.data.session)await applyAuthenticatedUser(r.data.session.user);else await loadCloudData();
  sb.auth.onAuthStateChange(function(ev,s){if(ev==="SIGNED_OUT"){user=null;loadCloudData();}else if(ev==="SIGNED_IN"&&s&&!user)setTimeout(function(){applyAuthenticatedUser(s.user)},0);});
 }catch(e){console.error(e);setStatus("Could not restore login: "+e.message,true);render();}
}
var applyP=null;
function applyAuthenticatedUser(authUser){
 if(applyP)return applyP;
 applyP=applyAuthenticatedUserRun(authUser).finally(function(){applyP=null});
 return applyP;
}
async function applyAuthenticatedUserRun(authUser){
 try{
  var r=await sb.from("directory_user_roles").select("role,person_id").eq("user_id",authUser.id).maybeSingle();if(r.error)throw r.error;
  if(!r.data){await sb.auth.signOut();user=null;await loadCloudData();setStatus("No directory role is assigned to this account. Ask the administrator.",true);return;}
  user={role:r.data.role,name:authUser.email||"User",id:r.data.person_id||null,authId:authUser.id,email:authUser.email};
  await loadCloudData();var me=user.id&&P.find(function(p){return String(p.id)===String(user.id)});if(me)user.name=me.name;
 }catch(e){console.error(e);setStatus("Could not load account permissions: "+e.message,true);render();}
}
function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function ini(n){return n.replace(/^(Fr\.|Br\.)\s*/,"").split(/\s+/).slice(0,2).map(function(w){return w[0]}).join("").toUpperCase()}
function av(p){return p.photo?'<img src="'+esc(p.photo)+'" alt="">':esc(ini(p.name))}
var canAdd=function(){return user&&(user.role==="admin"||user.role==="staff")};
var canEdit=function(p){return canAdd()||(user&&user.role==="seminarian"&&user.id===p.id)};
var ICON={
home:'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
formators:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
major:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.500 7 6M16 4.500a3.500 3.500 0 010 7M18 14c2.500.7 4 2.800 4 6"/>',
minor:'<path d="M12 3l9 5-9 5-9-5 9-5zM6 11v5c0 1.500 2.700 3 6 3s6-1.500 6-3v-5"/>',
login:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'};
var TABS=[["home","Home"],["formators","Formators"],["major","Major"],["minor","Minor"],["login",null]];
function go(p){page=p;render();window.scrollTo(0,0)}
function render(){
 document.getElementById("nav").innerHTML=TABS.map(function(t){
  var l=t[0]==="login"?(user?"Account":"Login"):t[1];
  return '<button onclick="go(\''+t[0]+'\')"'+(page===t[0]?' aria-current="page"':'')+'><svg viewBox="0 0 24 24">'+ICON[t[0]]+'</svg>'+l+'</button>'}).join("");
 var a=document.getElementById("app");
 if(page==="home")a.innerHTML=homeV();
 else if(page==="login")a.innerHTML=(user&&loginMode==="setpw")?setpwV():user?acctV():loginV();
 else a.innerHTML=page==="minor"?minorV():listV(PAGE_OF[page]);
 startC();
}
function homeV(){
 var b=[["formators","f"],["major","M"],["minor","m"]].map(function(x){
  var n=P.filter(function(p){return p.g===x[1]}).length;
  return '<button class="stat" onclick="go(\''+x[0]+'\')"><span>'+GROUPS[x[1]]+'</span><b>'+n+'</b></button>'}).join("");
 return '<section class="hero"><h1>Our seminary community</h1><p class="sub">'+(user?'Welcome, '+esc(user.name)+'. ':'')+'Find formators and seminarians, with their contact details and parish.</p>'+car("a","fx")+'<h2 class="sec">Life at the seminary</h2>'+car("b","sl")+'<div class="stats">'+b+'</div></section>';
}
function batchOf(p){var t=String(p.title||"").trim().toLowerCase();for(var i=0;i<BATCHES.length;i++)if(BATCHES[i].toLowerCase()===t)return i;return BATCHES.length}
function byName(a,b){return String(a.name||"").localeCompare(String(b.name||""))}
function cardH(p,sub){return '<button class="card" onclick="showP(\''+p.id+'\')"><div class="ph">'+av(p)+'</div><div class="nm">'+esc(p.name)+'<small>'+esc(sub)+'</small></div></button>'}
function batchSel(cur){
 cur=String(cur||"").trim();
 var known=BATCHES.some(function(b){return b.toLowerCase()===cur.toLowerCase()});
 var o='<option value="">Select batch…</option>'+BATCHES.map(function(b){return '<option value="'+esc(b)+'"'+(known&&b.toLowerCase()===cur.toLowerCase()?' selected':'')+'>'+esc(b)+'</option>'}).join("");
 if(cur&&!known)o+='<option value="'+esc(cur)+'" selected>'+esc(cur)+' (current)</option>';
 return '<label for="e_title">Course and year</label><select id="e_title">'+o+'</select>';
}
function listV(g){
 var all=P.filter(function(p){return p.g===g}),L=all;
 if(g==="M"&&majorQuery){
  var query=majorQuery.toLowerCase();
  L=all.filter(function(p){return [p.name,p.title,p.parish,p.seminary].some(function(v){return (v||"").toLowerCase().indexOf(query)>=0})});
 }
 var add=canAdd()?'<button class="btn" onclick="editP(null,\''+g+'\')">Add person</button>':'';
 var search=g==="M"?'<form class="search-form" onsubmit="searchMajor(event)"><input id="major-search" type="search" aria-label="Search major seminarians" placeholder="Search by name, course, or parish" value="'+esc(majorQuery)+'"><button class="btn" type="submit">Search</button></form>':"";
 var empty=all.length?(g==="M"?"No major seminarians match your search.":"No one listed yet."):"No one listed yet.";
 return '<div class="bar"><div><h1>'+GROUPS[g]+'</h1><p class="sub" style="margin-bottom:0">Tap a card to see full details.</p></div>'+add+'</div>'+search+
 (L.length?(g==="M"?BATCHES.concat(["Other"]).map(function(b,i){
   var m=L.filter(function(p){return batchOf(p)===i}).sort(byName);
   if(!m.length)return "";
   return '<h2 class="yr">'+esc(b)+' <small style="color:var(--mu);font-weight:400;font-size:.9rem">('+m.length+')</small></h2><div class="grid">'+m.map(function(p){return cardH(p,i===BATCHES.length?p.title:p.parish)}).join("")+'</div>'}).join(""):
  '<div class="grid">'+L.map(function(p){return cardH(p,p.title)}).join("")+'</div>'):'<p class="empty">'+empty+'</p>');
}
function searchMajor(e){e.preventDefault();majorQuery=document.getElementById("major-search").value.trim();render()}
function showP(id){
 var p=P.find(function(x){return x.id===id});if(!p)return;
 var dg=function(s){return String(s||"").replace(/\D/g,"")};
 var ig=(p.instagram||"").replace(/^@/,"").replace(/^https?:\/\/(www\.)?instagram\.com\//,"").replace(/\/$/,"");
 var ct=[
  ["Call",p.phone&&"tel:"+p.phone.replace(/\s/g,""),"call",'<svg class="phone-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 2.8 9.2 2c.8-.2 1.6.2 1.9 1l1.2 3.1c.3.7.1 1.5-.5 2l-1.7 1.4a14.5 14.5 0 0 0 4.4 4.4l1.4-1.7c.5-.6 1.3-.8 2-.5l3.1 1.2c.8.3 1.2 1.1 1 1.9l-.8 2.6c-.3 1-1.3 1.7-2.4 1.6C10 18.2 5.8 14 5 5.2c-.1-1.1.6-2.1 1.6-2.4Z"/></svg>'],
  ["WhatsApp",dg(p.whatsapp)&&"https://wa.me/"+dg(p.whatsapp),"wa",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z"/><path d="M8.5 7.4c.2-.3.5-.4.8-.4h.5c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.7.8c.7 1.3 1.7 2.3 3 3l.8-.7c.2-.2.5-.2.7-.1l1.8.8c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.5.4-1.2.6-1.9.4-3.4-.9-6-3.5-6.9-6.9-.2-.7 0-1.4.4-1.9Z"/></svg>'],
  ["Instagram",ig&&"https://instagram.com/"+ig,"ig",'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.8" cy="6.5" r=".7" fill="currentColor" stroke="none"/></svg>'],
  ["Email",p.email&&"mailto:"+p.email,"mail",'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3.5 6 8.5 7 8.5-7M4 18l6.3-6M20 18l-6.3-6"/></svg>']
 ].filter(function(x){return x[1]}).map(function(x){var target=x[0]==="WhatsApp"||x[0]==="Instagram"?' target="_blank" rel="noopener noreferrer"':"";return '<a class="'+x[2]+'" href="'+esc(x[1])+'" aria-label="'+x[0]+'" title="'+x[0]+'"'+target+'>'+x[3]+'<span class="sr-only">'+x[0]+'</span></a>'}).join("");
 ct=ct?'<div class="ct">'+ct+'</div>':"";
 var rows=[["Phone",p.phone],["Email",p.email],["Parish",p.parish],["Birthday",p.dob&&fd(p.dob)],["Ordination day",p.ordinationDay],["Feast",p.feast],["Seminary",p.seminary],["Address",p.address]].filter(function(r){return r[1]}).map(function(r){return '<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd></div>'}).join("");
 var act=(canEdit(p)?'<button class="btn" onclick="editP(\''+p.id+'\')">Edit details</button>':'')+(user&&user.role==="admin"?'<button class="btn del" onclick="delP(\''+p.id+'\')">Delete</button>':'');
 modal('<div class="top"><div class="ph">'+av(p)+'</div><div><h2>'+esc(p.name)+'</h2><div style="color:var(--mu)">'+esc(p.title)+'</div></div></div>'+ct+'<dl>'+rows+'</dl><div class="row">'+act+'<button class="btn alt" onclick="closeM()">Close</button></div>');
}
function fd(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;var d=new Date(s+"T00:00");return isNaN(d)?s:d.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}
function minorV(){
 var L=P.filter(function(p){return p.g==="m"}),ys=[];
 L.forEach(function(p){if(ys.indexOf(p.title)<0)ys.push(p.title)});
 ys.sort(function(a,b){return b.localeCompare(a,undefined,{numeric:true})});
 var add=canAdd()?'<button class="btn" onclick="editP(null,\'m\')">Add person</button>':'';
 return '<div class="bar"><h1>Minor Seminarians</h1>'+add+'</div>'+car("m","fx")+(ys.length?ys.map(function(y){return '<h2 class="yr">'+esc(y||"Year not set")+'</h2>'+L.filter(function(p){return p.title===y}).map(function(p){var t='<b>'+esc(p.name)+'</b><small>'+esc(p.parish)+'</small>';return canAdd()?'<button class="li" onclick="showP(\''+p.id+'\')">'+t+'</button>':'<div class="li">'+t+'</div>'}).join("")}).join(""):'<p class="empty">No one listed yet.</p>');
}
function car(k,st){
 var L=C[k];
 var m=canAdd()?'<div class="cm"><label class="btn alt sm">Add image<input type="file" accept="image/*" hidden onchange="addImg(\''+k+'\',this)"></label>'+(L.length?'<button class="btn del sm" onclick="rmImg(\''+k+'\')">Remove current</button>':'')+'</div>':'';
 if(!L.length)return canAdd()?'<p class="empty" style="padding:12px 0">No images yet.</p>'+m:'';
 if(IX[k]>=L.length)IX[k]=0;
 var sl=L.map(function(x,j){return '<div class="sd g'+(j%4)+(j===IX[k]?' on':'')+'">'+(x.img?'<img src="'+esc(x.img)+'" alt="">':'')+(x.t?'<span>'+esc(x.t)+'</span>':'')+'</div>'}).join("");
 var dots='<div class="dots">'+L.map(function(x,j){return '<button class="dt'+(j===IX[k]?' on':'')+'" aria-label="Image '+(j+1)+'" onclick="setC(\''+k+'\','+j+')"></button>'}).join("")+'</div>';
 return '<div class="cr '+st+'" id="c_'+k+'">'+(st==="sl"?'<div class="vp"><div class="tr" style="--i:'+IX[k]+'">'+sl+'</div></div>':sl)+dots+'</div>'+m;
}
function setC(k,i){
 var L=C[k];i=(i+L.length)%L.length;IX[k]=i;var e=document.getElementById("c_"+k);if(!e)return;
 e.querySelectorAll(".sd").forEach(function(s,j){s.classList.toggle("on",j===i)});
 e.querySelectorAll(".dt").forEach(function(d,j){d.classList.toggle("on",j===i)});
 var t=e.querySelector(".tr");if(t)t.style.setProperty("--i",i);
}
function startC(){TM.forEach(clearInterval);TM=[];["a","b","m"].forEach(function(k){if(document.getElementById("c_"+k)&&C[k].length>1)TM.push(setInterval(function(){setC(k,IX[k]+1)},k==="b"?4200:5600))})}
function shrink(f,mx,cb){var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var c=document.createElement("canvas"),s=Math.min(1,mx/Math.max(im.width,im.height));c.width=im.width*s;c.height=im.height*s;c.getContext("2d").drawImage(im,0,0,c.width,c.height);cb(c.toDataURL("image/jpeg",.8))};im.src=r.result};r.readAsDataURL(f)}
function addImg(k,i){var f=i.files[0];if(!f)return;shrink(f,700,function(u){C[k].push({id:"i"+Date.now(),img:u});IX[k]=C[k].length-1;saveC().then(function(ok){render();if(ok)setStatus("Carousel image saved to Supabase.")})})}
function rmImg(k){if(!C[k]||!C[k].length)return;C[k].splice(IX[k],1);IX[k]=0;saveC().then(function(ok){render();if(ok)setStatus("Carousel updated in Supabase.")})}
function modal(h){var m=document.getElementById("modal");m.innerHTML='<div class="ov" onclick="if(event.target===this)closeM()"><div class="sheet" role="dialog" aria-modal="true">'+h+'</div></div>'}
function closeM(){document.getElementById("modal").innerHTML=""}
function editP(id,g){
 var p=id?P.find(function(x){return x.id===id}):{g:g,name:"",title:"",parish:"",phone:"",email:"",address:""};
 photo=p.photo||null;
 function f(k,l){return '<label for="e_'+k+'">'+l+'</label><input id="e_'+k+'" value="'+esc(p[k])+'">'}
 function classSel(cur){
  var years=["Third Year","Second Year","First Year"],value=String(cur||"").trim();
  var known=years.some(function(year){return year.toLowerCase()===value.toLowerCase()});
  var options='<option value="">Select year / class…</option>'+years.map(function(year){return '<option value="'+year+'"'+(known&&year.toLowerCase()===value.toLowerCase()?' selected':'')+'>'+year+'</option>'}).join("");
  if(value&&!known)options+='<option value="'+esc(value)+'" selected>'+esc(value)+' (current)</option>';
  return '<label for="e_title">Year / class</label><select id="e_title">'+options+'</select>';
 }
 modal('<h2>'+(id?'Edit details':'Add person')+'</h2>'+f("name","Full name")+(p.g==="M"?batchSel(p.title):p.g==="m"?classSel(p.title):f("title","Role"))+f("phone","Phone")+f("whatsapp","WhatsApp number")+f("instagram","Instagram username")+f("email","Email")+
 '<label for="e_address">Address</label><textarea id="e_address" rows="2">'+esc(p.address)+'</textarea>'+f("parish","Parish")+(p.g!=="m"?f("dob","Birthday").replace("<input",'<input placeholder="e.g. 8 March 2001"')+f("feast","Feast day"):"")+(p.g==="f"?f("ordinationDay","Ordination day"):"")+(p.g==="M"?f("seminary","Seminary"):"")+
 '<label for="e_photo">Photo</label><input id="e_photo" type="file" accept="image/*" onchange="pick(this)">'+
 '<div class="err" id="eerr"></div><div class="row"><button class="btn" onclick="saveP(\''+(id||"")+'\',\''+p.g+'\')">Save changes</button><button class="btn alt" onclick="closeM()">Cancel</button></div>');
}
function pick(i){
 var f=i.files[0];if(!f)return;var r=new FileReader();
 r.onload=function(){var im=new Image();im.onload=function(){var c=document.createElement("canvas"),s=Math.min(1,320/Math.max(im.width,im.height));c.width=im.width*s;c.height=im.height*s;c.getContext("2d").drawImage(im,0,0,c.width,c.height);photo=c.toDataURL("image/jpeg",.8)};im.src=r.result};
 r.readAsDataURL(f);
}
async function saveP(id,g){
 var v=function(k){return document.getElementById("e_"+k).value.trim()};
 if(!v("name")){document.getElementById("eerr").textContent="Enter a name to save.";return}
 var d={name:v("name"),title:v("title"),phone:v("phone"),email:v("email"),address:v("address"),parish:v("parish"),whatsapp:v("whatsapp"),instagram:v("instagram"),photo:photo};
 if(document.getElementById("e_dob"))d.dob=v("dob"),d.feast=v("feast");
 if(document.getElementById("e_ordinationDay"))d.ordinationDay=v("ordinationDay");
 if(document.getElementById("e_seminary"))d.seminary=v("seminary");
 var isNew=!id;
 if(id){var existing=P.find(function(x){return String(x.id)===String(id)});if(!existing){document.getElementById("eerr").textContent="This record no longer exists. Reload the page.";return;}Object.assign(existing,d);d=existing;}
 else{d.id="p"+Date.now();d.g=g;P.push(d)}
 var ok=await saveOnePersonCloud(d,isNew);
 if(ok){closeM();await loadCloudData();setStatus("Changes saved to Supabase.");}
 else{await loadCloudData();var ee=document.getElementById("eerr");if(ee)ee.textContent="Could not save. Please try again.";}
}
function delP(id){
 var p=P.find(function(x){return String(x.id)===String(id)});if(!p)return;
 modal('<h2>Delete '+esc(p.name)+'?</h2><p class="sub">This removes their card and details from the shared directory.</p><div class="err" id="derr"></div><div class="row"><button class="btn del" onclick="deletePersonCloud(\''+id+'\')">Delete</button><button class="btn alt" onclick="closeM()">Keep</button></div>');
}
async function deletePersonCloud(id){
 if(!cloudReady||!user){setStatus("Please sign in to delete records.",true);return;}
 try{var r=await sb.from("directory_people").delete().eq("id",String(id));if(r.error)throw r.error;P=P.filter(function(x){return String(x.id)!==String(id)});closeM();render();setStatus("Person deleted from Supabase.");}
 catch(e){console.error(e);var el=document.getElementById("derr");if(el)el.textContent="Delete failed: "+e.message;}
}
function pwF(id,ac,min){
 return '<div class="pw"><input id="'+id+'" type="password" autocomplete="'+ac+'"'+(min?' minlength="8"':'')+' required><button type="button" class="pwt" aria-label="Show password" aria-pressed="false" onclick="togglePw(\''+id+'\',this)">Show</button></div>';
}
function togglePw(id,b){
 var i=document.getElementById(id),show=i.type==="password";
 i.type=show?"text":"password";b.textContent=show?"Hide":"Show";
 b.setAttribute("aria-pressed",show?"true":"false");b.setAttribute("aria-label",show?"Hide password":"Show password");
}
var loginMode="pw",codeEmail="";
function setMode(m){loginMode=m;render();}
function loginV(){
 if(loginMode==="pw")return loginPwV();
 var head='<h1 style="margin-bottom:8px">Login</h1>';
 if(loginMode==="email")return head+'<p class="sub">Enter the email on your card in the directory. We will email you a code.</p><form onsubmit="sendCode(event)"><label for="ce">Email</label><input id="ce" type="email" autocomplete="email" required><div class="err" id="lerr"></div><div class="row"><button class="btn" type="submit">Email me a code</button><button class="btn alt" type="button" onclick="setMode(\'pw\')">Back</button></div></form>';
 return head+'<p class="sub">We sent a code to '+esc(codeEmail)+'. Enter it below. Check your spam folder if you cannot find it.</p><form onsubmit="checkCode(event)"><label for="cc">Code</label><input id="cc" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required><div class="err" id="lerr"></div><div class="row"><button class="btn" type="submit">Verify</button><button class="btn alt" type="button" onclick="setMode(\'email\')">Use another email</button></div></form>';
}
async function sendCode(e){
 e.preventDefault();
 var email=document.getElementById("ce").value.trim(),err=document.getElementById("lerr"),btn=e.submitter;
 if(!cloudReady){err.textContent="Configure SUPABASE_URL and SUPABASE_ANON_KEY in config.js.";return;}
 var ok=P.some(function(p){return (p.g==="f"||p.g==="M")&&String(p.email||"").trim().toLowerCase()===email.toLowerCase()});
 if(!ok){err.textContent="This email is not on a formator or major seminarian card. Ask the administrator to add it.";return;}
 if(btn)btn.disabled=true;err.textContent="Sending…";
 try{var r=await sb.auth.signInWithOtp({email:email,options:{shouldCreateUser:true}});if(r.error)throw r.error;codeEmail=email;loginMode="code";render();}
 catch(ex){console.error(ex);err.textContent="Could not send the code: "+ex.message;}
 finally{if(btn)btn.disabled=false;}
}
async function checkCode(e){
 e.preventDefault();
 var token=document.getElementById("cc").value.replace(/\s/g,""),err=document.getElementById("lerr"),btn=e.submitter;
 if(btn)btn.disabled=true;err.textContent="Checking…";
 try{
  var r=await sb.auth.verifyOtp({email:codeEmail,token:token,type:"email"});if(r.error)throw r.error;
  await applyAuthenticatedUser(r.data.user);
  loginMode=user?"setpw":"pw";render();
 }catch(ex){console.error(ex);err.textContent="That code did not work: "+ex.message;}
 finally{if(btn)btn.disabled=false;}
}
function setpwV(){
 return '<h1 style="margin-bottom:8px">Set your password</h1><p class="sub">Choose a password to use the next time you log in.</p><form onsubmit="savePw(event)"><label for="np">New password (at least 8 characters)</label>'+pwF("np","new-password",1)+'<label for="np2">Repeat password</label>'+pwF("np2","new-password",1)+'<div class="err" id="lerr"></div><div class="row"><button class="btn" type="submit">Save password</button><button class="btn alt" type="button" onclick="skipPw()">Skip for now</button></div></form>';
}
async function savePw(e){
 e.preventDefault();
 var a=document.getElementById("np").value,b=document.getElementById("np2").value,err=document.getElementById("lerr"),btn=e.submitter;
 if(a!==b){err.textContent="The two passwords do not match.";return;}
 if(btn)btn.disabled=true;err.textContent="Saving…";
 try{var r=await sb.auth.updateUser({password:a});if(r.error)throw r.error;loginMode="pw";go("home");setStatus("Password saved. Use it next time you log in.");}
 catch(ex){console.error(ex);err.textContent="Could not save password: "+ex.message;}
 finally{if(btn)btn.disabled=false;}
}
function skipPw(){loginMode="pw";go("home");}
function loginPwV(){
 return '<h1 style="margin-bottom:8px">Login</h1>'+
 (!cloudReady?'<p class="err">Supabase is not configured. Add your Project URL and publishable/anon key in config.js.</p>':'')+
 '<form onsubmit="doLogin(event)"><label for="lu">Email</label><input id="lu" type="email" autocomplete="username" required><label for="lp">Password</label>'+pwF("lp","current-password")+'<div class="err" id="lerr"></div><div class="row"><button class="btn" type="submit">Log in</button></div></form>'+
 '<p style="margin-top:16px"><button class="btn alt" type="button" onclick="setMode(\'email\')">First time or forgot password? Get a code</button></p>'+
 '<p class="note">Formators and major seminarians: use the email on your card in the directory.</p>';
}
async function doLogin(e){
 e.preventDefault();
 var email=document.getElementById("lu").value.trim(),
     password=document.getElementById("lp").value,
     err=document.getElementById("lerr"),
     btn=e.submitter;
 if(!cloudReady){err.textContent="Configure SUPABASE_URL and SUPABASE_ANON_KEY in config.js.";return;}
 if(btn)btn.disabled=true;err.textContent="Signing in…";
 try{var r=await sb.auth.signInWithPassword({email:email,password:password});if(r.error)throw r.error;await applyAuthenticatedUser(r.data.user);if(user)go("home");}
 catch(ex){console.error(ex);err.textContent="Login failed: "+ex.message;}
 finally{if(btn)btn.disabled=false;}
}
async function doLogout(){
 if(cloudReady){var r=await sb.auth.signOut();if(r.error){setStatus("Logout failed: "+r.error.message,true);return;}}
 user=null;loginMode="pw";await loadCloudData();go("home");
}
function acctV(){
 var me=user.id?P.find(function(x){return x.id===user.id}):null;
 var info={admin:"You can add, edit and delete anyone in the directory.",staff:"You can add and edit people in the directory.",seminarian:"You can update your own details."}[user.role];
 return '<h1>'+esc(user.name)+'</h1><p class="sub">Signed in as '+user.role+'. '+info+'</p><div class="row" style="margin-top:0">'+(me?'<button class="btn" onclick="editP(\''+me.id+'\')">Edit my details</button>':'')+'<button class="btn alt" onclick="doLogout()">Log out</button></div>';
}
restoreSession();
