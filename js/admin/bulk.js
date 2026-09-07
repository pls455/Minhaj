import { db } from '../services/firebase.js';
import { collection,doc,writeBatch,serverTimestamp,query,where,getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { getAdmin } from './data.js';
import { logAction } from './audit.js';

const MAX_IMPORT=5000,MAX_BATCH=400;
const collectionNames={resources:'المصادر',foundations:'التأسيس',flashcards:'البطاقات',solutions:'الحلول'};
const allowed=new Set(Object.keys(collectionNames));
const urlOk=v=>{try{const u=new URL(String(v||''));return u.protocol==='http:'||u.protocol==='https:'}catch{return false}};
const normalizeUrl=v=>{try{const u=new URL(String(v||'').trim());if(!['http:','https:'].includes(u.protocol))return '';u.protocol=u.protocol.toLowerCase();u.hostname=u.hostname.toLowerCase();if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');u.hash='';return u.toString()}catch{return ''}};

function validateRow(item,index,collection,seen){
  const row=item&&typeof item==='object'&&!Array.isArray(item)?{...item}:null;
  if(!row)return{error:`Row ${index}: يجب أن يكون العنصر كائنًا.`};
  if(collection==='resources'||collection==='foundations'){
    if(typeof row.title!=='string'||!row.title.trim())return{error:`Row ${index}: الحقل title مطلوب.`};
    if(typeof row.url!=='string'||!row.url.trim())return{error:`Row ${index}: الحقل url مطلوب.`};
    if(!urlOk(row.url))return{error:`Row ${index}: الحقل url غير صالح.`};
    if(!Array.isArray(row.branchIds)||!row.branchIds.length)return{error:`Row ${index}: الحقل branchIds يجب أن يكون مصفوفة غير فارغة.`};
    if(typeof row.subjectId!=='string'||!row.subjectId.trim())return{error:`Row ${index}: الحقل subjectId مطلوب.`};
  }else if(collection==='flashcards'){
    if(typeof row.question!=='string'||!row.question.trim())return{error:`Row ${index}: الحقل question مطلوب.`};
    if(typeof row.answer!=='string'||!row.answer.trim())return{error:`Row ${index}: الحقل answer مطلوب.`};
  }else if(collection==='solutions'){
    if(typeof row.title!=='string'||!row.title.trim())return{error:`Row ${index}: الحقل title مطلوب.`};
    if(typeof row.problem!=='string'||!row.problem.trim())return{error:`Row ${index}: الحقل problem مطلوب.`};
    if(typeof row.solution!=='string'||!row.solution.trim())return{error:`Row ${index}: الحقل solution مطلوب.`};
  }
  if(row.url){const normalized=normalizeUrl(row.url);if(!normalized)return{error:`Row ${index}: الحقل url غير صالح.`};if(seen.has(normalized))return{error:`Row ${index}: الرابط مكرر داخل الملف.`};seen.add(normalized);row.url=normalized}
  if(row.branchIds&&!Array.isArray(row.branchIds))return{error:`Row ${index}: branchIds يجب أن تكون Array.`};
  for(const key of ['keywords','tags'])if(row[key]!==undefined&&!Array.isArray(row[key]))return{error:`Row ${index}: الحقل ${key} يجب أن يكون Array.`};
  if(row.type!==undefined&&typeof row.type!=='string')return{error:`Row ${index}: الحقل type يجب أن يكون نصًا.`};
  return{row};
}

async function findExistingUrls(collectionName,urls){
  const existing=new Set();
  for(let i=0;i<urls.length;i+=30){const chunk=urls.slice(i,i+30);if(!chunk.length)continue;const snap=await getDocs(query(collection(db,collectionName),where('url','in',chunk)));snap.forEach(d=>{const url=normalizeUrl(d.data()?.url);if(url)existing.add(url)})}
  return existing;
}

export function renderBulk(root){
  root.innerHTML=`<div class="section-head"><div><h2>استيراد جماعي</h2><p class="muted">تحقق كامل قبل الكتابة. إذا وُجد خطأ، لن يُدخل أي جزء من الملف.</p></div></div><div class="form-card"><label>القسم<select id="bulkCollection"><option value="resources">المصادر</option><option value="foundations">التأسيس</option><option value="flashcards">البطاقات</option><option value="solutions">الحلول</option></select></label><label>بيانات JSON<textarea id="bulkJson" rows="14" placeholder='[{"title":"...","url":"https://..."}]'></textarea></label><div class="actions"><button id="previewBulk" class="button">معاينة والتحقق</button><button id="runBulk" class="button primary" disabled>تنفيذ الاستيراد</button></div><pre id="bulkPreview" class="bulk-preview"></pre></div>`;
  let valid=[];
  document.getElementById('previewBulk').onclick=async()=>{
    const button=document.getElementById('previewBulk');button.disabled=true;valid=[];
    try{
      const raw=JSON.parse(document.getElementById('bulkJson').value);const rows=Array.isArray(raw)?raw:(raw?.items||raw?.resources||raw?.foundations||[]);const collectionName=document.getElementById('bulkCollection').value;
      if(!allowed.has(collectionName))throw Error('القسم غير مسموح.');if(!Array.isArray(rows))throw Error('JSON يجب أن يحتوي على Array.');if(rows.length>MAX_IMPORT)throw Error(`الحد الأقصى للاستيراد ${MAX_IMPORT} عنصر.`);
      const errors=[],seen=new Set(),candidates=[];rows.forEach((item,i)=>{const r=validateRow(item,i+1,collectionName,seen);if(r.error)errors.push(r.error);else candidates.push(r.row)});
      const urls=candidates.map(x=>normalizeUrl(x.url)).filter(Boolean);const existing=await findExistingUrls(collectionName,[...new Set(urls)]);const duplicateExisting=new Set();for(const row of candidates){const u=normalizeUrl(row.url);if(u&&existing.has(u))duplicateExisting.add(u)}
      valid=candidates.filter(row=>{const u=normalizeUrl(row.url);return !u||!duplicateExisting.has(u)});
      const skipped=duplicateExisting.size;
      document.getElementById('bulkPreview').textContent=`Total: ${rows.length}\nValid: ${candidates.length}\nInserted: ${valid.length}\nSkipped duplicates: ${skipped}\nErrors: ${errors.length}\n\n${errors.slice(0,100).join('\n')}${skipped?`\n\nتم تجاوز ${skipped} روابط موجودة مسبقًا في Firestore.`:''}`;
      document.getElementById('runBulk').disabled=errors.length>0||!valid.length;
    }catch(e){document.getElementById('bulkPreview').textContent=`فشل التحقق: ${e.message}`;document.getElementById('runBulk').disabled=true}finally{button.disabled=false}
  };
  document.getElementById('runBulk').onclick=async()=>{
    const c=document.getElementById('bulkCollection').value,button=document.getElementById('runBulk');if(!valid.length)return;button.disabled=true;
    try{
      const batchItems=[...valid];let inserted=0;
      for(let i=0;i<batchItems.length;i+=MAX_BATCH){const batch=writeBatch(db);batchItems.slice(i,i+MAX_BATCH).forEach(item=>batch.set(doc(collection(db,c)),{...item,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));await batch.commit();inserted+=Math.min(MAX_BATCH,batchItems.length-i)}
      await logAction(getAdmin(),'bulk_import',c,'bulk',`imported ${inserted}`);
      document.getElementById('bulkPreview').textContent+=`\n\nتم تنفيذ الاستيراد: ${inserted} من قسم ${collectionNames[c]||c}.`;
    }catch(e){console.error('[admin.bulk]',e);document.getElementById('bulkPreview').textContent+=`\n\nفشل التنفيذ: ${e.message||'تعذر استيراد البيانات.'}`}finally{button.disabled=false}
  };
}
