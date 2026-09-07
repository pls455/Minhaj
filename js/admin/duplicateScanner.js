import { db } from '../services/firebase.js';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, startAfter, writeBatch } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { logAction } from './audit.js';
import { currentAdmin } from '../services/firebase/adminCore.js';

const COLLECTION='sourceRegistry';
const PAGE_SIZE=200;
const normalizeUrl=value=>{const raw=String(value??'').trim();if(!raw)return '';try{const u=new URL(raw);u.protocol=u.protocol.toLowerCase();u.hostname=u.hostname.toLowerCase();if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');u.hash='';return u.toString()}catch{return raw}};

export async function scanSourceDuplicates(onProgress=()=>{}){
  let cursor=null,total=0;const primaryByUrl=new Map();const duplicates=[];
  while(true){
    const clauses=[collection(db,COLLECTION),orderBy('url','asc')];if(cursor)clauses.push(startAfter(cursor));clauses.push(limit(PAGE_SIZE));
    const snap=await getDocs(query(...clauses));if(snap.empty)break;
    for(const d of snap.docs){
      total++;const row={id:d.id,...d.data()};const key=normalizeUrl(row.url||row.sourceUrl||row.link||'');if(!key)continue;
      if(primaryByUrl.has(key)){duplicates.push({id:row.id,duplicateOf:primaryByUrl.get(key).id,title:row.name||row.title||row.id,url:row.url||''})}
      else primaryByUrl.set(key,{id:row.id});
    }
    cursor=snap.docs.at(-1);onProgress({scanned:total,duplicates:duplicates.length});if(snap.size<PAGE_SIZE)break;
  }
  return {duplicates,total};
}

export async function deleteDuplicateSources(ids){
  const unique=[...new Set(ids.map(String).filter(Boolean))];if(!unique.length)return 0;
  for(let i=0;i<unique.length;i+=400){const batch=writeBatch(db);unique.slice(i,i+400).forEach(id=>batch.delete(doc(db,COLLECTION,id)));await batch.commit()}
  const admin=await currentAdmin();if(admin){for(let i=0;i<unique.length;i+=100){await logAction(admin,'delete_duplicate',COLLECTION,unique.slice(i,i+100).join(','),`حذف ${Math.min(100,unique.length-i)} مصدر مكرر حسب الرابط`)}}
  return unique.length;
}

export function renderDuplicateScanner(root){
  root.replaceChildren();
  const box=document.createElement('div');box.className='form-card';
  const h=document.createElement('h2');h.textContent='كشف تكرار المصادر';
  const p=document.createElement('p');p.className='muted';p.textContent='يفحص سجل المصادر على صفحات متتابعة بدل تحميل السجل كاملًا إلى الذاكرة.';
  const scan=document.createElement('button');scan.className='button primary';scan.textContent='بدء الفحص';
  const status=document.createElement('p');status.className='message';
  const list=document.createElement('div');list.className='stack';
  box.append(h,p,scan,status);root.append(box,list);
  scan.onclick=async()=>{scan.disabled=true;list.replaceChildren();status.textContent='جاري الفحص...';try{const result=await scanSourceDuplicates(x=>{status.textContent=`تم فحص ${x.scanned.toLocaleString('ar-EG')} مصدرًا، ووجد ${x.duplicates.toLocaleString('ar-EG')} مكرر.`});if(!result.duplicates.length){status.textContent=`لم يتم العثور على تكرارات ضمن ${result.total.toLocaleString('ar-EG')} مصدر.`;return}status.textContent=`تم العثور على ${result.duplicates.length.toLocaleString('ar-EG')} مصدر مكرر.`;const selected=new Set();const toolbar=document.createElement('div');toolbar.className='bulk-toolbar';const del=document.createElement('button');del.className='button danger';del.textContent='حذف المحدد';del.disabled=true;const count=document.createElement('span');count.className='muted';const refresh=()=>{count.textContent=`${selected.size} محدد`;del.disabled=!selected.size};toolbar.append(del,count);list.append(toolbar);for(const row of result.duplicates){const article=document.createElement('article');article.className='admin-row';const check=document.createElement('input');check.type='checkbox';check.addEventListener('change',()=>{check.checked?selected.add(row.id):selected.delete(row.id);refresh()});const info=document.createElement('div');const title=document.createElement('b');title.textContent=row.title;const meta=document.createElement('small');meta.textContent=`مكرر من: ${row.duplicateOf}`;info.append(title,meta);article.append(check,info);list.append(article)}del.onclick=async()=>{if(!selected.size||!confirm(`تأكيد حذف ${selected.size} مصدر مكرر؟`))return;del.disabled=true;try{const n=await deleteDuplicateSources([...selected]);status.textContent=`تم حذف ${n} مصدر مكرر.`;scan.click()}catch(e){console.error('[duplicate-scanner.delete]',e);status.textContent='تعذر حذف التكرارات.';del.disabled=false}}}catch(e){console.error('[duplicate-scanner.scan]',e);status.textContent='تعذر فحص التكرار.'}finally{scan.disabled=false}};
}
