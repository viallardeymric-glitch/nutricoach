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
