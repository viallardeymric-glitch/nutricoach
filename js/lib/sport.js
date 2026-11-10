// Mode sportif : phases de préparation, besoins du jour selon la charge, charge en glucides, ravitaillement, import de séances.
// Repères généraux de nutrition du sport (IOC / ACSM) : ils ne remplacent pas l'avis d'un médecin ou d'un diététicien du sport.
// Fonctions pures, testées dans tests/sport.test.mjs.
import { cleDate, dateDepuisCle, ajouterJours } from './planning.js';
import { REGIMES_AVANCES } from '../data/regimes.js';

export const EPREUVES = {
  '5k': { nom: '5 km', km: 5, charge: false, dureeH: 0.4 },
  '10k': { nom: '10 km', km: 10, charge: false, dureeH: 0.8 },
  semi: { nom: 'Semi-marathon', km: 21.1, charge: true, dureeH: 1.8 },
  marathon: { nom: 'Marathon', km: 42.195, charge: true, dureeH: 4 },
  trail: { nom: 'Trail', km: 30, charge: true, dureeH: 4 },
  ultra: { nom: 'Ultra', km: 80, charge: true, dureeH: 10 },
  triathlon: { nom: 'Triathlon', km: 0, charge: true, dureeH: 3 },
  velo: { nom: 'Vélo', km: 100, charge: true, dureeH: 4 },
  muscu: { nom: 'Musculation', km: 0, charge: false, dureeH: 1 },
  autre: { nom: 'Autre', km: 0, charge: false, dureeH: 1.5 },
};
export const TYPES_JOUR = { repos: 'Repos', courte: 'Sortie courte', longue: 'Sortie longue', fractionne: 'Fractionné', course: 'Jour de course', recup: 'Récupération' };
export const PHASES = { base: 'Base', developpement: 'Développement', affutage: 'Affûtage', semaine_course: 'Semaine de course', jour_j: 'Jour J', recuperation: 'Récupération', apres: 'Après la récupération' };
const MET = { course: 9, trail: 9.5, velo: 7, triathlon: 8, muscu: 5, autre: 6 };
export const RAPPEL_JOUR_J = 'Ne testez rien de nouveau le jour J : ni aliment, ni boisson, ni gel, ni chaussures. Tout doit avoir été essayé à l\'entraînement.';
export const MENTION_SPORT = 'Repères généraux de nutrition du sport. Ils ne remplacent pas l\'avis d\'un médecin ou d\'un diététicien du sport.';

const jours = (a, b) => Math.round((dateDepuisCle(b) - dateDepuisCle(a)) / 86400000);

/** Phase de préparation d'un jour par rapport à la date de l'épreuve. */
export function phaseDuJour(dateCourse, jour, epreuve = 'marathon') {
  const reste = jours(jour, dateCourse);          // jours avant l'épreuve (négatif après)
  const long = EPREUVES[epreuve] && EPREUVES[epreuve].charge;
  const affut = long ? 21 : 10;                    // durée de l'affûtage
  if (reste < -13) return { phase: 'apres', reste };
  if (reste < 0) return { phase: 'recuperation', reste };
  if (reste === 0) return { phase: 'jour_j', reste };
  if (reste <= 7) return { phase: 'semaine_course', reste };
  if (reste <= affut) return { phase: 'affutage', reste };
  if (reste <= 84) return { phase: 'developpement', reste };
  return { phase: 'base', reste };
}

/** Semaine type quand aucune séance n'est importée : volume ajusté à la phase. */
const SEMAINE_TYPE = ['repos', 'fractionne', 'courte', 'courte', 'repos', 'longue', 'repos'];
const VOLUME = { base: 1, developpement: 1.15, affutage: 0.7, semaine_course: 0.5, jour_j: 0, recuperation: 0.4, apres: 0.8 };

/** Type de journée et durée d'effort (min) : séance importée si elle existe, sinon semaine type. */
export function chargeDuJour(jour, phase, seances, epreuve) {
  const s = (seances || []).filter((x) => x.date === jour);
  if (s.length) {
    const duree = s.reduce((t, x) => t + (x.duree_min || 0), 0);
    const km = s.reduce((t, x) => t + (x.distance_km || 0), 0);
    const type = s.some((x) => x.type === 'fractionne') ? 'fractionne' : (duree >= 90 || km >= 15 ? 'longue' : 'courte');
    return { type, duree_min: duree, source: 'seance' };
  }
  if (phase === 'jour_j') return { type: 'course', duree_min: Math.round((EPREUVES[epreuve] || EPREUVES.autre).dureeH * 60), source: 'plan' };
  if (phase === 'recuperation') return { type: 'recup', duree_min: 20, source: 'plan' };
  const type = SEMAINE_TYPE[(dateDepuisCle(jour).getDay() + 6) % 7];
  const base = { repos: 0, fractionne: 55, courte: 45, longue: 100 }[type];
  return { type, duree_min: Math.round(base * (VOLUME[phase] ?? 1) / 5) * 5, source: 'plan' };
}

/** Dépense d'effort (kcal) pour une durée, un poids et un sport (MET - 1, car le repos est déjà compté). */
export function depenseEffort(dureeMin, poidsKg, sport = 'course') {
  return Math.round(((MET[sport] || 6) - 1) * poidsKg * (dureeMin / 60));
}

/**
 * Besoins d'une journée d'entraînement : calories (base hors sport + effort), glucides selon la charge (g/kg),
 * protéines 1,6 g/kg, lipides pour le reste, eau. `base` : résultat de calculerBesoins (métabolisme et dépense sans sport).
 */
