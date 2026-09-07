import { getPage, saveResource, saveSourceRegistry, removeResource, count } from '../repositories/resourceRepository.js';
import { logAction } from './audit.js';
import { currentAdmin, hasRole, ROLES } from '../services/firebase/adminCore.js';
import { db } from '../services/firebase.js';
import { firebaseConfig } from '../config/firebaseConfig.js';
import { collection, deleteDoc, doc, addDoc, updateDoc, setDoc, serverTimestamp, getDocs, query, where, limit, writeBatch } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

export const configs = {
  branches:{label:'الفروع',role:ROLES.SUPER_ADMIN,searchField:'name',fields:{name:'text',description:'textarea',icon:'text',order:'number',active:'checkbox'}},
  subjects:{label:'المواد',role:ROLES.CONTENT_ADMIN,searchField:'name',fields:{name:'text',branchIds:'ids',description:'textarea',icon:'text',order:'number',active:'checkbox'}},
  categories:{label:'التصنيفات',role:ROLES.SUPER_ADMIN,searchField:'name',fields:{name:'text',description:'textarea',icon:'text',order:'number',active:'checkbox'}},
  resources:{label:'المصادر',role:ROLES.CONTENT_ADMIN,searchField:'title',fields:{title:'text',url:'url',branchIds:'ids',subjectId:'text',categoryId:'text',type:'enum',description:'textarea',author:'text',keywords:'ids',tags:'ids',order:'number',active:'checkbox'}},
  foundations:{label:'التأسيس',role:ROLES.CONTENT_ADMIN,searchField:'title',fields:{title:'text',url:'url',branchIds:'ids',subjectId:'text',level:'text',type:'enum',description:'textarea',author:'text',keywords:'ids',order:'number',active:'checkbox'}},
  solutions:{label:'الحلول',role:ROLES.CONTENT_ADMIN,searchField:'title',fields:{title:'text',problem:'textarea',solution:'textarea',steps:'textarea',category:'enum',keywords:'ids',status:'enum',notes:'textarea',active:'checkbox'}},
  flashcards:{label:'البطاقات',role:ROLES.CONTENT_ADMIN,searchField:'question',fields:{question:'textarea',answer:'textarea',explanation:'textarea',branchId:'text',subjectId:'text',order:'number',active:'checkbox'}},
  templates:{label:'قوالب المصادر',role:ROLES.CONTENT_ADMIN,searchField:'name',fields:{name:'text',target:'text',description:'textarea',fields:'ids',instructions:'ids'}},
  sourceRegistry:{label:'سجل المصادر',role:ROLES.REVIEWER,writeRole:ROLES.REVIEWER,searchField:'name',orderField:'createdAt',fields:{sourceId:'text',name:'text',title:'text',url:'url',description:'textarea',status:'enum',branchIds:'ids',subjectId:'text',categoryId:'text',keywords:'ids',tags:'ids',needsReview:'checkbox'}},
  suggestions:{label:'الاقتراحات',role:ROLES.REVIEWER,writeRole:ROLES.REVIEWER,searchField:'title',orderField:'createdAt',fields:{title:'text',url:'url',description:'textarea',contentType:'text',branchId:'text',subjectId:'text',level:'text',type:'text',status:'enum',keywords:'ids',reviewerNote:'textarea'}},
  problemReports:{label:'البلاغات',role:ROLES.REVIEWER,writeRole:ROLES.REVIEWER,searchField:'sourceTitle',orderField:'createdAt',fields:{sourceId:'text',sourceTitle:'text',sourceUrl:'url',kind:'text',description:'textarea',status:'enum',adminNote:'textarea'}},
  admins:{label:'المشرفون',role:ROLES.SUPER_ADMIN,searchField:'email',orderField:'createdAt',fields:{email:'email',role:'enum',active:'checkbox'}},
  adminLogs:{label:'سجل الإدارة',role:ROLES.SUPER_ADMIN,readOnly:true,searchField:'collection',orderField:'createdAt',fields:{action:'text',collection:'text',targetId:'text',details:'textarea',adminUid:'text',adminEmail:'email',role:'text'}}
};

