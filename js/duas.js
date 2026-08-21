const DUAS = [
  {text:'رَبِّ زِدْنِي عِلْمًا', source:'سورة طه: 114'},
  {text:'رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي', source:'سورة طه: 25-26'},
  {text:'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا', source:'رواه ابن ماجه'},
  {text:'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا', source:'ورد في الدعاء لطلب العلم'},
  {text:'رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا', source:'سورة الكهف: 10'},
  {text:'رَبِّ هَبْ لِي حُكْمًا وَأَلْحِقْنِي بِالصَّالِحِينَ', source:'سورة الشعراء: 83'},
  {text:'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', source:'سورة آل عمران: 173'},
  {text:'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً', source:'سورة آل عمران: 8'},
  {text:'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَتَوَفَّنَا مُسْلِمِينَ', source:'سورة الأعراف: 126'},
  {text:'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ', source:'سورة النمل: 19'},
  {text:'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ', source:'سورة البقرة: 127'},
  {text:'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ', source:'سورة القصص: 24'},
  {text:'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا', source:'ورد في الدعاء عند المشقة'},
  {text:'رَبَّنَا عَلَيْكَ تَوَكَّلْنَا وَإِلَيْكَ أَنَبْنَا وَإِلَيْكَ الْمَصِيرُ', source:'سورة الممتحنة: 4'},
  {text:'رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا', source:'سورة البقرة: 286'},
  {text:'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي', source:'رواه مسلم'},
  {text:'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى', source:'رواه مسلم'},
  {text:'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ', source:'رواه أبو داود والنسائي'},
  {text:'رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَعَافِنِي وَارْزُقْنِي', source:'رواه مسلم'},
  {text:'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِمَن دَخَلَ بَيْتِيَ مُؤْمِنًا', source:'سورة نوح: 28'}
];
const TRANSITIONS=['fade','rise','slide','zoom','soft'];
function initDuas(){
 if(document.getElementById('minhaj-dua-card'))return;
 const card=document.createElement('aside');card.id='minhaj-dua-card';card.className='minhaj-dua-card';card.setAttribute('aria-live','polite');
 card.innerHTML='<span class="minhaj-dua-icon">🤲</span><div class="minhaj-dua-body"><span class="minhaj-dua-label">دعاء الطالب</span><div class="minhaj-dua-text"></div><small class="minhaj-dua-source"></small></div>';document.body.appendChild(card);
 const text=card.querySelector('.minhaj-dua-text'),source=card.querySelector('.minhaj-dua-source');let last=-1;
 const next=()=>{let i=Math.floor(Math.random()*DUAS.length);if(DUAS.length>1&&i===last)i=(i+1)%DUAS.length;last=i;const t=TRANSITIONS[Math.floor(Math.random()*TRANSITIONS.length)];text.className=`minhaj-dua-text ${t}`;source.className=`minhaj-dua-source ${t}`;text.textContent=DUAS[i].text;source.textContent=DUAS[i].source;requestAnimationFrame(()=>{text.classList.add('show');source.classList.add('show')});};next();setInterval(next,10000);
}
function addDuaStyles(){if(document.getElementById('minhaj-dua-style'))return;const s=document.createElement('style');s.id='minhaj-dua-style';s.textContent=`
.minhaj-dua-card{position:fixed;right:16px;bottom:16px;z-index:9000;width:min(350px,calc(100vw - 32px));display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border:1px solid rgba(255,255,255,.11);border-radius:16px;background:rgba(13,18,34,.94);backdrop-filter:blur(14px);box-shadow:0 12px 38px rgba(0,0,0,.25);color:#eef2ff;font-family:system-ui,sans-serif}.minhaj-dua-icon{font-size:20px;line-height:1.3}.minhaj-dua-body{min-width:0}.minhaj-dua-label{display:block;font-size:10px;color:#98a5c1;margin-bottom:2px}.minhaj-dua-text{font-size:13px;font-weight:600;line-height:1.7;opacity:0;transform:translateY(5px);transition:opacity .55s ease,transform .55s ease}.minhaj-dua-source{display:block;margin-top:2px;font-size:9px;color:#7f8ba6;opacity:0;transition:opacity .55s ease .08s}.minhaj-dua-text.show,.minhaj-dua-source.show{opacity:1;transform:none}.minhaj-dua-text.slide{transform:translateX(12px)}.minhaj-dua-text.zoom{transform:scale(.96)}.minhaj-dua-text.soft{filter:blur(4px);transform:none}.minhaj-dua-text.show.soft{filter:blur(0)}
.minhaj-ai-fab{left:18px!important;right:auto!important;bottom:18px!important}.minhaj-dua-card{right:18px!important;left:auto!important;bottom:18px!important}
@media(max-width:700px){.minhaj-ai-fab{left:10px!important;bottom:10px!important;padding:10px 13px!important}.minhaj-dua-card{right:10px!important;bottom:64px!important;width:calc(100vw - 20px);padding:9px 11px}.minhaj-dua-text{font-size:12px}.minhaj-dua-source{font-size:8px}}
`;document.head.appendChild(s)}
addDuaStyles();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDuas);else initDuas();

function initMinhajMotto(){
 if(document.getElementById('minhaj-motto'))return;
 const el=document.createElement('div');el.id='minhaj-motto';el.innerHTML='<span>وَالعِزُّ في قِسامِكم</span>';document.body.prepend(el);
 const style=document.createElement('style');style.id='minhaj-motto-style';style.textContent=`#minhaj-motto{position:relative;z-index:8000;text-align:center;padding:8px 16px 7px;background:linear-gradient(180deg,rgba(20,26,48,.98),rgba(13,18,34,.92));border-bottom:1px solid rgba(255,255,255,.08);overflow:hidden}#minhaj-motto span{display:inline-block;font-size:clamp(13px,2.2vw,17px);font-weight:800;letter-spacing:.8px;background:linear-gradient(90deg,#d7b76a,#fff2b0,#d7b76a);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:minhajMottoGlow 4s ease-in-out infinite,minhajMottoIn 1s cubic-bezier(.2,.8,.2,1) both;text-shadow:0 0 22px rgba(215,183,106,.12)}@keyframes minhajMottoGlow{0%,100%{background-position:0% 50%;filter:brightness(1)}50%{background-position:100% 50%;filter:brightness(1.25)}}@keyframes minhajMottoIn{from{opacity:0;transform:translateY(-10px) scale(.96)}to{opacity:1;transform:none}}@media(max-width:600px){#minhaj-motto{padding:7px 12px 6px}#minhaj-motto span{font-size:13px}}`;
 document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMinhajMotto);else initMinhajMotto();
