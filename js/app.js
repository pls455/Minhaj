import { db } from "./firebase.js";
import {
  collection, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const BRANCHES = { scientific:"العلمي", literary:"الأدبي", industrial:"الصناعي" };
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const safeUrl = (v="") => { try { const u=new URL(v); return /^https?:$/.test(u.protocol)?u.href:"#"; } catch { return "#"; } };
const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
const branchOf = x => x.branchId || arr(x.branchIds)[0] || "";
const subjectOf = x => x.subjectId || "";
const textOf = x => [x.title,x.name,x.description,x.type,x.category,x.categoryId,x.keywords,x.tags,x.author].flat(Infinity).filter(Boolean).join(" ").toLowerCase();

function setupNav(){ const b=$(".menu-btn"), n=document.querySelector("nav"); if(b&&n)b.onclick=()=>n.classList.toggle("open"); }
async function getSubjects(branch=""){
  const key=`minhaj:subjects:${branch||"all"}`; const cached=localStorage.getItem(key);
  try{
    const snap=branch ? await getDocs(query(collection(db,"subjects"), where("branchIds","array-contains",branch))) : await getDocs(collection(db,"subjects"));
    const data=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order??9999)-(b.order??9999)||String(a.name||"").localeCompare(String(b.name||""),"ar"));
    localStorage.setItem(key,JSON.stringify(data)); return data;
  }catch(e){ return cached?JSON.parse(cached):[]; }
}
async function getResources({branch="",subject=""}={}){
  const key=`minhaj:resources:${branch}:${subject}`; const cached=localStorage.getItem(key);
  try{
    let q=collection(db,"resources");
    if(subject) q=query(q,where("subjectId","==",subject),limit(300));
    else if(branch) q=query(q,where("branchId","==",branch),limit(300));
    else q=query(q,limit(300));
    const snap=await getDocs(q); const data=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order??9999)-(b.order??9999)||String(a.title||"").localeCompare(String(b.title||""),"ar"));
    localStorage.setItem(key,JSON.stringify(data)); return data;
  }catch(e){ return cached?JSON.parse(cached):[]; }
}
async function getFoundations({branch="",subject=""}={}){
  const key=`minhaj:foundations:${branch}:${subject}`; const cached=localStorage.getItem(key);
  try{
    let q=collection(db,"foundations");
    if(subject) q=query(q,where("subjectId","==",subject),limit(300));
    else if(branch) q=query(q,where("branchIds","array-contains",branch),limit(300));
    else q=query(q,limit(300));
    const snap=await getDocs(q); const data=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order??9999)-(b.order??9999)||String(a.title||"").localeCompare(String(b.title||""),"ar"));
    localStorage.setItem(key,JSON.stringify(data)); return data;
  }catch(e){ return cached?JSON.parse(cached):[]; }
}

