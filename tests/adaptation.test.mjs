import test from 'node:test';
import assert from 'node:assert/strict';
import { arrondirQuantite, formaterNombre, ligneIngredient, pluraliserAliment, conseilsAdaptation } from '../js/lib/adaptation.js';

const ing = (quantite, unite, aliment, precision = '') => ({ quantite, unite, aliment, precision });

test('facteur 1 : la quantité d\'origine est conservée sans arrondi', () => {
  assert.deepEqual(ligneIngredient(ing(175, 'g', 'farine')), { quantite: '175 g', aliment: 'de farine', precision: '' });
  assert.equal(ligneIngredient(ing(2, 'c. à soupe', 'huile d\'olive')).aliment, "d'huile d'olive");
});

test('pas de 0,333 : arrondis lisibles', () => {
  assert.equal(ligneIngredient(ing(100, 'g', 'sucre'), 1 / 3).quantite, '35 g');
  assert.equal(ligneIngredient(ing(1, 'c. à soupe', 'miel'), 1 / 3).quantite, '¼ c. à soupe');
  assert.equal(ligneIngredient(ing(1, 'pièce', 'oignon'), 1 / 3).quantite, '½');
  assert.equal(ligneIngredient(ing(250, 'g', 'farine'), 1 / 3).quantite, '85 g');
  for (const q of [0.3333, 7.777, 123.456]) for (const u of ['g', 'ml', 'cl', 'pièce', 'c. à café']) {
    const t = ligneIngredient(ing(q, u, 'x'), 1.7).quantite;
    assert.ok(!/\d,\d{3}/.test(t), `${q} ${u} → ${t}`);
  }
});

test('changements d\'unité : g → kg, ml → l, cl → l', () => {
  assert.equal(ligneIngredient(ing(500, 'g', 'pâtes'), 3).quantite, '1,5 kg');
  assert.equal(ligneIngredient(ing(400, 'ml', 'lait'), 3).quantite, '1,2 l');
  assert.equal(ligneIngredient(ing(25, 'cl', 'crème'), 4).quantite, '1 l');
});

test('minimums : jamais de quantité nulle', () => {
  for (const u of ['g', 'kg', 'ml', 'cl', 'l', 'c. à café', 'c. à soupe', 'pincée', 'pièce', 'gousse']) {
    assert.ok(arrondirQuantite(0.01, u).q > 0, u);
  }
  assert.equal(arrondirQuantite(0.2, 'pincée').q, 1);
});

test('pluriels', () => {
  assert.equal(ligneIngredient(ing(1, 'gousse', 'ail'), 4).quantite, '4 gousses');
  assert.equal(ligneIngredient(ing(1, 'gousse', 'ail'), 1.5).quantite, '1 ½ gousse');
  assert.equal(ligneIngredient(ing(2, 'pièce', 'poivron rouge'), 2).aliment, 'poivrons rouges');
  assert.equal(pluraliserAliment("jaune d'œuf"), "jaunes d'œuf");
  assert.equal(pluraliserAliment('noix de Saint-Jacques'), 'noix de Saint-Jacques');
  assert.equal(ligneIngredient(ing(2, 'pièce', 'œuf'), 1).aliment, 'œufs');
});

test('formaterNombre', () => {
  assert.equal(formaterNombre(2.5), '2,5');
  assert.equal(formaterNombre(2.5, true), '2 ½');
  assert.equal(formaterNombre(0.30000000000000004), '0,3');
});

test('conseils d\'adaptation : seulement si le nombre de personnes change', () => {
  const r = { portions_base: 4, ustensiles: ['moule à gâteau', 'bol'], temps: { cuisson_min: 30 } };
  assert.deepEqual(conseilsAdaptation(r, 4), []);
  assert.equal(conseilsAdaptation(r, 8).length, 2);
  assert.equal(conseilsAdaptation(r, 5).length, 1);
  assert.equal(conseilsAdaptation({ ...r, ustensiles: ['bol'], temps: { cuisson_min: 0 } }, 12).length, 0);
});
