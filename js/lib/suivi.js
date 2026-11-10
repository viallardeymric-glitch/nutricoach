// Suivi : journal alimentaire, hydratation, poids, bilans. Fonctions pures, testées dans tests/suivi.test.mjs.
import { cleDate, dateDepuisCle, ajouterJours } from './planning.js';

export const REPAS_JOURNAL = [
  { id: 'petit_dejeuner', nom: 'Petit-déjeuner', icone: '🥐' },
  { id: 'dejeuner', nom: 'Déjeuner', icone: '☀️' },
  { id: 'diner', nom: 'Dîner', icone: '🌙' },
  { id: 'collation', nom: 'Collations', icone: '🍎' },
];
export const VERRE_ML = 250;

/** Repas probable selon l'heure (pour préremplir « j'ai mangé »). */
export function repasSelonHeure(date = new Date()) {
  const h = date.getHours();
  return h < 10 ? 'petit_dejeuner' : h < 15 ? 'dejeuner' : h < 17 ? 'collation' : h < 22 ? 'diner' : 'collation';
}

const arr = (v) => Math.round(v * 10) / 10;

/** Entrée de journal pour `portions` d'une recette (entrée d'index : kcal et nut par portion). */
export function entreeDepuisRecette(r, portions, repas, qui, date) {
  return { type: 'repas', date, repas, par: qui, nom: r.titre, kcal: Math.round(r.kcal * portions), p: arr(r.nut.p * portions), g: arr(r.nut.g * portions), l: arr(r.nut.l * portions),
    source: 'recette', ref: r.id, portion: `${portions} portion${portions > 1 ? 's' : ''}` };
}
/** Entrée de journal pour `grammes` d'un produit scanné (nutrition pour 100 g). */
export function entreeDepuisProduit(p, grammes, repas, qui, date) {
  const f = grammes / 100;
  const n = p.nutrition || {};
  return { type: 'repas', date, repas, par: qui, nom: p.nom, kcal: Math.round((n.kcal || 0) * f), p: arr((n.proteines || 0) * f), g: arr((n.glucides ?? n.sucres ?? 0) * f), l: arr((n.graisses ?? n.satures ?? 0) * f),
    source: 'scan', ref: p.code, portion: `${grammes} g` };
}

/** Totaux d'une journée pour une personne : { kcal, p, g, l, eau, repas: { id: [entrées] } }. */
export function bilanJour(entrees, date, qui) {
  const b = { kcal: 0, p: 0, g: 0, l: 0, eau: 0, repas: Object.fromEntries(REPAS_JOURNAL.map((r) => [r.id, []])) };
  for (const e of entrees) {
    if (e.date !== date || e.par !== qui) continue;
    if (e.type === 'eau') { b.eau += e.ml || 0; continue; }
    b.kcal += e.kcal || 0; b.p += e.p || 0; b.g += e.g || 0; b.l += e.l || 0;
    (b.repas[e.repas] || b.repas.collation).push(e);
  }
  b.p = arr(b.p); b.g = arr(b.g); b.l = arr(b.l);
  return b;
}

/** Objectif d'hydratation (ml) : 30 ml par kg, + sport et allaitement, entre 1,5 et 3,5 L. */
export function objectifEau(profil) {
  const kg = Number(profil && profil.poids_kg) || 65;
  let ml = kg * 30;
  if (profil && profil.sportif) ml += 500;
  if (profil && profil.allaitement) ml += 500;
  if (profil && profil.grossesse > 0) ml += 300;
  return Math.round(Math.max(1500, Math.min(3500, ml)) / 50) * 50;
}

// ---------- Poids ----------
export const MESURES = { tour_taille: 'Tour de taille', hanches: 'Hanches', poitrine: 'Poitrine', bras: 'Bras', cuisse: 'Cuisse' };

/** Points de poids d'une personne triés par date : [{ date, kg, ...mensurations }]. */
export function serieDePoids(poids, qui) {
  return poids.filter((p) => p.par === qui && Number.isFinite(p.kg)).sort((a, b) => a.date.localeCompare(b.date));
}
/** Moyenne mobile sur 7 jours (lisse les variations d'eau) : une valeur par point. */
export function tendancePoids(serie, fenetre = 7) {
  return serie.map((p, i) => {
    const d0 = ajouterJours(dateDepuisCle(p.date), -(fenetre - 1));
    const voisins = serie.slice(0, i + 1).filter((x) => dateDepuisCle(x.date) >= d0);
    return { date: p.date, kg: arr(voisins.reduce((s, x) => s + x.kg, 0) / voisins.length) };
  });
}
/** Variation (kg) entre le premier point de la période et le dernier ; null s'il manque de données. */
export function variationPoids(serie, jours, aujourdhui = new Date()) {
  const debut = cleDate(ajouterJours(aujourdhui, -jours));
  const dans = serie.filter((p) => p.date >= debut);
  if (dans.length < 2) return null;
  return arr(dans[dans.length - 1].kg - dans[0].kg);
}

