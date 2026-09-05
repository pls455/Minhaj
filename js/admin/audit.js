import { getDoc, getDocs, doc, query, where, limit, collection, writeBatch, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from '../services/firebase.js';
import { writeAdminLog } from '../services/firebase/adminLogRepository.js';
import { currentAdmin, hasRole, ROLES } from '../services/firebase/adminCore.js';

export async function logAction(admin, action, targetCollection, targetId, details = '') {
  const previous = { uid: admin?.uid || '', email: admin?.email || '' };
  try {
    await writeAdminLog({action,collectionName:targetCollection,targetId,details:{message:String(details||''),actorUid:previous.uid,actorEmail:previous.email}});
  } catch(error){console.error('[adminLogs]',error);throw error;}
}

async function refId(collectionName,value){
  const s=String(value??'').trim();
  if(!s)return'';
  const direct=await getDoc(doc(db,collectionName,s));
  if(direct.exists())return direct.id;
  const stable=await getDocs(query(collection(db,collectionName),where('stableId','==',s),limit(1)));
  if(!stable.empty)return stable.docs[0].id;
  const named=await getDocs(query(collection(db,collectionName),where('name','==',s),limit(1)));
  return named.empty?'':named.docs[0].id;
}
async function normalizeRegistry(current,id){const rawBranches=Array.isArray(current.branchIds)?current.branchIds:(current.branchId?[current.branchId]:[]);const branchIds=[...new Set((await Promise.all(rawBranches.map(v=>refId('branches',v)))).filter(Boolean))];const subjectId=await refId('subjects',current.subjectId||current.subject||current.subjectStableId||'');const categoryId=await refId('categories',current.categoryId||current.category||current.categoryStableId||'');return{branchIds,subjectId,categoryId,sourceId:current.sourceId||current.id||id};}
function normalizeSourceUrl(value){const raw=String(value??'').trim();if(!raw)return'';try{const u=new URL(raw);u.protocol=u.protocol.toLowerCase();u.hostname=u.hostname.toLowerCase();if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');u.hash='';return u.toString();}catch{return raw;}}
async function resourceWithSameUrl(url){
  const normalized=normalizeSourceUrl(url);
  if(!normalized)return null;
  const indexed=await getDocs(query(collection(db,'resources'),where('normalizedUrl','==',normalized),limit(1)));
  if(!indexed.empty)return indexed.docs[0];
  const exact=await getDocs(query(collection(db,'resources'),where('url','==',normalized),limit(1)));
  if(!exact.empty)return exact.docs[0];
  return null;
}
async function safeLog(admin,action,collectionName,id,details=''){
  try{await logAction(admin,action,collectionName,id,details)}catch(error){console.warn('[admin.status.audit] Audit log failed after the database operation completed.',error)}
}

export async function updateStatus(collectionName,id,status,admin){
  const authoritativeAdmin=await currentAdmin();
  const actor=authoritativeAdmin||admin;
  const ref=doc(db,collectionName,id);const snap=await getDoc(ref);if(!snap.exists())throw Error('العنصر المطلوب غير موجود.');const current=snap.data();
  if(collectionName==='sourceRegistry'){
    if(!['pending_review','approved','rejected'].includes(status))throw Error('حالة المراجعة غير صالحة.');
    if(status==='approved'){
      if(!hasRole(actor?.role,ROLES.CONTENT_ADMIN))throw Error('اعتماد ونشر المصادر يحتاج صلاحية مدير المحتوى أو المدير العام.');
      const normalized=await normalizeRegistry(current,id);const url=normalizeSourceUrl(current.url||current.sourceUrl||current.link||'');const name=String(current.name||current.title||current.originalTitle||'').trim();
      if(!url||!name||!normalized.subjectId||!normalized.branchIds.length)throw Error('لا يمكن اعتماد المصدر قبل اكتمال العنوان والرابط والفرع والمادة. افتح التعديل وأكمل البيانات المطلوبة.');
      const existing=await resourceWithSameUrl(url);
      if(existing){await safeLog(actor,'skip_duplicate_publish',collectionName,id,`تخطي المصدر لأنه مكرر مع ${existing.id}`);return {published:false,duplicate:true,existingResourceId:existing.id};}
      const batch=writeBatch(db);
      const publishedRef=doc(collection(db,'resources'));
      batch.set(publishedRef,{title:name,url,normalizedUrl:url,description:current.description||'',type:current.type||current.mimeType||'resource',subjectId:normalized.subjectId,categoryId:normalized.categoryId||'',branchIds:normalized.branchIds,keywords:Array.isArray(current.keywords)?current.keywords:[],tags:Array.isArray(current.tags)?current.tags:[],author:current.author||'',order:Number(current.order)||0,active:true,sourceId:normalized.sourceId,provider:current.provider||'google_drive',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      batch.update(ref,{name,title:name,url,branchIds:normalized.branchIds,subjectId:normalized.subjectId,categoryId:normalized.categoryId||'',status:'published',needsReview:false,active:false,publishedResourceId:publishedRef.id,publishedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      await batch.commit();
      await safeLog(actor,'publish',collectionName,id,`نشر المصدر ${publishedRef.id}`);return {published:true,resourceId:publishedRef.id};
    }
    await updateDoc(ref,{status,needsReview:status==='pending_review',active:false,updatedAt:serverTimestamp()});await safeLog(actor,`status:${status}`,collectionName,id,status);return {published:false};
  }
  await updateDoc(ref,{status,updatedAt:serverTimestamp()});await safeLog(actor,`status:${status}`,collectionName,id,status);return {published:false};
}
