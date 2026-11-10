import test from 'node:test';
import assert from 'node:assert/strict';
import { phaseDuJour, chargeDuJour, depenseEffort, besoinsJourSport, ravitaillement, repasPreCourse, recuperation, planNutritionnel, FILTRES_SPORT, EPREUVES, RAPPEL_JOUR_J } from '../js/lib/sport.js';
import { calculerBesoins } from '../js/lib/besoins.js';
import { preparerRecettes } from '../js/lib/recettes.js';
import { readFileSync } from 'node:fs';

const profil = { sexe: 'homme', naissance: '1988-01-02', poids_kg: 70, taille_cm: 178, activite: 'moderee', objectif: 'sport', sportif: true };
const base = calculerBesoins(profil, new Date(2026, 10, 10));

test('phases de préparation selon les jours avant l\'épreuve', () => {
  const c = '2027-04-18';
  const ph = (j) => phaseDuJour(c, j, 'marathon').phase;
  assert.equal(ph('2026-11-10'), 'base');
  assert.equal(ph('2027-02-10'), 'developpement');
  assert.equal(ph('2027-01-20'), 'base');
  assert.equal(ph('2027-03-30'), 'affutage');       // 19 jours avant (affûtage de 3 semaines)
  assert.equal(ph('2027-04-14'), 'semaine_course');
  assert.equal(ph('2027-04-18'), 'jour_j');
  assert.equal(ph('2027-04-20'), 'recuperation');
  assert.equal(ph('2027-05-10'), 'apres');
  assert.equal(phaseDuJour(c, '2027-04-05', '10k').phase, 'developpement', '10 km : affûtage plus court (10 jours)');
  assert.equal(phaseDuJour(c, '2027-04-10', '10k').phase, 'affutage');
});

test('charge du jour : séance importée prioritaire, sinon semaine type adaptée à la phase', () => {
  assert.equal(chargeDuJour('2026-11-14', 'base', [{ date: '2026-11-14', duree_min: 120, distance_km: 20, type: 'longue' }]).type, 'longue');
  assert.equal(chargeDuJour('2026-11-14', 'base', [{ date: '2026-11-14', duree_min: 50, distance_km: 8, type: 'fractionne' }]).type, 'fractionne');
  assert.equal(chargeDuJour('2026-11-14', 'base', []).type, 'longue', 'samedi : sortie longue');
  assert.equal(chargeDuJour('2026-11-15', 'base', []).type, 'repos');
  assert.ok(chargeDuJour('2026-11-14', 'affutage', []).duree_min < chargeDuJour('2026-11-14', 'base', []).duree_min, 'affûtage : moins de volume');
  assert.equal(chargeDuJour('2027-04-18', 'jour_j', [], 'marathon').type, 'course');
});

test('besoins du jour : plus de calories et de glucides les jours chargés, jamais de valeur absurde', () => {
  const j = (type, duree) => besoinsJourSport(profil, base, { type, duree_min: duree });
  const repos = j('repos', 0); const courte = j('courte', 45); const longue = j('longue', 120);
  assert.ok(repos.kcal < courte.kcal && courte.kcal < longue.kcal);
  assert.equal(repos.glucides_g, 280);      // 4 g/kg × 70
  assert.equal(longue.glucides_g, 560);     // 8 g/kg
  assert.equal(longue.proteines_g, 112);    // 1,6 g/kg
  assert.ok(longue.lipides_g >= 56, 'lipides jamais sous 0,8 g/kg');
  assert.ok(besoinsJourSport(profil, base, { type: 'repos', duree_min: 0 }, { chargeGlucides: true }).glucidesParKg === 9);
  assert.equal(depenseEffort(60, 70, 'course'), 560);
  assert.ok(longue.eau_ml > repos.eau_ml);
});

test('ravitaillement selon la durée visée', () => {
  assert.equal(ravitaillement(30).glucides_h, 0);
  assert.equal(ravitaillement(90).glucides_h, 40);
  assert.equal(ravitaillement(150).glucides_h, 60);
  const m = ravitaillement(240);
  assert.equal(m.glucides_h, 80); assert.equal(m.total_glucides, 320);
  assert.ok(ravitaillement(240, { chaud: true }).eau_ml_h > m.eau_ml_h);
  assert.match(m.conseil, /60 à 90 g/);
  assert.equal(repasPreCourse(profil, 3).glucides_g, 210);
  assert.equal(recuperation(profil).glucides_g, 77);
  assert.equal(recuperation(profil).proteines_g, 21);
});

test('plan de compétition : généré depuis la date et la distance, charge en glucides, veille, jour J, récupération', () => {
  const course = { type: 'marathon', date: '2027-04-18', distance_km: 42.195, temps_min: 225, charge_jours: 3 };
  const plan = planNutritionnel(profil, base, course, '2027-04-01');
  assert.equal(plan[0].date, '2027-04-01');
  assert.equal(plan[plan.length - 1].date, '2027-04-25', 'jusqu\'à 7 jours après');
  const jour = (d) => plan.find((p) => p.date === d);
  assert.ok(jour('2027-04-15').enCharge && jour('2027-04-16').enCharge && jour('2027-04-17').enCharge && !jour('2027-04-14').enCharge, 'charge sur 3 jours');
  assert.equal(jour('2027-04-15').besoins.glucidesParKg, 9);
  assert.ok(jour('2027-04-17').laVeille && /pauvres en fibres/.test(jour('2027-04-17').notes.join(' ')));
  assert.ok(jour('2027-04-18').notes.includes(RAPPEL_JOUR_J), 'rappel : rien de nouveau le jour J');
  assert.equal(jour('2027-04-18').phase, 'jour_j');
  assert.match(jour('2027-04-19').notes.join(' '), /Récupération/);
  const court = planNutritionnel(profil, base, { type: '10k', date: '2027-04-18' }, '2027-04-10');
  assert.ok(!court.some((p) => p.enCharge), '10 km : pas de charge en glucides');
  assert.ok(court.find((p) => p.date === '2027-04-17').laVeille);
  assert.deepEqual(planNutritionnel(profil, base, null, '2027-04-01'), []);
  const avecSeances = planNutritionnel(profil, base, course, '2027-04-01', [{ date: '2027-04-03', duree_min: 150, distance_km: 25, type: 'longue' }]);
  assert.equal(avecSeances.find((p) => p.date === '2027-04-03').charge.source, 'seance', 's\'ajuste aux séances importées');
  assert.ok(avecSeances.find((p) => p.date === '2027-04-03').besoins.kcal > plan.find((p) => p.date === '2027-04-03').besoins.kcal);
});


test('recettes pour le sport : sélections non vides dans le catalogue', () => {
  const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);
  for (const [id, f] of Object.entries(FILTRES_SPORT)) {
    const n = index.filter(f.test).length;
    assert.ok(n > 5 && n < index.length, `${id} : ${n}`);
    assert.ok(f.nom && f.aide, id);
  }
  assert.ok(EPREUVES.marathon.charge && !EPREUVES['10k'].charge);
});
