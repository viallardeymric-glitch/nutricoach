import test from 'node:test';
import assert from 'node:assert/strict';
import { entreeDepuisRecette, entreeDepuisProduit, bilanJour, objectifEau, serieDePoids, tendancePoids, variationPoids, cheminCourbe, bilanSemaine, serieDeSuivi, repasSelonHeure } from '../js/lib/suivi.js';
import { semaineDe } from '../js/lib/planning.js';

const recette = { id: 'REC-000001', titre: 'Poulet rôti', kcal: 550, nut: { p: 45, g: 1, l: 39, f: 0, s: 0, sel: 1.2 } };

test('entrées de journal : recette (portions) et produit (grammes)', () => {
  const e = entreeDepuisRecette(recette, 1.5, 'diner', 'E', '2026-11-09');
  assert.deepEqual([e.kcal, e.p, e.l, e.portion, e.source], [825, 67.5, 58.5, '1.5 portions', 'recette']);
  const p = entreeDepuisProduit({ code: '3017620422003', nom: 'Pâte', nutrition: { kcal: 539, proteines: 6.3, glucides: 57.5, graisses: 30.9 } }, 30, 'collation', 'M', '2026-11-09');
  assert.deepEqual([p.kcal, p.p, p.g, p.l], [162, 1.9, 17.3, 9.3]);
  assert.equal(entreeDepuisProduit({ code: '1', nom: 'x', nutrition: {} }, 100, 'diner', 'E', 'd').kcal, 0);
});

test('bilan du jour : par personne, repas groupés, eau à part', () => {
  const j = [
    entreeDepuisRecette(recette, 1, 'dejeuner', 'E', '2026-11-09'),
    entreeDepuisRecette(recette, 1, 'diner', 'M', '2026-11-09'),
    entreeDepuisRecette(recette, 1, 'diner', 'E', '2026-11-08'),
    { type: 'eau', ml: 250, date: '2026-11-09', par: 'E' }, { type: 'eau', ml: 500, date: '2026-11-09', par: 'E' },
    { type: 'repas', date: '2026-11-09', par: 'E', repas: 'inconnu', nom: 'x', kcal: 100, p: 0, g: 0, l: 0 },
  ];
  const b = bilanJour(j, '2026-11-09', 'E');
  assert.equal(b.kcal, 650);
  assert.equal(b.eau, 750);
  assert.equal(b.repas.dejeuner.length, 1);
  assert.equal(b.repas.collation.length, 1, 'repas inconnu : rangé en collation');
  assert.equal(bilanJour(j, '2026-11-09', 'M').kcal, 550);
});

test('hydratation : 30 ml/kg, bornes, majorations', () => {
  assert.equal(objectifEau({ poids_kg: 62 }), 1850);
  assert.equal(objectifEau({ poids_kg: 40 }), 1500);
  assert.equal(objectifEau({ poids_kg: 120 }), 3500);
  assert.equal(objectifEau({ poids_kg: 62, sportif: true, allaitement: true }), 2850);
  assert.equal(objectifEau(null), 1950);
});

test('repas selon l\'heure', () => {
  const h = (n) => new Date(2026, 10, 9, n, 0);
  assert.deepEqual([8, 12, 16, 20, 23].map((n) => repasSelonHeure(h(n))), ['petit_dejeuner', 'dejeuner', 'collation', 'diner', 'collation']);
});

test('poids : série triée par personne, tendance lissée, variation', () => {
  const pts = [{ date: '2026-11-05', par: 'M', kg: 62.4 }, { date: '2026-11-01', par: 'M', kg: 63 }, { date: '2026-11-03', par: 'E', kg: 80 }, { date: '2026-11-09', par: 'M', kg: 61.8 }, { date: '2026-11-02', par: 'M', kg: NaN }];
  const s = serieDePoids(pts, 'M');
  assert.deepEqual(s.map((p) => p.date), ['2026-11-01', '2026-11-05', '2026-11-09']);
  const t = tendancePoids(s);
  assert.equal(t[0].kg, 63);
  assert.equal(t[1].kg, 62.7);
  assert.ok(t[2].kg > 61.8 && t[2].kg < 62.4);
  assert.equal(variationPoids(s, 10, new Date(2026, 10, 9)), -1.2);
  assert.equal(variationPoids(s, 2, new Date(2026, 10, 9)), null, 'un seul point dans la période');
});

test('courbe SVG : points dans le cadre', () => {
  const chemin = cheminCourbe([{ date: '2026-11-01', kg: 60 }, { date: '2026-11-11', kg: 62 }], { w: 100, h: 50, min: 60, max: 62, debut: new Date(2026, 10, 1).getTime(), fin: new Date(2026, 10, 11).getTime() });
  assert.equal(chemin, 'M0.0,50.0 L100.0,0.0');
  assert.equal(cheminCourbe([], { w: 1, h: 1, min: 0, max: 1, debut: 0, fin: 1 }), '');
});

test('bilan hebdomadaire : moyennes, jours dans la cible, messages bienveillants, suggestions', () => {
  const jours = semaineDe(new Date(2026, 10, 9));
  const e = [];
  for (const j of jours.slice(0, 4)) e.push({ type: 'repas', date: j, par: 'E', repas: 'diner', nom: 'x', kcal: 2400, p: 90, g: 250, l: 80 });
  e.push({ type: 'eau', ml: 800, date: jours[0], par: 'E' });
  const b = bilanSemaine(e, [], 'E', 2000, 1900, jours, 'perte');
  assert.equal(b.suivis, 4);
  assert.equal(b.kcal, 2400);
  assert.equal(b.dansCible, 0);
  assert.ok(b.suggestions.some((s) => /400 kcal au-dessus/.test(s)));
  assert.ok(b.suggestions.some((s) => /verre d'eau/.test(s)));
  assert.ok(b.messages.some((m) => /4 jours suivis/.test(m)));
  assert.ok(![...b.messages, ...b.suggestions].some((m) => /échec|raté|honte|coupable|interdit/i.test(m)), 'ton sans culpabilisation');
  const vide = bilanSemaine([], [], 'E', 2000, 1900, jours, 'maintien');
  assert.match(vide.messages[0], /pas grave/);
  const peu = bilanSemaine([{ type: 'repas', date: jours[0], par: 'E', repas: 'diner', nom: 'x', kcal: 1200, p: 0, g: 0, l: 0 }], [], 'E', 2000, 1900, jours);
  assert.ok(peu.suggestions.some((s) => /en dessous/.test(s)));
});

test('série de suivi : jours consécutifs, sans punir une journée vide', () => {
  const e = ['2026-11-09', '2026-11-08', '2026-11-07', '2026-11-05'].map((date) => ({ type: 'repas', date, par: 'E' }));
  assert.equal(serieDeSuivi(e, 'E', new Date(2026, 10, 9)), 3);
  assert.equal(serieDeSuivi(e, 'E', new Date(2026, 10, 10)), 3, 'aujourd\'hui pas encore noté : on compte depuis hier');
  assert.equal(serieDeSuivi(e, 'M', new Date(2026, 10, 9)), 0);
});
