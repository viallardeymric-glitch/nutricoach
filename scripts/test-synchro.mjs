// Test de la connexion et de la synchro à deux téléphones. Firebase est remplacé par un faux SDK
// (vendor/firebase.js intercepté) relié à un « serveur » en mémoire côté Node : on vérifie NOTRE code
// (chemins, données écrites, affichage en direct), pas Firebase lui-même.
// Usage : node scripts/test-synchro.mjs [dossier-captures]
import { chargerPlaywright, servir } from './_navigateur.mjs';

const captures = process.argv[2];
const { chromium } = chargerPlaywright();
const serveur = await servir();
const navigateur = await chromium.launch();
let echecs = 0;
const verif = (ok, msg) => { console.log(ok ? 'ok   ' : 'ÉCHEC', msg); if (!ok) echecs++; };

// ---- « serveur » Firestore en mémoire : chemin du document → données
const base = new Map();
const ecoutes = []; // { page, coll }
const enfants = (coll) => [...base].filter(([c]) => c.startsWith(coll + '/') && !c.slice(coll.length + 1).includes('/'))
  .map(([c, d]) => ({ id: c.split('/').pop(), data: d }));
const notifier = async (coll) => {
  for (const e of ecoutes.filter((x) => x.coll === coll)) await e.page.evaluate(([c, d]) => window.__fsNotify(c, d), [coll, enfants(coll)]).catch(() => {});
};
const COMPTES = { 'eymric@test.fr': 'secret-E', 'marie@test.fr': 'secret-M' };

const SDK_FAUX = `
const ecouteurs = new Map();
window.__fsNotify = (coll, docs) => (ecouteurs.get(coll) || new Set()).forEach((cb) => cb(instantane(docs)));
const instantane = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) });
export const initializeApp = () => ({});
export const getAuth = () => ({});
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const doc = (db, ...chemin) => ({ chemin: chemin.join('/') });
export const collection = (db, ...chemin) => ({ chemin: chemin.join('/'), coll: true });
export const setDoc = (ref, data) => window.fsCall('set', ref.chemin, JSON.parse(JSON.stringify(data)));
export const deleteDoc = (ref) => window.fsCall('delete', ref.chemin);
export const onSnapshot = (ref, cb) => {
  if (!ecouteurs.has(ref.chemin)) ecouteurs.set(ref.chemin, new Set());
  ecouteurs.get(ref.chemin).add(cb);
  window.fsCall('listen', ref.chemin).then((docs) => cb(instantane(docs)));
  return () => ecouteurs.get(ref.chemin).delete(cb);
};
const abonnes = new Set();
export const onAuthStateChanged = (auth, cb) => { abonnes.add(cb); cb(JSON.parse(localStorage.getItem('faux-user') || 'null')); return () => abonnes.delete(cb); };
export const signInWithEmailAndPassword = async (auth, email, mdp) => {
  const ok = await window.fsCall('auth', email, mdp);
  if (!ok) { const e = new Error('x'); e.code = 'auth/invalid-credential'; throw e; }
  const u = { email, uid: email };
  localStorage.setItem('faux-user', JSON.stringify(u)); abonnes.forEach((cb) => cb(u));
};
export const signOut = async () => { localStorage.removeItem('faux-user'); abonnes.forEach((cb) => cb(null)); };
export const sendPasswordResetEmail = async () => { window.fsCall('reset'); };
`;

