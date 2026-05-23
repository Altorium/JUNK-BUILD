import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcNvF85mhJMEftToiTrc8mqioVW3Nywic",
  authDomain: "junk-build.firebaseapp.com",
  projectId: "junk-build",
  storageBucket: "junk-build.firebasestorage.app",
  messagingSenderId: "112067887630",
  appId: "1:112067887630:web:037ffba397d8071af5725f",
  measurementId: "G-5SY9JMJP16"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function loginAnonymously() {
    const result = await signInAnonymously(auth);
    return result.user.uid;
}

window.db = db;
window.auth = auth;
window.loginAnonymously = loginAnonymously;

//匿名ログインテスト、あとで消す
// loginAnonymously().then(uid => {
//   console.log("ログイン成功！ UID:", uid);
// }).catch(error => {
//   console.log("ログイン失敗：",error);
// })