export const ENUMS = {
  resourceType:[['book','كتاب'],['lesson','درس'],['summary','ملخص'],['worksheet','ورقة عمل'],['video','فيديو'],['file','ملف'],['other','أخرى']],
  foundationType:[['lesson','درس'],['book','كتاب'],['video','فيديو'],['file','ملف'],['other','أخرى']],
  solutionStatus:[['draft','مسودة'],['published','منشور'],['archived','مؤرشف']],
  solutionCategory:[['math','رياضيات'],['physics','فيزياء'],['chemistry','كيمياء'],['arabic','لغة عربية'],['english','لغة إنجليزية'],['other','أخرى']],
  suggestionStatus:[['pending','قيد المراجعة'],['approved','مقبول'],['rejected','مرفوض']],
  reportStatus:[['open','مفتوح'],['reviewed','تمت المراجعة'],['resolved','تم الحل'],['rejected','مرفوض']],
  sourceStatus:[['pending_review','قيد المراجعة'],['approved','مقبول'],['published','منشور'],['rejected','مرفوض'],['archived','مؤرشف']],
  adminRole:[['reviewer','مراجع'],['content_admin','مدير محتوى'],['super_admin','مدير النظام']]
};

const ALLOWED_STATUSES = new Set(['pending_review','approved','published','rejected','archived','pending','open','reviewed','resolved','draft']);
const errorMap={RESOURCE_TITLE_REQUIRED:'يرجى إدخال عنوان المصدر.',RESOURCE_URL_REQUIRED:'يرجى إدخال رابط المصدر.',RESOURCE_URL_INVALID:'رابط المصدر غير صالح.',RESOURCE_URL_PROTOCOL:'رابط المصدر يجب أن يبدأ بـ http أو https.',RESOURCE_BRANCH_REQUIRED:'يرجى اختيار فرع واحد على الأقل.',RESOURCE_SUBJECT_REQUIRED:'يرجى اختيار المادة.',RESOURCE_URL_DUPLICATE:'هذا الرابط موجود مسبقًا.',RESOURCE_NOT_FOUND:'المصدر غير موجود.',ADMIN_EMAIL_REQUIRED:'أدخل البريد الإلكتروني للمشرف.',ADMIN_PASSWORD_REQUIRED:'كلمة المرور مطلوبة عند إنشاء مشرف جديد.',ADMIN_ROLE_INVALID:'دور المشرف غير صالح.'};
export function friendlyError(e){const key=e?.message||e?.code||'';return errorMap[key]||key||'تعذر تنفيذ العملية، حاول مرة أخرى.'}
let state={collection:'branches',cursor:null,admin:null};
export function setAdmin(a){state.admin=a}
export function getAdmin(){return state.admin}
export function allowed(c){return !!state.admin&&hasRole(state.admin.role,configs[c]?.role||ROLES.REVIEWER)}
export function canWrite(c){const cfg=configs[c];return allowed(c)&&!cfg.readOnly&&hasRole(state.admin.role,cfg.writeRole||cfg.role)}
export async function loadPage(c,filters={}){const cfg=adminApiConfig(c);return getPage(c,{...filters,searchField:cfg.searchField,orderField:cfg.orderField},20,state.cursor)}
function adminApiConfig(c){return configs[c]||{label:c,role:ROLES.REVIEWER,searchField:'name'};}

async function createFirebaseUser(email,password){
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:false})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const code=d?.error?.message||'';const map={EMAIL_EXISTS:'البريد مستخدم مسبقًا.',INVALID_EMAIL:'البريد الإلكتروني غير صالح.',WEAK_PASSWORD:'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.'};throw Error(map[code]||'تعذر إنشاء حساب المشرف في Firebase Authentication.');}
  return d.localId;
}

