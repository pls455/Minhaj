import { db } from './firebase.js';
import { collection, getDocs, query, limit } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const AI_API_URL = 'https://json2.karamhahhss123.workers.dev/api/ai';
const cacheKey = 'minhaj:ai:resources:v2';
const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const safeUrl = v => { try { const u = new URL(String(v || '')); return /^https?:$/.test(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const normalize = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي');
const terms = s => normalize(s).replace(/[؟?!.,،؛:()\[\]{}"'`/\\]/g,' ').split(/\s+/).filter(x => x.length > 1);
const text = x => [x?.title,x?.name,x?.description,x?.type,x?.category,x?.keywords,x?.tags,x?.author,x?.branchId,x?.subjectId].flat(Infinity).filter(Boolean).join(' ');

async function getResources() {
  try {
    const snap = await getDocs(query(collection(db,'resources'), limit(1000)));
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(x => x.active !== false && x.url);
    localStorage.setItem(cacheKey, JSON.stringify(rows));
    return rows;
  } catch {
    try { return JSON.parse(localStorage.getItem(cacheKey) || '[]'); } catch { return []; }
  }
}

function localSearch(rows, question) {
  const q = normalize(question);
  const qs = terms(question);
  const scored = rows.map((r,index) => {
    const title = normalize(r.title || r.name || '');
    const hay = normalize(text(r));
    let score = 0;
    if (title && q.includes(title)) score += 30;
    for (const term of qs) {
      if (title.includes(term)) score += term.length >= 4 ? 12 : 5;
      else if (hay.includes(term)) score += term.length >= 4 ? 5 : 2;
    }
    if (/ادبي|الفرع الادبي|literary/.test(q) && /ادبي|literary/.test(hay)) score += 20;
    if (/علمي|الفرع العلمي|scientific/.test(q) && /علمي|scientific/.test(hay)) score += 20;
    if (/صناعي|الفرع الصناعي|industrial/.test(q) && /صناعي|industrial/.test(hay)) score += 20;
    return { r, score, index };
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score || a.index-b.index);
  return scored;
}

async function smartResourceSearch(rows, question) {
  const ranked = localSearch(rows, question);
  const candidates = ranked.slice(0,20).map(({r}) => ({
    id:r.id,title:r.title || r.name || 'مصدر',description:r.description || '',type:r.type || '',category:r.category || '',branchId:r.branchId || '',branchIds:Array.isArray(r.branchIds)?r.branchIds:[],subjectId:r.subjectId || '',keywords:r.keywords || r.tags || ''
  }));
  if (!candidates.length) return { action:'none', results:[] };
  try {
    const res = await fetch(AI_API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'resource',messages:[{role:'user',content:question}],candidates})});
    const data = await res.json();
    if (data.action === 'open_resource' && data.resourceId) {
      const chosen = rows.find(x => x.id === data.resourceId);
      if (chosen) return { action:'open_resource', resource:chosen, results:ranked.slice(0,5).map(x=>x.r) };
    }
  } catch (e) { console.warn('AI resource search fallback:', e); }
  return { action:'results', results:ranked.slice(0,5).map(x=>x.r) };
}

function isResourceIntent(q) {
  return /رابط|ملزمه|ملزمة|كتاب|ملخص|مصدر|ملفات|حلول|امتحان|امتحانات|رزم|رزمة|مذكره|مذكرة|اسئله|أسئلة|نماذج|تصنيف|حقيبه|حقيبة/.test(normalize(q));
}

function addStyles() {
  if (document.getElementById('minhaj-ai-style')) return;
  const s=document.createElement('style');s.id='minhaj-ai-style';s.textContent=`
  .minhaj-ai-fab{position:fixed;left:18px;bottom:18px;z-index:9999;border:1px solid rgba(255,255,255,.14);background:#101629;color:#fff;border-radius:999px;padding:12px 16px;box-shadow:0 12px 35px rgba(0,0,0,.3);cursor:pointer;font:600 14px system-ui}.minhaj-ai-panel{position:fixed;left:14px;bottom:72px;width:min(420px,calc(100vw - 28px));height:min(650px,75vh);z-index:9998;background:#0c1120;color:#eef2ff;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 25px 70px rgba(0,0,0,.45);display:none;overflow:hidden;font-family:system-ui}.minhaj-ai-panel.open{display:flex;flex-direction:column}.minhaj-ai-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}.minhaj-ai-close{background:none;border:0;color:#aab2c5;font-size:22px;cursor:pointer}.minhaj-ai-messages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}.minhaj-ai-msg{max-width:92%;padding:10px 12px;border-radius:14px;line-height:1.65;font-size:14px;white-space:pre-wrap}.minhaj-ai-msg.user{align-self:flex-start;background:#263451}.minhaj-ai-msg.bot{align-self:flex-end;background:#151d31}.minhaj-ai-input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)}.minhaj-ai-input textarea{flex:1;resize:none;min-height:44px;max-height:100px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#080c17;color:#fff;padding:10px;font:inherit}.minhaj-ai-input button{width:48px;border:0;border-radius:12px;background:#4b67ff;color:#fff;cursor:pointer}.minhaj-ai-resource{display:block;margin-top:8px;padding:10px;border-radius:12px;background:#202b48;color:#fff;text-decoration:none}.minhaj-ai-results{display:flex;flex-direction:column;gap:8px;margin-top:8px}.minhaj-ai-result{display:block;padding:10px;border-radius:12px;background:#202b48;color:#fff;text-decoration:none}.minhaj-ai-result small{display:block;color:#aeb9d0;margin-top:3px}.minhaj-ai-note{font-size:11px;color:#8f9ab0;text-align:center;padding:0 12px 8px}`;document.head.appendChild(s);
}

function createUI() {
  addStyles();
  const fab=document.createElement('button');fab.className='minhaj-ai-fab';fab.textContent='✦ مساعد منهاج';
  const panel=document.createElement('section');panel.className='minhaj-ai-panel';panel.innerHTML=`<div class="minhaj-ai-head"><strong>✦ مساعد منهاج</strong><button class="minhaj-ai-close" aria-label="إغلاق">×</button></div><div class="minhaj-ai-messages"></div><div class="minhaj-ai-note">شات دراسي + بحث ذكي داخل مصادر منهاج</div><form class="minhaj-ai-input"><textarea placeholder="مثال: بدي رابط ملزمة الكامل للفرع الأدبي"></textarea><button>↑</button></form>`;
  document.body.append(fab,panel);
  const messages=panel.querySelector('.minhaj-ai-messages'),form=panel.querySelector('form'),input=panel.querySelector('textarea');
  const add=(html,cls)=>{const d=document.createElement('div');d.className=`minhaj-ai-msg ${cls}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d;};
  const showResults=(loading,results)=>{if(!results.length){loading.textContent='ما لقيت موردًا مطابقًا داخل منهاج. جرّب اسم المادة أو نوع المصدر.';return;}loading.innerHTML='<strong>أفضل النتائج:</strong><div class="minhaj-ai-results">'+results.map(r=>{const url=safeUrl(r.url);return url==='#'?'':`<a class="minhaj-ai-result" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.title||r.name||'مصدر')}</strong><small>${esc([r.type,r.category].filter(Boolean).join(' · '))}</small></a>`;}).join('')+'</div>';};
  fab.onclick=()=>{panel.classList.toggle('open');if(panel.classList.contains('open')&&!messages.children.length)add('اسألني سؤالًا دراسيًا أو اطلب أي مصدر موجود في منهاج.','bot');};
  panel.querySelector('.minhaj-ai-close').onclick=()=>panel.classList.remove('open');
  form.onsubmit=async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value='';add(esc(q),'user');const loading=add('جاري البحث...','bot');try{const rows=await getResources();if(isResourceIntent(q)){const result=await smartResourceSearch(rows,q);if(result.action==='open_resource'){const r=result.resource,url=safeUrl(r.url);loading.innerHTML=`وجدت لك: <strong>${esc(r.title||r.name||'المصدر')}</strong>${r.description?`<br><small>${esc(r.description)}</small>`:''}${url!=='#'?`<a class="minhaj-ai-resource" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a>`:''}`;return;}showResults(loading,result.results);return;}const res=await fetch(AI_API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'study',messages:[{role:'user',content:q}]})});const data=await res.json();loading.textContent=data.answer||'تعذر الحصول على إجابة حاليًا.';}catch(err){console.error(err);loading.textContent='تعذر الاتصال بمساعد منهاج حاليًا.';}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUI);else createUI();
