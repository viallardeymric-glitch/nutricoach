import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGIMES_AVANCES, respecteRegime, pointsMaison, budgetPoints, FAMILLES_REGIMES } from '../js/data/regimes.js';
import { preparerRecettes, filtrerRecettes, FILTRES_VIDES } from '../js/lib/recettes.js';
import { entreeIndex } from '../js/lib/index-entree.js';

const complet = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);

test('l\'entrée d\'index d\'une fiche complète est identique à celle de l\'index', () => {
  const r = complet[41];
  assert.deepEqual(entreeIndex(r), (({ f, _titre, _autres, _ingr, ...reste }) => reste)(index[41]));
});

test('chaque régime a un nom, une famille et une règle ; les médicaux sont signalés', () => {
  for (const [id, r] of Object.entries(REGIMES_AVANCES)) {
    assert.ok(r.nom && r.aide && FAMILLES_REGIMES[r.famille] && typeof r.test === 'function', id);
    assert.equal(Boolean(r.medical), r.famille === 'medical', `${id} : « médical » cohérent avec la famille`);
  }
});

test('chaque règle sélectionne une partie du catalogue (ni vide, ni tout) — hors modes sans filtre', () => {
  const sansFiltre = new Set(['flexitarien', 'jeune', 'points']);
  const rapport = [];
  for (const [id, r] of Object.entries(REGIMES_AVANCES)) {
    const n = index.filter((x) => r.test(x)).length;
    rapport.push(`${id}:${n}`);
    if (sansFiltre.has(id)) continue;
    assert.ok(n > 0, `${id} ne sélectionne aucune recette`);
    assert.ok(n < index.length, `${id} sélectionne tout`);
  }
  console.log('   sélection par régime :', rapport.join(' '));
});

test('règles de fond : valeurs repères respectées sur les recettes retenues', () => {
  const choix = (id) => index.filter((r) => respecteRegime(r, id));
  assert.ok(choix('low_carb').every((r) => r.nut.g <= 25));
  assert.ok(choix('cetogene').every((r) => r.nut.g <= 10 && (r.nut.l * 9) / r.kcal >= 0.6));
  assert.ok(choix('hyperproteine').every((r) => r.nut.p >= 25));
  assert.ok(choix('hypertension').every((r) => r.nut.sel <= 1));
  assert.ok(choix('coeliaque').every((r) => !r.allergenes.includes('gluten')));
  assert.ok(choix('sans_oeuf').every((r) => !r.allergenes.includes('oeuf')));
  assert.ok(choix('sans_alcool').every((r) => !/vin|biere|rhum/.test(r._ingr.replace(/vinaigre/g, ''))));
  assert.ok(choix('goutte').every((r) => !/\b(foie|anchois|sardine|moule|boeuf|porc)\b/.test(r._ingr)));
  assert.ok(choix('crudivore').every((r) => r.cuisson === 0));
});

test('un régime du catalogue et un régime avancé se cumulent (tous les critères)', () => {
  const f = { ...FILTRES_VIDES, regimes: ['vegetarien', 'low_carb', 'sans_oeuf'] };
  const res = filtrerRecettes(index, f);
  assert.ok(res.every((r) => r.regimes.includes('vegetarien') && r.nut.g <= 25 && !r.allergenes.includes('oeuf')));
  assert.ok(res.length < filtrerRecettes(index, { ...FILTRES_VIDES, regimes: ['vegetarien'] }).length);
});

test('points maison : bornes et budget', () => {
  const pts = index.map(pointsMaison);
  assert.ok(pts.every((p) => Number.isInteger(p) && p >= 0 && p < 60));
  assert.ok(new Set(pts).size > 8, 'des valeurs variées');
  assert.equal(budgetPoints(2000), 36);
  assert.equal(budgetPoints(1000), 23);
});
