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
    conditions: [], regimes: [], allergenes: [], exclusions: '', appliquer: true, modifie: 0,
  };
}
