import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrerRecettes, FILTRES_VIDES, contientAllergene, nombreFiltres, basculer } from '../js/lib/recettes.js';
import { normaliser } from '../js/lib/texte.js';

const fabrique = (o) => ({
  id: 'REC-1', titre: 'Poulet', categorie: 'Plats', regimes: ['omnivore'], allergenes: [], temps: 30,
  difficulte: 'facile', saisons: ['toute_annee'], appareils: ['classique'], tags: [], ingredients: [], ...o,
});
const prep = (o) => { const r = fabrique(o); return { ...r, _titre: normaliser(r.titre), _autres: normaliser([...r.ingredients, ...r.tags].join(' | ')) }; };
const f = (o) => ({ ...FILTRES_VIDES, ...o });

test('recherche tolérante aux accents, aux majuscules et au pluriel', () => {
  const liste = [prep({ id: 'A', titre: 'Crème brûlée' }), prep({ id: 'B', titre: 'Gâteau', ingredients: ['œufs', 'farine'] })];
  assert.deepEqual(filtrerRecettes(liste, f({ q: 'CREME BRULEE' })).map((r) => r.id), ['A']);
  assert.deepEqual(filtrerRecettes(liste, f({ q: 'oeuf' })).map((r) => r.id), ['B']);
  assert.deepEqual(filtrerRecettes(liste, f({ q: 'œuf farine' })).map((r) => r.id), ['B']);
  assert.deepEqual(filtrerRecettes(liste, f({ q: 'zzz' })), []);
});

test('la recherche cherche aussi dans les ingrédients et les tags, titre en premier', () => {
  const liste = [prep({ id: 'A', titre: 'Salade', ingredients: ['poulet'] }), prep({ id: 'B', titre: 'Poulet rôti' }), prep({ id: 'C', titre: 'Soupe', tags: ['poulet'] })];
  assert.deepEqual(filtrerRecettes(liste, f({ q: 'poulet' })).map((r) => r.id), ['B', 'A', 'C']);
});

test('SÉCURITÉ : un allergène exclu écarte toute recette qui le contient', () => {
  const liste = [prep({ id: 'A', allergenes: ['lait', 'gluten'] }), prep({ id: 'B', allergenes: ['oeuf'] }), prep({ id: 'C', allergenes: [] }), prep({ id: 'D', allergenes: undefined })];
  assert.deepEqual(filtrerRecettes(liste, f({ allergenes: ['lait'] })).map((r) => r.id), ['B', 'C']);
  assert.deepEqual(filtrerRecettes(liste, f({ allergenes: ['lait', 'oeuf'] })).map((r) => r.id), ['C']);
  assert.equal(contientAllergene({ allergenes: 'lait' }, ['gluten']), true, 'liste illisible : on écarte');
  assert.equal(filtrerRecettes(liste, f()).length, 4, 'sans filtre, tout passe');
});

test('filtres cumulables', () => {
  const liste = [
    prep({ id: 'A', categorie: 'Plats', regimes: ['vegan', 'sans_gluten'], temps: 20, difficulte: 'facile', saisons: ['ete'], appareils: ['four'] }),
    prep({ id: 'B', categorie: 'Desserts', regimes: ['vegan'], temps: 50, difficulte: 'moyen', saisons: ['toute_annee'], appareils: ['classique', 'thermomix'] }),
    prep({ id: 'C', categorie: 'Plats', regimes: ['omnivore'], temps: 90, difficulte: 'difficile', saisons: ['hiver'], appareils: ['four'] }),
  ];
  const ids = (o) => filtrerRecettes(liste, f(o)).map((r) => r.id);
  assert.deepEqual(ids({ categories: ['Plats'] }), ['A', 'C']);
  assert.deepEqual(ids({ categories: ['Plats', 'Desserts'] }), ['A', 'B', 'C']);
  assert.deepEqual(ids({ regimes: ['vegan', 'sans_gluten'] }), ['A']);
  assert.deepEqual(ids({ tempsMax: 45 }), ['A']);
  assert.deepEqual(ids({ difficultes: ['facile', 'moyen'] }), ['A', 'B']);
  assert.deepEqual(ids({ saisons: ['ete'] }), ['A', 'B'], 'toute_annee convient à toutes les saisons');
  assert.deepEqual(ids({ appareils: ['thermomix'] }), ['B']);
  assert.deepEqual(ids({ categories: ['Plats'], appareils: ['four'], tempsMax: 30 }), ['A']);
  assert.deepEqual(ids({ favoris: true }), []);
  assert.deepEqual(filtrerRecettes(liste, f({ favoris: true }), new Set(['C'])).map((r) => r.id), ['C']);
});

test('nombreFiltres et basculer', () => {
  assert.equal(nombreFiltres(f({ regimes: ['vegan'], tempsMax: 30, favoris: true, q: 'abc' })), 3);
  assert.deepEqual(basculer(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(basculer(['a', 'b'], 'a'), ['b']);
});
