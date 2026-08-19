import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { collection, getDocs, query, where, limit, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
const roleLevel = { reviewer:1, content_admin:2, superadmin:3 };
let role = null, editing = {}, data = {branches:[],subjects:[],categories:[],resources:[],foundations:[],suggestions:[],logs:[],admins:[]};
const cache = n => data[n] || [];
const can = r => (roleLevel[role]||0) >= (roleLevel[r]||0);
const msg = (el,text,error=false) => { if(el){el.textContent=text;el.className=error?"message error":"message success";} };
const errorText = e => e?.code || e?.message || "حدث خطأ غير معروف.";
const slug = v => String(v||"").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s_-]/gu,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
const normalizeUrl = v => { try { const u=new URL(String(v||"").trim()); u.hash=""; if(u.pathname.length>1&&u.pathname.endsWith("/"))u.pathname=u.pathname.slice(0,-1); return u.toString().toLowerCase(); } catch { return String(v||"").trim().replace(/\/+$/).toLowerCase(); } };
const branchName = id => cache("branches").find(x=>x.id===id||x.stableId===id)?.name || id || "غير محدد";
const categoryName = id => cache("categories").find(x=>x.id===id||x.stableId===id)?.name || id || "غير مصنف";
const subjectName = id => cache("subjects").find(x=>x.id===id||x.stableId===id)?.name || id || "غير محدد";
const branchIdsOfSubject = s => arr(s?.branchIds).length ? arr(s.branchIds) : arr(s?.branchId);
const branchesOf = x => { const ids=arr(x?.branchIds); return ids.length?ids:arr(x?.branchId); };
const nowLog = async (action, collectionName, targetId, details="") => { try { await addDoc(collection(db,"adminLogs"), {action,collection:collectionName,targetId:String(targetId||""),details:String(details||""),adminUid:auth.currentUser?.uid||"",adminEmail:auth.currentUser?.email||"",role,createdAt:serverTimestamp()}); } catch(e){ console.warn("log failed",e); } };
async function all(name, max=500){ const s=await getDocs(query(collection(db,name),limit(max))); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function ensureDefaults(){
  if(role!=="superadmin") return;
  const branchDefaults=[
    {id:"scientific",name:"العلمي",stableId:"scientific",icon:"🔬",order:1,active:true,description:"الفرع العلمي"},
    {id:"literary",name:"الأدبي",stableId:"literary",icon:"📚",order:2,active:true,description:"الفرع الأدبي"},
    {id:"industrial",name:"الصناعي",stableId:"industrial",icon:"⚙️",order:3,active:true,description:"الفرع الصناعي"}
  ];
  const categoryDefaults=[
    {id:"books",name:"كتب",stableId:"books",icon:"📚",order:1,active:true,description:"كتب ومراجع"},
    {id:"summaries",name:"ملخصات",stableId:"summaries",icon:"📝",order:2,active:true,description:"ملخصات ومراجعات"},
    {id:"solutions",name:"حلول",stableId:"solutions",icon:"✅",order:3,active:true,description:"حلول وأسئلة"},
    {id:"exams",name:"اختبارات",stableId:"exams",icon:"🧪",order:4,active:true,description:"اختبارات ونماذج"},
    {id:"worksheets",name:"دوسيات",stableId:"worksheets",icon:"📖",order:5,active:true,description:"دوسيات وملفات"}
  ];
  const bSnap=await getDocs(collection(db,"branches"));
  const cSnap=await getDocs(collection(db,"categories"));
  const batch=writeBatch(db);
  const existingB=new Set(bSnap.docs.map(d=>d.id));
  const existingC=new Set(cSnap.docs.map(d=>d.id));
  branchDefaults.filter(x=>!existingB.has(x.id)).forEach(x=>batch.set(doc(db,"branches",x.id),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  categoryDefaults.filter(x=>!existingC.has(x.id)).forEach(x=>batch.set(doc(db,"categories",x.id),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  if(branchDefaults.some(x=>!existingB.has(x.id))||categoryDefaults.some(x=>!existingC.has(x.id))) await batch.commit();
}

async function ensureStableIds(){
  if(role!=="superadmin") return;
  const [bs,ss,cs]=await Promise.all([getDocs(collection(db,"branches")),getDocs(collection(db,"subjects")),getDocs(collection(db,"categories"))]);
  const batch=writeBatch(db); let changed=false;
  for(const snap of [bs,ss,cs]) for(const d of snap.docs){ const x=d.data(); if(!x.stableId){ batch.update(d.ref,{stableId:slug(x.name)||d.id,updatedAt:serverTimestamp()}); changed=true; } }
  if(changed) await batch.commit();
}

async function loadAll(){
  await ensureDefaults();
  await ensureStableIds();
  const [branches,subjects,categories,resources,foundations,suggestions] = await Promise.all([
    all("branches"), all("subjects"), all("categories"), all("resources"), all("foundations"),
    getDocs(query(collection(db,"suggestions"),where("status","==","pending"),limit(300))).then(s=>s.docs.map(d=>({id:d.id,...d.data()})))
  ]);
  data={...data,branches,subjects,categories,resources,foundations,suggestions};
  if(role==="superadmin") data.admins=await all("admins"); else data.admins=[];
  if(role==="superadmin") data.logs=await all("adminLogs",100).then(x=>x.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))); else data.logs=[];
  render();
}
function optionHTML(items,valueField="id",labelField="name",selected="",extra=""){ return items.filter(x=>x.active!==false).sort((a,b)=>(a.order??9999)-(b.order??9999)||String(a[labelField]||"").localeCompare(String(b[labelField]||""),"ar")).map(x=>`<option value="${esc(x[valueField])}" ${x[valueField]===selected?"selected":""}>${esc(x[labelField])}</option>`).join(""); }
function checks(container, items, selected=[]){ if(!container)return; container.innerHTML=items.filter(x=>x.active!==false).sort((a,b)=>(a.order??9999)-(b.order??9999)).map(x=>`<label><input type="checkbox" value="${esc(x.id)}" ${selected.includes(x.id)?"checked":""}> ${esc(x.name)}</label>`).join(""); }
function checked(container){ return $$("input[type=checkbox]:checked", container).map(x=>x.value); }
function documentId(id,stable){ return `<p class="admin-doc-id"><strong>Document ID:</strong> <code>${esc(id)}</code>${stable?` · <strong>Stable ID:</strong> <code>${esc(stable)}</code>`:""}<button type="button" class="btn small" data-copy-id="${esc(id)}">📋 نسخ ID</button></p>`; }
function openTab(name){ $$(".admin-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name)); $$(".admin-panel").forEach(x=>x.classList.add("hidden")); $("#"+name+"Panel")?.classList.remove("hidden"); }
function render(){
  $("#branchesCount").textContent=cache("branches").length; $("#subjectsCount").textContent=cache("subjects").length; $("#resourcesCount").textContent=cache("resources").length; $("#categoriesCount").textContent=cache("categories").length; $("#suggestionsCount").textContent=cache("suggestions").length; $("#logsCount").textContent=cache("logs").length;
  $$(".super-only").forEach(x=>x.classList.toggle("hidden",role!=="superadmin"));
  renderBranches(); renderSubjects(); renderCategories(); renderResources(); renderFoundations(); renderSuggestions(); renderLogs(); renderAdmins(); renderFormsOptions();
  $("#overviewCards").innerHTML=[['🌿','الفروع',data.branches.length,'branches'],['📚','المواد',data.subjects.length,'subjects'],['🗂️','التصنيفات',data.categories.length,'categories'],['🔗','المصادر',data.resources.length,'resources']].map(x=>`<button class="stat-box" data-tabjump="${x[3]}"><span>${x[0]} ${x[1]}</span><strong>${x[2]}</strong></button>`).join("");
  $("#recentSuggestions").innerHTML=data.suggestions.slice(0,5).map(s=>`<div class="admin-item"><div><strong>${esc(s.title)}</strong><p>اقتراح قيد المراجعة · ${esc(s.studentName||"طالب")}</p></div><button class="btn small" data-tabjump="suggestions">مراجعة</button></div>`).join("")||'<div class="empty">لا توجد اقتراحات معلقة.</div>';
}
function renderBranches(){ $("#branchesList").innerHTML=data.branches.sort((a,b)=>(a.order??9999)-(b.order??9999)).map(b=>`<div class="admin-item"><div><strong>${esc(b.icon||"🌿")} ${esc(b.name)}</strong><p>${esc(b.description||"")} · ${b.active===false?"موقوف":"نشط"} · stableId: ${esc(b.stableId||b.id)}</p>${documentId(b.id,b.stableId)}</div><div><button class="btn small" data-edit-branch="${esc(b.id)}">تعديل</button>${b.active===false?`<button class="btn small" data-toggle-branch="${esc(b.id)}">تفعيل</button>`:`<button class="btn danger small" data-toggle-branch="${esc(b.id)}">تعطيل</button>`}</div></div>`).join("")||'<div class="empty">لا توجد فروع.</div>'; }
function renderSubjects(){ $("#subjectsList").innerHTML=data.subjects.sort((a,b)=>(a.order??9999)-(b.order??9999)).map(s=>`<div class="admin-item"><div><strong>${esc(s.name)}</strong><p>${branchesOf(s).map(branchName).join("، ")||"بدون فرع"} · ${branchesOf(s).length>1?"مادة مشتركة":"مادة لفرع واحد"}</p>${documentId(s.id,s.stableId)}</div><div><button class="btn small" data-edit-sub="${esc(s.id)}">تعديل</button><button class="btn danger small" data-del-sub="${esc(s.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد مواد.</div>'; }
function renderCategories(){ $("#categoriesList").innerHTML=data.categories.sort((a,b)=>(a.order??9999)-(b.order??9999)).map(c=>`<div class="admin-item"><div><strong>${esc(c.icon||"🗂️")} ${esc(c.name)}</strong><p>${esc(c.description||"")} · ${c.active===false?"موقوف":"نشط"}</p>${documentId(c.id,c.stableId)}</div><div><button class="btn small" data-edit-cat="${esc(c.id)}">تعديل</button><button class="btn danger small" data-del-cat="${esc(c.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد تصنيفات.</div>'; }
function renderResources(){ $("#resourcesList").innerHTML=data.resources.sort((a,b)=>(a.order??9999)-(b.order??9999)).map(r=>`<div class="admin-item"><div><strong>${esc(r.title)}</strong><p>📚 ${esc(subjectName(r.subjectId))} · ${branchesOf(r).map(branchName).join("، ")||branchesOfSubject(data.subjects.find(s=>s.id===r.subjectId)).map(branchName).join("، ")} · ${esc(r.categoryId?categoryName(r.categoryId):(r.category||"غير مصنف"))} · ${r.active===false?"موقوف":"نشط"} · <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">الرابط</a></p>${documentId(r.id,r.stableId)}</div><div><button class="btn small" data-edit-res="${esc(r.id)}">تعديل</button><button class="btn danger small" data-del-res="${esc(r.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد مصادر.</div>'; }
function renderFoundations(){ $("#foundationsList").innerHTML=data.foundations.sort((a,b)=>(a.order??9999)-(b.order??9999)).map(f=>`<div class="admin-item"><div><strong>🧠 ${esc(f.title)}</strong><p>📚 ${esc(subjectName(f.subjectId))} · ${branchesOf(f).map(branchName).join("، ")} · ${esc(f.level||"")} · ${esc(f.type||"")} · <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">الرابط</a></p>${documentId(f.id,f.stableId)}</div><div><button class="btn small" data-edit-found="${esc(f.id)}">تعديل</button><button class="btn danger small" data-del-found="${esc(f.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا يوجد تأسيس.</div>'; }
function renderSuggestions(){ $("#suggestionsList").innerHTML=data.suggestions.map(s=>`<div class="admin-item"><div><strong>${esc(s.title)}</strong><p>${s.contentType==="foundation"?"🧠 تأسيس":"📚 مصدر"} · ${branchesOf(s).map(branchName).join("، ")} · ${esc(subjectName(s.subjectId))} · ${esc(s.studentName||"طالب")}</p>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a>`:""}</div><div><button class="btn primary small" data-approve="${esc(s.id)}">✅ موافقة</button><button class="btn danger small" data-reject="${esc(s.id)}">❌ رفض</button></div></div>`).join("")||'<div class="empty">لا توجد اقتراحات معلقة.</div>'; }
function renderLogs(){ if(role!=="superadmin"){$("#logsList").innerHTML="";return;} $("#logsList").innerHTML=data.logs.map(l=>`<div class="admin-item"><div><strong>${esc(l.action)} · ${esc(l.collection||"")}</strong><p>${esc(l.details||"")} · ${esc(l.adminEmail||l.adminUid||"أدمن")} · ${l.createdAt?.seconds?new Date(l.createdAt.seconds*1000).toLocaleString("ar-PS"):"الآن"}</p></div><code>${esc(l.targetId||"")}</code></div>`).join("")||'<div class="empty">لا يوجد سجل بعد.</div>'; }
function renderAdmins(){ if(role!=="superadmin"){$("#adminsList").innerHTML="";return;} $("#adminsList").innerHTML=data.admins.map(a=>`<div class="admin-item"><div><strong>${esc(a.email||a.id)}</strong><p>${esc(a.role||"reviewer")} · ${a.active?"نشط":"موقوف"} · UID: ${esc(a.id)}</p></div><button class="btn small" data-edit-admin="${esc(a.id)}">تعديل</button></div>`).join("")||'<div class="empty">لا يوجد أدمن.</div>'; }
function renderFormsOptions(){
  checks($("#subjectBranches"),data.branches); checks($("#resourceBranches"),data.branches); checks($("#foundationBranches"),data.branches);
  const so=optionHTML(data.subjects); $("#resourceSubject").innerHTML='<option value="">المادة</option>'+so; $("#foundationSubject").innerHTML='<option value="">المادة</option>'+so;
  const co=optionHTML(data.categories); $("#resourceCategory").innerHTML='<option value="">التصنيف</option>'+co;
}
function resetForm(name){ editing[name]=null; $("#"+name+"Form")?.reset(); if(name==="branch")$("#branchActive").checked=true; if(name==="category")$("#categoryActive").checked=true; if(name==="resource")$("#resourceActive").checked=true; renderFormsOptions(); }
function fillChecks(container, ids){ $$("input[type=checkbox]",container).forEach(x=>x.checked=ids.includes(x.value)); }
async function saveEntity(name, payload, id=null){ const col=name+"s"; if(id) await updateDoc(doc(db,col,id),{...payload,updatedAt:serverTimestamp()}); else { const stable=payload.stableId||slug(payload.name||payload.title||""); const ref=stable?doc(db,col,stable):doc(collection(db,col)); await setDoc(ref,{...payload,stableId:stable||ref.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); id=ref.id; } await nowLog(id?"تعديل/إضافة":"إضافة",col,id,payload.name||payload.title||""); await loadAll(); }

// tabs/nav
$$(".admin-tab").forEach(b=>b.onclick=()=>!b.classList.contains("hidden")&&openTab(b.dataset.tab));
document.addEventListener("click",async e=>{ const t=e.target.closest("button"); if(!t)return;
  if(t.dataset.copyId){await navigator.clipboard?.writeText(t.dataset.copyId);return;}
  if(t.dataset.tabjump){openTab(t.dataset.tabjump);return;}
  try{
    if(t.dataset.editBranch){ const x=data.branches.find(v=>v.id===t.dataset.editBranch);editing.branch=x.id; $("#branchId").value=x.stableId||x.id; $("#branchName").value=x.name||""; $("#branchIcon").value=x.icon||""; $("#branchOrder").value=x.order??""; $("#branchActive").checked=x.active!==false; $("#branchDescription").value=x.description||""; $("#branchForm").classList.remove("hidden");openTab("branches"); }
    else if(t.dataset.toggleBranch){ if(!can("superadmin"))throw Error("Super Admin فقط"); const x=data.branches.find(v=>v.id===t.dataset.toggleBranch);await updateDoc(doc(db,"branches",x.id),{active:x.active===false,updatedAt:serverTimestamp()});await nowLog(x.active===false?"تفعيل فرع":"تعطيل فرع","branches",x.id,x.name);await loadAll(); }
    else if(t.dataset.editSub){const x=data.subjects.find(v=>v.id===t.dataset.editSub);editing.subject=x.id;$("#subjectId").value=x.stableId||x.id;$("#subjectName").value=x.name||"";$("#subjectOrder").value=x.order??"";$("#subjectDescription").value=x.description||"";renderFormsOptions();fillChecks($("#subjectBranches"),branchesOfSubject(x));$("#subjectForm").classList.remove("hidden");openTab("subjects");}
    else if(t.dataset.delSub){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف المادة؟"))return;await deleteDoc(doc(db,"subjects",t.dataset.delSub));await nowLog("حذف","subjects",t.dataset.delSub,subjectName(t.dataset.delSub));await loadAll();}
    else if(t.dataset.editCat){const x=data.categories.find(v=>v.id===t.dataset.editCat);editing.category=x.id;$("#categoryId").value=x.stableId||x.id;$("#categoryName").value=x.name||"";$("#categoryIcon").value=x.icon||"";$("#categoryOrder").value=x.order??"";$("#categoryActive").checked=x.active!==false;$("#categoryDescription").value=x.description||"";$("#categoryForm").classList.remove("hidden");openTab("categories");}
    else if(t.dataset.delCat){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف التصنيف؟ المصادر لن تُحذف، لكنها ستحتاج تصنيفًا آخر."))return;await deleteDoc(doc(db,"categories",t.dataset.delCat));await nowLog("حذف","categories",t.dataset.delCat,categoryName(t.dataset.delCat));await loadAll();}
    else if(t.dataset.editRes){const x=data.resources.find(v=>v.id===t.dataset.editRes);editing.resource=x.id;$("#resourceTitle").value=x.title||"";$("#resourceUrl").value=x.url||"";$("#resourceSubject").value=x.subjectId||"";renderFormsOptions();$("#resourceCategory").value=x.categoryId || data.categories.find(c=>c.name===(x.category||""))?.id || "";fillChecks($("#resourceBranches"),branchesOf(x));$("#resourceType").value=x.type||"";$("#resourceKeywords").value=arr(x.keywords).join(", ");$("#resourceOrder").value=x.order??"";$("#resourceActive").checked=x.active!==false;$("#resourceDescription").value=x.description||"";$("#resourceForm").classList.remove("hidden");openTab("resources");}
    else if(t.dataset.delRes){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف المصدر؟"))return;await deleteDoc(doc(db,"resources",t.dataset.delRes));await nowLog("حذف","resources",t.dataset.delRes,"");await loadAll();}
    else if(t.dataset.editFound){const x=data.foundations.find(v=>v.id===t.dataset.editFound);editing.foundation=x.id;$("#foundationTitle").value=x.title||"";$("#foundationUrl").value=x.url||"";$("#foundationSubject").value=x.subjectId||"";renderFormsOptions();fillChecks($("#foundationBranches"),branchesOf(x));$("#foundationLevel").value=x.level||"beginner";$("#foundationType").value=x.type||"lesson";$("#foundationKeywords").value=arr(x.keywords).join(", ");$("#foundationOrder").value=x.order??"";$("#foundationDescription").value=x.description||"";$("#foundationForm").classList.remove("hidden");openTab("foundations");}
    else if(t.dataset.delFound){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف التأسيس؟"))return;await deleteDoc(doc(db,"foundations",t.dataset.delFound));await nowLog("حذف","foundations",t.dataset.delFound,"");await loadAll();}
    else if(t.dataset.approve||t.dataset.reject){if(!can("reviewer"))throw Error("ليس لديك صلاحية");const s=data.suggestions.find(v=>v.id===(t.dataset.approve||t.dataset.reject));const approve=!!t.dataset.approve;if(approve){const col=s.contentType==="foundation"?"foundations":"resources";const copy={...s};delete copy.id;delete copy.status;delete copy.reviewedAt;delete copy.reviewedBy;copy.createdAt=serverTimestamp();copy.updatedAt=serverTimestamp();if(col==="resources"){copy.categoryId=copy.categoryId||null;copy.branchIds=branchesOfSubject(data.subjects.find(x=>x.id===copy.subjectId));}await addDoc(collection(db,col),copy);await nowLog("اعتماد اقتراح",col,s.id,s.title);}await updateDoc(doc(db,"suggestions",s.id),{status:approve?"approved":"rejected",reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||""});await loadAll();}
    else if(t.dataset.editAdmin){if(role!=="superadmin")throw Error("Super Admin فقط");const x=data.admins.find(v=>v.id===t.dataset.editAdmin);$("#adminUid").value=x.id;$("#adminEmailInput").value=x.email||"";$("#adminRole").value=x.role||"reviewer";$("#adminActive").checked=x.active!==false;$("#adminForm").classList.remove("hidden");openTab("admins");}
  }catch(err){alert(errorText(err));}
});

$("#addBranchBtn").onclick=()=>{if(!can("superadmin"))return alert("Super Admin فقط");resetForm("branch");$("#branchForm").classList.remove("hidden");}; $("#cancelBranch").onclick=()=>{$("#branchForm").classList.add("hidden");resetForm("branch");};
$("#addSubjectBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("subject");$("#subjectForm").classList.remove("hidden");}; $("#cancelSubject").onclick=()=>{$("#subjectForm").classList.add("hidden");resetForm("subject");};
$("#addCategoryBtn").onclick=()=>{if(!can("superadmin"))return alert("Super Admin فقط");resetForm("category");$("#categoryForm").classList.remove("hidden");}; $("#cancelCategory").onclick=()=>{$("#categoryForm").classList.add("hidden");resetForm("category");};
$("#addResourceBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("resource");$("#resourceForm").classList.remove("hidden");}; $("#cancelResource").onclick=()=>{$("#resourceForm").classList.add("hidden");resetForm("resource");};
$("#addFoundationBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("foundation");$("#foundationForm").classList.remove("hidden");}; $("#cancelFoundation").onclick=()=>{$("#foundationForm").classList.add("hidden");resetForm("foundation");};
$("#addAdminBtn").onclick=()=>{if(role!=="superadmin")return alert("Super Admin فقط");$("#adminForm").classList.remove("hidden");};$("#cancelAdmin").onclick=()=>$("#adminForm").classList.add("hidden");

$("#branchForm").onsubmit=async e=>{e.preventDefault();if(!can("superadmin"))return;const stable=slug($("#branchId").value)||slug($("#branchName").value);if(!stable)return msg($("#branchMsg"),"أدخل معرفًا ثابتًا أو اسمًا.",true);const old=editing.branch;const payload={name:$("#branchName").value.trim(),icon:$("#branchIcon").value.trim(),description:$("#branchDescription").value.trim(),order:Number($("#branchOrder").value)||9999,active:$("#branchActive").checked,stableId:stable};try{if(old)await updateDoc(doc(db,"branches",old),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"branches",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(old?"تعديل فرع":"إضافة فرع","branches",old||stable,payload.name);$("#branchForm").classList.add("hidden");await loadAll();}catch(err){msg($("#branchMsg"),errorText(err),true);}};
$("#subjectForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const ids=checked($("#subjectBranches"));if(!ids.length)return msg($("#subjectMsg"),"اختر فرعًا واحدًا على الأقل.",true);const stable=slug($("#subjectId").value)||slug($("#subjectName").value);const payload={name:$("#subjectName").value.trim(),branchIds:ids,description:$("#subjectDescription").value.trim(),order:Number($("#subjectOrder").value)||9999,stableId:stable};try{if(editing.subject)await updateDoc(doc(db,"subjects",editing.subject),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"subjects",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.subject?"تعديل مادة":"إضافة مادة","subjects",editing.subject||stable,payload.name);$("#subjectForm").classList.add("hidden");await loadAll();}catch(err){msg($("#subjectMsg"),errorText(err),true);}};
$("#categoryForm").onsubmit=async e=>{e.preventDefault();if(!can("superadmin"))return;const stable=slug($("#categoryId").value)||slug($("#categoryName").value);const payload={name:$("#categoryName").value.trim(),icon:$("#categoryIcon").value.trim(),description:$("#categoryDescription").value.trim(),order:Number($("#categoryOrder").value)||9999,active:$("#categoryActive").checked,stableId:stable};try{if(editing.category)await updateDoc(doc(db,"categories",editing.category),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"categories",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.category?"تعديل تصنيف":"إضافة تصنيف","categories",editing.category||stable,payload.name);$("#categoryForm").classList.add("hidden");await loadAll();}catch(err){msg($("#categoryMsg"),errorText(err),true);}};
$("#resourceForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const url=$("#resourceUrl").value.trim();try{new URL(url);}catch{return msg($("#resourceMsg"),"الرابط غير صالح.",true);}const subjectId=$("#resourceSubject").value, ids=checked($("#resourceBranches"));const subject=data.subjects.find(s=>s.id===subjectId);const finalBranches=ids.length?ids:branchesOfSubject(subject);if(!subjectId)return msg($("#resourceMsg"),"اختر المادة.",true);if(!finalBranches.length)return msg($("#resourceMsg"),"المادة لا تحتوي فروعًا.",true);const dup=data.resources.some(r=>normalizeUrl(r.url)===normalizeUrl(url)&&r.id!==editing.resource);if(dup)return msg($("#resourceMsg"),"هذا الرابط موجود بالفعل.",true);const payload={title:$("#resourceTitle").value.trim(),url,subjectId,branchIds:finalBranches,categoryId:$("#resourceCategory").value,type:$("#resourceType").value.trim(),keywords:$("#resourceKeywords").value.split(",").map(x=>x.trim()).filter(Boolean),order:Number($("#resourceOrder").value)||9999,active:$("#resourceActive").checked,description:$("#resourceDescription").value.trim(),stableId:slug($("#resourceTitle").value)};try{if(editing.resource)await updateDoc(doc(db,"resources",editing.resource),{...payload,updatedAt:serverTimestamp()});else await addDoc(collection(db,"resources"),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.resource?"تعديل مصدر":"إضافة مصدر","resources",editing.resource||"new",payload.title);$("#resourceForm").classList.add("hidden");await loadAll();}catch(err){msg($("#resourceMsg"),errorText(err),true);}};
$("#foundationForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const url=$("#foundationUrl").value.trim();try{new URL(url);}catch{return msg($("#foundationMsg"),"الرابط غير صالح.",true);}const subjectId=$("#foundationSubject").value,ids=checked($("#foundationBranches"));const subject=data.subjects.find(s=>s.id===subjectId);const finalBranches=ids.length?ids:branchesOfSubject(subject);if(!subjectId||!finalBranches.length)return msg($("#foundationMsg"),"اختر المادة وفروعها.",true);const payload={title:$("#foundationTitle").value.trim(),url,subjectId,branchIds:finalBranches,level:$("#foundationLevel").value,type:$("#foundationType").value,keywords:$("#foundationKeywords").value.split(",").map(x=>x.trim()).filter(Boolean),order:Number($("#foundationOrder").value)||9999,description:$("#foundationDescription").value.trim(),stableId:slug($("#foundationTitle").value)};try{if(editing.foundation)await updateDoc(doc(db,"foundations",editing.foundation),{...payload,updatedAt:serverTimestamp()});else await addDoc(collection(db,"foundations"),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.foundation?"تعديل تأسيس":"إضافة تأسيس","foundations",editing.foundation||"new",payload.title);$("#foundationForm").classList.add("hidden");await loadAll();}catch(err){msg($("#foundationMsg"),errorText(err),true);}};

async function importItems(selector,col,msgSelector,type){
  if(!can("content_admin"))return msg($(msgSelector),"ليس لديك صلاحية.",true);
  let parsed;
  try{parsed=JSON.parse($(selector).value);}catch{return msg($(msgSelector),"JSON غير صالح. تأكد أن القالب يبدأ بـ { أو [ وأنه مغلق بشكل صحيح.",true);}

  // دعم الصيغتين:
  // 1) [ {...}, {...} ]
  // 2) { "resources": [ ... ], "foundations": [ ... ] }
  // حتى لا يرفض الاستيراد قالب الموقع نفسه.
  let list;
  if(Array.isArray(parsed)) list=parsed;
  else if(parsed && typeof parsed==="object"){
    const key=type==="resource"?"resources":"foundations";
    if(Array.isArray(parsed[key])) list=parsed[key];
    else if(type==="resource" && Array.isArray(parsed.resources)) list=parsed.resources;
    else if(type==="foundation" && Array.isArray(parsed.foundations)) list=parsed.foundations;
    else return msg($(msgSelector),`لم أجد قائمة ${key} داخل JSON. الصيغة المقبولة: [ ... ] أو { "${key}": [ ... ] }`,true);
  }else return msg($(msgSelector),"يجب أن يكون JSON Array أو Object يحتوي على resources/foundations.",true);

  const existing=new Set(data[col].map(x=>normalizeUrl(x.url)).filter(Boolean)),batch=new Set(),valid=[];
  let dup=0,bad=0,errors=[];
  for(let i=0;i<list.length;i++){
    const x=list[i],n=i+1;
    if(!x||typeof x!=="object"){bad++;errors.push(`العنصر ${n}: ليس Object`);continue;}
    const url=String(x.url||"").trim(),title=String(x.title||"").trim();
    if(!title||!url){bad++;errors.push(`العنصر ${n}: العنوان أو الرابط ناقص`);continue;}
    try{new URL(url);}catch{bad++;errors.push(`العنصر ${n}: رابط غير صالح`);continue;}
    const nu=normalizeUrl(url);if(existing.has(nu)||batch.has(nu)){dup++;continue;}

    const subjectKey=String(x.subjectId||x.subjectStableId||x.subject||"").trim();
    const subject=data.subjects.find(s=>s.id===subjectKey||s.stableId===subjectKey||s.name===subjectKey);
    if(!subject){bad++;errors.push(`العنصر ${n}: المادة غير موجودة (${subjectKey||"بدون subjectId"})`);continue;}

    let branchIds=arr(x.branchIds).filter(Boolean);
    if(!branchIds.length && x.branchId) branchIds=[x.branchId];
    const resolvedBranches=branchIds.map(key=>data.branches.find(b=>b.id===String(key)||b.stableId===String(key)||b.name===String(key))?.id).filter(Boolean);
    if(!resolvedBranches.length) branchIds=branchesOfSubject(subject); else branchIds=[...new Set(resolvedBranches)];
    if(!branchIds.length){bad++;errors.push(`العنصر ${n}: المادة بلا فروع (${subject.name||subject.id})`);continue;}

    if(type==="resource"){
      const categoryKey=String(x.categoryId||x.categoryStableId||x.category||"").trim();
      const category=data.categories.find(c=>c.id===categoryKey||c.stableId===categoryKey||c.name===categoryKey);
      valid.push({title,url,subjectId:subject.id,branchIds,categoryId:category?.id||null,type:String(x.type||""),keywords:Array.isArray(x.keywords)?x.keywords:String(x.keywords||"").split(",").map(v=>v.trim()).filter(Boolean),author:String(x.author||""),order:Number(x.order)||9999,active:x.active!==false,description:String(x.description||""),stableId:slug(title),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }else valid.push({title,url,subjectId:subject.id,branchIds,level:x.level||"beginner",type:x.type||"lesson",keywords:Array.isArray(x.keywords)?x.keywords:String(x.keywords||"").split(",").map(v=>v.trim()).filter(Boolean),order:Number(x.order)||9999,description:String(x.description||""),stableId:slug(title),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    batch.add(nu);
  }
  if(!valid.length)return msg($(msgSelector),`لا توجد عناصر صالحة. تم فحص ${list.length} عنصر. مكرر: ${dup} · غير صالح: ${bad}${errors.length?"\n\nالأسباب:\n"+errors.slice(0,12).join("\n"):""}`,true);
  for(let i=0;i<valid.length;i+=450){const b=writeBatch(db);valid.slice(i,i+450).forEach(x=>b.set(doc(collection(db,col)),x));await b.commit();}
  await nowLog("استيراد جماعي",col,"bulk",`تمت إضافة ${valid.length} من ${list.length}`);
  msg($(msgSelector),`تم الاستيراد: ${valid.length}\nمكرر: ${dup}\nغير صالح: ${bad}`,false);await loadAll();
}
$("#importResources").onclick=()=>importItems("#bulkResources","resources","#bulkResourceMsg","resource"); $("#importFoundations").onclick=()=>importItems("#bulkFoundations","foundations","#bulkFoundationMsg","foundation");
$("#adminForm").onsubmit=async e=>{e.preventDefault();if(role!=="superadmin")return;const uid=$("#adminUid").value.trim();if(!uid)return;const payload={email:$("#adminEmailInput").value.trim(),role:$("#adminRole").value,active:$("#adminActive").checked,updatedAt:serverTimestamp()};await setDoc(doc(db,"admins",uid),{...payload,createdAt:serverTimestamp()},{merge:true});await nowLog("تعديل صلاحيات","admins",uid,payload.role);$("#adminForm").classList.add("hidden");await loadAll();};

$("#loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#password").value);msg($("#loginMsg"),"تم تسجيل الدخول.");}catch(e){msg($("#loginMsg"),errorText(e),true);}}; $("#logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{if(!user){role=null;$("#loginSection").classList.remove("hidden");$("#dashboard").classList.add("hidden");return;}try{const s=await getDoc(doc(db,"admins",user.uid));if(!s.exists()||s.data().active!==true)throw Error("هذا الحساب ليس أدمن نشطًا.");role=s.data().role||"reviewer";$("#adminEmail").textContent=user.email||"الأدمن";$("#roleBadge").textContent=role;$("#loginSection").classList.add("hidden");$("#dashboard").classList.remove("hidden");await loadAll();}catch(e){await signOut(auth);msg($("#loginMsg"),errorText(e),true);}});
