const DUAS = [
  {text:'رَبِّ زِدْنِي عِلْمًا', source:'سورة طه: 114'},
  {text:'رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي', source:'سورة طه: 25-26'},
  {text:'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا', source:'رواه ابن ماجه'},
  {text:'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا', source:'ورد في الدعاء لطلب العلم'},
  {text:'رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا', source:'سورة الكهف: 10'},
  {text:'رَبِّ هَبْ لِي حُكْمًا وَأَلْحِقْنِي بِالصَّالِحِينَ', source:'سورة الشعراء: 83'},
  {text:'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', source:'سورة آل عمران: 173'},
  {text:'وَقُلْ رَبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ', source:'سورة المؤمنون: 97-98'},
  {text:'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً', source:'سورة آل عمران: 8'},
  {text:'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَتَوَفَّنَا مُسْلِمِينَ', source:'سورة الأعراف: 126'},
  {text:'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ', source:'سورة النمل: 19'},
  {text:'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ', source:'سورة البقرة: 127'},
  {text:'رَبَّنَا ظَلَمْنَا أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ', source:'سورة الأعراف: 23'},
  {text:'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ', source:'سورة القصص: 24'},
  {text:'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا', source:'ورد في الدعاء عند المشقة'},
  {text:'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ', source:'من دعاء الاستعاذة من العلم غير النافع'},
  {text:'رَبَّنَا عَلَيْكَ تَوَكَّلْنَا وَإِلَيْكَ أَنَبْنَا وَإِلَيْكَ الْمَصِيرُ', source:'سورة الممتحنة: 4'},
  {text:'رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا', source:'سورة البقرة: 286'},
  {text:'رَبَّنَا وَآتِنَا مَا وَعَدتَّنَا عَلَىٰ رُسُلِكَ وَلَا تُخْزِنَا يَوْمَ الْقِيَامَةِ', source:'سورة آل عمران: 194'},
  {text:'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي', source:'رواه مسلم'},
  {text:'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى', source:'رواه مسلم'},
  {text:'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ', source:'رواه أبو داود والنسائي'},
  {text:'رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَعَافِنِي وَارْزُقْنِي', source:'رواه مسلم'},
  {text:'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِمَن دَخَلَ بَيْتِيَ مُؤْمِنًا', source:'سورة نوح: 28'}
];

const TRANSITIONS = ['fade','rise','slide','zoom','soft'];

function initDuas(){
  if(document.getElementById('minhaj-dua-card')) return;
  const card=document.createElement('aside');
  card.id='minhaj-dua-card';
  card.className='minhaj-dua-card';
  card.setAttribute('aria-live','polite');
  card.innerHTML='<span class="minhaj-dua-icon">🤲</span><div class="minhaj-dua-body"><span class="minhaj-dua-label">دعاء الطالب</span><div class="minhaj-dua-text"></div><small class="minhaj-dua-source"></small></div>';
  document.body.appendChild(card);
  const text=card.querySelector('.minhaj-dua-text');
  const source=card.querySelector('.minhaj-dua-source');
  let last=-1;
  const next=()=>{
    let i=Math.floor(Math.random()*DUAS.length);
    if(DUAS.length>1 && i===last) i=(i+1)%DUAS.length;
    last=i;
    const transition=TRANSITIONS[Math.floor(Math.random()*TRANSITIONS.length)];
    text.className=`minhaj-dua-text ${transition}`;
    source.className=`minhaj-dua-source ${transition}`;
    text.textContent=DUAS[i].text;
    source.textContent=DUAS[i].source;
    requestAnimationFrame(()=>{text.classList.add('show');source.classList.add('show');});
  };
  next();
  setInterval(next,10000);
}

function addDuaStyles(){
  if(document.getElementById('minhaj-dua-style')) return;
  const s=document.createElement('style');s.id='minhaj-dua-style';s.textContent=`
  .minhaj-dua-card{position:fixed;right:16px;bottom:16px;z-index:9000;width:min(370px,calc(100vw - 32px));display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border:1px solid rgba(255,255,255,.11);border-radius:17px;background:rgba(13,18,34,.92);backdrop-filter:blur(14px);box-shadow:0 14px 45px rgba(0,0,0,.25);color:#eef2ff;font-family:system-ui,sans-serif}.minhaj-dua-icon{font-size:22px;line-height:1.3}.minhaj-dua-body{min-width:0}.minhaj-dua-label{display:block;font-size:11px;color:#98a5c1;margin-bottom:3px}.minhaj-dua-text{font-size:14px;font-weight:600;line-height:1.8;opacity:0;transform:translateY(5px);transition:opacity .55s ease,transform .55s ease}.minhaj-dua-source{display:block;margin-top:3px;font-size:10px;color:#7f8ba6;opacity:0;transition:opacity .55s ease .08s}.minhaj-dua-text.show,.minhaj-dua-source.show{opacity:1;transform:none}.minhaj-dua-text.fade{transform:none}.minhaj-dua-text.rise{transform:translateY(8px)}.minhaj-dua-text.slide{transform:translateX(12px)}.minhaj-dua-text.zoom{transform:scale(.96)}.minhaj-dua-text.soft{filter:blur(4px);transform:none}.minhaj-dua-text.show.soft{filter:blur(0)}.minhaj-dua-text.show.rise,.minhaj-dua-text.show.slide,.minhaj-dua-text.show.zoom{transform:none}@media(max-width:600px){.minhaj-dua-card{right:10px;bottom:10px;width:calc(100vw - 20px);padding:11px 12px}.minhaj-dua-text{font-size:13px}.minhaj-dua-source{font-size:9px}}
  `;document.head.appendChild(s);
}

addDuaStyles();
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initDuas); else initDuas();
