import test from 'node:test';
import assert from 'node:assert/strict';
import { alertesProfil, conflitsProfil, filtresDuProfil, listeExclusions, profilVide } from '../js/lib/profils.js';
import { filtrerRecettes, FILTRES_VIDES } from '../js/lib/recettes.js';
import { normaliser } from '../js/lib/texte.js';

const marie = { ...profilVide('M'), sexe: 'femme', age: 34, poids_kg: 62, taille_cm: 168, grossesse: 2, allergenes: ['lait'], regimes: ['vegetarien'], exclusions: 'Coriandre, olives' };
const recette = (o) => ({
  id: 'R', titre: 'Tarte', allergenes: [], regimes_compatibles: ['vegetarien'], deconseille_a: [],
  ingredients: [{ aliment: 'farine' }, { aliment: 'olives noires' }], ...o,
});

test('aliments à éviter : sans accents, sans pluriel', () => {
  assert.deepEqual(listeExclusions('Coriandre, olives ; Œufs\n  '), ['coriandre', 'olive', 'oeuf']);
  assert.deepEqual(listeExclusions(''), []);
});

test('le profil impose régimes, allergènes et exclusions ; désactivable', () => {
  assert.deepEqual(filtresDuProfil(marie), { regimes: ['vegetarien'], allergenes: ['lait'], exclusions: ['coriandre', 'olive'] });
  assert.deepEqual(filtresDuProfil({ ...marie, appliquer: false }), { regimes: [], allergenes: [], exclusions: [] });
  assert.deepEqual(filtresDuProfil(null), { regimes: [], allergenes: [], exclusions: [] });
});

test('alertes : seulement les avertissements qui concernent le profil', () => {
  const r = recette({ deconseille_a: [{ profil: 'femme_enceinte', raison: 'Alcool.' }, { profil: 'enfant', raison: 'Alcool.' }] });
  assert.deepEqual(alertesProfil(r, marie), [{ profil: 'femme_enceinte', raison: 'Alcool.' }]);
  assert.deepEqual(alertesProfil(r, { ...marie, grossesse: 0 }), [], 'pas enceinte : pas d\'alerte grossesse');
  assert.deepEqual(alertesProfil(r, { ...marie, sexe: 'homme' }), []);
});

test('conflits : allergène, régime, aliment à éviter', () => {
  const c = conflitsProfil(recette({ allergenes: ['lait'], regimes_compatibles: ['omnivore'] }), marie);
  assert.deepEqual(c.allergenes, ['lait']);
  assert.deepEqual(c.regimes, ['vegetarien']);
  assert.deepEqual(c.exclusions, ['olive']);
  const ok = conflitsProfil(recette({ ingredients: [{ aliment: 'farine' }] }), marie);
  assert.deepEqual([ok.allergenes, ok.regimes, ok.exclusions, ok.alertes], [[], [], [], []]);
  const off = conflitsProfil(recette({ allergenes: ['lait'] }), { ...marie, appliquer: false });
  assert.deepEqual(off.allergenes, [], 'profil non appliqué : aucun conflit signalé');
});

test('SÉCURITÉ : la liste exclut aussi les allergènes et aliments du profil', () => {
  const fab = (id, o) => { const r = { id, titre: id, categorie: 'Plats', regimes: ['vegetarien'], allergenes: [], temps: 10, difficulte: 'facile', saisons: [], appareils: [], tags: [], ingredients: [], ...o }; return { ...r, _titre: normaliser(r.titre), _autres: '', _ingr: normaliser(r.ingredients.join(' | ')) }; };
  const liste = [fab('A', { allergenes: ['lait'] }), fab('B', { ingredients: ['olives vertes'] }), fab('C', { regimes: ['omnivore'] }), fab('D', { ingredients: ['pâtes'] })];
  const fp = filtresDuProfil(marie);
  const ids = filtrerRecettes(liste, { ...FILTRES_VIDES, ...fp }).map((r) => r.id);
  assert.deepEqual(ids, ['D']);
});
