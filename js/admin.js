import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { collection, getDocs, query, where, limit, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const $ = s => document.querySelector(s), $$ = (s,root=document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
const roleLevel = { reviewer:1, content_admin:2, superadmin:3, super_admin:3, admin:3 };
let role = null, editing = {}, data = {branches:[],subjects:[],categories:[],resources:[],foundations:[],suggestions:[],logs:[],admins:[],templates:[]};
const cache = n => data[n] || [];
const can = r => (roleLevel[role]||0) >= (roleLevel[r]||0);
const msg = (el,text,error=false) => { if(el){el.textContent=text;el.className=error?"message error":"message success";} };
const errorText = e => e?.code || e?.message || "حدث خطأ غير معروف.";
const slug = v => String(v||"").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}\s_-]/gu,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
const normalizeUrl = v => { try { const u=new URL(String(v||"").trim()); u.hash=""; if(u.pathname.length>1&&u.pathname.endsWith("/"))u.pathname=u.pathname.slice(0,-1); return u.toString().toLowerCase(); } catch { return String(v||"").trim().replace(/\/+$/).toLowerCase(); } };
const branchName = id => cache("branches").find(x=>x.id===id||x.stableId===id)?.name || id || "غير محدد";
const categoryName = id => cache("categories").find(x=>x.id===id||x.stableId===id)?.name || id || "غير مصنف";
const subjectName = id => cache("subjects").find(x=>x.id===id||x.stableId===id)?.name || id || "غير محدد";
const branchesOfSubject = s => arr(s?.branchIds).length ? arr(s.branchIds) : arr(s?.branchId);
const branchesOf = x => arr(x?.branchIds).length ? arr(x.branchIds) : arr(x?.branchId);
const nowLog = async (action, collectionName, targetId, details="") => { try { await addDoc(collection(db,"adminLogs"), {action,collection:collectionName,targetId:String(targetId||""),details:String(details||""),adminUid:auth.currentUser?.uid||"",adminEmail:auth.currentUser?.email||"",role,createdAt:serverTimestamp()}); } catch(e){ console.warn("log failed",e); } };
async function all(name,max=500){ const s=await getDocs(query(collection(db,name),limit(max))); return s.docs.map(d=>({id:d.id,...d.data()})); }
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
  const [bSnap,cSnap]=await Promise.all([getDocs(collection(db,"branches")),getDocs(collection(db,"categories"))]);
  const batch=writeBatch(db); const existingB=new Set(bSnap.docs.map(d=>d.id)); const existingC=new Set(cSnap.docs.map(d=>d.id)); let changed=false;
  branchDefaults.filter(x=>!existingB.has(x.id)).forEach(x=>{batch.set(doc(db,"branches",x.id),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});changed=true;});
  categoryDefaults.filter(x=>!existingC.has(x.id)).forEach(x=>{batch.set(doc(db,"categories",x.id),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});changed=true;});
  if(changed) await batch.commit();
}
async function ensureStableIds(){
  if(role!=="superadmin") return;
  const [bs,ss,cs]=await Promise.all([getDocs(collection(db,"branches")),getDocs(collection(db,"subjects")),getDocs(collection(db,"categories"))]);
  const batch=writeBatch(db); let changed=false;
  for(const snap of [bs,ss,cs]) for(const d of snap.docs){ const x=d.data(); if(!x.stableId){ batch.update(d.ref,{stableId:slug(x.name)||d.id,updatedAt:serverTimestamp()}); changed=true; } }
  if(changed) await batch.commit();
}
async function loadAll(){
  await ensureDefaults(); await ensureStableIds();
  const [branches,subjects,categories,resources,foundations,suggestions] = await Promise.all([
    all("branches"),all("subjects"),all("categories"),all("resources"),all("foundations"),
    getDocs(query(collection(db,"suggestions"),where("status","==","pending"),limit(300))).then(s=>s.docs.map(d=>({id:d.id,...d.data()})))
  ]);
  data={...data,branches,subjects,categories,resources,foundations,suggestions};
  if(can("content_admin")){
    const [admins,logs,templates]=await Promise.all([
      role==="superadmin" ? all("admins") : Promise.resolve([]),
      role==="superadmin" ? all("adminLogs",100).then(x=>x.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))) : Promise.resolve([]),
      all("templates",100).catch(()=>[])
    ]);
    data={...data,admins,logs,templates};
  } else data={...data,admins:[],logs:[],templates:[]};
  render();
}
function optionHTML(items,valueField="id",labelField="name",selected=""){ return items.filter(x=>x.active!==false).slice().sort((a,b)=>(a.order??9999)-(b.order??9999)||String(a[labelField]||"").localeCompare(String(b[labelField]||""),"ar")).map(x=>`<option value="${esc(x[valueField])}" ${x[valueField]===selected?"selected":""}>${esc(x[labelField])}</option>`).join(""); }
function checks(container,items,selected=[]){ if(!container)return; container.innerHTML=items.filter(x=>x.active!==false).slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(x=>`<label><input type="checkbox" value="${esc(x.id)}" ${selected.includes(x.id)?"checked":""}> ${esc(x.name)}</label>`).join(""); }
function checked(container){ return $$('input[type="checkbox"]:checked',container).map(x=>x.value); }
function documentId(id,stable){ return `<p class="admin-doc-id"><strong>Document ID:</strong> <code>${esc(id)}</code>${stable?` · <strong>Stable ID:</strong> <code>${esc(stable)}</code>`:""}<button type="button" class="btn small" data-copy-id="${esc(id)}">📋 نسخ ID</button></p>`; }
function openTab(name){ $$(".admin-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name)); $$(".admin-panel").forEach(x=>x.classList.add("hidden")); $("#"+name+"Panel")?.classList.remove("hidden"); if(name==="templates")renderTemplatePreview(); }
function render(){
  $("#branchesCount").textContent=cache("branches").length; $("#subjectsCount").textContent=cache("subjects").length; $("#resourcesCount").textContent=cache("resources").length; $("#categoriesCount").textContent=cache("categories").length; $("#suggestionsCount").textContent=cache("suggestions").length; $("#logsCount").textContent=cache("logs").length;
  $$(".super-only").forEach(x=>x.classList.toggle("hidden",role!=="superadmin"));
  renderBranches();renderSubjects();renderCategories();renderResources();renderFoundations();renderSuggestions();renderLogs();renderAdmins();renderTemplates();renderFormsOptions();
  $("#overviewCards").innerHTML=[['🌿','الفروع',data.branches.length,'branches'],['📚','المواد',data.subjects.length,'subjects'],['🗂️','التصنيفات',data.categories.length,'categories'],['🔗','المصادر',data.resources.length,'resources']].map(x=>`<button class="stat-box" data-tabjump="${x[3]}"><span>${x[0]} ${x[1]}</span><strong>${x[2]}</strong></button>`).join("");
  $("#recentSuggestions").innerHTML=data.suggestions.slice(0,5).map(s=>`<div class="admin-item"><div><strong>${esc(s.title)}</strong><p>اقتراح قيد المراجعة · ${esc(s.studentName||"طالب")}</p></div><button class="btn small" data-tabjump="suggestions">مراجعة</button></div>`).join("")||'<div class="empty">لا توجد اقتراحات معلقة.</div>';
}
function renderBranches(){ $("#branchesList").innerHTML=data.branches.slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(b=>`<div class="admin-item"><div><strong>${esc(b.icon||"🌿")} ${esc(b.name)}</strong><p>${esc(b.description||"")} · ${b.active===false?"موقوف":"نشط"} · stableId: ${esc(b.stableId||b.id)}</p>${documentId(b.id,b.stableId)}</div><div><button class="btn small" data-edit-branch="${esc(b.id)}">تعديل</button>${b.active===false?`<button class="btn small" data-toggle-branch="${esc(b.id)}">تفعيل</button>`:`<button class="btn danger small" data-toggle-branch="${esc(b.id)}">تعطيل</button>`}</div></div>`).join("")||'<div class="empty">لا توجد فروع.</div>'; }
function renderSubjects(){ $("#subjectsList").innerHTML=data.subjects.slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(s=>`<div class="admin-item"><div><strong>${esc(s.name)}</strong><p>${branchesOf(s).map(branchName).join("، ")||"بدون فرع"} · ${branchesOf(s).length>1?"مادة مشتركة":"مادة لفرع واحد"}</p>${documentId(s.id,s.stableId)}</div><div><button class="btn small" data-edit-sub="${esc(s.id)}">تعديل</button><button class="btn danger small" data-del-sub="${esc(s.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد مواد.</div>'; }
function renderCategories(){ $("#categoriesList").innerHTML=data.categories.slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(c=>`<div class="admin-item"><div><strong>${esc(c.icon||"🗂️")} ${esc(c.name)}</strong><p>${esc(c.description||"")} · ${c.active===false?"موقوف":"نشط"}</p>${documentId(c.id,c.stableId)}</div><div><button class="btn small" data-edit-cat="${esc(c.id)}">تعديل</button><button class="btn danger small" data-del-cat="${esc(c.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد تصنيفات.</div>'; }
function renderResources(){ $("#resourcesList").innerHTML=data.resources.slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(r=>`<div class="admin-item"><div><strong>${esc(r.title)}</strong><p>📚 ${esc(subjectName(r.subjectId))} · ${branchesOf(r).map(branchName).join("، ")||branchesOfSubject(data.subjects.find(s=>s.id===r.subjectId)).map(branchName).join("، ")} · ${esc(r.categoryId?categoryName(r.categoryId):(r.category||"غير مصنف"))} · ${r.active===false?"موقوف":"نشط"} · <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">الرابط</a></p>${documentId(r.id,r.stableId)}</div><div><button class="btn small" data-edit-res="${esc(r.id)}">تعديل</button><button class="btn danger small" data-del-res="${esc(r.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد مصادر.</div>'; }
function renderFoundations(){ $("#foundationsList").innerHTML=data.foundations.slice().sort((a,b)=>(a.order??9999)-(b.order??9999)).map(f=>`<div class="admin-item"><div><strong>🧠 ${esc(f.title)}</strong><p>📚 ${esc(subjectName(f.subjectId))} · ${branchesOf(f).map(branchName).join("، ")} · ${esc(f.level||"")} · ${esc(f.type||"")} · <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">الرابط</a></p>${documentId(f.id,f.stableId)}</div><div><button class="btn small" data-edit-found="${esc(f.id)}">تعديل</button><button class="btn danger small" data-del-found="${esc(f.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا يوجد تأسيس.</div>'; }
function renderSuggestions(){ $("#suggestionsList").innerHTML=data.suggestions.map(s=>`<div class="admin-item"><div><strong>${esc(s.title)}</strong><p>${s.contentType==="foundation"?"🧠 تأسيس":"📚 مصدر"} · ${branchesOf(s).map(branchName).join("، ")} · ${esc(subjectName(s.subjectId))} · ${esc(s.studentName||"طالب")}</p>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a>`:""}</div><div><button class="btn primary small" data-approve="${esc(s.id)}">✅ موافقة</button><button class="btn danger small" data-reject="${esc(s.id)}">❌ رفض</button></div></div>`).join("")||'<div class="empty">لا توجد اقتراحات معلقة.</div>'; }
function renderLogs(){ if(role!=="superadmin"){$("#logsList").innerHTML="";return;} $("#logsList").innerHTML=data.logs.map(l=>`<div class="admin-item"><div><strong>${esc(l.action)} · ${esc(l.collection||"")}</strong><p>${esc(l.details||"")} · ${esc(l.adminEmail||l.adminUid||"أدمن")} · ${l.createdAt?.seconds?new Date(l.createdAt.seconds*1000).toLocaleString("ar-PS"):"الآن"}</p></div><code>${esc(l.targetId||"")}</code></div>`).join("")||'<div class="empty">لا يوجد سجل بعد.</div>'; }
function renderAdmins(){ if(role!=="superadmin"){$("#adminsList").innerHTML="";return;} $("#adminsList").innerHTML=data.admins.map(a=>`<div class="admin-item"><div><strong>${esc(a.email||a.id)}</strong><p>${esc(a.role||"reviewer")} · ${a.active!==false?"نشط":"موقوف"} · UID: ${esc(a.id)}</p></div><button class="btn small" data-edit-admin="${esc(a.id)}">تعديل</button></div>`).join("")||'<div class="empty">لا يوجد أدمن.</div>'; }

function systemReference(){
  return {
    branches:data.branches.map(x=>({branchId:x.stableId||x.id,name:x.name,active:x.active!==false})),
    subjects:data.subjects.map(x=>({subjectId:x.stableId||x.id,name:x.name,branchIds:branchesOfSubject(x).map(id=>data.branches.find(b=>b.id===id)?.stableId||id),active:x.active!==false})),
    categories:data.categories.map(x=>({categoryId:x.stableId||x.id,name:x.name,active:x.active!==false}))
  };
}
function buildGeneralTemplate(){
  return {
    templateType:"minhaj-general-v3",
    title:"قالب منهاج العام لإضافة المحتوى",
    purpose:"انسخ هذا القالب كاملًا إلى GPT، ثم أرسل بعده معلومات المحتوى أو الروابط. يجب على GPT إرجاع JSON فقط وفق schema المحدد.",
    systemReference:systemReference(),
    input:{content:"ضع هنا النص أو الروابط أو البيانات التي تريد استخراج المحتوى منها"},
    output:{
      resources:[{title:"",url:"",description:"",type:"",keywords:[],author:"",branchIds:[],subjectId:"",categoryId:"",order:9999,active:true}],
      foundations:[{title:"",url:"",description:"",level:"beginner",type:"lesson",keywords:[],author:"",branchIds:[],subjectId:"",order:9999,active:true}]
    },
    rules:[
      "أعد JSON صالحًا فقط ولا تضع Markdown أو شرحًا خارج JSON.",
      "استخدم IDs الموجودة في systemReference فقط، ولا تخترع أي ID.",
      "طابق أسماء الفرع والمادة والتصنيف مع systemReference ثم استخدم الـ ID المطابق.",
      "إذا تعذر تحديد المادة أو الفرع أو التصنيف فلا تخمّن، ضع القيمة فارغة وأضف المشكلة في validationErrors.",
      "العنوان والرابط مطلوبان للمصادر والتأسيس.",
      "لا تخترع روابط أو معلومات غير موجودة في المدخل.",
      "branchIds يجب أن تحتوي IDs الفروع فقط، وsubjectId يجب أن يكون ID مادة، وcategoryId يجب أن يكون ID تصنيف.",
      "أضف validationErrors كـ array إذا كانت هناك بيانات ناقصة أو غير مؤكدة."
    ],
    responseSchema:{resources:"array",foundations:"array",validationErrors:"array"}
  };
}
const FIELD_DEFS = {
  title:{label:"العنوان",value:""},url:{label:"الرابط",value:""},description:{label:"الوصف",value:""},type:{label:"النوع",value:""},keywords:{label:"الكلمات المفتاحية",value:[]},author:{label:"المؤلف",value:""},order:{label:"الترتيب",value:9999},active:{label:"نشط",value:true},level:{label:"المستوى",value:"beginner"}
};
function selectedTemplateFields(){ return $$("#customTemplateFields input[type=checkbox]:checked").map(x=>x.value); }
function buildCustomTemplate(){
  const collectionName=$("#customTemplateCollection")?.value||"resources";
  const fields=selectedTemplateFields();
  const item={}; fields.forEach(k=>item[k]=FIELD_DEFS[k]?.value ?? "");
  const context={branchName:"",subjectName:"",categoryName:""};
  return {
    templateType:"minhaj-custom-v2",
    name:$("#customTemplateName")?.value.trim()||"قالب مخصص",
    target:collectionName,
    description:$("#customTemplateDescription")?.value.trim()||"",
    input:{content:"ضع هنا المحتوى المراد تحويله"},
    context,
    fields,
    itemTemplate:item,
    output:{items:[item],validationErrors:[]},
    instructions:[
      "أعد JSON صالحًا فقط.",
      "لا تخترع روابط أو معلومات غير موجودة.",
      "استخدم أسماء الفرع والمادة والتصنيف عند توفرها، ولا تخترع IDs.",
      "إذا كانت معلومة أساسية ناقصة ضعها في validationErrors بدل التخمين."
    ]
  };
}
function renderTemplatePreview(){
  const el=$("#templatePreview"); if(!el)return;
  const mode=$("#templateMode")?.value||"general";
  const out=mode==="general"?buildGeneralTemplate():buildCustomTemplate();
  el.value=JSON.stringify(out,null,2);
  el.scrollTop=0;
}
async function copyTextReliable(text){
  if(!text)return false;
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true;}}catch{}
  try{const ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";ta.style.pointerEvents="none";document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);const ok=document.execCommand("copy");ta.remove();return ok;}catch{return false;}
}
function renderTemplates(){
  const list=$("#savedTemplatesList"); if(!list)return;
  if(!can("content_admin")){list.innerHTML="";return;}
  list.innerHTML=data.templates.map(t=>`<div class="admin-item"><div><strong>🧩 ${esc(t.name||t.id)}</strong><p>${esc(t.target||"resources")} · ${esc(t.description||"")}</p></div><div><button class="btn small" data-load-template="${esc(t.id)}">تحميل</button><button class="btn danger small" data-del-template="${esc(t.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد قوالب مخصصة محفوظة.</div>';
}
function renderFormsOptions(){ checks($("#subjectBranches"),data.branches);checks($("#resourceBranches"),data.branches);checks($("#foundationBranches"),data.branches);const so=optionHTML(data.subjects);$("#resourceSubject").innerHTML='<option value="">المادة</option>'+so;$("#foundationSubject").innerHTML='<option value="">المادة</option>'+so;$("#resourceCategory").innerHTML='<option value="">التصنيف</option>'+optionHTML(data.categories); }
function resetForm(name){ editing[name]=null; $("#"+name+"Form")?.reset(); if(name==="branch")$("#branchActive").checked=true;if(name==="category")$("#categoryActive").checked=true;if(name==="resource")$("#resourceActive").checked=true;renderFormsOptions(); }
function fillChecks(container,ids){ $$('input[type="checkbox"]',container).forEach(x=>x.checked=ids.includes(x.value)); }

// tabs/nav
$$(".admin-tab").forEach(b=>b.onclick=()=>!b.classList.contains("hidden")&&openTab(b.dataset.tab));
document.addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;if(t.dataset.copyId){try{await navigator.clipboard?.writeText(t.dataset.copyId);msg($("#loginMsg"),"تم نسخ المعرف.");}catch{}return;}if(t.dataset.tabjump){openTab(t.dataset.tabjump);return;}try{
  if(t.dataset.editBranch){const x=data.branches.find(v=>v.id===t.dataset.editBranch);editing.branch=x.id;$("#branchId").value=x.stableId||x.id;$("#branchName").value=x.name||"";$("#branchIcon").value=x.icon||"";$("#branchOrder").value=x.order??"";$("#branchActive").checked=x.active!==false;$("#branchDescription").value=x.description||"";$("#branchForm").classList.remove("hidden");openTab("branches");}
  else if(t.dataset.toggleBranch){if(!can("superadmin"))throw Error("Super Admin فقط");const x=data.branches.find(v=>v.id===t.dataset.toggleBranch);await updateDoc(doc(db,"branches",x.id),{active:x.active===false,updatedAt:serverTimestamp()});await nowLog(x.active===false?"تفعيل فرع":"تعطيل فرع","branches",x.id,x.name);await loadAll();}
  else if(t.dataset.editSub){const x=data.subjects.find(v=>v.id===t.dataset.editSub);editing.subject=x.id;$("#subjectId").value=x.stableId||x.id;$("#subjectName").value=x.name||"";$("#subjectOrder").value=x.order??"";$("#subjectDescription").value=x.description||"";renderFormsOptions();fillChecks($("#subjectBranches"),branchesOfSubject(x));$("#subjectForm").classList.remove("hidden");openTab("subjects");}
  else if(t.dataset.delSub){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف المادة؟"))return;await deleteDoc(doc(db,"subjects",t.dataset.delSub));await nowLog("حذف","subjects",t.dataset.delSub,subjectName(t.dataset.delSub));await loadAll();}
  else if(t.dataset.editCat){const x=data.categories.find(v=>v.id===t.dataset.editCat);editing.category=x.id;$("#categoryId").value=x.stableId||x.id;$("#categoryName").value=x.name||"";$("#categoryIcon").value=x.icon||"";$("#categoryOrder").value=x.order??"";$("#categoryActive").checked=x.active!==false;$("#categoryDescription").value=x.description||"";$("#categoryForm").classList.remove("hidden");openTab("categories");}
  else if(t.dataset.delCat){if(!can("superadmin"))throw Error("Super Admin فقط");if(!confirm("حذف التصنيف؟ المصادر لن تُحذف، لكنها ستحتاج تصنيفًا آخر."))return;await deleteDoc(doc(db,"categories",t.dataset.delCat));await nowLog("حذف","categories",t.dataset.delCat,categoryName(t.dataset.delCat));await loadAll();}
  else if(t.dataset.editRes){const x=data.resources.find(v=>v.id===t.dataset.editRes);editing.resource=x.id;$("#resourceTitle").value=x.title||"";$("#resourceUrl").value=x.url||"";renderFormsOptions();$("#resourceSubject").value=x.subjectId||"";$("#resourceCategory").value=x.categoryId||data.categories.find(c=>c.name===(x.category||""))?.id||"";fillChecks($("#resourceBranches"),branchesOf(x));$("#resourceType").value=x.type||"";$("#resourceKeywords").value=arr(x.keywords).join(", ");$("#resourceOrder").value=x.order??"";$("#resourceActive").checked=x.active!==false;$("#resourceDescription").value=x.description||"";$("#resourceForm").classList.remove("hidden");openTab("resources");}
  else if(t.dataset.delRes){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف المصدر؟"))return;await deleteDoc(doc(db,"resources",t.dataset.delRes));await nowLog("حذف","resources",t.dataset.delRes,"");await loadAll();}
  else if(t.dataset.editFound){const x=data.foundations.find(v=>v.id===t.dataset.editFound);editing.foundation=x.id;$("#foundationTitle").value=x.title||"";$("#foundationUrl").value=x.url||"";renderFormsOptions();$("#foundationSubject").value=x.subjectId||"";fillChecks($("#foundationBranches"),branchesOf(x));$("#foundationLevel").value=x.level||"beginner";$("#foundationType").value=x.type||"lesson";$("#foundationKeywords").value=arr(x.keywords).join(", ");$("#foundationOrder").value=x.order??"";$("#foundationDescription").value=x.description||"";$("#foundationForm").classList.remove("hidden");openTab("foundations");}
  else if(t.dataset.delFound){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف التأسيس؟"))return;await deleteDoc(doc(db,"foundations",t.dataset.delFound));await nowLog("حذف","foundations",t.dataset.delFound,"");await loadAll();}
  else if(t.dataset.approve||t.dataset.reject){if(!can("reviewer"))throw Error("ليس لديك صلاحية");const s=data.suggestions.find(v=>v.id===(t.dataset.approve||t.dataset.reject));const approve=!!t.dataset.approve;if(approve){const col=s.contentType==="foundation"?"foundations":"resources";const copy={...s};delete copy.id;delete copy.status;delete copy.reviewedAt;delete copy.reviewedBy;copy.createdAt=serverTimestamp();copy.updatedAt=serverTimestamp();if(col==="resources"){copy.categoryId=copy.categoryId||null;copy.branchIds=branchesOfSubject(data.subjects.find(x=>x.id===copy.subjectId));}await addDoc(collection(db,col),copy);await nowLog("اعتماد اقتراح",col,s.id,s.title);}await updateDoc(doc(db,"suggestions",s.id),{status:approve?"approved":"rejected",reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||""});await loadAll();}
  else if(t.dataset.editAdmin){if(role!=="superadmin")throw Error("Super Admin فقط");const x=data.admins.find(v=>v.id===t.dataset.editAdmin);$("#adminUid").value=x.id;$("#adminEmailInput").value=x.email||"";$("#adminRole").value=x.role||"reviewer";$("#adminActive").checked=x.active!==false;$("#adminForm").classList.remove("hidden");openTab("admins");}
  else if(t.dataset.loadTemplate){if(!can("content_admin"))throw Error("ليس لديك صلاحية");const x=data.templates.find(v=>v.id===t.dataset.loadTemplate);if(x){$("#templateMode").value="custom";$("#customTemplateName").value=x.name||"";$("#customTemplateCollection").value=x.target||"resources";$("#customTemplateDescription").value=x.description||"";$$('#customTemplateFields input[type="checkbox"]').forEach(c=>c.checked=arr(x.fields).includes(c.value));renderTemplatePreview();openTab("templates");}}
  else if(t.dataset.delTemplate){if(!can("content_admin"))throw Error("ليس لديك صلاحية");if(!confirm("حذف القالب؟"))return;await deleteDoc(doc(db,"templates",t.dataset.delTemplate));await nowLog("حذف قالب","templates",t.dataset.delTemplate,"");await loadAll();}
}catch(err){alert(errorText(err));}});

$("#addBranchBtn").onclick=()=>{if(!can("superadmin"))return alert("Super Admin فقط");resetForm("branch");$("#branchForm").classList.remove("hidden");};$("#cancelBranch").onclick=()=>{$("#branchForm").classList.add("hidden");resetForm("branch");};
$("#addSubjectBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("subject");$("#subjectForm").classList.remove("hidden");};$("#cancelSubject").onclick=()=>{$("#subjectForm").classList.add("hidden");resetForm("subject");};
$("#addCategoryBtn").onclick=()=>{if(!can("superadmin"))return alert("Super Admin فقط");resetForm("category");$("#categoryForm").classList.remove("hidden");};$("#cancelCategory").onclick=()=>{$("#categoryForm").classList.add("hidden");resetForm("category");};
$("#addResourceBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("resource");$("#resourceForm").classList.remove("hidden");};$("#cancelResource").onclick=()=>{$("#resourceForm").classList.add("hidden");resetForm("resource");};
$("#addFoundationBtn").onclick=()=>{if(!can("content_admin"))return alert("ليس لديك صلاحية");resetForm("foundation");$("#foundationForm").classList.remove("hidden");};$("#cancelFoundation").onclick=()=>{$("#foundationForm").classList.add("hidden");resetForm("foundation");};
$("#addAdminBtn").onclick=()=>{if(role!=="superadmin")return alert("Super Admin فقط");$("#adminForm").classList.remove("hidden");};$("#cancelAdmin").onclick=()=>$("#adminForm").classList.add("hidden");

$("#branchForm").onsubmit=async e=>{e.preventDefault();if(!can("superadmin"))return;const stable=slug($("#branchId").value)||slug($("#branchName").value);if(!stable)return msg($("#branchMsg"),"أدخل معرفًا ثابتًا أو اسمًا.",true);const old=editing.branch;const payload={name:$("#branchName").value.trim(),icon:$("#branchIcon").value.trim(),description:$("#branchDescription").value.trim(),order:Number($("#branchOrder").value)||9999,active:$("#branchActive").checked,stableId:stable};try{if(old)await updateDoc(doc(db,"branches",old),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"branches",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(old?"تعديل فرع":"إضافة فرع","branches",old||stable,payload.name);msg($("#branchMsg"),"تم حفظ الفرع بنجاح.");$("#branchForm").classList.add("hidden");await loadAll();}catch(err){msg($("#branchMsg"),errorText(err),true);}};
$("#subjectForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const ids=checked($("#subjectBranches"));if(!ids.length)return msg($("#subjectMsg"),"اختر فرعًا واحدًا على الأقل.",true);const stable=slug($("#subjectId").value)||slug($("#subjectName").value);if(!stable)return msg($("#subjectMsg"),"أدخل اسم المادة.",true);const payload={name:$("#subjectName").value.trim(),branchIds:ids,description:$("#subjectDescription").value.trim(),order:Number($("#subjectOrder").value)||9999,stableId:stable};try{if(editing.subject)await updateDoc(doc(db,"subjects",editing.subject),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"subjects",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.subject?"تعديل مادة":"إضافة مادة","subjects",editing.subject||stable,payload.name);msg($("#subjectMsg"),"تم حفظ المادة بنجاح.");$("#subjectForm").classList.add("hidden");await loadAll();}catch(err){msg($("#subjectMsg"),errorText(err),true);}};
$("#categoryForm").onsubmit=async e=>{e.preventDefault();if(!can("superadmin"))return;const stable=slug($("#categoryId").value)||slug($("#categoryName").value);if(!stable)return msg($("#categoryMsg"),"أدخل اسم التصنيف.",true);const payload={name:$("#categoryName").value.trim(),icon:$("#categoryIcon").value.trim(),description:$("#categoryDescription").value.trim(),order:Number($("#categoryOrder").value)||9999,active:$("#categoryActive").checked,stableId:stable};try{if(editing.category)await updateDoc(doc(db,"categories",editing.category),{...payload,updatedAt:serverTimestamp()});else await setDoc(doc(db,"categories",stable),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.category?"تعديل تصنيف":"إضافة تصنيف","categories",editing.category||stable,payload.name);msg($("#categoryMsg"),"تم حفظ التصنيف بنجاح.");$("#categoryForm").classList.add("hidden");await loadAll();}catch(err){msg($("#categoryMsg"),errorText(err),true);}};
$("#resourceForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const url=$("#resourceUrl").value.trim();try{new URL(url);}catch{return msg($("#resourceMsg"),"الرابط غير صالح.",true);}const subjectId=$("#resourceSubject").value;if(!subjectId)return msg($("#resourceMsg"),"اختر المادة.",true);const ids=checked($("#resourceBranches")),subject=data.subjects.find(s=>s.id===subjectId),finalBranches=ids.length?ids:branchesOfSubject(subject);if(!finalBranches.length)return msg($("#resourceMsg"),"المادة لا تحتوي فروعًا.",true);const categoryId=$("#resourceCategory").value;if(!categoryId)return msg($("#resourceMsg"),"اختر التصنيف.",true);const dup=data.resources.some(r=>normalizeUrl(r.url)===normalizeUrl(url)&&r.id!==editing.resource);if(dup)return msg($("#resourceMsg"),"هذا الرابط موجود بالفعل.",true);const payload={title:$("#resourceTitle").value.trim(),url,subjectId,branchIds:finalBranches,categoryId,type:$("#resourceType").value.trim(),keywords:$("#resourceKeywords").value.split(",").map(x=>x.trim()).filter(Boolean),order:Number($("#resourceOrder").value)||9999,active:$("#resourceActive").checked,description:$("#resourceDescription").value.trim(),stableId:slug($("#resourceTitle").value)};try{if(editing.resource)await updateDoc(doc(db,"resources",editing.resource),{...payload,updatedAt:serverTimestamp()});else await addDoc(collection(db,"resources"),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.resource?"تعديل مصدر":"إضافة مصدر","resources",editing.resource||"new",payload.title);msg($("#resourceMsg"),"تم حفظ المصدر بنجاح.");$("#resourceForm").classList.add("hidden");await loadAll();}catch(err){msg($("#resourceMsg"),errorText(err),true);}};
$("#foundationForm").onsubmit=async e=>{e.preventDefault();if(!can("content_admin"))return;const url=$("#foundationUrl").value.trim();try{new URL(url);}catch{return msg($("#foundationMsg"),"الرابط غير صالح.",true);}const subjectId=$("#foundationSubject").value;if(!subjectId)return msg($("#foundationMsg"),"اختر المادة.",true);const ids=checked($("#foundationBranches")),subject=data.subjects.find(s=>s.id===subjectId),finalBranches=ids.length?ids:branchesOfSubject(subject);if(!finalBranches.length)return msg($("#foundationMsg"),"اختر المادة وفروعها.",true);const payload={title:$("#foundationTitle").value.trim(),url,subjectId,branchIds:finalBranches,level:$("#foundationLevel").value,type:$("#foundationType").value,keywords:$("#foundationKeywords").value.split(",").map(x=>x.trim()).filter(Boolean),order:Number($("#foundationOrder").value)||9999,description:$("#foundationDescription").value.trim(),stableId:slug($("#foundationTitle").value)};try{if(editing.foundation)await updateDoc(doc(db,"foundations",editing.foundation),{...payload,updatedAt:serverTimestamp()});else await addDoc(collection(db,"foundations"),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await nowLog(editing.foundation?"تعديل تأسيس":"إضافة تأسيس","foundations",editing.foundation||"new",payload.title);msg($("#foundationMsg"),"تم حفظ التأسيس بنجاح.");$("#foundationForm").classList.add("hidden");await loadAll();}catch(err){msg($("#foundationMsg"),errorText(err),true);}};

async function importItems(selector,col,msgSelector,type){if(!can("content_admin"))return msg($(msgSelector),"ليس لديك صلاحية.",true);let list;try{list=JSON.parse($(selector).value);}catch{return msg($(msgSelector),"JSON غير صالح.",true);}if(!Array.isArray(list))return msg($(msgSelector),"يجب أن يكون JSON Array.",true);const existing=new Set(data[col].map(x=>normalizeUrl(x.url)).filter(Boolean)),batchUrls=new Set(),valid=[];let dup=0,bad=0,errors=[];for(let i=0;i<list.length;i++){const x=list[i],n=i+1;if(!x||typeof x!=="object"){bad++;errors.push(`العنصر ${n}: ليس Object`);continue;}const url=String(x.url||"").trim(),title=String(x.title||"").trim();if(!title||!url){bad++;errors.push(`العنصر ${n}: العنوان أو الرابط ناقص`);continue;}try{new URL(url);}catch{bad++;errors.push(`العنصر ${n}: رابط غير صالح`);continue;}const nu=normalizeUrl(url);if(existing.has(nu)||batchUrls.has(nu)){dup++;continue;}const subject=data.subjects.find(s=>s.id===String(x.subjectId||"")||s.stableId===String(x.subjectId||"")||s.name===String(x.subject||""));if(!subject){bad++;errors.push(`العنصر ${n}: المادة غير موجودة`);continue;}let branchIds=arr(x.branchIds).filter(Boolean).map(id=>{const b=data.branches.find(v=>v.id===id||v.stableId===id||v.name===id);return b?.id;}).filter(Boolean);if(!branchIds.length)branchIds=branchesOfSubject(subject);if(!branchIds.length){bad++;errors.push(`العنصر ${n}: المادة بلا فروع`);continue;}if(type==="resource"){const category=data.categories.find(c=>c.id===String(x.categoryId||"")||c.stableId===String(x.categoryId||"")||c.name===String(x.category||""));if(!category){bad++;errors.push(`العنصر ${n}: التصنيف غير موجود`);continue;}valid.push({title,url,subjectId:subject.id,branchIds,categoryId:category.id,type:String(x.type||""),keywords:Array.isArray(x.keywords)?x.keywords:String(x.keywords||"").split(",").map(v=>v.trim()).filter(Boolean),order:Number(x.order)||9999,active:x.active!==false,description:String(x.description||""),stableId:slug(title),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}else valid.push({title,url,subjectId:subject.id,branchIds,level:x.level||"beginner",type:x.type||"lesson",keywords:Array.isArray(x.keywords)?x.keywords:String(x.keywords||"").split(",").map(v=>v.trim()).filter(Boolean),order:Number(x.order)||9999,description:String(x.description||""),stableId:slug(title),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});batchUrls.add(nu);}if(!valid.length)return msg($(msgSelector),`لا توجد عناصر صالحة. مكرر: ${dup} · غير صالح: ${bad}\n${errors.slice(0,8).join("\n")}`,true);for(let i=0;i<valid.length;i+=450){const b=writeBatch(db);valid.slice(i,i+450).forEach(x=>b.set(doc(collection(db,col)),x));await b.commit();}await nowLog("استيراد جماعي",col,"bulk",`تمت إضافة ${valid.length} من ${list.length}`);msg($(msgSelector),`تم الاستيراد: ${valid.length}\nمكرر: ${dup}\nغير صالح: ${bad}`,false);await loadAll();}
$("#importResources").onclick=()=>importItems("#bulkResources","resources","#bulkResourceMsg","resource");$("#importFoundations").onclick=()=>importItems("#bulkFoundations","foundations","#bulkFoundationMsg","foundation");

$("#templateMode")?.addEventListener("change",()=>{const custom=$("#templateMode").value==="custom";$("#customTemplateEditor")?.classList.toggle("hidden",!custom);renderTemplatePreview();});
$("#customTemplateFields")?.addEventListener("change",renderTemplatePreview);["customTemplateName","customTemplateCollection","customTemplateDescription"].forEach(id=>$("#"+id)?.addEventListener("input",renderTemplatePreview));
$("#copyTemplateBtn")?.addEventListener("click",async()=>{renderTemplatePreview();const ok=await copyTextReliable($("#templatePreview").value);msg($("#templateMsg"),ok?"تم نسخ القالب كاملًا إلى الحافظة.":"تعذر النسخ التلقائي. تم تجهيز القالب، استخدم زر النسخ من لوحة المفاتيح.",!ok);if(!ok){$("#templatePreview")?.focus();$("#templatePreview")?.select();}});
$("#resetGeneralTemplate")?.addEventListener("click",()=>{$("#templateMode").value="general";$("#customTemplateEditor")?.classList.add("hidden");renderTemplatePreview();});
$("#saveCustomTemplate")?.addEventListener("click",async()=>{if(!can("content_admin"))return msg($("#templateMsg"),"ليس لديك صلاحية إدارة القوالب.",true);const x=buildCustomTemplate();if(!x.name)return msg($("#templateMsg"),"اكتب اسم القالب.",true);if(!x.fields.length)return msg($("#templateMsg"),"اختر حقلًا واحدًا على الأقل.",true);try{const ref=await addDoc(collection(db,"templates"),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:auth.currentUser?.uid||""});await nowLog("إضافة قالب","templates",ref.id,x.name);msg($("#templateMsg"),"تم حفظ القالب المخصص.");await loadAll();}catch(e){msg($("#templateMsg"),errorText(e),true);}});

$("#adminForm").onsubmit=async e=>{e.preventDefault();if(role!=="superadmin")return;const uid=$("#adminUid").value.trim();if(!uid)return;const payload={email:$("#adminEmailInput").value.trim(),role:$("#adminRole").value,active:$("#adminActive").checked,updatedAt:serverTimestamp()};try{await setDoc(doc(db,"admins",uid),{...payload,createdAt:serverTimestamp()},{merge:true});await nowLog("تعديل صلاحيات","admins",uid,payload.role);msg($("#loginMsg"),"تم حفظ صلاحيات الأدمن.");$("#adminForm").classList.add("hidden");await loadAll();}catch(e){alert(errorText(e));}};

$("#loginBtn").onclick=async()=>{const btn=$("#loginBtn");btn.disabled=true;msg($("#loginMsg"),"جارٍ تسجيل الدخول...");try{await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#password").value);msg($("#loginMsg"),"تم تسجيل الدخول، جارٍ تحميل لوحة الإدارة...");}catch(e){msg($("#loginMsg"),errorText(e),true);}finally{btn.disabled=false;}};
$("#logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  if(!user){role=null;$("#loginSection").classList.remove("hidden");$("#dashboard").classList.add("hidden");return;}
  try{
    const s=await getDoc(doc(db,"admins",user.uid));
    if(!s.exists()||s.data().active!==true){role=null;$("#dashboard").classList.add("hidden");$("#loginSection").classList.remove("hidden");msg($("#loginMsg"),"تم تسجيل الدخول بحساب Firebase، لكن هذا الحساب غير مفعّل كأدمن.",true);return;}
    role=s.data().role||"reviewer"; if(role==="super_admin"||role==="admin") role="superadmin"; if(!roleLevel[role]) role="reviewer";
    $("#adminEmail").textContent=user.email||"الأدمن";$("#roleBadge").textContent=role;$("#loginSection").classList.add("hidden");$("#dashboard").classList.remove("hidden");
    try{await loadAll();msg($("#dashboardMsg"),"تم تحميل لوحة الإدارة بنجاح.");}catch(e){console.error(e);msg($("#dashboardMsg"),`تم الدخول، لكن فشل تحميل بعض بيانات الإدارة: ${errorText(e)}`,true);}
  }catch(e){console.error(e);role=null;$("#dashboard").classList.add("hidden");$("#loginSection").classList.remove("hidden");msg($("#loginMsg"),errorText(e),true);}
});

renderTemplatePreview();
