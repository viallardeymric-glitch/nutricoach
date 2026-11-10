// Service worker NutriCoach : l'appli, l'index et les recettes consultées fonctionnent hors ligne.
// Pour publier une mise à jour : changer VERSION ici ET les ?v=N de index.html (scripts/verifier.mjs le contrôle).
const VERSION = '28';
const CACHE = `nutricoach-${VERSION}`;
const DONNEES = 'nutricoach-donnees'; // recettes : conservées d'une version à l'autre
const FICHIERS = [
  './', 'index.html', 'manifest.webmanifest', '.nojekyll',
  'css/app.css',
  'js/main.js',
  'js/core/camera.js', 'js/core/catalogue.js', 'js/core/coach.js', 'js/core/collection.js', 'js/core/config.js', 'js/core/favoris.js', 'js/core/glisser.js', 'js/core/image.js', 'js/core/firebase-config.js', 'js/core/nuage.js', 'js/core/off.js', 'js/core/pin.js',
  'js/core/profil.js', 'js/core/session.js', 'js/core/stockage.js', 'js/core/synchro.js',
  'js/data/additifs.js', 'js/data/deconseilles.js', 'js/data/grossesse.js', 'js/data/libelles.js', 'js/data/pictogrammes.js', 'js/data/rayons.js', 'js/data/sources.js',
  'js/lib/adaptation.js', 'js/lib/alertes.js', 'js/lib/besoins.js', 'js/lib/courses.js', 'js/lib/cuisine.js', 'js/lib/planning.js', 'js/lib/profils.js', 'js/lib/recettes.js', 'js/lib/recette-perso.js', 'js/lib/sante.js', 'js/lib/sauvegarde.js', 'js/lib/scan.js',
  'js/lib/texte-riche.js', 'js/lib/texte.js',
  'js/ui/composants.js',
  'js/views/accueil.js', 'js/views/coach.js', 'js/views/connexion.js', 'js/views/courses.js', 'js/views/cuisine.js', 'js/views/fiche.js', 'js/views/liste.js',
  'js/views/nous-deux.js', 'js/views/plus.js', 'js/views/profil.js', 'js/views/scanner.js', 'js/views/semaine.js', 'js/views/verrou.js',
  'vendor/preact-htm.js', 'vendor/firebase.js', 'vendor/zxing.js', 'vendor/LISEZMOI.txt',
  'js/data/regimes.js',
  'js/lib/index-entree.js',
  'js/lib/suivi.js',
  'js/views/suivi.js',
  'js/lib/sport.js',
  'js/views/sport.js',
  'js/lib/batch.js',
  'js/views/batch.js',
  'js/core/appareils.js',
  'js/lib/frigo.js',
  'js/lib/budget.js',
  'js/views/frigo.js', 'js/views/grossesse.js', 'js/views/mes-recettes.js',
  'js/core/reecriture.js',
  'js/data/substitutions.js',
  'js/lib/methodes.js',
  'js/lib/substitutions.js',
  'js/lib/thermomix.js',
  'js/lib/activite.js',
  'js/core/biometrie.js',
  'js/core/photos.js', 'js/core/pieces.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'data/index.json',
];
const DELAI_RESEAU_MS = 4000; // au-delà, on sert la copie locale (réseau très lent)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.filter((f) => f !== '.nojekyll'))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE && k !== DONNEES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

const enCache = (req) => caches.match(req, { ignoreSearch: true });

async function reseau(req, nomCache) {
  const rep = await fetch(req, { cache: 'no-cache' }); // revalide auprès du serveur (304 si inchangé)
  if (rep.ok) { const copie = rep.clone(); caches.open(nomCache).then((c) => c.put(req, copie)); }
  return rep;
}

// Code de l'appli : le réseau d'abord (mises à jour à la prochaine ouverture), sinon la copie locale.
async function reseauPuisCache(req) {
  const copie = await enCache(req);
  try {
    const attente = new Promise((_, refus) => setTimeout(() => refus(new Error('lent')), DELAI_RESEAU_MS));
    return await (copie ? Promise.race([reseau(req, CACHE), attente]) : reseau(req, CACHE));
  } catch (err) {
    return copie || (req.mode === 'navigate' ? enCache('index.html') : Response.error());
  }
}

// Données (index, recettes) : copie locale tout de suite, mise à jour discrète en arrière-plan.
async function cachePuisReseau(req, evt) {
  const copie = await enCache(req);
  const maj = reseau(req, DONNEES).catch(() => null);
  if (copie) { evt.waitUntil(maj); return copie; }
  return (await maj) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\/data\/[^/]+\.json$/.test(url.pathname)) e.respondWith(cachePuisReseau(req, e));
  else if (/\/(vendor|icons)\//.test(url.pathname)) e.respondWith(enCache(req).then((c) => c || reseau(req, CACHE)));
  else e.respondWith(reseauPuisCache(req));
});
