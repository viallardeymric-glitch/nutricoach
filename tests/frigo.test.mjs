import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estBasique, correspond, couverture, articlesDuFrigo, frigoMagique, aConsommerBientot, bonusStock } from '../js/lib/frigo.js';
import { coutRecette, budgetMenu, budgetListe, COUT_PORTION } from '../js/lib/budget.js';
import { preparerRecettes } from '../js/lib/recettes.js';
import { proposer, contraintesCouple, genererSemaine, semaineDe, REPAS_COMPLETS } from '../js/lib/planning.js';

const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);
const stock = (...noms) => noms.map((n) => (typeof n === 'string' ? { nom: n } : n));

test('produits de base : sel, huile, farine… supposés disponibles', () => {
  assert.ok(['sel fin', 'huile d\'olive', 'poivre noir', 'farine de blé', 'eau froide'].every(estBasique));
  assert.ok(!['poulet', 'tomate', 'beurre doux'].some(estBasique));
});

test('correspondance stock / ingrédient dans les deux sens', () => {
  const ing = (n) => ({ jetons: n.split(' ') });
  assert.ok(correspond(ing('blanc poulet'), ['poulet']));
  assert.ok(correspond(ing('poulet'), ['blanc', 'poulet']));
  assert.ok(!correspond(ing('pomme terre'), ['pomme']) === false, 'pomme ⊂ pomme de terre : rapprochement accepté');
  assert.ok(!correspond(ing('carotte'), ['courgette']));
  assert.ok(!correspond({ jetons: [] }, ['x']));
});

test('frigo magique : recettes réalisables avec le stock, mieux couvertes d\'abord', () => {
  const art = articlesDuFrigo(stock('poulet', 'riz', 'carotte', 'oignon', 'crème fraîche', 'champignon'));
  const res = frigoMagique(index, art, { min: 3, ratioMin: 0.5 });
  assert.ok(res.length > 3, `${res.length} recettes`);
  assert.ok(res.every((x) => x.couverts.length >= 3 && x.ratio >= 0.5));
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].gaspi >= res[i].gaspi, 'anti-gaspi d\'abord');
  const vide = frigoMagique(index, articlesDuFrigo([]), {});
  assert.deepEqual(vide, []);
  const c = couverture(res[0].r, art);
  assert.deepEqual([...c.couverts, ...c.manquants].sort(), res[0].r.ingredients.filter((i) => !estBasique(i)).sort());
});

test('anti-gaspi : produits qui périment, périmés signalés, recettes prioritaires', () => {
  const s = stock({ nom: 'Yaourt', peremption: '2026-11-11' }, { nom: 'Poulet', peremption: '2026-11-09' }, { nom: 'Riz', peremption: null }, { nom: 'Fromage', peremption: '2026-12-30' });
  const l = aConsommerBientot(s, new Date(2026, 10, 10), 3);
  assert.deepEqual(l.map((x) => x.nom), ['Poulet', 'Yaourt']);
  assert.ok(l[0].perime && !l[1].perime);
  assert.equal(l[1].joursRestants, 1);
  const art = articlesDuFrigo(stock({ nom: 'poulet', peremption: '2026-11-11' }, 'riz', 'carotte'));
  const prio = frigoMagique(index, art, { min: 2, ratioMin: 0.4, prioritaires: ['poulet'] });
  assert.ok(prio.length && prio[0].gaspi >= 1, 'les recettes qui utilisent le produit qui périme passent devant');
});

test('« ce soir » et menus tiennent compte du stock (bonus) sans enfreindre les contraintes', () => {
  const art = articlesDuFrigo(stock('saumon', 'courgette', 'riz'));
  const c = contraintesCouple([{ allergenes: ['lait'], regimes: [], exclusions: '', appliquer: true, sexe: 'homme' }]);
  const avec = proposer(index, c, { jour: new Date(2026, 10, 10), saison: 'automne', graine: 1, n: 3, bonus: bonusStock(art) });
  assert.ok(avec.every((r) => !r.allergenes.includes('lait')));
  const couv = (r) => couverture(r, art).couverts.length;
  const sans = proposer(index, c, { jour: new Date(2026, 10, 10), saison: 'automne', graine: 1, n: 3 });
  assert.ok(avec.reduce((s, r) => s + couv(r), 0) >= sans.reduce((s, r) => s + couv(r), 0), 'le bonus rapproche du stock');
});

test('budget : coût par portion, menu, liste', () => {
  assert.equal(coutRecette({ cout: 'economique' }, 2), 4.4);
  assert.equal(coutRecette({ cout: 'inconnu' }, 1), COUT_PORTION.moyen);
  const parId = new Map([['A', { id: 'A', cout: 'economique' }], ['B', { id: 'B', cout: 'eleve' }]]);
  const b = budgetMenu({ j1: { dejeuner: 'A', diner: 'B' }, j2: { diner: 'A' } }, ['j1', 'j2'], parId, 2);
  assert.equal(b.repas, 3);
  assert.equal(b.total, Math.round(2.2 * 2 * 2 + 6.5 * 2));
  const l = budgetListe([{ recettes: ['A', 'B'] }, { recettes: ['A'] }, { recettes: [] }], parId, 2);
  assert.equal(l.recettes, 2);
  assert.equal(l.total, Math.round(2.2 * 2 + 6.5 * 2 + 2));
});

test('budget serré : les menus favorisent l\'économique', () => {
  const c = contraintesCouple([]);
  const jours = semaineDe(new Date(2026, 10, 9));
  const moy = (budgetSerre) => { const { plan } = genererSemaine(index, jours, {}, { contraintes: c, saison: 'automne', cibleKcal: 2000, graine: 5, budgetSerre });
    const ids = jours.flatMap((j) => Object.values(plan[j])); return ids.reduce((s, id) => s + coutRecette(index.find((r) => r.id === id)), 0) / ids.length; };
  assert.ok(moy(true) <= moy(false), 'coût moyen plus bas');
});

test('petit-déjeuner et collations : choisis dans les goûters, sans doublon', () => {
  const c = contraintesCouple([]);
  const jours = semaineDe(new Date(2026, 10, 9));
  const { plan, manquants } = genererSemaine(index, jours, {}, { contraintes: c, saison: 'automne', cibleKcal: 2000, graine: 3, repas: REPAS_COMPLETS });
  assert.equal(manquants.length, 0);
  const ids = jours.flatMap((j) => Object.values(plan[j]));
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
  for (const j of jours) {
    const pdj = index.find((r) => r.id === plan[j].petit_dejeuner);
    assert.equal(pdj.sous_categorie, 'petit_dejeuner');
    const col = index.find((r) => r.id === plan[j].collation);
    assert.ok(col.categorie === 'Goûters' || col.categorie === 'Desserts');
    assert.equal(index.find((r) => r.id === plan[j].dejeuner).categorie, 'Plats');
  }
});
