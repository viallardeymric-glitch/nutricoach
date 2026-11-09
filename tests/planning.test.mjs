import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { semaineDe, lundiDe, cleDate, dateDepuisCle, saisonDe, graine, aleatoire, contraintesCouple, convient, proposer, genererSemaine, REPAS } from '../js/lib/planning.js';
import { preparerRecettes } from '../js/lib/recettes.js';
import { profilVide } from '../js/lib/profils.js';
import { dureeEnSecondes, dureeEtape, formaterMinuteur } from '../js/lib/cuisine.js';

const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);
const complet = new Map(JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8')).map((r) => [r.id, r]));
const SAISON = 'automne';

test('dates : semaine du lundi au dimanche, saisons', () => {
  assert.deepEqual(semaineDe(new Date(2026, 10, 11)), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(cleDate(lundiDe(new Date(2026, 10, 15))), '2026-11-09', 'le dimanche appartient à la semaine qui finit');
  assert.equal(cleDate(dateDepuisCle('2026-02-05')), '2026-02-05');
  assert.deepEqual(semaineDe(new Date(2026, 11, 30)).slice(0, 3), ['2026-12-28', '2026-12-29', '2026-12-30'], 'passage d\'année');
  assert.equal(saisonDe(new Date(2026, 10, 9)), 'automne');
  assert.equal(saisonDe(new Date(2026, 6, 1)), 'ete');
});

test('hasard reproductible', () => {
  const a = aleatoire(graine('x')); const b = aleatoire(graine('x'));
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(graine('a'), graine('b'));
});

test('contraintes du couple : union des deux profils', () => {
  const e = { ...profilVide('E'), allergenes: ['arachides'], regimes: [] };
  const m = { ...profilVide('M'), sexe: 'femme', grossesse: 2, allergenes: ['lait'], regimes: ['vegetarien'], exclusions: 'coriandre' };
  const c = contraintesCouple([e, m, null]);
  assert.deepEqual(c.allergenes.sort(), ['arachides', 'lait']);
  assert.deepEqual(c.regimes, ['vegetarien']);
  assert.deepEqual(c.exclusions, ['coriandre']);
  assert.deepEqual(c.risques, ['femme_enceinte']);
  const off = contraintesCouple([{ ...m, appliquer: false }]);
  assert.deepEqual(off.allergenes, ['lait'], 'un menu respecte toujours les allergies, même profil non appliqué en navigation');
});

test('une semaine complète : 14 repas, sans doublon, au moins 2 poissons et 2 végétariens', () => {
  const jours = semaineDe(new Date(2026, 10, 9));
  const { plan, manquants } = genererSemaine(index, jours, {}, { contraintes: contraintesCouple([]), saison: SAISON, cibleKcal: 2000, graine: 42 });
  assert.equal(manquants.length, 0);
  const ids = jours.flatMap((j) => REPAS.map((r) => plan[j][r.id]));
  assert.equal(ids.length, 14);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, 14, 'aucune recette en double');
  const rec = ids.map((id) => index.find((r) => r.id === id));
  assert.ok(rec.filter((r) => r.allergenes.includes('poisson')).length >= 2, 'au moins 2 repas de poisson');
  assert.ok(rec.filter((r) => r.regimes.includes('vegetarien')).length >= 2, 'au moins 2 repas végétariens');
  assert.ok(rec.every((r) => r.categorie === 'Plats'));
});

test('compléter sans écraser ; même graine = même menu ; autre graine = autre menu', () => {
  const jours = semaineDe(new Date(2026, 10, 9));
  const deja = { [jours[0]]: { diner: 'REC-000001' } };
  const opts = { contraintes: contraintesCouple([]), saison: SAISON, cibleKcal: 2000 };
  const a = genererSemaine(index, jours, deja, { ...opts, graine: 7 }).plan;
  const b = genererSemaine(index, jours, deja, { ...opts, graine: 7 }).plan;
  const c = genererSemaine(index, jours, deja, { ...opts, graine: 8 }).plan;
  assert.equal(a[jours[0]].diner, 'REC-000001', 'le repas déjà choisi est conservé');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(!Object.values(a).some((j) => j.dejeuner === 'REC-000001'), 'pas de doublon avec un repas déjà planifié');
});

test('SÉCURITÉ : un menu ne contient jamais un allergène, un aliment évité ni une recette déconseillée', () => {
  const jours = semaineDe(new Date(2026, 10, 9));
  const cas = [
    ...['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'arachides', 'fruits_a_coque', 'soja', 'sesame', 'moutarde'].map((a) => [{ ...profilVide('E'), allergenes: [a] }]),
    [{ ...profilVide('M'), sexe: 'femme', grossesse: 2, allaitement: true }, { ...profilVide('E'), allergenes: ['lait', 'oeuf'], exclusions: 'champignon, oignon' }],
    [{ ...profilVide('M'), regimes: ['vegan'], allergenes: ['soja'] }],
  ];
  for (const [i, profils] of cas.entries()) {
    const c = contraintesCouple(profils);
    for (const g of [1, 2, 3]) {
      const { plan } = genererSemaine(index, jours, {}, { contraintes: c, saison: SAISON, cibleKcal: 2000, graine: g });
      for (const j of jours) for (const { id } of REPAS) {
        const r = plan[j][id];
        if (!r) continue;
        const f = complet.get(r);
        assert.ok(!c.allergenes.some((a) => f.allergenes.includes(a)), `cas ${i} : ${r} contient un allergène exclu`);
        assert.ok(c.regimes.every((x) => f.regimes_compatibles.includes(x)), `cas ${i} : ${r} ne respecte pas le régime`);
        assert.ok(!f.deconseille_a.some((d) => c.risques.includes(d.profil)), `cas ${i} : ${r} déconseillée à un profil du couple`);
        const texte = (f.titre + ' ' + f.ingredients.map((x) => x.aliment).join(' ')).toLowerCase();
        for (const x of c.exclusions) assert.ok(!texte.includes(x.slice(0, 5)), `cas ${i} : ${r} contient « ${x} »`);
      }
    }
  }
});

test('contraintes impossibles : rien n\'est inventé', () => {
  const impossible = { regimes: [], allergenes: ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'mollusques', 'arachides', 'fruits_a_coque', 'soja', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin'], exclusions: [], risques: [] };
  const { plan, manquants } = genererSemaine(index, semaineDe(new Date(2026, 10, 9)), {}, { contraintes: impossible, saison: SAISON, cibleKcal: 2000, graine: 1 });
  const remplis = Object.values(plan).flatMap((j) => Object.values(j));
  assert.equal(remplis.length + manquants.length, 14);
  for (const id of remplis) assert.ok(convient(index.find((r) => r.id === id), impossible));
});

test('proposer : 3 idées différentes, rapides si demandé', () => {
  const c = contraintesCouple([]);
  const idees = proposer(index, c, { jour: new Date(2026, 10, 9), saison: SAISON, graine: 5, n: 3, rapideMax: 20 });
  assert.equal(idees.length, 3);
  assert.equal(new Set(idees.map((r) => r.id)).size, 3);
  assert.ok(idees.every((r) => r.temps <= 20));
});

test('durées des étapes pour le minuteur', () => {
  assert.equal(dureeEnSecondes('20 min'), 1200);
  assert.equal(dureeEnSecondes('30 sec'), 30);
  assert.equal(dureeEnSecondes('1 h 30'), 5400);
  assert.equal(dureeEnSecondes('1h'), 3600);
  assert.equal(dureeEnSecondes('5 à 7 min'), 420);
  assert.equal(dureeEnSecondes('45 minutes'), 2700);
  assert.equal(dureeEnSecondes('Varoma'), null);
  assert.equal(dureeEnSecondes(''), null);
  assert.equal(dureeEtape({ texte: 'Laissez mijoter pendant 10 minutes.', reglages: {} }), 600);
  assert.equal(dureeEtape({ texte: 'Cuire 10 minutes.', reglages: { duree: '15 min' } }), 900, 'le réglage prime sur le texte');
  assert.equal(formaterMinuteur(65), '01:05');
  assert.equal(formaterMinuteur(3725), '1:02:05');
});
