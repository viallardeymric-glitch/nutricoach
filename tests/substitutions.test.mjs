import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contraintesDeProfil, substitutionsPour, appliquerSubstitutions, nutritionAdaptee } from '../js/lib/substitutions.js';
import { SUBSTITUTIONS } from '../js/data/substitutions.js';
import { MOTS_ALLERGENES } from '../js/data/deconseilles.js';
import { normaliser } from '../js/lib/texte.js';
import { profilVide, enfantVide } from '../js/lib/profils.js';

const toutes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const recette = (ings, o = {}) => ({ portions_base: 4, nutrition_par_portion: { calories_kcal: 500, proteines_g: 20, glucides_g: 50, lipides_g: 20 }, ingredients: ings.map(([aliment, quantite, unite]) => ({ aliment, quantite, unite, precision: '' })), ...o });
const C = (...x) => new Set(x);

test('contraintes d\'un profil adulte, d\'une femme enceinte, d\'un enfant', () => {
  const c = contraintesDeProfil({ ...profilVide('M'), allergenes: ['lait'], regimes: ['vegan'], grossesse: 2 });
  assert.deepEqual([...c].sort(), ['allergen:lait', 'regime:vegan', 'situation:grossesse']);
  assert.ok(contraintesDeProfil({ ...enfantVide('e'), prenom: 'Léa' }).has('regime:enfant'));
  assert.equal(contraintesDeProfil({ ...profilVide('M'), allergenes: ['lait'], appliquer: false }).size, 0);
  assert.equal(contraintesDeProfil(null).size, 0);
});

