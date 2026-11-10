// Aide pour les scripts qui pilotent Chromium (Playwright doit être installé : npm i -g playwright).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

export function chargerPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* module global */ }
  const global = execSync('npm root -g').toString().trim();
  return createRequire(join(global, 'x.js'))('playwright');
}

/** Sert le dépôt sur un port libre. Retourne { url, fermer }. */
export async function servir() {
  const serveur = createServer(async (req, rep) => {
    let chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (chemin.endsWith('/')) chemin += 'index.html';
    try {
      const fichier = await readFile(join(racine, chemin));
      rep.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream' });
      rep.end(fichier);
    } catch { rep.writeHead(404); rep.end('introuvable'); }
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  return { url: `http://localhost:${serveur.address().port}`, fermer: () => serveur.close() };
}

/** Force le mode local (sans compte ni synchronisation) pour tester l'appli hors Firebase. */
export async function modeLocal(contexte) {
  await contexte.route('**/js/core/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript',
    body: "export const FIREBASE_CONFIG = null; export const FOYER = 'foyer';" }));
}
