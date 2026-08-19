import { db } from "./firebase.js";
import { collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
const count = async name => { try { const snap = await getDocs(query(collection(db,name), limit(500))); return snap.docs.filter(d => d.data()?.active !== false).length; } catch { return null; } };
const animate = (el,value) => { if (value === null) { el.textContent = "—"; return; } const start = performance.now(); const duration = 650; const tick = now => { const p = Math.min(1,(now-start)/duration); const eased = 1-Math.pow(1-p,3); el.textContent = Math.round(value*eased).toLocaleString("ar"); if(p<1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
async function loadStats(){ const el=document.querySelector("#homeResourceCount"); if(!el) return; const value=await count("resources"); animate(el,value); }
loadStats();