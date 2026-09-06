import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const USERS='users';
const clean=v=>String(v??'').trim();

export async function initStudentAuth(){
  await setPersistence(auth,browserLocalPersistence);
  return auth;
}

export function watchAuth(callback){ return onAuthStateChanged(auth,callback); }

export async function registerStudent({name,email,password,identityNumber=''}){
  const safeName=clean(name).slice(0,100);
  const safeEmail=clean(email).toLowerCase();
  const safeIdentity=clean(identityNumber).replace(/\s+/g,'').slice(0,32);
  if(!safeName) throw Error('STUDENT_NAME_REQUIRED');
  if(!safeEmail) throw Error('STUDENT_EMAIL_REQUIRED');
  if(String(password||'').length<6) throw Error('STUDENT_PASSWORD_SHORT');
  if(safeIdentity && !/^[0-9]{4,32}$/.test(safeIdentity)) throw Error('STUDENT_ID_INVALID');
  const credential=await createUserWithEmailAndPassword(auth,safeEmail,password);
  if(safeName) await updateProfile(credential.user,{displayName:safeName});
  try{
    await setDoc(doc(db,USERS,credential.user.uid),{
      name:safeName,
      email:safeEmail,
      role:'student',
      identityNumber:safeIdentity||null,
      createdAt:serverTimestamp(),
      lastLoginAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
  }catch(error){
    console.warn('[studentAuth] profile creation failed after successful auth:',error);
  }
  return credential.user;
}

export async function loginStudent(email,password){
  const safeEmail=clean(email).toLowerCase();
  if(!safeEmail||!password) throw Error('STUDENT_LOGIN_REQUIRED');
  const credential=await signInWithEmailAndPassword(auth,safeEmail,password);
  try{
    await setDoc(doc(db,USERS,credential.user.uid),{
      name:credential.user.displayName||safeEmail.split('@')[0],
      email:credential.user.email||safeEmail,
      role:'student',
      lastLoginAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});
  }catch(error){
    console.warn('[studentAuth] profile sync failed after successful login:',error);
  }
  return credential.user;
}

export async function logoutStudent(){ await signOut(auth); }

export async function getStudentProfile(uid=auth.currentUser?.uid){
  if(!uid) return null;
  try{
    const snap=await getDoc(doc(db,USERS,uid));
    return snap.exists()?{id:snap.id,...snap.data()}:null;
  }catch(error){
    console.warn('[studentAuth] profile read failed:',error);
    return null;
  }
}

export async function saveStudentProfile({name,identityNumber=''}){
  const user=auth.currentUser;
  if(!user) throw Error('STUDENT_LOGIN_REQUIRED');
  const safeName=clean(name).slice(0,100);
  const safeIdentity=clean(identityNumber).replace(/\s+/g,'').slice(0,32);
  if(!safeName) throw Error('STUDENT_NAME_REQUIRED');
  if(safeIdentity && !/^[0-9]{4,32}$/.test(safeIdentity)) throw Error('STUDENT_ID_INVALID');
  await setDoc(doc(db,USERS,user.uid),{name:safeName,email:user.email||'',role:'student',identityNumber:safeIdentity||null,updatedAt:serverTimestamp()},{merge:true});
  if(user.displayName!==safeName) await updateProfile(user,{displayName:safeName});
}

export function authErrorMessage(error){
  const code=error?.code||error?.message||'';
  const map={
    'auth/email-already-in-use':'هذا البريد مستخدم بالفعل.',
    'auth/invalid-email':'البريد الإلكتروني غير صحيح.',
    'auth/weak-password':'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
    'auth/invalid-credential':'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/user-not-found':'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/wrong-password':'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/user-disabled':'هذا الحساب معطل.',
    'auth/too-many-requests':'تمت محاولات كثيرة. جرّب لاحقًا.',
    'auth/network-request-failed':'تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.',
    STUDENT_NAME_REQUIRED:'اكتب اسم الطالب.',
    STUDENT_EMAIL_REQUIRED:'اكتب البريد الإلكتروني.',
    STUDENT_PASSWORD_SHORT:'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
    STUDENT_ID_INVALID:'رقم الهوية يجب أن يحتوي على أرقام فقط وبطول 4 إلى 32 رقمًا.',
    STUDENT_LOGIN_REQUIRED:'أدخل البريد الإلكتروني وكلمة المرور.'
  };
  return map[code]||'تعذر إكمال العملية. حاول مرة أخرى.';
}
