import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliserRecette, ingredientDepuisTexte, ingredientVersTexte, prochainId, lireFichierRecettes, modeleFichier, exporterRecettes, estRecettePerso, allergenesDetectes } from '../js/lib/recette-perso.js';
import { recetteVersDoc, docsVersRecettes, idDocRecette } from '../js/core/synchro.js';
import { entreeIndex } from '../js/lib/index-entree.js';
import { noterRecette } from '../js/lib/sante.js';

const base = { titre: 'Crêpes', ingredients: ['250 g de farine', '3 oeufs', '50 cl de lait', '1 pincée de sel'], etapes: ['Mélanger.', 'Cuire.'] };

test('ingrédients : quantités, unités, fractions, virgules décimales, précision', () => {
  assert.deepEqual(ingredientDepuisTexte('200 g de farine, tamisée'), { section: 'Ingrédients', quantite: 200, unite: 'g', aliment: 'farine', precision: 'tamisée' });
  assert.equal(ingredientDepuisTexte('1,5 l de lait').quantite, 1.5);
  assert.equal(ingredientDepuisTexte('1/2 c. à café de sel').quantite, 0.5);
  assert.equal(ingredientDepuisTexte('2 gousses d\'ail').unite, 'gousse');
  assert.equal(ingredientDepuisTexte('sel').quantite, 1);
  assert.equal(ingredientDepuisTexte('   '), null);
  assert.equal(ingredientVersTexte(ingredientDepuisTexte('200 g de farine, tamisée')), '200 g farine, tamisée');
});
test('recette : normalisée au schéma, allergènes détectés automatiquement, régimes incohérents retirés', () => {
  const { recette, erreurs, avertissements } = normaliserRecette({ ...base, regimes_compatibles: ['sans_gluten', 'vegan', 'vegetarien'], allergenes: [] });
  assert.deepEqual(erreurs, []);
  assert.deepEqual(recette.allergenes.sort(), ['gluten', 'lait', 'oeuf']);
  assert.ok(!recette.regimes_compatibles.includes('sans_gluten') && !recette.regimes_compatibles.includes('vegan') && recette.regimes_compatibles.includes('vegetarien'));
  assert.ok(avertissements.some((a) => /Allergènes ajoutés/.test(a)) && avertissements.some((a) => /Nutrition non renseignée/.test(a)));
  assert.equal(recette.temps.total_min, 15);
  assert.equal(recette.etapes[1].numero, 2);
  assert.equal(recette.origine, 'perso');
  assert.ok(recette.tags.includes('perso'));
  assert.equal(noterRecette(recette), null, 'sans nutrition : pas de score santé');
});
test('recette : erreurs claires', () => {
  assert.match(normaliserRecette({}).erreurs.join(' '), /titre/);
  assert.match(normaliserRecette({ titre: 'x1', ingredients: [], etapes: ['a'] }).erreurs.join(' '), /ingrédient/);
  assert.match(normaliserRecette({ titre: 'x1', ingredients: ['1 oeuf'], etapes: [] }).erreurs.join(' '), /étape/);
  assert.match(normaliserRecette({ titre: 'x1', ingredients: [{ aliment: 'sel', quantite: -2 }], etapes: ['a'] }).erreurs.join(' '), /quantité/);
  assert.equal(normaliserRecette(null).recette, null);
});
test('recette : avertissements de profil d\'après les ingrédients (saumon fumé → femme enceinte)', () => {
  const { recette } = normaliserRecette({ titre: 'Toast saumon', ingredients: ['4 tranches de saumon fumé', '2 tranches de pain'], etapes: ['Assembler.'] });
  assert.ok(recette.deconseille_a.some((d) => d.profil === 'femme_enceinte'));
  assert.ok(recette.allergenes.includes('poisson') && recette.allergenes.includes('gluten'));
});
test('le filtre d\'allergènes exclut une recette perso qui en contient (même non déclaré)', () => {
  const { recette } = normaliserRecette({ ...base, allergenes: [] });
  const e = entreeIndex({ ...recette, id: 'REC-900001' });
  assert.ok(e.allergenes.includes('lait') && e.allergenes.includes('gluten'));
  assert.equal(e.kcal, 0);
});
test('identifiants : REC-900001 puis suivants, jamais ceux du catalogue', () => {
  assert.equal(prochainId([]), 'REC-900001');
  assert.equal(prochainId(['REC-000010', 'REC-900001', 'REC-900007']), 'REC-900008');
  assert.ok(estRecettePerso('REC-900001') && !estRecettePerso('REC-000001') && !estRecettePerso('REC-1'));
});
test('fichier modèle : importable tel quel, round-trip export → import, doublons et erreurs signalés', () => {
  const m = lireFichierRecettes(JSON.stringify(modeleFichier()));
  assert.equal(m.erreurs.length, 0);
  assert.equal(m.recettes.length, 1);
  const exp = exporterRecettes([{ ...m.recettes[0].recette, id: 'REC-900001', perso: true }]);
  assert.ok(!('id' in exp.recettes[0]) && !('perso' in exp.recettes[0]));
  const re = lireFichierRecettes(JSON.stringify(exp));
  assert.equal(re.recettes[0].recette.titre, m.recettes[0].recette.titre);
  const dbl = lireFichierRecettes(JSON.stringify(exp), [m.recettes[0].recette.titre]);
  assert.equal(dbl.recettes.length, 0); assert.match(dbl.erreurs[0], /existe déjà/);
  assert.match(lireFichierRecettes('pas du json').erreurs[0], /JSON/);
  assert.match(lireFichierRecettes('[]').erreurs[0], /Aucune recette/);
  const mix = lireFichierRecettes(JSON.stringify([base, { titre: 'Sans étape', ingredients: ['1 oeuf'] }, { ...base, titre: 'Autre' }]));
  assert.equal(mix.recettes.length, 2); assert.equal(mix.erreurs.length, 1);
  assert.ok(lireFichierRecettes(JSON.stringify(base)).recettes.length === 1, 'une recette seule est acceptée');
});
test('synchro : document notes/recette-… valide et re-validé à la lecture', () => {
  const { recette } = normaliserRecette(base);
  const doc = recetteVersDoc({ ...recette, id: 'REC-900003' });
  assert.equal(idDocRecette('REC-900003'), 'recette-REC-900003');
  assert.ok(Object.values(doc).every((v) => v !== undefined));
  const l = docsVersRecettes([{ ...doc, id: 'REC-900003' }, { ...doc, id: 'REC-000001' }, { ...doc, id: 'REC-900004', titre: '' }, { kind: 'photo' }, { ...doc, id: 'REC-900005', allergenes: [], ingredients: [{ aliment: 'beurre', quantite: 10, unite: 'g' }] }]);
  assert.deepEqual(l.map((r) => r.id), ['REC-900003', 'REC-900005']);
  assert.ok(l[1].allergenes.includes('lait'), 'les allergènes sont recalculés, pas crus sur parole');
});
test('le modèle ne dépend pas du catalogue : data/recettes.json n\'est pas modifié', () => {
  const r = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
  assert.equal(r.length, 1610); assert.equal(r[0].id, 'REC-000001'); assert.equal(r[1609].id, 'REC-001610');
});