async function persistAdmin(id,payload,actor){
  const email=String(payload.email||'').trim().toLowerCase();
  const role=String(payload.role||'').trim();
  if(!email)throw Error('ADMIN_EMAIL_REQUIRED');
  if(!ENUMS.adminRole.some(([v])=>v===role))throw Error('ADMIN_ROLE_INVALID');
  if(id){
    await updateDoc(doc(db,'admins',id),{email,role,active:payload.active!==false,updatedAt:serverTimestamp()});
    await logAction(actor,'update','admins',id,`updated admin ${email}`);
    return id;
  }
  const password=String(payload.password||'');
  if(password.length<6)throw Error('ADMIN_PASSWORD_REQUIRED');
  const uid=await createFirebaseUser(email,password);
  await setDoc(doc(db,'admins',uid),{email,role,active:payload.active!==false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await logAction(actor,'create','admins',uid,`created admin ${email}`);
  return uid;
}

export async function persist(c,id,payload){
  const actor=await currentAdmin();
  if(!actor||!hasRole(actor.role,configs[c]?.role||ROLES.REVIEWER)||configs[c]?.readOnly)throw Error('ليس لديك صلاحية للكتابة');
  if(c==='admins')return persistAdmin(id,payload,actor);
  const next={...payload};
  if(['branches','subjects','categories'].includes(c)&&!next.stableId&&next.name){next.stableId=String(next.name).trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-|-$/g,'')||`item-${Date.now()}`;}
  let saved;
  if(c==='resources')saved=await saveResource(id||null,next);
  else if(c==='sourceRegistry')saved=await saveSourceRegistry(id||null,next);
  else if(id){await updateDoc(doc(db,c,id),{...next,updatedAt:serverTimestamp()});saved=id;}
  else{const r=await addDoc(collection(db,c),{...next,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});saved=r.id;}
  try{await logAction(actor,id?'update':'create',c,saved,next.title||next.name||next.question||next.email||next.sourceId||'')}catch(error){console.warn('[admin.persist.audit]',error)}
  return saved;
}

export async function erase(c,id){await eraseMany(c,[id]);}
export async function eraseMany(c,ids){
  const actor=await currentAdmin(),cfg=configs[c],clean=[...new Set((ids||[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=128))];
  if(!actor||!cfg||cfg.readOnly||!hasRole(actor.role,cfg.writeRole||cfg.role))throw Error('ليس لديك صلاحية للحذف');
  if(!clean.length)return;
  if(c==='resources'){for(const id of clean)await removeResource(id);return;}
  const batch=writeBatch(db);clean.forEach(id=>batch.delete(doc(db,c,id)));await batch.commit();
  for(const id of clean){try{await logAction(actor,'delete',c,id,'')}catch(error){console.warn('[admin.erase.audit]',error)}}
}

export async function stats(){
  const names=['branches','subjects','categories','resources','foundations','suggestions','problemReports'];const out={};
  await Promise.all(names.map(async n=>{const f=n==='suggestions'?{status:'pending'}:n==='problemReports'?{status:'open'}:{};try{out[n]=await count(n,f)}catch(e){console.warn('[admin.stats]',n,e);out[n]=0}}));
  return out;
}

export async function scanSourceDuplicates(){
  const groups=new Map();let cursor=null,total=0;
  while(true){const r=await getPage('sourceRegistry',{orderField:'createdAt',sort:'oldest'},50,cursor);total+=r.rows.length;for(const row of r.rows){const key=normalizeUrl(row.url||row.sourceUrl||row.link||'');if(!key)continue;const group=groups.get(key)||[];group.push(row);groups.set(key,group)}if(!r.hasMore||!r.nextCursor)break;cursor=r.nextCursor;}
  const duplicates=[];
  for(const [url,group] of groups){if(group.length<2)continue;group.sort((a,b)=>timestamp(a.createdAt)-timestamp(b.createdAt)||String(a.id).localeCompare(String(b.id)));const primary=group[0];for(const row of group.slice(1))duplicates.push({...row,duplicateOf:primary.id,primaryTitle:primary.name||primary.title||primary.id,duplicateUrl:url});}
  return {duplicates,total};
}
function timestamp(v){return v?.toMillis?.()||Date.parse(v)||0;}
export function normalizeUrl(value){const raw=String(value??'').trim();if(!raw)return '';try{const u=new URL(raw);u.protocol=u.protocol.toLowerCase();u.hostname=u.hostname.toLowerCase();if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');u.hash='';return u.toString();}catch{return raw;}}

export function toPayload(c,form){
  const p={};
  for(const[key,type]of Object.entries(configs[c].fields)){const el=form.elements[key];if(!el)continue;if(type==='checkbox')p[key]=el.checked;else if(type==='number'){const n=Number(el.value);if(!Number.isInteger(n)||n<0)throw Error('الترتيب يجب أن يكون رقمًا صحيحًا غير سالب');p[key]=n}else if(type==='ids')p[key]=el.multiple?[...el.selectedOptions].map(o=>o.value).filter(Boolean):el.value.split(',').map(x=>x.trim()).filter(Boolean);else{p[key]=el.value.trim();}}
  if(c==='admins'&&form.elements.password)p.password=form.elements.password.value;
  if(c==='sourceRegistry'&&p.status&&!ALLOWED_STATUSES.has(p.status))throw Error('حالة المصدر غير صالحة');
  if(c==='admins'&&!ENUMS.adminRole.some(([v])=>v===p.role))throw Error('ADMIN_ROLE_INVALID');
  return p;
}
export function initialValue(type,v){if(type==='checkbox')return!!v;if(type==='ids')return Array.isArray(v)?v.join(', '):String(v||'');return String(v??'');}
export {state};
