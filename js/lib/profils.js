// Profil d'une personne : validation, profils à risque, filtres et alertes pour les recettes.
import { normaliser } from './texte.js';
import { respecteRegime } from '../data/regimes.js';
import { entreeIndex } from './index-entree.js';
import { preparerRecettes } from './recettes.js';

export const LIMITES = { poids_kg: [35, 250], taille_cm: [120, 230] };
const ETIQUETTES = { poids_kg: 'Le poids', taille_cm: 'La taille' };
export const AGE_MIN = 18;
export const AGE_MAX = 100;

/** Âge en années pour une date « AAAA-MM-JJ » (null si la date est absente ou impossible). */
export function ageDepuis(naissance, ref = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(naissance || '');
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(a, mo - 1, j);
  if (d.getFullYear() !== a || d.getMonth() !== mo - 1 || d.getDate() !== j) return null;
  let age = ref.getFullYear() - a;
  if (ref.getMonth() < mo - 1 || (ref.getMonth() === mo - 1 && ref.getDate() < j)) age--;
  return age;
}
/** Âge d'un profil : d'après la date de naissance, sinon l'ancien champ « age » (profils créés avant). */
export const ageDe = (p, ref) => (p.naissance ? ageDepuis(p.naissance, ref) : (typeof p.age === 'number' ? p.age : null));

/** Retourne { champ: message } pour chaque valeur manquante ou hors limites ; objet vide = profil complet. */
export function validerProfil(p) {
  const erreurs = {};
  if (p.sexe !== 'homme' && p.sexe !== 'femme') erreurs.sexe = 'Choisissez homme ou femme.';
  const age = ageDe(p);
  if (age === null) erreurs.naissance = 'La date de naissance est à renseigner.';
  else if (age < AGE_MIN) erreurs.naissance = `L'appli est prévue pour les adultes (${AGE_MIN} ans et plus).`;
  else if (age > AGE_MAX) erreurs.naissance = 'Cette date de naissance semble incorrecte.';
  for (const [champ, [min, max]] of Object.entries(LIMITES)) {
    const v = p[champ];
    if (v === '' || v == null || Number.isNaN(Number(v))) erreurs[champ] = `${ETIQUETTES[champ]} est à renseigner.`;
    else if (v < min || v > max) erreurs[champ] = `${ETIQUETTES[champ]} doit être entre ${min} et ${max}.`;
  }
  return erreurs;
}

export const profilComplet = (p) => Object.keys(validerProfil(p)).length === 0;

/** Profils à risque du catalogue (`deconseille_a[].profil`) qui concernent cette personne. */
export function profilsARisque(p) {
  const r = new Set();
  if (p.sexe === 'femme' && p.grossesse > 0) r.add('femme_enceinte');
  if (p.sexe === 'femme' && p.allaitement) r.add('allaitante');
  if (ageDe(p) >= 65) r.add('senior');
  const c = p.conditions || [];
  const rg = p.regimes || [];
  if (c.includes('diabete') || rg.includes('diabetique') || rg.includes('diabete_ig')) r.add('diabetique');
  if (c.includes('hypertension') || rg.includes('hypertension')) r.add('hypertendu');
  if (c.includes('immunodeprime')) r.add('immunodeprime');
  return [...r];
}

/** « coriandre, olives » → ['coriandre', 'olive'] (sans accents, sans pluriel), pour les aliments à éviter. */
export function listeExclusions(texte) {
  return String(texte || '').split(/[,;\n]/).map((m) => normaliser(m).trim())
    .filter(Boolean).map((m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m));
}

/** Filtres imposés par le profil : régimes, allergènes et aliments à éviter (exclusion stricte). */
export function filtresDuProfil(p) {
  if (!p || p.appliquer === false) return { regimes: [], allergenes: [], exclusions: [] };
  return { regimes: p.regimes || [], allergenes: p.allergenes || [], exclusions: listeExclusions(p.exclusions) };
}

/** Avertissements du catalogue (deconseille_a) qui concernent cette personne : [{ profil, raison }]. */
export function alertesProfil(recette, p) {
  if (!p || p.appliquer === false) return [];
  const risques = profilsARisque(p);
  return (recette.deconseille_a || []).filter((d) => risques.includes(d.profil));
}

/**
 * Tout ce qui, dans une fiche complète, ne convient pas à cette personne :
 * { alertes, allergenes, regimes, exclusions } (listes vides si tout va bien).
 */
