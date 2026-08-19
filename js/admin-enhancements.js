import { auth, db } from './firebase.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const $=id=>document.getElementById(id);
const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const normUrl=v=>{try{const u=new URL(String(v||'').trim());u.hash='';if(u.pathname.length>1&&u.pathname.endsWith('/'))u.pathname=u.pathname.slice(0,-1);return u.toString().toLowerCase();}catch{return String(v||'').trim().replace(/\/+$/,'').toLowerCase();}};

/* Firestore Document ID is the canonical UID. stableId is only a legacy alias. */
const uid=x=>String(x?.id||x?.uid||'').trim();
async function all(name){const s=await getDocs(collection(db,name));return s.docs.map(d=>({id:d.id,...d.data()}));}
function norm(v){return String(v??'').trim().toLowerCase();}
function resolve(items,value){
  const n=norm(value); if(!n)return null;
  return items.find(x=>norm(x.id)===n || norm(x.uid)===n || norm(x.stableId)===n || norm(x.name)===n) || null;
}
function unwrap(raw,key){
  if(Array.isArray(raw))return raw;
  if(raw&&Array.isArray(raw[key]))return raw[key];
  if(raw&&Array.isArray(raw.items))return raw.items;
  if(raw&&Array.isArray(raw.data))return raw.data;
  if(raw&&raw.data&&Array.isArray(raw.data[key]))return raw.data[key];
  if(raw&&typeof raw==='object'&&('title'in raw||'name'in raw||'url'in raw||'link'in raw))return[raw];
  return[];
}
function refs(ctx){
  return {
    branches:ctx.branches.map(x=>({uid:uid(x),name:x.name||'',legacyStableId:x.stableId||null})),
    subjects:ctx.subjects.map(x=>({uid:uid(x),name:x.name||'',branchIds:arr(x.branchIds||x.branchId).map(v=>{const b=resolve(ctx.branches,v);return b?uid(b):String(v)}),legacyStableId:x.stableId||null})),
    categories:ctx.categories.map(x=>({uid:uid(x),name:x.name||'',legacyStableId:x.stableId||null}))
  };
}
function general(ctx){
  return JSON.stringify({
    templateType:'minhaj-general-v5',
    title:'قالب منهاج العام لإضافة المحتوى',
    purpose:'استخرج المحتوى من الروابط أو المعلومات وأعد JSON فقط. استخدم UID_REFERENCE حرفيًا ولا تخترع أي UID.',
    rules:[
      'JSON فقط بدون Markdown أو شرح خارجي.',
      'uid هو Document ID الحقيقي في Firestore.',
      'subjectId وcategoryId وbranchIds يجب أن تكون من UID_REFERENCE فقط.',
      'إذا لم تحدد branchIds للمصدر، ضعها فارغة وسيستنتجها النظام من المادة.',
      'لا تستخدم أسماء المواد أو الفروع مكان UID إذا كان UID_REFERENCE متاحًا.',
      'لا تكرر نفس الرابط.'
    ],
    output:{resources:[{title:'',url:'',subjectId:'',categoryId:'',branchIds:[],type:'',keywords:[],description:'',author:'',order:0,active:true}],foundations:[{title:'',url:'',subjectId:'',branchIds:[],level:'beginner',type:'lesson',keywords:[],description:'',order:0,active:true}]},
    UID_REFERENCE:refs(ctx)
  },null,2);
}
function custom(ctx){
  const mode=$('customTemplateCollection')?.value||'resources';
  const fields=[...document.querySelectorAll('#customTemplateFields input[type="checkbox"]:checked')].map(x=>x.value);
  const name=$('customTemplateName')?.value?.trim()||'قالب مخصص';
  const description=$('customTemplateDescription')?.value?.trim()||'';
  const item={title:'',url:'',subjectId:'',branchIds:[]};
  if(mode==='resources')item.categoryId='';
  for(const f of fields)if(!(f in item))item[f]=f==='keywords'?[]:f==='active'?true:f==='order'?0:'';
  return JSON.stringify({templateType:'minhaj-custom-v3',name,description,collection:mode,instructions:['أعد JSON فقط.','استخدم UID_REFERENCE فقط للربط.','uid هو Document ID الحقيقي.','لا تخترع UID.'],example:[item],UID_REFERENCE:refs(ctx)},null,2);
}
async function refresh(){
  try{
    const [branches,subjects,categories,resources,foundations]=await Promise.all(['branches','subjects','categories','resources','foundations'].map(all));
    const ctx={branches,subjects,categories,resources,foundations};
    const mode=$('templateMode')?.value||'general';
    $('customTemplateEditor')?.classList.toggle('hidden',mode!=='custom');
    if($('templatePreview'))$('templatePreview').value=mode==='general'?general(ctx):custom(ctx);
    await saved();
  }catch(e){console.error('[templates]',e);const m=$('templateMsg');if(m){m.textContent='تعذر تحميل بيانات القالب من Firestore: '+(e.code||e.message);m.className='message error';}}
}
async function saved(){
  const box=$('savedTemplatesList');if(!box)return;
  try{const list=await all('templates');box.innerHTML=list.length?list.map((x,i)=>`<div class="admin-item"><div><strong>${esc(x.name||'قالب بدون اسم')}</strong><small>${esc(x.collection||'resources')}</small></div><button class="btn secondary saved-template-open" data-i="${i}">فتح</button></div>`).join(''):'<div class="empty-state">لا توجد قوالب مخصصة محفوظة.</div>';box.querySelectorAll('.saved-template-open').forEach(b=>b.addEventListener('click',()=>{const x=list[Number(b.dataset.i)];if(!x)return;$('templateMode').value='custom';$('customTemplateEditor')?.classList.remove('hidden');if($('customTemplateName'))$('customTemplateName').value=x.name||'';if($('customTemplateDescription'))$('customTemplateDescription').value=x.description||'';if($('customTemplateCollection'))$('customTemplateCollection').value=x.collection||'resources';if($('templatePreview'))$('templatePreview').value=x.content||'';}));}catch(e){console.error('[templates saved]',e);}}