import { categorieDepuis } from '../js/lib/recette-perso.js';
test('catégorie : textes libres de l\'IA ramenés aux catégories du catalogue', () => {
  for (const [t, c] of [['Plat principal', 'Plats'], ['plats', 'Plats'], ['Dessert', 'Desserts'], ['desserts', 'Desserts'], ['Entrée', 'Entrées'], ['entrees', 'Entrées'], ['Goûter', 'Goûters'], ['Petit-déjeuner', 'Goûters'], ['Apéritif', 'Apéros'], ['Apéro', 'Apéros'], ['', 'Plats'], [undefined, 'Plats'], ['n\'importe quoi', 'Plats']]) assert.equal(categorieDepuis(t), c, String(t));
  assert.equal(normaliserRecette({ ...base, categorie: 'Dessert' }).recette.categorie, 'Desserts');
  assert.equal(normaliserRecette({ ...base, categorie: 'Desserts' }).recette.categorie, 'Desserts');
  assert.equal(normaliserRecette({ ...base, categorie: 'Apéritif dînatoire' }).recette.categorie, 'Apéros');
});

test('régimes d\'une recette ajoutée : jamais déduits d\'après les mots, mais les affirmations contredites par les ingrédients sont retirées', () => {
  const n = (ingredients, regimes) => normaliserRecette({ titre: 'x1', etapes: ['a'], ingredients, regimes_compatibles: regimes }).recette.regimes_compatibles;
  assert.deepEqual(n(['200 g de riz', '2 courgettes'], []), ['omnivore'], 'rien n\'est déduit');
  assert.ok(!n(['300 g de lardons', '200 g de riz'], ['vegetarien', 'sans_porc', 'halal', 'pescetarien']).some((r) => ['vegetarien', 'sans_porc', 'halal', 'pescetarien'].includes(r)));
  assert.ok(!n(['2 filets de poulet'], ['vegan', 'vegetarien']).includes('vegetarien'));
  assert.ok(!n(['1 verre de vin blanc', '200 g de riz'], ['halal']).includes('halal'));
  assert.ok(n(['200 g de riz', '2 courgettes'], ['vegetarien', 'vegan']).includes('vegan'), 'déclaré et cohérent : gardé');
});
