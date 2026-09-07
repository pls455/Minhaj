import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "../firebase.js";

const AUTH_WAIT_TIMEOUT_MS = 10000;
export function observeAuth(callback){return onAuthStateChanged(auth,callback)}
export async function signIn(email,password){const credential=await signInWithEmailAndPassword(auth,email.trim(),password);return credential.user}
export async function signOutUser(){await signOut(auth)}
export async function getCurrentAdmin(user=auth.currentUser){if(!user)return null;const snapshot=await getDoc(doc(db,"admins",user.uid));if(!snapshot.exists())return null;return{uid:snapshot.id,...snapshot.data()}}
export async function getCurrentIdToken(forceRefresh=false){if(!auth.currentUser)return null;return auth.currentUser.getIdToken(forceRefresh)}
export async function requireAuthenticatedAdmin(){const user=await waitForAuthUser();if(!user)throw new Error("AUTH_REQUIRED");const admin=await getCurrentAdmin(user);if(!admin?.active)throw new Error("ADMIN_ACCESS_REQUIRED");return{user,admin}}
function waitForAuthUser(){if(auth.currentUser)return Promise.resolve(auth.currentUser);return new Promise((resolve,reject)=>{let settled=false,timer;const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timer);unsubscribe();callback(value)};const unsubscribe=onAuthStateChanged(auth,user=>finish(resolve,user),error=>finish(reject,error));timer=setTimeout(()=>{const error=new Error("AUTH_TIMEOUT");error.code="AUTH_TIMEOUT";finish(reject,error)},AUTH_WAIT_TIMEOUT_MS)})}