export function besoinsJourSport(profil, base, charge, { chargeGlucides = false, epreuve = 'course', sport = 'course' } = {}) {
  const kg = Number(profil.poids_kg) || 65;
  const horsSport = Math.round(base.bmr * 1.4);
  const effort = depenseEffort(charge.duree_min, kg, sport === 'marathon' || sport === 'semi' || sport === '5k' || sport === '10k' ? 'course' : sport);
  const kcal = Math.round((horsSport + effort) / 10) * 10;
  const parKg = chargeGlucides ? 9 : { repos: 4, courte: 5.5, fractionne: 6.5, longue: 8, course: 8, recup: 6.5 }[charge.type] || 5;
  const glucides_g = Math.round(parKg * kg);
  const proteines_g = Math.round(1.6 * kg);
  const lipides_g = Math.max(Math.round(0.8 * kg), Math.round((kcal - glucides_g * 4 - proteines_g * 4) / 9));
  const eau_ml = Math.round((kg * 30 + charge.duree_min * 10) / 50) * 50;
  return { kcal, glucides_g, proteines_g, lipides_g, eau_ml, glucidesParKg: parKg };
}

/** Stratégie de course : glucides, eau et sodium par heure selon la durée visée (repères IOC/ACSM). */
export function ravitaillement(dureeMin, { chaud = false } = {}) {
  const h = dureeMin / 60;
  let glucides;
  let conseil;
  if (h <= 0.75) { glucides = 0; conseil = 'Effort court : l\'eau suffit, un rinçage de bouche au glucose est possible.'; }
  else if (h <= 2) { glucides = 40; conseil = 'De 30 à 60 g de glucides par heure (gel, boisson, fruit sec).'; }
  else if (h <= 3) { glucides = 60; conseil = 'De 60 g de glucides par heure, en une ou deux sources.'; }
  else { glucides = 80; conseil = 'De 60 à 90 g de glucides par heure : combinez plusieurs sources (glucose et fructose) et habituez votre ventre à l\'entraînement.'; }
  return {
    glucides_h: glucides,
    eau_ml_h: chaud ? 800 : 500,
    sodium_mg_h: chaud ? 700 : 400,
    total_glucides: Math.round(glucides * h),
    total_eau_ml: Math.round((chaud ? 800 : 500) * h / 50) * 50,
    conseil,
  };
}

/** Repas avant l'épreuve : 3 à 4 h avant, 1 à 4 g de glucides par kg, peu de graisses et de fibres. */
export function repasPreCourse(profil, heuresAvant = 3) {
  const kg = Number(profil.poids_kg) || 65;
  const parKg = Math.max(1, Math.min(4, heuresAvant)) * 1;     // 3 h avant → 3 g/kg
  return { heuresAvant, glucides_g: Math.round(parKg * kg), consigne: 'Repas habituel, riche en glucides, pauvre en graisses et en fibres. Rien de nouveau.' };
}

/** Récupération : dans l'heure qui suit, 1 à 1,2 g de glucides et 0,3 g de protéines par kg. */
export function recuperation(profil) {
  const kg = Number(profil.poids_kg) || 65;
  return { glucides_g: Math.round(1.1 * kg), proteines_g: Math.round(0.3 * kg), delaiMin: 60,
    idees: ['Lait chocolaté ou yaourt + banane', 'Smoothie fruits-lait + flocons d\'avoine', 'Riz au lait ou pâtes + œuf ou fromage blanc'] };
}

/**
 * Plan nutritionnel jour par jour depuis `debut` jusqu'à 7 jours après l'épreuve.
 * course : { type, date, distance_km, temps_min, charge_jours (2 ou 3) }. Retourne [{ date, phase, reste, charge, besoins, notes }].
 */
export function planNutritionnel(profil, base, course, debut, seances = []) {
  if (!course || !course.date) return [];
  const ep = EPREUVES[course.type] || EPREUVES.autre;
  const fin = cleDate(ajouterJours(dateDepuisCle(course.date), 7));
  const chargeJours = ep.charge ? (Number(course.charge_jours) || 3) : 0;
  const plan = [];
  for (let d = debut; d <= fin && plan.length < 200; d = cleDate(ajouterJours(dateDepuisCle(d), 1))) {
    const { phase, reste } = phaseDuJour(course.date, d, course.type);
    const charge = chargeDuJour(d, phase, seances, course.type);
    const enCharge = reste > 0 && reste <= chargeJours;
    const b = besoinsJourSport(profil, base, enCharge ? { ...charge, type: 'repos' } : charge, { chargeGlucides: enCharge, sport: course.type });
    const notes = [];
    if (enCharge) notes.push(`Charge en glucides (${b.glucidesParKg} g/kg) : repas riches en féculents, entraînement léger.${reste === 1 ? ' La veille : repas pauvres en fibres, bonne hydratation.' : ''}`);
    if (reste === 1 && !enCharge) notes.push('La veille : repas pauvres en fibres, bonne hydratation.');
    if (phase === 'jour_j') notes.push(RAPPEL_JOUR_J);
    if (phase === 'recuperation' && reste === -1) notes.push('Récupération : glucides + protéines dans l\'heure, hydratez-vous, mangez normalement ensuite.');
    plan.push({ date: d, phase, reste, charge, besoins: b, enCharge, laVeille: reste === 1, notes });
  }
  return plan;
}

// ---------- Recettes pour le sport (règles sur l'entrée d'index) ----------
export const FILTRES_SPORT = {
  pre_effort: REGIMES_AVANCES.sport_pre,
  riche_glucides: REGIMES_AVANCES.sport_glucides,
  recuperation: REGIMES_AVANCES.sport_recup,
  veille: REGIMES_AVANCES.sport_veille,
  hyperproteine: REGIMES_AVANCES.hyperproteine,
};

// ---------- Import de séances ----------
