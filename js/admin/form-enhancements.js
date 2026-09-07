const FIELD_META = {
  name:['اسم المادة/القسم','اكتب الاسم الذي سيظهر للمستخدمين'],
  description:['الوصف','وصف مختصر وواضح، اختياري'],
  icon:['الأيقونة','اسم أو رمز الأيقونة، اختياري'],
  order:['ترتيب العرض','رقم صحيح لتحديد ترتيب الظهور'],
  title:['عنوان المصدر','اكتب العنوان الذي سيظهر للطالب'],
  url:['رابط المصدر','الصق الرابط الكامل الذي سيصل إليه الطالب'],
  type:['النوع','حدد نوع المحتوى أو المصدر'],
  subjectId:['المادة','استخدم معرّف المادة المرتبطة بالمحتوى'],
  categoryId:['التصنيف','استخدم معرّف التصنيف المرتبط بالمحتوى'],
  branchIds:['الفروع','اكتب معرّفات الفروع المرتبطة، وافصل بينها بفواصل'],
  keywords:['الكلمات المفتاحية','اكتب الكلمات وافصل بينها بفواصل'],
  tags:['الوسوم','اكتب الوسوم وافصل بينها بفواصل'],
  author:['المؤلف','اسم المؤلف إن وجد، اختياري'],
  level:['المستوى','المستوى الدراسي أو مستوى المحتوى'],
  category:['التصنيف','اسم التصنيف'],
  categoryName:['اسم التصنيف','اكتب اسم التصنيف'],
  problem:['المشكلة','اكتب المشكلة بوضوح'],
  solution:['الحل','اكتب الحل المقترح أو المعتمد'],
  steps:['الخطوات','اكتب خطوات الحل بالتفصيل'],
  notes:['ملاحظات','ملاحظات داخلية أو إضافية، اختياري'],
  status:['الحالة','الحالة الحالية للعنصر'],
  question:['السؤال','اكتب نص السؤال'],
  answer:['الإجابة','اكتب الإجابة الصحيحة أو المتوقعة'],
  explanation:['الشرح','شرح الإجابة، اختياري'],
  target:['نوع القالب','حدد نوع البيانات التي يستخدم لها القالب'],
  fields:['الحقول','أسماء الحقول التي يتضمنها القالب، مفصولة بفواصل'],
  instructions:['التعليمات','تعليمات استخدام القالب، مفصولة بفواصل'],
  sourceTitle:['عنوان المصدر','العنوان الظاهر للمصدر'],
  kind:['نوع البلاغ','حدد نوع المشكلة أو البلاغ'],
  contentType:['نوع المحتوى','حدد نوع المحتوى'],
  email:['البريد الإلكتروني','البريد الإلكتروني للمشرف'],
  role:['الصلاحية','اختر صلاحية المشرف'],
  active:['نشط','هل يظهر العنصر ويُستخدم حاليًا؟'],
  needsReview:['بحاجة إلى مراجعة','حددها إذا كان العنصر يحتاج مراجعة']
};
const TECHNICAL_FIELDS = new Set(['stableId','sourceId','path','mimeType','provider','createdByEmail','publishedResourceId','createdBy','reviewedBy','adminUid','adminEmail','targetId','action','collection']);
const REQUIRED = new Set(['name','title','url','question','answer','email','role']);
function enhance(root=document) {
  const form=root.querySelector('#editForm');
  if(!form || form.dataset.enhanced==='1') return;
  form.dataset.enhanced='1';
  form.querySelectorAll(':scope > label, :scope > .check').forEach(label=>{
    const control=label.querySelector('[name]'); if(!control)return;
    const key=control.name; const meta=FIELD_META[key];
    if(TECHNICAL_FIELDS.has(key)) { label.style.display='none'; control.removeAttribute('name'); return; }
    if(meta){
      const text=label.firstChild;
      if(text && text.nodeType===Node.TEXT_NODE) text.textContent=meta[0]+' ';
      label.setAttribute('data-field-help',meta[1]);
      control.setAttribute('aria-label',meta[0]);
      if(meta[1] && control.tagName!=='INPUT' || meta[1] && control.tagName==='INPUT') control.setAttribute('placeholder',meta[1]);
      if(REQUIRED.has(key)) control.setAttribute('required','required');
    }
  });
}

