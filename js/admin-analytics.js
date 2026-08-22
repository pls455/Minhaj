import { db } from './firebase.js';
import { collection, getDocs, query, limit } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const n = v => Number(v || 0).toLocaleString('ar');
const dateOf = x => {
  const v = x?.createdAt || x?.timestamp || x?.visitedAt || x?.date;
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const pageOf = x => String(x?.path || x?.page || x?.url || x?.pagePath || 'غير معروف').replace(location.origin,'').split('?')[0] || '/';

async function read(name, max = 1000) {
  try {
    const s = await getDocs(query(collection(db, name), limit(max)));
    return s.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch (e) {
    console.warn(`[analytics] ${name}`, e);
    return [];
  }
}

function injectUI() {
  if (document.getElementById('analyticsPanel')) return;
  const tabs = document.querySelector('.admin-tabs');
  const dashboard = document.getElementById('dashboard');
  if (!tabs || !dashboard) return;

  const tab = document.createElement('button');
  tab.className = 'admin-tab';
  tab.dataset.tab = 'analytics';
  tab.textContent = '📈 الإحصائيات';
  tabs.appendChild(tab);

  const panel = document.createElement('div');
  panel.id = 'analyticsPanel';
  panel.className = 'admin-panel hidden';
  panel.innerHTML = `
    <div class="panel-header">
      <div><h2>📈 إحصائيات الموقع</h2><p>حركة الموقع واستخدام الصفحات من بيانات Firestore.</p></div>
      <button id="refreshAnalytics" class="btn secondary">↻ تحديث</button>
    </div>
    <div id="analyticsMessage"></div>
    <div class="admin-stats analytics-stats">
      <div class="stat-box"><span>إجمالي الزيارات</span><strong id="analyticsTotal">—</strong></div>
      <div class="stat-box"><span>زوار مميزون</span><strong id="analyticsUnique">—</strong></div>
      <div class="stat-box"><span>آخر 24 ساعة</span><strong id="analytics24">—</strong></div>
      <div class="stat-box"><span>آخر 7 أيام</span><strong id="analytics7">—</strong></div>
      <div class="stat-box"><span>آخر 30 يومًا</span><strong id="analytics30">—</strong></div>
      <div class="stat-box"><span>الصفحات المسجلة</span><strong id="analyticsPages">—</strong></div>
    </div>
    <div class="cards analytics-grid">
      <div class="bulk-box"><h3>🔥 أكثر الصفحات زيارة</h3><div id="analyticsTopPages" class="admin-list"></div></div>
      <div class="bulk-box"><h3>📅 الزيارات حسب اليوم</h3><div id="analyticsDays" class="admin-list"></div></div>
    </div>`;
  dashboard.querySelector('.admin-tabs')?.after(panel);

  tab.addEventListener('click', async () => {
    document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(x => x.classList.add('hidden'));
    panel.classList.remove('hidden');
    await render();
  });
  document.getElementById('refreshAnalytics')?.addEventListener('click', render);
}

function set(id, value) { const el=document.getElementById(id); if(el) el.textContent=n(value); }

async function render() {
  const panel = document.getElementById('analyticsPanel');
  if (!panel || panel.classList.contains('hidden')) return;
  const [stats, views] = await Promise.all([read('siteStats',100), read('pageViews',2000)]);
  const global = stats.find(x => x.id === 'global') || stats[0] || {};
  const now = Date.now();
  const day = 86400000;
  const valid = views.map(x => ({...x,d:dateOf(x)})).filter(x => x.d);
  set('analyticsTotal', global.totalVisits ?? global.visits ?? valid.length);
  set('analyticsUnique', global.uniqueVisitors ?? global.uniqueUsers ?? global.users ?? 0);
  set('analytics24', valid.filter(x => now-x.d.getTime() < day).length);
  set('analytics7', valid.filter(x => now-x.d.getTime() < 7*day).length);
  set('analytics30', valid.filter(x => now-x.d.getTime() < 30*day).length);
  set('analyticsPages', new Set(valid.map(pageOf)).size);

  const counts = new Map();
  valid.forEach(x => counts.set(pageOf(x),(counts.get(pageOf(x))||0)+1));
  const top = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topBox = document.getElementById('analyticsTopPages');
  if (topBox) topBox.innerHTML = top.length ? top.map(([p,c],i)=>`<div class="admin-item"><div><strong>${i+1}. ${esc(p)}</strong></div><span class="tag">${n(c)} زيارة</span></div>`).join('') : '<div class="empty-state">لا توجد بيانات زيارات بعد.</div>';

  const days = new Map();
  valid.filter(x => now-x.d.getTime() < 14*day).forEach(x => {
    const key=x.d.toLocaleDateString('ar-PS',{month:'short',day:'numeric'});
    days.set(key,(days.get(key)||0)+1);
  });
  const dayBox=document.getElementById('analyticsDays');
  const rows=[...days.entries()].reverse();
  if(dayBox) dayBox.innerHTML=rows.length?rows.map(([d,c])=>`<div class="admin-item"><strong>${esc(d)}</strong><span class="tag">${n(c)}</span></div>`).join(''):'<div class="empty-state">لا توجد بيانات يومية بعد.</div>';

  const msg=document.getElementById('analyticsMessage');
  if(msg){msg.textContent = views.length ? `تم تحديث الإحصائيات من ${n(views.length)} سجل زيارة.` : 'لا توجد سجلات في pageViews حاليًا. إذا كانت الإحصائيات لا تسجل زيارات، راجع صلاحيات الكتابة للمجموعة.'; msg.className=views.length?'message success':'message';}
}

function boot() {
  const dashboard=document.getElementById('dashboard');
  if(!dashboard) return;
  const run=()=>{ if(!dashboard.classList.contains('hidden')) injectUI(); };
  run();
  new MutationObserver(run).observe(dashboard,{attributes:true,attributeFilter:['class']});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
