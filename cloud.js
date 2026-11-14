import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, collection, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ВСТАВЬТЕ СЮДА ВАШ firebaseConfig ИЗ КОНСОЛИ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB6dGSsy9b3X2wtQnPiGv4HH64GVnXF-E4",
  authDomain: "hockey-sim-fda59.firebaseapp.com",
  projectId: "hockey-sim-fda59",
  storageBucket: "hockey-sim-fda59.firebasestorage.app",
  messagingSenderId: "256952962517",
  appId: "1:256952962517:web:d6a09d7303c94aaca3c15c",
  measurementId: "G-Q18Y7BEZ1E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let uid = null, ready = false, timer = null, known = new Set();
const clean = o => JSON.parse(JSON.stringify(o));
const setStatus = t => { $('sync-status').textContent = t; };
const msg = t => { $('au-msg').textContent = t; };

const ERRORS = {
  'auth/invalid-email': 'Некорректный email',
  'auth/missing-email': 'Введите email',
  'auth/missing-password': 'Введите пароль',
  'auth/weak-password': 'Пароль слишком короткий (минимум 6 символов)',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/user-not-found': 'Неверный email или пароль',
  'auth/wrong-password': 'Неверный email или пароль',
  'auth/too-many-requests': 'Слишком много попыток, попробуйте позже',
  'auth/network-request-failed': 'Нет соединения с интернетом'
};

// ---------- Облако ----------
async function pull() {
  const tm = await getDoc(doc(db, 'users', uid, 'data', 'teams'));
  const tr = await getDocs(collection(db, 'users', uid, 'tournaments'));
  return {
    teams: tm.exists() ? tm.data().list : null,
    tournaments: tr.docs.map(d => d.data()).sort((a, b) => a.id - b.id)
  };
}

async function push() {
  if (!uid || !ready) return;
  const { teams, tournaments } = App.getData();
  setStatus('☁️ Синхронизация…');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'data', 'teams'), { list: clean(teams) });
    const ids = new Set();
    tournaments.forEach(t => {
      ids.add(String(t.id));
      batch.set(doc(db, 'users', uid, 'tournaments', String(t.id)), clean(t));
    });
    known.forEach(id => {
      if (!ids.has(id)) batch.delete(doc(db, 'users', uid, 'tournaments', id));
    });
    await batch.commit();
    known = ids;
    setStatus('☁️ Сохранено');
  } catch (e) {
    console.error(e);
    setStatus('⚠️ Не удалось сохранить');
  }
}

window.Cloud = {
  queueSave() {
    if (!uid || !ready) return;
    clearTimeout(timer);
    timer = setTimeout(push, 1200);
  }
};

// ---------- Вход и выход ----------
async function run(fn) {
  msg('');
  try { await fn(); } catch (e) { msg(ERRORS[e.code] || 'Ошибка: ' + e.code); }
}
$('btn-login').addEventListener('click', () =>
  run(() => signInWithEmailAndPassword(auth, $('au-email').value.trim(), $('au-pass').value)));
$('btn-register').addEventListener('click', () =>
  run(() => createUserWithEmailAndPassword(auth, $('au-email').value.trim(), $('au-pass').value)));
$('btn-reset').addEventListener('click', () => run(async () => {
  const email = $('au-email').value.trim();
  if (!email) { msg('Введите email'); return; }
  await sendPasswordResetEmail(auth, email);
  msg('Письмо для сброса пароля отправлено');
}));
$('btn-logout').addEventListener('click', () => signOut(auth));

function authView(loading) {
  $('auth-loading').style.display = loading ? 'block' : 'none';
  $('auth-form').style.display = loading ? 'none' : 'block';
}

onAuthStateChanged(auth, async user => {
  clearTimeout(timer);
  ready = false;
  if (!user) {
    uid = null;
    App.setUser(null);
    $('au-pass').value = '';
    authView(false);
    showScreen('auth');
    return;
  }
  uid = user.uid;
  App.setUser(uid);                // сначала данные из локального кэша
  authView(true);
  showScreen('auth');
  $('acc-email').textContent = user.email;
  try {
    const r = await pull();
    if (r.teams === null && r.tournaments.length === 0) {
      // облако пустое: переносим старые данные, если они есть
      const cur = App.getData();
      if (!cur.teams.length && !cur.tournaments.length) {
        const old = App.legacy();
        App.setData(old.teams, old.tournaments);
      }
      known = new Set();
      ready = true;
      await push();
    } else {
      App.setData(r.teams || [], r.tournaments);
      known = new Set(r.tournaments.map(t => String(t.id)));
      ready = true;
      setStatus('☁️ Сохранено');
    }
  } catch (e) {
    console.error(e);
    setStatus('⚠️ Офлайн: изменения не сохраняются в облако');
  }
  showScreen('menu');
});