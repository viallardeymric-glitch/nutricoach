// Configuration web du projet Firebase « nutricoach ».
// Ces valeurs sont publiques par conception (elles identifient le projet, elles ne donnent aucun accès) :
// la protection des données vient des règles Firestore (limitées aux deux comptes) et de la connexion.
// Mettre FIREBASE_CONFIG à null pour revenir au mode local, sans compte ni synchronisation.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDbAUnITI_EoORh7s2SbrHMrDGU2ShI_b4',
  authDomain: 'nutricoach-96298.firebaseapp.com',
  projectId: 'nutricoach-96298',
  storageBucket: 'nutricoach-96298.firebasestorage.app',
  messagingSenderId: '533864967426',
  appId: '1:533864967426:web:e52cf02f056d71afeca61b',
};
// Identifiant du foyer (un seul : le couple). Les données sont sous households/foyer/….
export const FOYER = 'foyer';
