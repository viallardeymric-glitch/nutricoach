// Besoins énergétiques et repères nutritionnels. Estimations générales, jamais un avis médical.
// Formule de Mifflin-St Jeor pour le métabolisme de base. Fonctions pures, testées dans tests/besoins.test.mjs.

import { ageDe } from './profils.js';

export const ACTIVITES = {
  sedentaire: { nom: 'Sédentaire', coef: 1.2, aide: 'Peu ou pas d\'exercice' },
  legere: { nom: 'Légère', coef: 1.375, aide: '1 à 3 séances par semaine' },
  moderee: { nom: 'Modérée', coef: 1.55, aide: '3 à 5 séances par semaine' },
  intense: { nom: 'Intense', coef: 1.725, aide: '6 à 7 séances par semaine' },
};
export const OBJECTIFS = {
  equilibre: 'Équilibre, sans régime',
  maintien: 'Maintenir mon poids',
  perte: 'Perdre du poids',
  date: 'Atteindre un poids à une date',
  prise: 'Prendre de la masse',
  seche: 'Sèche',
  energie: 'Plus d\'énergie, moins de fatigue',
  digestion: 'Meilleure digestion',
  sport: 'Préparation sportive',
};
/** Objectifs complémentaires (cumulables avec l'objectif principal). */
export const SECONDAIRES = {
  sel: 'Réduire le sel',
  sucre: 'Réduire le sucre',
  alcool: 'Réduire l\'alcool',
  budget: 'Petit budget',
};
export const RYTHME_MAX_KG_SEMAINE = 0.8;   // jamais plus (ni plus de 1 % du poids par semaine)
export const RYTHME_PRISE_MAX = 0.4;
const MS_JOUR = 86400000;

const PLANCHER_KCAL = { femme: 1200, homme: 1500 }; // jamais sous ce seuil (ni sous le métabolisme de base)
const arrondir = (v, pas) => Math.round(v / pas) * pas;

/**
 * Calcule calories cibles et macros d'un profil complet et valide (voir validerProfil).
 * Plafonds de sécurité : aucun régime amincissant pendant une grossesse, un allaitement, une convalescence
 * ou si l'IMC est inférieur à 18,5 ; jamais sous le plancher calorique ; déficit limité à 15 %.
 */