test('lait, beurre, crème : remplacés selon l\'allergie ; l\'option compatible est choisie', () => {
  const r = recette([['lait', 500, 'ml'], ['beurre doux', 50, 'g'], ['crème fraîche', 20, 'cl'], ['farine de blé', 200, 'g'], ['sucre', 100, 'g']]);
  const s = substitutionsPour(r, C('allergen:lait'));
  assert.deepEqual(s.map((x) => x.index), [0, 1, 2]);
  assert.match(s[0].nouveau, /avoine/);
  assert.match(s[1].nouveau, /huile d'olive/);
  assert.equal(s[1].ratio, 0.8);
  assert.match(s[2].nouveau, /coco/);
  const gluten = substitutionsPour(r, C('allergen:lait', 'allergen:gluten'));
  assert.match(gluten.find((x) => x.index === 0).nouveau, /riz/, 'avoine écartée si allergie au gluten');
  assert.match(gluten.find((x) => x.index === 3).nouveau, /riz/, 'farine remplacée');
  const soja = substitutionsPour(r, C('allergen:lait', 'allergen:gluten', 'allergen:soja'));
  assert.match(soja.find((x) => x.index === 0).nouveau, /riz/);
  const ing = appliquerSubstitutions(r.ingredients, s);
  assert.equal(ing[1].quantite, 40);
  assert.match(ing[1].precision, /remplace : beurre doux/);
  assert.equal(ing[3].aliment, 'farine de blé', 'ingrédient non concerné : inchangé');
});

test('vegan, sans porc, sans alcool, grossesse', () => {
  const r = recette([['œuf', 2, 'pièce'], ['miel', 30, 'g'], ['lardons', 100, 'g'], ['vin blanc', 10, 'cl'], ['bouillon de volaille', 50, 'cl'], ['gélatine', 8, 'g'], ['poulet', 400, 'g']]);
  const v = substitutionsPour(r, C('regime:vegan'));
  assert.ok(v.some((x) => x.regle === 'oeuf') && v.some((x) => x.regle === 'miel') && v.some((x) => x.regle === 'volaille') && v.some((x) => x.regle === 'gelatine'));
  assert.ok(!v.some((x) => x.regle === 'vin'), 'vegan seul : le vin n\'est pas remplacé (pas une exigence)');
  const porc = substitutionsPour(r, C('regime:sans_porc'));
  assert.deepEqual(porc.map((x) => x.regle), ['lardons', 'gelatine']);
  assert.match(porc[0].nouveau, /volaille/);
  const grossesse = substitutionsPour(r, C('situation:grossesse'));
  assert.deepEqual(grossesse.map((x) => x.regle), ['vin']);
  assert.match(grossesse[0].nouveau, /bouillon|citron/);
  const enfant = substitutionsPour(r, contraintesDeProfil({ ...enfantVide('e'), prenom: 'Léa' }));
  assert.ok(enfant.some((x) => x.regle === 'vin'), 'pas d\'alcool pour un enfant');
  const lardonsVege = substitutionsPour(recette([['lardons', 100, 'g']]), C('regime:vegetarien'));
  assert.match(lardonsVege[0].nouveau, /champignons/, 'végétarien : pas de lardons de volaille');
});

test('allergies : arachides, fruits à coque, soja, poisson, crustacés', () => {
  const r = recette([['beurre de cacahuètes', 30, 'g'], ['amandes', 50, 'g'], ['tofu', 200, 'g'], ['filet de saumon', 400, 'g'], ['crevettes', 200, 'g'], ['noix de coco râpée', 20, 'g']]);
  assert.deepEqual(substitutionsPour(r, C('allergen:arachides')).map((x) => x.index), [0]);
  assert.deepEqual(substitutionsPour(r, C('allergen:fruits_a_coque')).map((x) => x.index), [1], 'noix de coco : pas un fruit à coque');
  assert.deepEqual(substitutionsPour(r, C('allergen:soja')).map((x) => x.index), [2]);
  assert.deepEqual(substitutionsPour(r, C('allergen:poisson')).map((x) => x.index), [3]);
  assert.deepEqual(substitutionsPour(r, C('allergen:crustaces')).map((x) => x.index), [4]);
  assert.match(substitutionsPour(r, C('allergen:poisson', 'regime:vegetarien'))[0].nouveau, /tofu|pois chiches/);
});

test('nutrition recalculée : estimation chiffrée des substitutions', () => {
  const r = recette([['beurre', 100, 'g'], ['lait', 400, 'ml'], ['sucre', 80, 'g']]);
  const s = substitutionsPour(r, C('allergen:lait'));
  const n = nutritionAdaptee(r, s);
  assert.ok(n && n.nb === 2);
  assert.ok(n.kcal !== 500 && n.l < 20, `lipides en baisse (${n.l})`);
  // beurre 100 g (740 kcal) → huile 80 g (720 kcal) ; lait 400 ml (188 kcal) → avoine (180 kcal) : −28 kcal sur 4 portions → −7
  assert.equal(n.kcal, 493);
  assert.equal(nutritionAdaptee(r, []), null);
  assert.equal(nutritionAdaptee(recette([['persil', 5, 'branche']]), substitutionsPour(recette([['lait', 1, 'cuillère']]), C('allergen:lait'))), null);
  const oeufs = recette([['œuf', 4, 'pièce']]);
  const o = nutritionAdaptee(oeufs, substitutionsPour(oeufs, C('regime:vegan')));
  assert.ok(o.kcal < 500 && o.p < 20, 'moins de protéines sans œuf');
  assert.equal(appliquerSubstitutions(oeufs.ingredients, substitutionsPour(oeufs, C('regime:vegan')))[0].unite, 'g');
});

test('la table est cohérente : ids uniques, motifs et options valides', () => {
  assert.equal(new Set(SUBSTITUTIONS.map((r) => r.id)).size, SUBSTITUTIONS.length);
  for (const r of SUBSTITUTIONS) {
    assert.ok(r.pour.length && r.options.length && r.motif instanceof RegExp, r.id);
    assert.ok(r.pour.every((x) => /^(allergen|regime|situation):/.test(x)), r.id);
    for (const o of r.options) assert.ok(o.nom && o.ratio > 0 && Array.isArray(o.exclut), r.id);
  }
});

test('couverture sur le catalogue : la plupart des ingrédients en conflit ont une substitution', () => {
  const rapport = [];
  for (const [a, motif] of Object.entries(MOTS_ALLERGENES)) {
    if (!['lait', 'gluten', 'oeuf', 'arachides', 'fruits_a_coque', 'soja', 'poisson', 'crustaces'].includes(a)) continue;
    let conflits = 0; let couverts = 0;
    for (const r of toutes.filter((x) => x.allergenes.includes(a)).slice(0, 400)) {
      const subs = new Set(substitutionsPour(r, C(`allergen:${a}`)).map((s) => s.index));
      r.ingredients.forEach((ing, i) => { if (motif.test(` ${normaliser(ing.aliment)} `)) { conflits++; if (subs.has(i)) couverts++; } });
    }
    rapport.push(`${a}:${couverts}/${conflits}`);
    assert.ok(conflits === 0 || couverts / conflits >= 0.55, `${a} : ${couverts}/${conflits}`);
  }
  console.log('   couverture des substitutions :', rapport.join(' '));
});