async function renderSubjects(){
  const grid=$("#subjectsGrid"); if(!grid)return; let branch=new URLSearchParams(location.search).get("branch")||"";
  $$("[data-branch]").forEach(b=>{b.classList.toggle("active",b.dataset.branch===branch); b.onclick=()=>{branch=b.dataset.branch; history.replaceState({},"",`subjects.html${branch?`?branch=${branch}`:""}`); render();};});
  async function render(){ grid.innerHTML=`<div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`; const data=await getSubjects(branch); grid.innerHTML=data.length?data.map((s,i)=>`<a class="subject-card" href="resources.html?branch=${encodeURIComponent(branch||branchOf(s))}&subject=${encodeURIComponent(s.id)}"><small>${String(i+1).padStart(2,"0")}</small><div class="subject-icon">${esc(s.icon||"📚")}</div><h3>${esc(s.name)}</h3><p>${esc(s.description||"مصادر ومراجع دراسية")}</p>${arr(s.branchIds).length>1?`<span class="tag shared">مشتركة</span>`:""}</a>`).join(""): `<div class="empty">لا توجد مواد لهذا الفرع حاليًا.</div>`; }
  render();
}
async function renderResources(){
  const grid=$("#resourcesGrid"); if(!grid)return; const p=new URLSearchParams(location.search); let branch=p.get("branch")||"", subject=p.get("subject")||"";
  const search=$("#searchInput"), branchSel=$("#branchSelect"), subjectSel=$("#subjectSelect"), typeSel=$("#typeSelect"), catSel=$("#categorySelect"); if(branchSel)branchSel.value=branch;
  const subjects=await getSubjects(branch); if(subjectSel){subjectSel.innerHTML=`<option value="">كل المواد</option>`+subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(""); subjectSel.value=subject;}
  const all=await getResources({branch,subject});
  function render(){ const q=(search?.value||"").trim().toLowerCase(), b=branchSel?.value||"", s=subjectSel?.value||"", t=typeSel?.value||"", c=catSel?.value||""; const data=all.filter(x=>(!q||textOf(x).includes(q))&&(!b||branchOf(x)===b||arr(x.branchIds).includes(b))&&(!s||subjectOf(x)===s)&&(!t||x.type===t)&&(!c||x.categoryId===c||x.category===c)); grid.innerHTML=data.length?data.map(x=>`<a class="resource-card" href="${safeUrl(x.url)}" target="_blank" rel="noopener noreferrer"><div class="resource-cover">${esc(x.icon||"📖")}</div><div><span class="tag">${esc(x.type||"مصدر")}</span><h3>${esc(x.title||"مصدر")}</h3><p>${esc(x.description||"فتح المصدر")}</p><small>${esc(x.category||"")}</small></div><strong>↗</strong></a>`).join(""):`<div class="empty">لا توجد مصادر مطابقة.</div>`; }
  [search,branchSel,subjectSel,typeSel,catSel].filter(Boolean).forEach(el=>el.addEventListener("input",render)); render();
}
async function renderFoundations(){
  const grid=$("#foundationsGrid"); if(!grid)return; const branchSel=$("#foundationBranch"), subjectSel=$("#foundationSubject"), levelSel=$("#foundationLevel"), typeSel=$("#foundationType"), search=$("#foundationSearch"); let branch=new URLSearchParams(location.search).get("branch")||""; branchSel.value=branch;
  async function refreshSubjects(){const ss=await getSubjects(branch); subjectSel.innerHTML=`<option value="">كل المواد</option>`+ss.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");}
  await refreshSubjects(); let data=await getFoundations({branch});
  async function reload(){branch=branchSel.value; await refreshSubjects(); data=await getFoundations({branch,subject:subjectSel.value}); render();}
  function render(){const q=(search.value||"").trim().toLowerCase(),s=subjectSel.value,l=levelSel.value,t=typeSel.value; const out=data.filter(x=>(!q||textOf(x).includes(q))&&(!s||x.subjectId===s)&&(!l||x.level===l)&&(!t||x.type===t)&&(!branch||arr(x.branchIds).includes(branch)||branchOf(x)===branch)); grid.innerHTML=out.length?out.map(x=>`<a class="resource-card foundation-card" href="${safeUrl(x.url)}" target="_blank" rel="noopener noreferrer"><div class="resource-cover">🧠</div><div><span class="tag">${esc(x.level||"تأسيس")}</span><h3>${esc(x.title)}</h3><p>${esc(x.description||"ابدأ التأسيس")}</p><small>${esc(x.type||"")}</small></div><strong>↗</strong></a>`).join(""):`<div class="empty">لا يوجد محتوى تأسيس مطابق.</div>`;}
  branchSel.addEventListener("change",reload); subjectSel.addEventListener("change",async()=>{data=await getFoundations({branch,subject:subjectSel.value});render();}); [levelSel,typeSel,search].forEach(e=>e.addEventListener("input",render)); render();
}

setupNav(); renderSubjects(); renderResources(); renderFoundations();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(console.error);
