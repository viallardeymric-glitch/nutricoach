// Service worker NutriCoach : l'appli fonctionne hors ligne une fois visitée.
// Changer VERSION à chaque modification des fichiers de l'appli.
const VERSION = 'v1';
const COQUILLE = `nutricoach-coquille-${VERSION}`;
const DONNEES = `nutricoach-donnees-${VERSION}`;
const LIB = 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
const FICHIERS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'data/index.json', LIB,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(COQUILLE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => ![COQUILLE, DONNEES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const memeOrigine = url.origin === location.origin;
  if (!memeOrigine && req.url !== LIB) return;

  // Catalogue complet (5 Mo) : mis en cache à la première ouverture d'une fiche.
  const cible = url.pathname.endsWith('/data/recettes.json') ? DONNEES : COQUILLE;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(cible).then((c) => c.put(req, copie)); }
        return rep;
      }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    }));
});