async function telephone(nom) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.route('**/vendor/firebase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: SDK_FAUX }));
  await ctx.exposeBinding('fsCall', async ({ page }, op, a, b) => {
    if (op === 'auth') return COMPTES[a] === b;
    if (op === 'set') { base.set(a, b); await notifier(a.split('/').slice(0, -1).join('/')); return null; }
    if (op === 'delete') { base.delete(a); await notifier(a.split('/').slice(0, -1).join('/')); return null; }
    if (op === 'listen') { ecoutes.push({ page, coll: a }); return enfants(a); }
    return null;
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.nom = nom; page.erreurs = erreurs;
  return page;
}
async function seConnecter(p, email, mdp, qui) {
  await p.goto(serveur.url + '/');
  await p.waitForSelector('form.connexion');
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', mdp);
  await p.click('button[type=submit]');
  if (qui) { await p.waitForSelector('text=Qui utilise ce téléphone'); await p.click(`text=Je suis ${qui}`); }
  await p.waitForSelector('.carte');
}
const nb = async (p) => parseInt((await p.textContent('.nb-resultats')).trim(), 10);

const eymric = await telephone('Eymric');
const marie = await telephone('Marie');

// 1. Connexion
await eymric.goto(serveur.url + '/');
await eymric.waitForSelector('form.connexion');
verif(true, 'sans compte connecté : écran de connexion');
await eymric.fill('input[type=email]', 'eymric@test.fr'); await eymric.fill('input[type=password]', 'mauvais');
await eymric.click('button[type=submit]');
await eymric.waitForSelector('.bandeau.alerte');
verif((await eymric.textContent('.bandeau.alerte')).includes('incorrect'), 'mauvais mot de passe : message clair');
await eymric.fill('input[type=password]', 'secret-E');
await eymric.click('button[type=submit]');
await eymric.waitForSelector('text=Qui utilise ce téléphone');
await eymric.click('text=Je suis Eymric');
await eymric.waitForSelector('.carte');
verif(true, 'bon mot de passe : choix « Je suis Eymric » puis liste');
await seConnecter(marie, 'marie@test.fr', 'secret-M', 'Marie');

// 2. Favori d'Eymric -> visible chez Marie en direct, avec la pastille E
await eymric.fill('input[type=search]', 'poulet roti');
await eymric.click('.carte .coeur >> nth=0');
const idFav = [...base.keys()].find((k) => k.startsWith('households/foyer/favorites/'));
verif(/favorites\/REC-\d{6}_E$/.test(idFav || ''), `favori écrit à households/foyer/favorites/… (${idFav})`);
verif(JSON.stringify(base.get(idFav)).includes('"par":"E"'), 'le document favori indique qui l\'a ajouté');
await marie.goto(serveur.url + '/#/favoris');
await marie.waitForSelector('.liste .carte .pastille.E', { timeout: 2000 }).then(
  () => verif(true, 'Marie voit le favori d\'Eymric (pastille E) en moins de 2 s'),
  () => verif(false, 'Marie voit le favori d\'Eymric en moins de 2 s'));
verif(await nb(marie) === 1, 'onglet Favoris de Marie : 1 recette');

// 3. Marie ajoute le même favori -> les deux pastilles ; Eymric voit M apparaître
await marie.click('.liste .coeur');
await eymric.goto(serveur.url + '/#/favoris');
await eymric.waitForSelector('.liste .carte .pastille.M', { timeout: 2000 }).then(
  () => verif(true, 'Eymric voit la pastille M apparaître'), () => verif(false, 'Eymric voit la pastille M'));
verif(await eymric.locator('.liste .carte .pastille').count() === 2, 'les deux pastilles E et M sont affichées');
await marie.click('.liste .coeur');   // Marie retire le sien
await eymric.waitForFunction(() => document.querySelectorAll('.liste .carte .pastille').length === 1, null, { timeout: 2000 }).then(
  () => verif(true, 'Marie retire son favori : il disparaît chez Eymric, le sien reste'), () => verif(false, 'retrait synchronisé'));

// 4. Profil de Marie -> « Nous deux » chez Eymric
await marie.goto(serveur.url + '/#/profil');
await marie.click('.puce:text-is("Femme")');
const champs = marie.locator('.grille input');
await champs.nth(0).fill('34'); await champs.nth(1).fill('62'); await champs.nth(2).fill('168');
await marie.click('.puce:text-is("2e trimestre")');
await marie.waitForTimeout(1200);
const docMarie = base.get('households/foyer/profiles/M');
verif(docMarie && docMarie.grossesse === 2 && docMarie.age === 34 && !('intrus' in docMarie), 'profil de Marie écrit à households/foyer/profiles/M');
verif(Object.values(docMarie || {}).every((v) => v !== undefined) && Object.keys(docMarie).length <= 60, 'document profil valide pour les règles (≤ 60 champs)');
await eymric.goto(serveur.url + '/#/nous');
await eymric.waitForSelector('.carte-nous >> text=Enceinte', { timeout: 2000 }).then(
  () => verif(true, '« Nous deux » : Eymric voit la situation de Marie (enceinte) en direct'),
  () => verif(false, '« Nous deux » : profil de Marie'));
verif((await eymric.textContent('.fiche-corps')).includes('kcal par jour'), '« Nous deux » : besoins de Marie affichés');
if (captures) await eymric.screenshot({ path: `${captures}/nous.png` });

// 5. Favoris déjà gardés en local avant la connexion : ils rejoignent le nuage
const tardif = await telephone('Tardif');
await tardif.goto(serveur.url + '/');
await tardif.evaluate(() => { localStorage.setItem('nutricoach.moi', '"E"'); localStorage.setItem('nutricoach.favoris', '["REC-000077"]'); });
await seConnecter(tardif, 'eymric@test.fr', 'secret-E');
await tardif.waitForTimeout(500);
verif(base.has('households/foyer/favorites/REC-000077_E'), 'favori local migré vers le nuage à la première connexion');

// 6. PIN
await marie.goto(serveur.url + '/#/profil');
await marie.click('text=Définir un code');
const codes = marie.locator('input[inputmode=numeric]');
await codes.nth(0).fill('4821'); await codes.nth(1).fill('4821');
await marie.click('.puce:text-is("Enregistrer")');
await marie.waitForSelector('text=Un code est défini');
const stocke = await marie.evaluate(() => localStorage.getItem('nutricoach.pin'));
verif(stocke && !stocke.includes('4821') && stocke.includes('150000'), 'PIN stocké dérivé (PBKDF2), jamais en clair');
await marie.reload();
await marie.waitForSelector('form.verrou');
verif(true, 'au rechargement : écran verrouillé');
await marie.fill('input.pin', '1111'); await marie.click('button[type=submit]');
await marie.waitForSelector('text=Code incorrect');
verif(true, 'mauvais code refusé');
await marie.fill('input.pin', '4821'); await marie.click('button[type=submit]');
await marie.waitForSelector('h1:has-text("Profil de Marie")');
verif(true, 'bon code : appli déverrouillée');
if (captures) await marie.screenshot({ path: `${captures}/profil-pin.png` });

// 7. Déconnexion
await marie.goto(serveur.url + '/#/profil');
await marie.click('text=Se déconnecter');
await marie.waitForSelector('form.connexion');
verif(true, 'déconnexion : retour à l\'écran de connexion');

for (const p of [eymric, marie, tardif]) verif(p.erreurs.length === 0, `aucune erreur console (${p.nom}) ${p.erreurs.join(' | ')}`);
await navigateur.close();
serveur.fermer();
process.exit(echecs ? 1 : 0);