export function calculerBesoins(p, aujourdhui = new Date()) {
  const messages = [];
  const age = ageDe(p);
  const bmr = Math.round(10 * p.poids_kg + 6.25 * p.taille_cm - 5 * age + (p.sexe === 'homme' ? 5 : -161));
  const tdee = Math.round(bmr * (ACTIVITES[p.activite]?.coef ?? ACTIVITES.sedentaire.coef));
  const imc = Math.round((p.poids_kg / ((p.taille_cm / 100) ** 2)) * 10) / 10;
  const trimestre = p.grossesse || 0;

  let objectif = p.objectif || 'equilibre';
  const cibleDate = objectif === 'date' && p.objectifDate && Number(p.objectifDate.kg) > 0 && p.objectifDate.date ? p.objectifDate : null;
  const veutMaigrir = cibleDate && Number(cibleDate.kg) < p.poids_kg;
  const amincissant = objectif === 'perte' || objectif === 'seche' || Boolean(veutMaigrir);
  if (amincissant && (trimestre > 0 || p.allaitement || p.convalescence)) {
    objectif = 'maintien';
    messages.push('Pendant la grossesse, l\'allaitement ou une convalescence, aucun régime amincissant n\'est proposé : l\'objectif est ramené au maintien.');
  } else if (amincissant && imc < 18.5) {
    objectif = 'maintien';
    messages.push('Avec un IMC inférieur à 18,5, aucune perte de poids n\'est proposée : l\'objectif est ramené au maintien. Parlez-en à un médecin.');
  }

  let ajustement = { perte: -0.15, seche: -0.15, prise: 0.10 }[objectif] || 0;
  let rythme = null;
  let dateAtteinte = null;
  if (objectif === 'date' && !cibleDate) messages.push('Indiquez le poids visé et la date pour calculer votre rythme.');
  if (objectif === 'date' && cibleDate) {
    const kg = Number(cibleDate.kg);
    const jours = Math.max(1, Math.ceil((new Date(cibleDate.date + 'T12:00:00') - aujourdhui) / MS_JOUR));
    const voulu = (p.poids_kg - kg) / (jours / 7);               // kg par semaine, positif = perte
    const maxi = Math.min(RYTHME_MAX_KG_SEMAINE, p.poids_kg * 0.01);
    rythme = veutMaigrir ? Math.min(voulu, maxi) : Math.max(voulu, -RYTHME_PRISE_MAX);
    if (rythme !== voulu) {
      const semaines = Math.ceil(Math.abs(p.poids_kg - kg) / Math.abs(rythme));
      dateAtteinte = new Date(aujourdhui.getTime() + semaines * 7 * MS_JOUR).toISOString().slice(0, 10);
      messages.push(`Pour atteindre ${String(kg).replace('.', ',')} kg à cette date, il faudrait ${veutMaigrir ? 'perdre' : 'prendre'} ${String(Math.round(Math.abs(voulu) * 10) / 10).replace('.', ',')} kg par semaine : c'est trop rapide pour votre santé. Nous visons ${String(Math.round(Math.abs(rythme) * 100) / 100).replace('.', ',')} kg par semaine, soit le ${dateAtteinte.split('-').reverse().join('/')}.`);
    }
    if (amincissant) ajustement = -Math.min(0.2, (rythme * 7700) / 7 / tdee);
    else ajustement = Math.min(0.15, (-rythme * 7700) / 7 / tdee);
  }
  let cible = tdee * (1 + ajustement);
  if (trimestre === 2) cible += 340;
  if (trimestre === 3) cible += 450;
  if (p.allaitement) cible += 500;
  if (ajustement < 0) {
    const plancher = Math.max(bmr, PLANCHER_KCAL[p.sexe] ?? 1500);
    if (cible < plancher) {
      cible = plancher;
      messages.push('L\'apport a été relevé au minimum de sécurité : en dessous, un régime ne serait pas raisonnable.');
    }
  }
  // Garde-fous de sécurité : 2e et 3e trimestres ou allaitement : au moins 1 800 kcal ; dans tous les cas : au moins 1 200 kcal
  if ((trimestre >= 2 || p.allaitement) && cible < 1800) {
    cible = 1800;
    messages.push('Pendant la grossesse (2e et 3e trimestres) ou l\'allaitement, l\'apport conseillé ne descend pas sous 1 800 kcal par jour.');
  } else if (cible < 1200) {
    cible = 1200;
    messages.push('L\'apport conseillé ne descend jamais sous 1 200 kcal par jour.');
  }
  cible = arrondir(cible, 10);

  let parKg = 1.0;
  if (age >= 65) parKg = Math.max(parKg, 1.2);
  if (p.sportif || objectif === 'sport' || objectif === 'perte' || objectif === 'seche') parKg = Math.max(parKg, 1.6);
  if (objectif === 'prise' || (objectif === 'date' && !amincissant && cibleDate)) parKg = Math.max(parKg, 1.8);
  if (amincissant) parKg = Math.max(parKg, 1.6);
  if (trimestre > 0) parKg = Math.max(parKg, 1.1);
  if (p.allaitement) parKg = Math.max(parKg, 1.3);
  const proteines_g = Math.round(p.poids_kg * parKg);
  const lipides_g = Math.round((cible * 0.30) / 9);
  const glucides_g = Math.max(0, Math.round((cible - proteines_g * 4 - lipides_g * 9) / 4));

  return {
    bmr, tdee, cible, objectif, imc, proteines_g, lipides_g, glucides_g, rythme, dateAtteinte,
    fibres_g: cible > 2500 ? 30 : 25,
    sel_max_g: 5,
    messages,
  };
}