const DUP_COLLECTION='sourceRegistry';
const DUP_PAGE_SIZE=200;
let duplicateObserverInstalled=false;
function normalizeDuplicateUrl(value){const raw=String(value??'').trim();if(!raw)return '';try{const u=new URL(raw);u.protocol=u.protocol.toLowerCase();u.hostname=u.hostname.toLowerCase();if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');u.hash='';return u.toString();}catch{return raw;}}
async function scanSourceDuplicates(){const{collection,query,orderBy,limit,startAfter,getDocs}=await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');const{db}=await import('../services/firebase.js');let cursor=null,rows=[];while(true){const constraints=[collection(db,DUP_COLLECTION),orderBy('__name__','asc')];if(cursor)constraints.push(startAfter(cursor));constraints.push(limit(DUP_PAGE_SIZE));const snap=await getDocs(query(...constraints));if(snap.empty)break;rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));cursor=snap.docs.at(-1);if(snap.size<DUP_PAGE_SIZE)break;}const groups=new Map();for(const row of rows){const url=normalizeDuplicateUrl(row.url||row.sourceUrl||row.link||'');if(!url)continue;const group=groups.get(url)||[];group.push(row);groups.set(url,group);}const duplicates=[];for(const[url,group]of groups){if(group.length<2)continue;group.sort((a,b)=>{const at=a.createdAt?.toMillis?.()||0,bt=b.createdAt?.toMillis?.()||0;return at-bt||a.id.localeCompare(b.id)});const primary=group[0];for(const row of group.slice(1))duplicates.push({...row,duplicateOf:primary.id,primaryTitle:primary.name||primary.title||primary.id,duplicateUrl:url});}return{duplicates,total:rows.length};}
function renderDuplicateResults(result){const table=document.getElementById('table');if(!table)return;table.replaceChildren();const head=document.createElement('div');head.className='card';const title=document.createElement('strong');title.textContent=`تم العثور على ${result.duplicates.length} عنصر مكرر`;const note=document.createElement('small');note.className='muted';note.textContent='التطابق يعتمد على الرابط فقط. العنصر الرئيسي محفوظ ولا يظهر ضمن النتائج.';head.append(title,note);table.append(head);if(!result.duplicates.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='لا توجد مصادر مكررة.';table.append(empty);return;}const selected=new Set();const toolbar=document.createElement('div');toolbar.className='bulk-toolbar';const count=document.createElement('span');count.className='muted';count.textContent='0 محدد';const selectAll=document.createElement('button');selectAll.type='button';selectAll.className='button';selectAll.textContent='تحديد الكل';const deleteSelected=document.createElement('button');deleteSelected.type='button';deleteSelected.className='button danger';deleteSelected.textContent='حذف المحدد';deleteSelected.disabled=true;toolbar.append(selectAll,deleteSelected,count);table.append(toolbar);const list=document.createElement('div');list.className='stack';const refresh=()=>{count.textContent=`${selected.size} محدد`;deleteSelected.disabled=!selected.size};for(const row of result.duplicates){const card=document.createElement('article');card.className='admin-row';const main=document.createElement('div');main.className='row-main';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.dupId=row.id;checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(row.id):selected.delete(row.id);refresh()});const info=document.createElement('div');const name=document.createElement('b');name.textContent=row.name||row.title||row.id;const meta=document.createElement('small');meta.textContent=`مكرر من: ${row.primaryTitle}`;const link=document.createElement('a');link.className='admin-row-link';link.href=row.url||'#';link.target='_blank';link.rel='noopener noreferrer';link.textContent=row.url||'بدون رابط';info.append(name,meta,link);main.append(checkbox,info);const actions=document.createElement('div');actions.className='row-actions';const del=document.createElement('button');del.type='button';del.className='button danger';del.textContent='حذف المكرر';del.addEventListener('click',()=>deleteDuplicates([row.id],refreshScan));actions.append(del);card.append(main,actions);list.append(card);}table.append(list);selectAll.addEventListener('click',()=>{const boxes=[...list.querySelectorAll('[data-dup-id]')];const select=selected.size!==result.duplicates.length;boxes.forEach(box=>{box.checked=select;select?selected.add(box.dataset.dupId):selected.delete(box.dataset.dupId)});refresh()});deleteSelected.addEventListener('click',()=>deleteDuplicates([...selected],refreshScan));}
async function deleteDuplicates(ids,done){if(!ids.length||!confirm(`تأكيد حذف ${ids.length} عنصر مكرر؟\nالعنصر الرئيسي لن يتم حذفه.`))return;try{const{deleteDoc,doc}=await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');const{db}=await import('../services/firebase.js');const{currentAdmin}=await import('../services/firebase/adminCore.js');const{logAction}=await import('./audit.js');for(const id of ids)await deleteDoc(doc(db,DUP_COLLECTION,id));const admin=await currentAdmin();if(admin)for(const id of ids)await logAction(admin,'delete_duplicate',DUP_COLLECTION,id,'حذف كمصدر مكرر حسب الرابط');await done()}catch(error){console.error('[source-duplicates.delete]',error);alert('تعذر حذف العناصر المكررة.');}}
async function refreshScan(){const table=document.getElementById('table');if(table){table.innerHTML='<div class="loading">جاري فحص الروابط...</div>';try{renderDuplicateResults(await scanSourceDuplicates())}catch(error){console.error('[source-duplicates.scan]',error);table.innerHTML='<div class="error-box">تعذر فحص التكرار.</div>'}}}
function installDuplicateControl(){if(duplicateObserverInstalled)return;const content=document.getElementById('adminContent');if(!content)return;duplicateObserverInstalled=true;const observer=new MutationObserver(()=>{const heading=[...content.querySelectorAll('h2')].find(x=>x.textContent?.trim()==='سجل المصادر');if(!heading)return;const head=heading.closest('.section-head');if(!head||head.dataset.duplicateControl==='1')return;head.dataset.duplicateControl='1';const b=document.createElement('button');b.type='button';b.className='button';b.textContent='كشف التكرار';b.addEventListener('click',refreshScan);head.append(b)});observer.observe(content,{subtree:true,childList:true});}

new MutationObserver(()=>{enhance();installDuplicateControl()}).observe(document.getElementById('adminApp')||document.body,{subtree:true,childList:true});
setTimeout(()=>{enhance();installDuplicateControl()},0);
