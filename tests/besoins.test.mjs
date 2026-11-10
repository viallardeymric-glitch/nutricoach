import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerBesoins } from '../js/lib/besoins.js';
import { validerProfil, profilsARisque, profilVide, profilComplet, ageDepuis } from '../js/lib/profils.js';

const femme = { sexe: 'femme', age: 35, poids_kg: 60, taille_cm: 165, activite: 'legere', objectif: 'maintien' };
const homme = { sexe: 'homme', age: 40, poids_kg: 80, taille_cm: 180, activite: 'moderee', objectif: 'maintien' };

test('Mifflin-St Jeor : valeurs de référence', () => {
  assert.equal(calculerBesoins(femme).bmr, 1295);          // 600 + 1031,25 − 175 − 161
  assert.equal(calculerBesoins(homme).bmr, 1730);          // 800 + 1125 − 200 + 5
  assert.equal(calculerBesoins(homme).tdee, Math.round(1730 * 1.55));
  assert.equal(calculerBesoins(femme).cible, 1780);        // 1295 × 1,375 = 1780,6 → arrondi à 10
});

test('perte de poids : déficit limité à 15 %, plancher de sécurité', () => {
  const b = calculerBesoins({ ...homme, objectif: 'perte' });
  assert.equal(b.objectif, 'perte');
  assert.ok(b.cible >= Math.round(b.tdee * 0.85) - 10 && b.cible < b.tdee);
  const petite = calculerBesoins({ ...femme, poids_kg: 45, taille_cm: 150, age: 70, activite: 'sedentaire', objectif: 'perte' });
  assert.equal(petite.objectif, 'perte');
  assert.ok(petite.cible >= Math.max(petite.bmr, 1200), `cible ${petite.cible} ≥ plancher`);
});

test('aucun régime amincissant pendant grossesse, allaitement, convalescence ou IMC < 18,5', () => {
  for (const situation of [{ grossesse: 2 }, { allaitement: true }, { convalescence: true }]) {
    const b = calculerBesoins({ ...femme, ...situation, objectif: 'perte' });
    assert.equal(b.objectif, 'maintien', JSON.stringify(situation));
    assert.ok(b.messages.length > 0);
  }
  const mince = calculerBesoins({ ...femme, poids_kg: 45, taille_cm: 170, objectif: 'seche' });
  assert.equal(mince.objectif, 'maintien');
  assert.ok(mince.imc < 18.5);
});

test('grossesse et allaitement : apports majorés, jamais réduits', () => {
  const normal = calculerBesoins(femme).cible;
  assert.equal(calculerBesoins({ ...femme, grossesse: 1 }).cible, normal);
  assert.ok(calculerBesoins({ ...femme, grossesse: 2 }).cible > normal);
  assert.ok(calculerBesoins({ ...femme, grossesse: 3 }).cible > calculerBesoins({ ...femme, grossesse: 2 }).cible);
  assert.ok(calculerBesoins({ ...femme, allaitement: true }).cible >= normal + 490);
});

test('macros cohérentes : calories retrouvées, glucides jamais en dessous de 100 g', () => {
  for (const sexe of ['femme', 'homme']) for (const poids_kg of [45, 60, 80, 110]) for (const objectif of ['perte', 'maintien', 'prise', 'seche']) {
    for (const age of [20, 45, 70]) {
      const b = calculerBesoins({ sexe, age, poids_kg, taille_cm: 170, activite: 'sedentaire', objectif, sportif: objectif === 'seche' });
      const kcal = b.proteines_g * 4 + b.glucides_g * 4 + b.lipides_g * 9;
      assert.ok(Math.abs(kcal - b.cible) <= 12, `${sexe} ${poids_kg} kg ${objectif} : ${kcal} vs ${b.cible}`);
      assert.ok(b.glucides_g >= 100, `${sexe} ${poids_kg} kg ${objectif} ${age} ans : glucides ${b.glucides_g} g`);
    }
  }
});

test('validation du profil', () => {
  assert.deepEqual(Object.keys(validerProfil(profilVide('E'))).sort(), ['naissance', 'poids_kg', 'sexe', 'taille_cm']);
  assert.ok(profilComplet({ ...profilVide('E'), ...femme }));
  assert.ok(validerProfil({ ...femme, poids_kg: 10 }).poids_kg);
  assert.ok(validerProfil({ ...femme, age: 12 }).naissance, 'mineur refusé');
  assert.ok(validerProfil({ ...femme, naissance: '2015-03-02' }).naissance);
  assert.ok(validerProfil({ ...femme, naissance: '1990-02-31' }).naissance, 'date impossible');
  assert.deepEqual(validerProfil({ ...femme, age: undefined, naissance: '1990-05-14' }), {});
  assert.ok(validerProfil({ ...femme, taille_cm: '' }).taille_cm);
});

