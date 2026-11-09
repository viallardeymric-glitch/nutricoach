// Profil d'une personne : validation, profils à risque, filtres et alertes pour les recettes.
import { normaliser } from './texte.js';

export const LIMITES = {
  age: [18, 100], poids_kg: [35, 250], taille_cm: [120, 230],
};
const ETIQUETTES = { age: 'L\'âge', poids_kg: 'Le poids', taille_cm: 'La taille' };

/** Retourne { champ: message } pour chaque valeur manquante ou hors limites ; objet vide = profil complet. */
export function validerProfil(p) {
  const erreurs = {};
  if (p.sexe !== 'homme' && p.sexe !== 'femme') erreurs.sexe = 'Choisissez homme ou femme.';
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
  if (p.age >= 65) r.add('senior');
  const c = p.conditions || [];
  if (c.includes('diabete') || (p.regimes || []).includes('diabetique')) r.add('diabetique');
  if (c.includes('hypertension')) r.add('hypertendu');
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
  const ingr = normaliser(recette.ingredients.map((i) => i.aliment).join(' | ') + ' | ' + recette.titre);
  return {
    alertes: alertesProfil(recette, p),
    allergenes: f.allergenes.filter((a) => (recette.allergenes || []).includes(a)),
    regimes: f.regimes.filter((g) => !(recette.regimes_compatibles || []).includes(g)),
    exclusions: f.exclusions.filter((x) => ingr.includes(x)),
  };
}

export function profilVide(id) {
  return {
    id, sexe: '', age: '', poids_kg: '', taille_cm: '', activite: 'legere', objectif: 'equilibre',
    grossesse: 0, allaitement: false, sportif: false, convalescence: false,
    conditions: [], regimes: [], allergenes: [], exclusions: '', appliquer: true, modifie: 0,
  };
}
