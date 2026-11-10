import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genererSemaine, autreRepasPour, classeProteine, contraintesCouple, semaineDe, contexteEquilibre, REPAS } from '../js/lib/planning.js';
import { preparerRecettes } from '../js/lib/recettes.js';
import { noterMenu } from '../js/lib/sante.js';
import { profilVide } from '../js/lib/profils.js';

const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);
const parId = new Map(index.map((r) => [r.id, r]));
const jours = semaineDe(new Date(2026, 10, 9));
const contraintes = contraintesCouple([{ ...profilVide(), sexe: 'homme', allergenes: [] }, { ...profilVide(), sexe: 'femme', allergenes: ['lait'], grossesse: 2 }]);
const semaine = (g, c = contraintes, extra = {}) => genererSemaine(index, jours, {}, { contraintes: c, saison: 'hiver', cibleKcal: 2200, graine: g, repas: REPAS, ...extra });
const classes = (plan) => Object.values(plan).flatMap((j) => Object.values(j)).map((id) => classeProteine(parId.get(id)));

test('classe de protéines : exemples du catalogue', () => {
  const classe = (re) => classeProteine(index.find((r) => re.test(r.titre) && r.categorie === 'Plats'));
  assert.equal(classe(/saumon/i), 'poisson_gras');
  assert.equal(classeProteine(index.find((r) => /lentilles|pois chiches/i.test(r.titre) && r.categorie === 'Plats' && r.regimes.includes('vegetarien'))), 'legumineuses');
  assert.equal(classe(/porc/i), 'porc');
  assert.ok(['viande_rouge'].includes(classe(/bourguignon/i)));
});

test('menu de la semaine « façon diététicien » : plafonds de viande rouge et de porc, poisson, légumineuses', () => {
  let ok = 0;
  for (let g = 1; g <= 20; g++) {
    const { plan, manquants } = semaine(g * 7919);
    assert.equal(manquants.length, 0);
    const c = classes(plan); const n = (k) => c.filter((x) => x === k).length;
    assert.ok(n('viande_rouge') <= 2, `graine ${g} : ${n('viande_rouge')} viandes rouges`);
    assert.ok(n('porc') <= 2, `graine ${g} : ${n('porc')} porc`);
    assert.ok(n('poisson') + n('poisson_gras') >= 2, `graine ${g} : poisson`);
    if (n('legumineuses') >= 2) ok++;
  }
  assert.ok(ok >= 14, `légumineuses ≥ 2 dans ${ok}/20 semaines`);
});

test('variété : pas deux plats du même type, ni la même source de protéines, le même jour', () => {
  let jours2 = 0; let memeType = 0; let memeProteine = 0;
  for (let g = 1; g <= 20; g++) {
    const { plan } = semaine(g * 104729);
    for (const j of jours) {
      const r = ['dejeuner', 'diner'].map((x) => parId.get((plan[j] || {})[x])).filter(Boolean);
      if (r.length < 2) continue;
      jours2++;
      if (r[0].sous_categorie === r[1].sous_categorie) memeType++;
      const [a, b] = r.map(classeProteine);
      if (a === b && a !== 'vegetal' && a !== 'autre') memeProteine++;
    }
  }
  assert.ok(memeType / jours2 <= 0.02, `même type le même jour : ${memeType}/${jours2}`);
  assert.ok(memeProteine / jours2 <= 0.06, `même protéine le même jour : ${memeProteine}/${jours2}`);
});

test('qualité nutritionnelle : le menu a un bon score santé moyen', () => {
  const notes = [];
  for (let g = 1; g <= 10; g++) { const { plan } = semaine(g * 31337); notes.push(noterMenu(Object.values(plan).flatMap((j) => Object.values(j)).map((id) => parId.get(id))).note); }
  const moy = notes.reduce((s, x) => s + x, 0) / notes.length;
  assert.ok(moy >= 60, `score santé moyen du menu : ${moy}`);
});

test('profil diabétique ou hypertendu : sucres et sel mieux maîtrisés', () => {
  const c = contraintesCouple([{ ...profilVide(), sexe: 'homme', conditions: ['diabete', 'hypertension'] }]);
  const moy = (c2) => { let s = 0; let n = 0; for (let g = 1; g <= 10; g++) { const { plan } = semaine(g * 2203, c2); for (const id of Object.values(plan).flatMap((j) => Object.values(j))) { s += parId.get(id).nut.sel; n++; } } return s / n; };
  assert.ok(moy(c) < 2.6, `sel moyen par repas ${moy(c)}`);
});

test('« autre repas » : jamais le même plat, jamais le même type ni la même protéine que l\'autre repas du jour', () => {
  const { plan } = semaine(4242);
  let essais = 0;
  for (const j of jours) for (const repas of ['dejeuner', 'diner']) {
    const autre = repas === 'dejeuner' ? 'diner' : 'dejeuner';
    const ref = parId.get(plan[j][autre]);
    const avant = plan[j][repas];
    for (let g = 1; g <= 8; g++) {
      const r = autreRepasPour(index, contraintes, { plan, jours, jour: j, repas, saison: 'hiver', cibleKcal: 2200, graine: g * 977 + essais });
      essais++;
      assert.ok(r, 'une proposition existe');
      assert.notEqual(r.id, avant, 'pas le plat qu\'on remplace');
      assert.notEqual(r.id, ref.id, 'pas le même plat que l\'autre repas du jour');
      assert.ok(!Object.values(plan).flatMap((x) => Object.values(x)).includes(r.id), 'pas un plat déjà au menu de la semaine');
      assert.notEqual(r.sous_categorie, ref.sous_categorie, `même type que l'autre repas : ${r.titre} / ${ref.titre}`);
      const [a, b] = [classeProteine(r), classeProteine(ref)];
      assert.ok(!(a === b && a !== 'vegetal' && a !== 'autre'), `même protéine que l'autre repas : ${r.titre} / ${ref.titre}`);
    }
  }
});

test('contexte d\'équilibre : compte les protéines de la semaine sans le repas remplacé', () => {
  const { plan } = semaine(1);
  const tous = contexteEquilibre(parId, plan, jours);
  const sans = contexteEquilibre(parId, plan, jours, { jour: jours[0], repas: 'diner' });
  const total = (c) => Object.values(c.compteurs).reduce((s, x) => s + x, 0);
  assert.equal(total(tous) - total(sans), 1);
});