export function conflitsProfil(recette, p) {
  const f = filtresDuProfil(p);
  const entree = preparerRecettes([entreeIndex(recette)])[0];
  const ingr = normaliser(recette.ingredients.map((i) => i.aliment).join(' | ') + ' | ' + recette.titre);
  return {
    alertes: alertesProfil(recette, p),
    allergenes: f.allergenes.filter((a) => (recette.allergenes || []).includes(a)),
    regimes: f.regimes.filter((g) => !respecteRegime(entree, g)),
    exclusions: f.exclusions.filter((x) => ingr.includes(x)),
  };
}

export function profilVide(id) {
  return {
    id, sexe: '', naissance: '', age: null, poids_kg: '', taille_cm: '', activite: 'legere', objectif: 'equilibre',
    grossesse: 0, allaitement: false, sportif: false, convalescence: false,
    conditions: [], regimes: [], allergenes: [], exclusions: '', appliquer: true, modifie: 0, secondaires: [], objectifDate: null, sport: null,
  };
}

// ---------- Enfants du foyer (profils sans compte) ----------
/** Âge en mois d'une date « AAAA-MM-JJ » (null si absente ou invalide). */
export function ageEnMois(naissance, ref = new Date()) {
  const a = ageDepuis(naissance, ref);
  if (a === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(naissance);
  let mois = (ref.getFullYear() - Number(m[1])) * 12 + (ref.getMonth() - (Number(m[2]) - 1));
  if (ref.getDate() < Number(m[3])) mois--;
  return Math.max(0, mois);
}
/** Groupe d'âge : bebe (< 1 an), petit (1 à 2 ans), enfant (3 à 12 ans), ado (13 à 17 ans), adulte. */
export function groupeAge(naissance, ref = new Date()) {
  const mois = ageEnMois(naissance, ref);
  if (mois === null) return null;
  return mois < 12 ? 'bebe' : mois < 36 ? 'petit' : mois < 156 ? 'enfant' : mois < 216 ? 'ado' : 'adulte';
}
export const GROUPES_AGE = { bebe: 'Bébé', petit: 'Petit enfant', enfant: 'Enfant', ado: 'Adolescent', adulte: 'Adulte' };
/** Part d'une portion adulte mangée par un enfant (pour les quantités des courses). */
export const FACTEUR_PORTION = { bebe: 0.25, petit: 0.4, enfant: 0.6, ado: 1, adulte: 1 };

/** Profils à risque d'un enfant (mêmes clés que le catalogue + « bebe » pour les règles propres aux moins d'un an). */
export function risquesEnfant(e, ref = new Date()) {
  const g = groupeAge(e.naissance, ref);
  const r = new Set();
  if (g === 'bebe') { r.add('bebe'); r.add('enfant_moins_de_3_ans'); r.add('enfant'); }
  else if (g === 'petit') { r.add('enfant_moins_de_3_ans'); r.add('enfant'); }
  else if (g === 'enfant') r.add('enfant');
  return [...r];
}
export function enfantVide(id) { return { id, prenom: '', naissance: '', allergenes: [], regimes: [], exclusions: '', appliquer: true, dansMenus: true, modifie: 0 }; }

/** Nombre de convives d'un repas : les adultes comptent 1, les enfants une fraction (voir FACTEUR_PORTION). */
export function nombreConvives(adultes, enfants, ref = new Date()) {
  const n = adultes + enfants.filter((e) => e.dansMenus !== false).reduce((s, e) => s + (FACTEUR_PORTION[groupeAge(e.naissance, ref)] ?? 0.6), 0);
  return Math.round(n * 10) / 10;
}
/** Portion conseillée d'une recette pour une cible de repas (kcal), par pas de 0,25, entre 0,25 et 2. */
export function portionConseillee(kcalParPortion, cibleRepas) {
  if (!(kcalParPortion > 0) || !(cibleRepas > 0)) return 1;
  return Math.max(0.25, Math.min(2, Math.round((cibleRepas / kcalParPortion) * 4) / 4));
}

/** Profils à risque d'une personne : adulte (profilsARisque) ou enfant du foyer (risquesEnfant). */
export const risquesPour = (p) => (p && p.prenom !== undefined ? risquesEnfant(p) : profilsARisque(p));

/** Repère de besoin énergétique d'un enfant (kcal par jour) selon l'âge : ordre de grandeur, pas une prescription. */
export function kcalRepereEnfant(naissance, ref = new Date()) {
  const m = ageEnMois(naissance, ref);
  if (m === null) return 1500;
  const a = m / 12;
  return a < 1 ? 800 : a < 3 ? 1100 : a < 6 ? 1400 : a < 10 ? 1700 : a < 13 ? 2000 : 2400;
}