test('profils à risque (alertes de la fiche recette)', () => {
  assert.deepEqual(profilsARisque(femme), []);
  assert.deepEqual(profilsARisque({ ...femme, grossesse: 2, allaitement: true }).sort(), ['allaitante', 'femme_enceinte']);
  assert.deepEqual(profilsARisque({ ...homme, grossesse: 2 }), [], 'un homme n\'est jamais « femme enceinte »');
  assert.ok(profilsARisque({ ...homme, age: 70 }).includes('senior'));
  assert.deepEqual(profilsARisque({ ...homme, conditions: ['diabete', 'hypertension'] }).sort(), ['diabetique', 'hypertendu']);
  assert.ok(profilsARisque({ ...homme, regimes: ['diabetique'] }).includes('diabetique'));
});

test('âge calculé depuis la date de naissance', () => {
  const ref = new Date(2026, 10, 9);
  assert.equal(ageDepuis('1990-11-09', ref), 36);
  assert.equal(ageDepuis('1990-11-10', ref), 35, 'anniversaire demain');
  assert.equal(ageDepuis('1990-12-31', ref), 35);
  assert.equal(ageDepuis('2000-02-29', new Date(2026, 1, 28)), 25);
  assert.equal(ageDepuis('', ref), null);
  assert.equal(ageDepuis('1990-13-01', ref), null);
});

import { ageEnMois, groupeAge, risquesEnfant, nombreConvives, portionConseillee, enfantVide, FACTEUR_PORTION } from '../js/lib/profils.js';
import { SECONDAIRES, OBJECTIFS } from '../js/lib/besoins.js';

test('objectif à date : rythme raisonnable plafonné, avec message clair', () => {
  const ref = new Date(2026, 10, 10);
  const p = { ...femme, poids_kg: 70, objectif: 'date', objectifDate: { kg: 66, date: '2027-02-10' } };   // 4 kg en ~13 semaines
  const b = calculerBesoins(p, ref);
  assert.ok(b.rythme > 0.25 && b.rythme < 0.4, `rythme ${b.rythme}`);
  assert.equal(b.messages.length, 0, 'objectif réaliste : aucun avertissement');
  assert.ok(b.cible < b.tdee);
  const trop = calculerBesoins({ ...p, objectifDate: { kg: 60, date: '2026-12-10' } }, ref);   // 10 kg en 1 mois
  assert.ok(trop.rythme <= 0.7 + 1e-9, `plafonné : ${trop.rythme}`);
  assert.match(trop.messages[0], /trop rapide/);
  assert.ok(trop.dateAtteinte > '2026-12-10');
  assert.ok(trop.cible >= Math.max(trop.bmr, 1200) && trop.cible >= Math.round(trop.tdee * 0.8) - 10, 'déficit limité à 20 %');
  const prise = calculerBesoins({ ...p, objectifDate: { kg: 73, date: '2027-03-10' } }, ref);
  assert.ok(prise.cible > prise.tdee && prise.rythme < 0);
  assert.match(calculerBesoins({ ...p, objectifDate: null }, ref).messages[0], /Indiquez le poids visé/);
  assert.equal(calculerBesoins({ ...p, grossesse: 2 }, ref).objectif, 'maintien', 'jamais de régime amincissant pendant la grossesse, même avec une date');
});

test('objectifs complémentaires et énergie / digestion sans effet calorique', () => {
  assert.ok(OBJECTIFS.date && OBJECTIFS.energie && OBJECTIFS.digestion && OBJECTIFS.sport);
  assert.deepEqual(Object.keys(SECONDAIRES), ['sel', 'sucre', 'alcool', 'budget']);
  assert.equal(calculerBesoins({ ...femme, objectif: 'energie' }).cible, calculerBesoins({ ...femme, objectif: 'maintien' }).cible);
});

test('enfants : âge en mois, groupes d\'âge, risques, portions', () => {
  const ref = new Date(2026, 10, 10);
  assert.equal(ageEnMois('2021-11-09', ref), 60);
  assert.equal(ageEnMois('2026-06-15', ref), 4);
  assert.equal(groupeAge('2026-06-15', ref), 'bebe');
  assert.equal(groupeAge('2025-02-01', ref), 'petit');
  assert.equal(groupeAge('2021-03-01', ref), 'enfant');
  assert.equal(groupeAge('2012-01-01', ref), 'ado');
  assert.equal(groupeAge('2000-01-01', ref), 'adulte');
  assert.deepEqual(risquesEnfant({ naissance: '2021-03-01' }, ref), ['enfant']);
  assert.ok(risquesEnfant({ naissance: '2025-02-01' }, ref).includes('enfant_moins_de_3_ans'));
  assert.ok(risquesEnfant({ naissance: '2026-06-15' }, ref).includes('bebe'));
  assert.deepEqual(risquesEnfant({ naissance: '2010-01-01' }, ref), []);
  assert.equal(nombreConvives(2, [{ naissance: '2021-03-01' }], ref), 2.6);
  assert.equal(nombreConvives(2, [{ naissance: '2021-03-01', dansMenus: false }], ref), 2);
  assert.equal(nombreConvives(2, [], ref), 2);
  assert.equal(FACTEUR_PORTION.enfant, 0.6);
  assert.equal(portionConseillee(600, 700), 1.25);
  assert.equal(portionConseillee(600, 300), 0.5);
  assert.equal(portionConseillee(100, 900), 2);
  assert.equal(portionConseillee(0, 700), 1);
  assert.equal(enfantVide('enfant-1').dansMenus, true);
});