function replace(id,fn){const old=$(id);if(!old)return;const n=old.cloneNode(true);old.replaceWith(n);n.addEventListener('click',e=>{e.preventDefault();fn(e);});}
function detail(errors){return errors.map(e=>`العنصر ${e.index}: ${e.reason}`).join(' | ');}
async function importItems(kind){
  const input=kind==='resources'?'bulkResources':'bulkFoundations',out=kind==='resources'?'bulkResourceMsg':'bulkFoundationMsg',m=$(out);
  try{
    const raw=JSON.parse($(input)?.value||'');const items=unwrap(raw,kind);if(!items.length)throw new Error('لم أجد عناصر. الصيغ المدعومة: Array أو {resources:[...]} أو {foundations:[...]} أو {items:[...]}.');
    const [branches,subjects,categories,existing]=await Promise.all([all('branches'),all('subjects'),all('categories'),all(kind)]);
    const seen=new Set(existing.map(x=>normUrl(x.url)).filter(Boolean));const valid=[],errors=[];
    for(let i=0;i<items.length;i++){
      const s=items[i]||{},title=String(s.title||s.name||'').trim(),url=String(s.url||s.link||'').trim();
      if(!title){errors.push({index:i+1,reason:'العنوان مفقود'});continue;} if(!url){errors.push({index:i+1,reason:'الرابط مفقود'});continue;}
      const nu=normUrl(url);if(seen.has(nu)){errors.push({index:i+1,reason:'الرابط مكرر'});continue;}
      const subject=resolve(subjects,s.subjectId??s.subjectUid??s.subject??s.subjectName);if(!subject){errors.push({index:i+1,reason:'المادة غير موجودة: '+String(s.subjectId??s.subjectUid??s.subject??s.subjectName??'غير محددة')});continue;}
      let rawBranches=arr(s.branchIds??s.branches??s.branchId);
      if(!rawBranches.length)rawBranches=arr(subject.branchIds??subject.branchId);
      const branchIds=[...new Set(rawBranches.map(v=>resolve(branches,v)).filter(Boolean).map(uid))];
      if(rawBranches.length&&branchIds.length!==rawBranches.length){errors.push({index:i+1,reason:'يوجد فرع غير معروف'});continue;}
      const item={title,url,subjectId:uid(subject),branchIds,active:s.active!==false,description:String(s.description||''),keywords:arr(s.keywords).map(String),order:Number(s.order)||0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      if(kind==='resources'){const cat=resolve(categories,s.categoryId??s.categoryUid??s.category??s.categoryName);if(!cat){errors.push({index:i+1,reason:'التصنيف غير موجود: '+String(s.categoryId??s.categoryUid??s.category??s.categoryName??'غير محدد')});continue;}item.categoryId=uid(cat);item.type=String(s.type||s.resourceType||'').trim();if(s.author)item.author=String(s.author);}
      else{item.level=['beginner','intermediate','advanced'].includes(s.level)?s.level:'beginner';item.type=String(s.type||'lesson');}
      valid.push(item);seen.add(nu);
    }
    for(const x of valid)await addDoc(collection(db,kind),x);
    if(m){m.textContent=`تم استيراد ${valid.length} عنصر. ${errors.length?`تم رفض ${errors.length}: ${detail(errors)}`:'كل العناصر صالحة.'}`;m.className=errors.length?'message error':'message success';}
  }catch(e){if(m){m.textContent=e.message||'JSON غير صالح.';m.className='message error';}}
}
function extraFields(){const box=$('customTemplateFields');if(!box)return;const have=new Set([...box.querySelectorAll('input')].map(x=>x.value));for(const [v,l] of [['uid','UID العنصر'],['branchIds','UIDات الفروع'],['subjectId','UID المادة'],['categoryId','UID التصنيف']])if(!have.has(v)){const label=document.createElement('label');label.innerHTML=`<input type="checkbox" value="${v}"> ${l}`;box.appendChild(label);}}
async function init(){
  extraFields();
  replace('importResources',()=>importItems('resources'));replace('importFoundations',()=>importItems('foundations'));
  replace('copyTemplateBtn',async()=>{const v=$('templatePreview')?.value||'';if(v)await navigator.clipboard.writeText(v);});
  replace('saveCustomTemplate',async()=>{try{const name=$('customTemplateName')?.value?.trim();if(!name)return;const ctx={branches:await all('branches'),subjects:await all('subjects'),categories:await all('categories'),resources:await all('resources'),foundations:await all('foundations')};await addDoc(collection(db,'templates'),{name,collection:$('customTemplateCollection')?.value||'resources',description:$('customTemplateDescription')?.value?.trim()||'',content:custom(ctx),fields:[...document.querySelectorAll('#customTemplateFields input[type="checkbox"]:checked')].map(x=>x.value),createdBy:auth.currentUser?.uid||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await refresh();const m=$('templateMsg');if(m){m.textContent='تم حفظ القالب المخصص.';m.className='message success';}}catch(e){const m=$('templateMsg');if(m){m.textContent='فشل حفظ القالب: '+(e.code||e.message);m.className='message error';}}});
  $('templateMode')?.addEventListener('change',refresh);$('resetGeneralTemplate')?.addEventListener('click',async()=>{$('templateMode').value='general';await refresh();});$('customTemplateCollection')?.addEventListener('change',refresh);document.querySelectorAll('#customTemplateFields input').forEach(x=>x.addEventListener('change',refresh));
  const d=$('dashboard');const run=async()=>{if(d&&!d.classList.contains('hidden'))await refresh();};if(d&&!d.classList.contains('hidden'))run();else new MutationObserver(run).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
