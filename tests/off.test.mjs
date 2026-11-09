import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerProduitOFF, chercherAlternatives } from '../js/core/off.js';

const reponse = (corps, statut = 200) => async () => ({ ok: statut < 400, status: statut, json: async () => corps });
const produit = (code, nom, kcal, sucres, extra = {}) => ({ code, product_name: nom, nova_group: 3, nutriments: { 'energy-kcal_100g': kcal, 'saturated-fat_100g': 1, sugars_100g: sucres, salt_100g: 0.1, fiber_100g: 2, proteins_100g: 3 }, ...extra });

test('produit trouvé, absent (404 ou status 0), réseau coupé', async () => {
  const p = await chargerProduitOFF('3017620422003', { appeler: reponse({ status: 1, product: produit('3017620422003', 'Pâte', 500, 50) }) });
  assert.equal(p.nom, 'Pâte');
  assert.equal(await chargerProduitOFF('1', { appeler: reponse({}, 404) }), null);
  assert.equal(await chargerProduitOFF('1', { appeler: reponse({ status: 0, status_verbose: 'product not found' }) }), null);
  await assert.rejects(chargerProduitOFF('1', { appeler: async () => { throw new TypeError('Failed to fetch'); } }), /joindre Open Food Facts/);
  await assert.rejects(chargerProduitOFF('1', { appeler: reponse({}, 500) }), /joindre Open Food Facts/);
});

test('l\'URL ne contient que le code-barres (aucune donnée personnelle)', async () => {
  let url;
  await chargerProduitOFF('3017620422003', { appeler: async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ status: 0 }) }; } });
  assert.match(url, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\.json\?fields=/);
});

test('alternatives : meilleures notes seulement, hors produit lui-même', async () => {
  const courant = { code: '1', nom: 'Céréales sucrées', categories: ['breakfast-cereals'], additifs: [], nova: 4,
    nutrition: { kcal: 400, sucres: 35, satures: 3, sel: 0.8, fibres: 2, proteines: 6 } };
  const liste = { products: [produit('1', 'Céréales sucrées', 400, 35), produit('2', 'Flocons nature', 360, 1, { nova_group: 1 }), produit('3', 'Céréales miel', 390, 30, { nova_group: 4 }), produit('4', 'Muesli', 370, 12, { nova_group: 3 }), { code: '5', nutriments: {} }] };
  const a = await chercherAlternatives(courant, { appeler: reponse(liste) });
  assert.ok(a.length >= 1 && a.every((x) => x.produit.code !== '1' && x.note >= 10));
  assert.equal(a[0].produit.nom, 'Flocons nature');
  assert.deepEqual(await chercherAlternatives({ ...courant, categories: [] }, { appeler: reponse(liste) }), []);
});
