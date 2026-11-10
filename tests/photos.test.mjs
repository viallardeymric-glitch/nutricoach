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
