import test from 'node:test';
import assert from 'node:assert/strict';
import { requetePhoto, construireRequete, lirePhoto, FOURNISSEURS, messageErreurPhotos } from '../js/core/photos.js';

test('requête : mots utiles du titre, dessert ou plat', () => {
  assert.equal(requetePhoto({ titre: 'Poulet rôti au thym et aux gousses d\'ail', categorie: 'Plats' }), 'Poulet rôti thym gousses ail plat');
  assert.equal(requetePhoto({ titre: 'Tarte aux pommes maison', categorie: 'Desserts' }), 'Tarte pommes dessert');
  assert.ok(requetePhoto({ titre: 'Un très long titre de recette avec beaucoup de mots inutiles ici', categorie: 'Plats' }).split(' ').length <= 6);
});

test('Pexels et Unsplash : URL, clé en en-tête (jamais dans l\'URL)', () => {
  const p = construireRequete('pexels', 'poulet rôti plat', 'CLE-PEXELS');
  assert.match(p.url, /^https:\/\/api\.pexels\.com\/v1\/search\?query=poulet%20r%C3%B4ti%20plat&per_page=1/);
  assert.equal(p.entetes.Authorization, 'CLE-PEXELS'); assert.ok(!p.url.includes('CLE-PEXELS'));
  const u = construireRequete('unsplash', 'tarte', 'CLE-UNS');
  assert.match(u.url, /^https:\/\/api\.unsplash\.com\/search\/photos/);
  assert.equal(u.entetes.Authorization, 'Client-ID CLE-UNS'); assert.ok(!u.url.includes('CLE-UNS'));
});

test('lecture des réponses : photo et crédit du photographe', () => {
  const px = lirePhoto('pexels', { photos: [{ src: { large: 'https://images.pexels.com/a.jpg' }, photographer: 'Anna Dupont', photographer_url: 'https://www.pexels.com/@anna' }] });
  assert.deepEqual([px.url, px.credit, px.fournisseur], ['https://images.pexels.com/a.jpg', 'Anna Dupont', 'Pexels']);
  const un = lirePhoto('unsplash', { results: [{ urls: { regular: 'https://images.unsplash.com/b' }, user: { name: 'Paul', links: { html: 'https://unsplash.com/@paul' } }, links: { download_location: 'https://api.unsplash.com/photos/x/download' } }] });
  assert.equal(un.credit, 'Paul'); assert.match(un.lien, /utm_source=nutricoach/); assert.ok(un.telechargement);
  assert.equal(lirePhoto('pexels', { photos: [] }), null);
  assert.equal(lirePhoto('unsplash', {}), null);
  assert.equal(lirePhoto('pexels', null), null);
  assert.deepEqual(Object.keys(FOURNISSEURS), ['pexels', 'unsplash']);
  assert.match(messageErreurPhotos(401), /clé/); assert.match(messageErreurPhotos(429), /Quota/);
});

import { normaliserReglagesPhotos, ordreFournisseurs } from '../js/core/photos.js';
test('deux clés : ordre d\'essai, ancien format repris, fournisseur sans clé ignoré', () => {
  assert.deepEqual(ordreFournisseurs(normaliserReglagesPhotos({ fournisseur: 'pexels', cles: { pexels: 'A', unsplash: 'B' } })), ['pexels', 'unsplash']);
  assert.deepEqual(ordreFournisseurs(normaliserReglagesPhotos({ fournisseur: 'unsplash', cles: { pexels: 'A', unsplash: 'B' } })), ['unsplash', 'pexels']);
  assert.deepEqual(ordreFournisseurs(normaliserReglagesPhotos({ fournisseur: 'unsplash', cles: { pexels: 'A' } })), ['pexels'], 'pas de clé Unsplash : on n\'essaie pas');
  assert.deepEqual(ordreFournisseurs(normaliserReglagesPhotos({})), []);
  assert.deepEqual(normaliserReglagesPhotos({ fournisseur: 'pexels', cle: 'ANCIENNE' }).cles, { pexels: 'ANCIENNE', unsplash: '' }, 'une seule clé enregistrée avec l\'ancienne version');
  assert.equal(normaliserReglagesPhotos({ fournisseur: 'inconnu' }).fournisseur, 'pexels');
});

import { quotaFournisseur, LIMITES, MINIATURES_PAR_HEURE } from '../js/core/photos.js';
test('quotas séparés par fournisseur : heure glissante, miniatures sous le plafond total', () => {
  const t = 1_000_000;
  assert.deepEqual(quotaFournisseur(null, t, 10), { autorise: true, etat: { debut: t, n: 0 } });
  assert.equal(quotaFournisseur({ debut: t, n: 9 }, t + 10, 10).autorise, true);
  assert.equal(quotaFournisseur({ debut: t, n: 10 }, t + 10, 10).autorise, false);
  const apres = quotaFournisseur({ debut: t, n: 10 }, t + 3_600_001, 10);
  assert.ok(apres.autorise && apres.etat.n === 0, 'une heure plus tard : compteur remis à zéro');
  for (const f of Object.values(LIMITES)) assert.ok(f.miniatures < f.total, 'une marge reste pour les fiches');
  assert.ok(LIMITES.pexels.total <= 200 && LIMITES.unsplash.total <= 50, 'sous les limites gratuites des fournisseurs');
  assert.equal(MINIATURES_PAR_HEURE, 180);
  assert.equal(normaliserReglagesPhotos({}).miniatures, true, 'miniatures activées par défaut');
  assert.equal(normaliserReglagesPhotos({ miniatures: false }).miniatures, false);
  assert.equal(lirePhoto('pexels', { photos: [{ src: { large: 'L', medium: 'M' } }] }).mini, 'M');
  assert.equal(lirePhoto('unsplash', { results: [{ urls: { regular: 'R', small: 'S' } }] }).mini, 'S');
});
