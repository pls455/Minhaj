import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSe5Rgsr6_JneRvhtZilHmTfga8LCYZUo",
  authDomain: "minhaj-1be6f.firebaseapp.com",
  projectId: "minhaj-1be6f",
  storageBucket: "minhaj-1be6f.firebasestorage.app",
  messagingSenderId: "780231348130",
  appId: "1:780231348130:web:cafdef92ee081e12b02cfb"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;