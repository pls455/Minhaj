import { escapeHtml } from '../core/utils.js';

export function navbar(){const logoPath=location.pathname.includes('/admin/')?'../assets/minhaj-logo.png':'assets/minhaj-logo.png';return `<header class="site-header"><a class="brand" href="index.html" aria-label="مِنهَاج - الصفحة الرئيسية"><span style="width:43px;height:43px;flex:0 0 43px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;line-height:0"><img src="${logoPath}" alt="" style="width:100%;height:100%;max-width:none;object-fit:cover;transform:scale(1.45);display:block"></span><span>مِنهَاج</span></a><div class="nav-actions"><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation" aria-label="فتح القائمة">☰</button><button class="theme-toggle" type="button" aria-label="تبديل المظهر">☾</button></div><nav id="site-navigation" aria-label="التنقل الرئيسي"><a href="branches.html">الفروع</a><a href="subjects.html">المواد</a><a href="resources.html">المصادر</a><a href="foundation.html">التأسيس</a><a href="solutions.html">الحلول</a><a href="schools.html">المدارس</a><a href="flashcards.html">البطاقات</a><a href="tests.html">الاختبارات</a><a href="my-flashcards.html">بطاقاتي</a><a href="my-tests.html">اختباراتي</a><a href="tools.html">الأدوات</a><a href="ai.html">الذكاء</a><a href="suggestions.html">اقتراح</a></nav></header>`}

export function footer(){return `<footer><div><strong>مِنهَاج | Minhaj</strong><p>مصادر تعليمية مرتبة لطلاب التوجيهي.</p></div><a href="admin/index.html">الإدارة</a></footer>`}

function setupShellInteractions(root){
  const header=root.querySelector('.site-header');
  if(!header)return;
  const menu=header.querySelector('.menu-toggle'),nav=header.querySelector('#site-navigation');
  const closeMenu=()=>{nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false')};
  menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('open');menu.setAttribute('aria-expanded',String(Boolean(open)))});
  nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()},{once:false});
  const current=location.pathname.split('/').pop()||'index.html';
  nav?.querySelectorAll('a').forEach(link=>{
    const target=link.getAttribute('href')?.split('?')[0]?.split('#')[0];
    if(target===current){link.classList.add('active');link.setAttribute('aria-current','page')}});
  try{const saved=localStorage.getItem('minhaj-theme');if(saved)document.documentElement.dataset.theme=saved}catch(error){console.warn('[layout] theme restore skipped',error)}
  const themeButton=header.querySelector('.theme-toggle');
  const syncThemeIcon=()=>{const light=document.documentElement.dataset.theme==='light';if(themeButton){themeButton.textContent=light?'☀':'☾';themeButton.setAttribute('aria-label',light?'تفعيل المظهر الداكن':'تفعيل المظهر الفاتح')}};
  syncThemeIcon();
  themeButton?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;syncThemeIcon();try{localStorage.setItem('minhaj-theme',next)}catch(error){console.warn('[layout] theme save skipped',error)}});

  root.querySelectorAll('.card,.branch-card,.feature,.form-card,.section-head,.page-head,.page-header,.toolbar').forEach((element,index)=>{
    if(element.closest('.ai-layout'))return;
    element.classList.add('ui-reveal');
    element.style.setProperty('--reveal-delay',`${Math.min(index,8)*35}ms`);
  });
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.08});
    root.querySelectorAll('.ui-reveal').forEach(element=>observer.observe(element));
  }else root.querySelectorAll('.ui-reveal').forEach(element=>element.classList.add('is-visible'));
}

export function mountShell(title,content){const app=document.getElementById('app');if(!app)throw new Error('Missing #app root');document.title=`${title} | مِنهَاج`;app.innerHTML=`${navbar()}<main class="container"><div class="page-head"><span class="eyebrow">مِنهَاج</span><h1>${escapeHtml(title)}</h1></div>${content}</main>${footer()}`;setupShellInteractions(app);}

export function renderNavbar(root=document.body){const wrapper=document.createElement('div');wrapper.innerHTML=navbar();const header=wrapper.firstElementChild;root.prepend(header);setupShellInteractions(root);return header}
export function renderFooter(root=document.body){const wrapper=document.createElement('div');wrapper.innerHTML=footer();const element=wrapper.firstElementChild;root.append(element);return element}

export function showToast(message,type='info'){const host=document.querySelector('.toast-region')||document.body.appendChild(Object.assign(document.createElement('div'),{className:'toast-region',role:'status','aria-live':'polite'}));const toast=document.createElement('div');toast.className=`toast toast-${type}`;toast.textContent=message;host.append(toast);requestAnimationFrame(()=>toast.classList.add('is-visible'));setTimeout(()=>{toast.classList.remove('is-visible');setTimeout(()=>toast.remove(),220)},2600);}