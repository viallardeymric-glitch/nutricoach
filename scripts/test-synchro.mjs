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
  await ctx.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, product: {
    product_name: 'Yaourt nature', brands: 'Laiterie Test', allergens_tags: ['en:milk'], categories_tags: ['en:dairies', 'en:yogurts'], nova_group: 3, nutriscore_grade: 'a',
    nutriments: { 'energy-kcal_100g': 55, 'saturated-fat_100g': 1.2, sugars_100g: 4.5, salt_100g: 0.1, proteins_100g: 4, fiber_100g: 0 } } }) }));
  await ctx.route('https://images.pexels.com/**', (r) => r.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64') }));
  await ctx.route('https://api.pexels.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ photos: [{ src: { large: 'https://images.pexels.com/test.gif' }, photographer: 'Anna Dupont', photographer_url: 'https://www.pexels.com/@anna' }] }) }));
  await ctx.exposeBinding('fsCall', async ({ page }, op, a, b) => {
    if (op === 'auth') return COMPTES[a] === b;
    if (op === 'set') { base.set(a, b); await notifier(a.split('/').slice(0, -1).join('/')); return null; }
    if (op === 'delete') { base.delete(a); await notifier(a.split('/').slice(0, -1).join('/')); return null; }
    if (op === 'listen') { ecoutes.push({ page, coll: a }); return enfants(a); }
    return null;
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1,3).join(' ; ')));
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
  await p.waitForSelector('.entete.grand');
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
await eymric.waitForSelector('.entete.grand');
verif(true, 'bon mot de passe : choix « Je suis Eymric » puis liste');
await seConnecter(marie, 'marie@test.fr', 'secret-M', 'Marie');

// 2. Favori d'Eymric -> visible chez Marie en direct, avec la pastille E
await eymric.goto(serveur.url + '/#/recettes'); await eymric.waitForSelector('.carte');
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
await marie.goto(serveur.url + '/#/profil/infos'); await marie.waitForSelector('input[type=date]');
await marie.click('.puce:text-is("Femme")');
await marie.fill('input[type=date]', '1991-05-14');
const champs = marie.locator('.grille input');
await champs.nth(0).fill('62'); await champs.nth(1).fill('168');
await marie.goto(serveur.url + '/#/profil/situation');
await marie.click('.puce:text-is("2e trimestre")');
await marie.goto(serveur.url + '/#/profil/regimes'); await marie.waitForSelector('.puce.exclu');
await marie.click('.puce.exclu:text-is("Lait")');
await marie.waitForTimeout(1200);
const docMarie = base.get('households/foyer/profiles/M');
verif(docMarie && docMarie.grossesse === 2 && docMarie.naissance === '1991-05-14' && docMarie.allergenes.includes('lait') && !('intrus' in docMarie), 'profil de Marie écrit à households/foyer/profiles/M');
verif(Object.values(docMarie || {}).every((v) => v !== undefined) && Object.keys(docMarie).length <= 60, 'document profil valide pour les règles (≤ 60 champs)');
await eymric.goto(serveur.url + '/#/nous');
await eymric.waitForSelector('.carte-nous >> text=Enceinte', { timeout: 2000 }).then(
  () => verif(true, '« Nous deux » : Eymric voit la situation de Marie (enceinte) en direct'),
  () => verif(false, '« Nous deux » : profil de Marie'));
verif((await eymric.textContent('.contenu')).includes('kcal par jour'), '« Nous deux » : besoins de Marie affichés');
if (captures) await eymric.screenshot({ path: `${captures}/nous.png` });

// 4 bis. Menu de la semaine partagé : généré chez Eymric, il tient compte du profil de Marie (sans lait, enceinte)
await eymric.goto(serveur.url + '/#/semaine'); await eymric.waitForSelector('.actions-semaine');
await eymric.waitForSelector('text=sans lait', { timeout: 2000 }).then(
  () => verif(true, 'semaine : les contraintes de Marie (sans lait) sont prises en compte chez Eymric'),
  () => verif(false, 'semaine : contraintes de Marie'));
await eymric.click('text=Générer ma semaine'); await eymric.waitForSelector('.jour .mini');
const docsPlan = [...base.keys()].filter((k) => k.startsWith('households/foyer/planning/'));
verif(docsPlan.length === 7 && docsPlan.every((k) => /planning\/\d{4}-\d{2}-\d{2}$/.test(k)), `menu écrit dans households/foyer/planning/AAAA-MM-JJ (${docsPlan.length} jours)`);
const complet = new Map(JSON.parse((await import('node:fs')).readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8')).map((r) => [r.id, r]));
const idsPlan = docsPlan.flatMap((k) => [base.get(k).dejeuner, base.get(k).diner]).filter(Boolean);
verif(idsPlan.length === 14 && idsPlan.every((id) => !complet.get(id).allergenes.includes('lait') && !complet.get(id).deconseille_a.some((d) => d.profil === 'femme_enceinte')),
  'SÉCURITÉ : aucun repas avec lait ni déconseillé à une femme enceinte (profil de Marie)');
await marie.goto(serveur.url + '/#/semaine');
await marie.waitForSelector('.jour .mini', { timeout: 2000 }).then(
  () => verif(true, 'Marie voit le menu d\'Eymric en moins de 2 s'), () => verif(false, 'Marie voit le menu'));
verif(await marie.locator('.jour .mini').count() === 14, 'Marie : les 14 repas du même menu');
await marie.click('.jour .repas-jour >> nth=0 >> [aria-label^="Retirer"]');
await eymric.waitForFunction(() => document.querySelectorAll('.jour .mini').length === 13, null, { timeout: 2000 }).then(
  () => verif(true, 'Marie retire un repas : disparu chez Eymric'), () => verif(false, 'retrait de repas synchronisé'));

// 4 ter. Courses partagées : un document par article, cochage en direct, pastilles E / M
await eymric.goto(serveur.url + '/#/courses'); await eymric.waitForSelector('.page-courses');
await eymric.fill('input[aria-label="Ajouter un article"]', '6 oeufs'); await eymric.press('input[aria-label="Ajouter un article"]', 'Enter');
await eymric.fill('input[aria-label="Ajouter un article"]', '1 l de lait'); await eymric.press('input[aria-label="Ajouter un article"]', 'Enter');
const docsArticles = [...base.keys()].filter((k) => k.startsWith('households/foyer/shoppingLists/semaine__'));
verif(docsArticles.length === 2, `un document par article : ${docsArticles.map((k) => k.split('/').pop()).join(', ')}`);
verif(docsArticles.every((k) => Object.values(base.get(k)).every((v) => v !== undefined) && Object.keys(base.get(k)).length <= 60 && base.get(k).par === 'E'), 'documents d\'articles valides, ajoutés par E');
await marie.goto(serveur.url + '/#/courses'); await marie.waitForSelector('.article', { timeout: 2000 }).then(
  () => verif(true, 'Marie voit les articles d\'Eymric en moins de 2 s'), () => verif(false, 'Marie voit les articles'));
verif(await marie.locator('.article', { hasText: 'Oeufs' }).locator('.article-qui .pastille.E').count() === 1, 'pastille E (ajouté par Eymric)');
verif(await marie.locator('.article', { hasText: 'Lait' }).locator('.alerte-article.rouge').count() === 1, 'alerte de profil sur la liste de Marie (allergie au lait)');
await marie.click('.article:has-text("Oeufs") .case-article');
await eymric.waitForSelector('.article.coche .article-qui .pastille.M', { timeout: 2000 }).then(
  () => verif(true, 'Marie coche : Eymric voit l\'article coché avec la pastille M en moins de 2 s'), () => verif(false, 'cochage synchronisé'));
// deux personnes ajoutent en même temps : aucun article perdu
await Promise.all([
  eymric.fill('input[aria-label="Ajouter un article"]', 'pain').then(() => eymric.press('input[aria-label="Ajouter un article"]', 'Enter')),
  marie.fill('input[aria-label="Ajouter un article"]', 'riz').then(() => marie.press('input[aria-label="Ajouter un article"]', 'Enter')),
]);
await eymric.waitForFunction(() => document.querySelectorAll('.article').length === 4, null, { timeout: 2500 }).then(
  () => verif(true, 'ajouts simultanés : les 4 articles sont là des deux côtés, sans perte'), () => verif(false, 'ajouts simultanés'));
// terminer les courses -> stock partagé
marie.once('dialog', (d) => d.accept());
await marie.click('text=Terminer les courses');
await marie.waitForSelector('text=Courses terminées');
verif([...base.keys()].some((k) => k.startsWith('households/foyer/pantry/')), 'stock écrit dans households/foyer/pantry/…');
await eymric.click('role=tab[name="📦 Stock"]');
await eymric.waitForSelector('.article:has-text("Oeufs")', { timeout: 2000 }).then(
  () => verif(true, 'le stock mis à jour par Marie apparaît chez Eymric'), () => verif(false, 'stock synchronisé'));

// 4 quater. Scans partagés
await eymric.goto(serveur.url + '/#/produit/3017620422003'); await eymric.waitForSelector('.produit .jauge');
verif(base.has('households/foyer/scans/3017620422003') && base.get('households/foyer/scans/3017620422003').par === 'E', 'scan écrit dans households/foyer/scans/{code-barres}');
await marie.goto(serveur.url + '/#/scans');
await marie.waitForSelector('.sans-marge-liste .carte', { timeout: 2000 }).then(
  () => verif(true, 'Marie voit le scan d\'Eymric en moins de 2 s'), () => verif(false, 'scan partagé'));
verif((await marie.textContent('.sans-marge-liste')).includes('Yaourt nature'), 'historique partagé : produit et auteur');
await marie.goto(serveur.url + '/#/produit/3017620422003'); await marie.waitForSelector('.produit .jauge');
verif((await marie.textContent('.bandeau.alerte')).includes('lait'), 'le même produit : alerte selon le profil de Marie (lait)');

// 4 quinquies. Suivi partagé : journal, hydratation, poids (et « privé »)
await eymric.goto(serveur.url + '/#/suivi'); await eymric.waitForSelector('.bilan-jour');
await eymric.locator('section.section:has(h2:text-is("☀️ Déjeuner")) .ajout').click();
await eymric.click('.ajout-repas .puce:text-is("Libre")');
await eymric.locator('.ajout-repas input[type=text]').first().fill('Soupe maison');
await eymric.getByLabel('kcal', { exact: true }).fill('200');
await eymric.click('.ajout-repas button[type=submit]');
await eymric.click('role=button[name="＋ Un verre (250 ml)"]');
const docsJ = [...base.keys()].filter((k) => k.startsWith('households/foyer/journal/'));
verif(docsJ.length === 2 && docsJ.some((k) => base.get(k).type === 'eau' && base.get(k).ml === 250) && docsJ.some((k) => base.get(k).nom === 'Soupe maison' && base.get(k).par === 'E'), 'journal et eau écrits dans households/foyer/journal/…');
await eymric.click('role=tab[name="Poids"]'); await eymric.getByLabel('Poids (kg)').fill('80,5'); await eymric.click('role=button[name="Enregistrer"]');
const docPoids = [...base.keys()].filter((k) => /households\/foyer\/weights\/\d{4}-\d{2}-\d{2}_E$/.test(k));
verif(docPoids.length === 1 && base.get(docPoids[0]).kg === 80.5, 'poids écrit dans households/foyer/weights/AAAA-MM-JJ_E');
await marie.goto(serveur.url + '/#/nous');
await marie.waitForSelector('.carte-nous >> text=200 kcal', { timeout: 2000 }).then(
  () => verif(true, '« Nous deux » : Marie voit le journal d\'Eymric (200 kcal) en moins de 2 s'), async () => { verif(false, 'journal partagé'); console.log('   DEBUG', (await marie.textContent('.contenu')).replace(/\s+/g, ' ').slice(0, 400)); });
verif((await marie.textContent('.contenu')).includes('80,5 kg'), '« Nous deux » : Marie voit le poids d\'Eymric (partagé par défaut)');
await eymric.getByLabel('Poids (kg)').fill('80,5');
await eymric.check('.case input'); await eymric.click('role=button[name="Enregistrer"]');
await marie.waitForFunction(() => !document.body.textContent.includes('80,5 kg'), null, { timeout: 2000 }).then(
  () => verif(true, 'option « privé » : le poids n\'apparaît plus chez Marie'), () => verif(false, 'poids privé masqué'));

// 4 septies. Photos partagées : trouvée par Eymric (avec une clé), affichée chez Marie (sans clé), sans nouvelle recherche
await eymric.evaluate(() => localStorage.setItem('nutricoach.photos.reglages', JSON.stringify({ fournisseur: 'pexels', cles: { pexels: 'CLE-EYMRIC' } })));
await eymric.reload(); await eymric.waitForSelector('.entete', { state: 'attached' }); await eymric.waitForTimeout(1200);
await eymric.goto(serveur.url + '/#/recette/REC-000001');
await eymric.waitForSelector('.fiche-photo', { timeout: 6000 }).catch(async () => { console.log('DEBUG', eymric.erreurs.join(' | '), await eymric.evaluate(() => [localStorage.getItem('nutricoach.photos'), localStorage.getItem('nutricoach.photos.reglages'), localStorage.getItem('nutricoach.photos.quota')].join(' ## ')), (await eymric.textContent('body')).replace(/\s+/g, ' ').slice(0, 300), eymric.url()); });
verif(base.has('households/foyer/notes/photo-REC-000001') && base.get('households/foyer/notes/photo-REC-000001').credit === 'Anna Dupont', 'photo écrite dans households/foyer/notes/photo-REC-000001 (partagée)');
let appelsMarie = 0;
await marie.context().route('https://api.pexels.com/**', async (r) => { appelsMarie++; await r.abort(); });
await marie.goto(serveur.url + '/#/recette/REC-000001'); await marie.reload(); await marie.waitForTimeout(1500);
await marie.waitForSelector('.fiche-photo', { timeout: 8000 }).then(
  () => verif(true, 'Marie (sans clé) voit la photo trouvée par Eymric sur la fiche'), () => verif(false, 'photo partagée chez Marie'));
verif(appelsMarie === 0, 'aucune recherche chez Marie : la photo vient du partage');

// 4 sexies. Fil d'activité : « Eymric a ajouté… » depuis la dernière visite de Marie
await marie.addInitScript(() => { const v = sessionStorage.getItem('test_dv'); if (v) localStorage.setItem('nutricoach.derniere_visite', v); });
await marie.evaluate((t) => sessionStorage.setItem('test_dv', String(t)), Date.now() - 3600000);
await marie.goto(serveur.url + '/#/'); await marie.reload();
await marie.waitForSelector('.bandeau:has-text("Depuis votre dernière visite")', { timeout: 5000 }).then(
  () => verif(true, 'fil d\'activité : carte « Depuis votre dernière visite » chez Marie'), () => verif(false, 'fil d\'activité'));
const fil = await marie.textContent('.bandeau:has-text("Depuis votre dernière visite")');
verif(fil.includes('Eymric') && /a ajouté \d+ articles? aux courses/.test(fil) && fil.includes('a scanné 1 produit') && /a noté 1 repas au journal/.test(fil), 'fil d\'activité : articles ajoutés, produit scanné, repas noté par Eymric');
verif(!fil.includes('Marie'), 'fil d\'activité : jamais mes propres actions');
await marie.click('text=Marquer comme vu');
verif(await marie.locator('.bandeau:has-text("Depuis votre dernière visite")').count() === 0, 'fil d\'activité : marqué comme vu');

// 5. Favoris déjà gardés en local avant la connexion : ils rejoignent le nuage
const tardif = await telephone('Tardif');
await tardif.goto(serveur.url + '/');
await tardif.evaluate(() => { localStorage.setItem('nutricoach.moi', '"E"'); localStorage.setItem('nutricoach.favoris', '["REC-000077"]'); });
await seConnecter(tardif, 'eymric@test.fr', 'secret-E');
await tardif.waitForTimeout(500);
verif(base.has('households/foyer/favorites/REC-000077_E'), 'favori local migré vers le nuage à la première connexion');

// 6. PIN
await marie.goto(serveur.url + '/#/profil/securite');
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
await marie.waitForSelector('h1:has-text("Code PIN")');
verif(true, 'bon code : appli déverrouillée');
if (captures) await marie.screenshot({ path: `${captures}/profil-pin.png` });

// 6 bis. Face ID / Touch ID (authentificateur WebAuthn virtuel)
const cdp = await marie.context().newCDPSession(marie);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
await marie.goto(serveur.url + '/#/profil/securite'); await marie.reload();
await marie.waitForSelector('form.verrou'); await marie.fill('input.pin', '4821'); await marie.click('button[type=submit]');
await marie.waitForSelector('text=Face ID / Touch ID');
await marie.click('role=button[name="Activer Face ID / Touch ID"]');
await marie.waitForSelector('text=Face ID / Touch ID activé');
verif(await marie.evaluate(() => Boolean(localStorage.getItem('nutricoach.biometrie'))), 'Face ID / Touch ID : clé enregistrée (WebAuthn, authentificateur de la plateforme)');
await marie.reload();
await marie.waitForSelector('h1:has-text("Code PIN")', { timeout: 6000 }).then(
  () => verif(true, 'Face ID / Touch ID : l\'appli se déverrouille sans saisir le code'), () => verif(false, 'déverrouillage biométrique'));
await marie.click('role=button[name="✓ Face ID / Touch ID activé"]');
await marie.waitForSelector('text=Activer Face ID / Touch ID');
verif(await marie.evaluate(() => !localStorage.getItem('nutricoach.biometrie')), 'Face ID / Touch ID : désactivable');

// 7. Déconnexion
await marie.goto(serveur.url + '/#/profil/compte');
await marie.click('text=Se déconnecter');
await marie.waitForSelector('form.connexion');
verif(true, 'déconnexion : retour à l\'écran de connexion');

for (const p of [eymric, marie, tardif]) verif(p.erreurs.length === 0, `aucune erreur console (${p.nom}) ${p.erreurs.join(' | ')}`);
await navigateur.close();
serveur.fermer();
process.exit(echecs ? 1 : 0);