/** Chemin SVG d'une courbe dans un cadre w × h (valeurs min/max communes à plusieurs séries). */
export function cheminCourbe(points, { w, h, min, max, debut, fin }) {
  if (!points.length) return '';
  const span = Math.max(1, fin - debut);
  const y = (v) => h - ((v - min) / Math.max(0.1, max - min)) * h;
  return points.map((p, i) => `${i ? 'L' : 'M'}${(((dateDepuisCle(p.date).getTime() - debut) / span) * w).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
}

// ---------- Bilan de la semaine ----------
/**
 * Bilan sur 7 jours pour une personne : moyennes, jours « dans la cible » (±10 %), eau, série de suivi, variation de poids
 * et messages bienveillants (jamais culpabilisants) + suggestion d'ajustement.
 */
export function bilanSemaine(entrees, poids, qui, cibleKcal, objectifEauMl, jours, objectif) {
  const parJour = jours.map((j) => bilanJour(entrees, j, qui));
  const suivis = parJour.filter((b) => b.kcal > 0);
  const moyenne = (k) => (suivis.length ? Math.round(suivis.reduce((s, b) => s + b[k], 0) / suivis.length) : 0);
  const kcal = moyenne('kcal');
  const dansCible = suivis.filter((b) => Math.abs(b.kcal - cibleKcal) <= cibleKcal * 0.1).length;
  const eauJours = parJour.filter((b) => b.eau > 0);
  const eau = eauJours.length ? Math.round(eauJours.reduce((s, b) => s + b.eau, 0) / eauJours.length) : 0;
  const serie = serieDePoids(poids, qui);
  const variation = variationPoids(serie, 7, dateDepuisCle(jours[jours.length - 1]));
  const messages = [];
  const suggestions = [];
  if (suivis.length === 0) messages.push('Aucun repas noté cette semaine : ce n\'est pas grave, on repart quand vous voulez.');
  else {
    messages.push(`${suivis.length} jour${suivis.length > 1 ? 's' : ''} suivi${suivis.length > 1 ? 's' : ''} sur ${jours.length} : bravo pour la régularité.`);
    if (dansCible >= Math.ceil(suivis.length / 2)) messages.push(`${dansCible} jour${dansCible > 1 ? 's' : ''} dans votre cible calorique.`);
    const ecart = kcal - cibleKcal;
    if (Math.abs(ecart) > cibleKcal * 0.1) {
      if (ecart > 0) suggestions.push(`Vous êtes en moyenne ${ecart} kcal au-dessus de votre cible. Choisissez des portions un peu plus petites ou plus de légumes, sans vous priver.`);
      else suggestions.push(`Vous êtes en moyenne ${-ecart} kcal en dessous de votre cible. Pensez à une collation : manger trop peu fatigue et ralentit les progrès.`);
    }
  }
  if (eau && eau < objectifEauMl * 0.7) suggestions.push('Un verre d\'eau de plus à chaque repas vous rapprocherait de votre objectif d\'hydratation.');
  if (variation !== null && objectif === 'perte' && variation > 0.5) suggestions.push('Le poids fluctue d\'un jour à l\'autre : regardez la tendance sur plusieurs semaines plutôt que le chiffre du jour.');
  return { jours: parJour, suivis: suivis.length, kcal, dansCible, proteines: moyenne('p'), eau, variation, messages, suggestions };
}

/** Série de jours consécutifs suivis jusqu'à aujourd'hui (une journée sans rien noté n'est pas un échec : on compte depuis hier si besoin). */
export function serieDeSuivi(entrees, qui, aujourdhui = new Date()) {
  const dates = new Set(entrees.filter((e) => e.par === qui && e.type !== 'eau').map((e) => e.date));
  let d = aujourdhui;
  if (!dates.has(cleDate(d))) d = ajouterJours(d, -1);
  let n = 0;
  while (dates.has(cleDate(d))) { n++; d = ajouterJours(d, -1); }
  return n;
}
