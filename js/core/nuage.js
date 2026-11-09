// Accès à Firebase (connexion + Firestore). Le SDK (vendor/firebase.js) n'est chargé que si la configuration existe.
import { FIREBASE_CONFIG, FOYER } from './firebase-config.js';

let promesseSdk = null;
let auth = null;
let db = null;

export const nuageActif = () => Boolean(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);

function sdk() {
  if (!promesseSdk) {
    promesseSdk = import('../../vendor/firebase.js').then((m) => {
      const app = m.initializeApp(FIREBASE_CONFIG);
      auth = m.getAuth(app);
      try {
        // Cache hors ligne : les écritures faites sans réseau partent au retour de la connexion.
        db = m.initializeFirestore(app, { localCache: m.persistentLocalCache({ tabManager: m.persistentMultipleTabManager() }) });
      } catch { db = m.initializeFirestore(app, {}); } // navigation privée : pas de cache disque
      return m;
    }).catch((e) => { promesseSdk = null; throw e; });
  }
  return promesseSdk;
}

/** Appelle cb(utilisateur | null) à chaque changement de connexion. Retourne une promesse de fonction d'arrêt. */
export async function ecouterConnexion(cb, cbErreur) {
  const m = await sdk();
  return m.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email, uid: u.uid } : null), cbErreur);
}
export async function connecter(email, motDePasse) {
  const m = await sdk();
  await m.signInWithEmailAndPassword(auth, email.trim(), motDePasse);
}
export async function deconnecter() { const m = await sdk(); await m.signOut(auth); }
export async function motDePasseOublie(email) { const m = await sdk(); await m.sendPasswordResetEmail(auth, email.trim()); }

/** Écoute une sous-collection du foyer : cb([{ id, ...champs }]) à chaque changement (aussi hors ligne, depuis le cache). */
export function ecouterCollection(nom, cb, cbErreur) {
  let fini = false;
  let arret = () => {};
  sdk().then((m) => {
    if (fini) return;
    arret = m.onSnapshot(m.collection(db, 'households', FOYER, nom),
      (instantane) => cb(instantane.docs.map((d) => ({ ...d.data(), id: d.id }))), cbErreur);
  }).catch((e) => cbErreur && cbErreur(e));
  return () => { fini = true; arret(); };
}
export async function ecrireDoc(nom, id, donnees) {
  const m = await sdk();
  return m.setDoc(m.doc(db, 'households', FOYER, nom, id), donnees);
}
export async function supprimerDoc(nom, id) {
  const m = await sdk();
  return m.deleteDoc(m.doc(db, 'households', FOYER, nom, id));
}

/** Message lisible pour une erreur de connexion Firebase. */
export function messageErreur(e) {
  const c = e && e.code;
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email') return 'Email ou mot de passe incorrect.';
  if (c === 'auth/too-many-requests') return 'Trop d\'essais. Patientez quelques minutes, puis réessayez.';
  if (c === 'auth/network-request-failed') return 'Pas de réseau. Vérifiez votre connexion.';
  if (c === 'auth/user-disabled') return 'Ce compte est désactivé.';
  return 'Connexion impossible pour le moment. Réessayez.';
}
