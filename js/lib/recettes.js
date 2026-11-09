// Recherche et filtres sur l'index léger. Fonctions pures, sans DOM.
import { normaliser } from './texte.js';

export const FILTRES_VIDES = Object.freeze({
  q: '', categories: [], regimes: [], allergenes: [], tempsMax: null,
  difficultes: [], saisons: [], appareils: [], favoris: false,
  exclusions: [], // aliments à éviter (mots normalisés) : voir listeExclusions
});

/** Ajoute à chaque entrée de l'index les textes normalisés utilisés par la recherche et les exclusions. */
export function preparerRecettes(liste) {
  return liste.map((r) => ({
    ...r,
    _titre: normaliser(r.titre),
    _autres: normaliser([...r.ingredients, ...r.tags].join(' | ')),
    _ingr: normaliser(r.ingredients.join(' | ')),
  }));
}

/** Nombre de filtres actifs (hors texte de recherche). */
export function nombreFiltres(f) {
  return f.categories.length + f.regimes.length + f.allergenes.length + (f.tempsMax ? 1 : 0)
    + f.difficultes.length + f.saisons.length + f.appareils.length + (f.favoris ? 1 : 0);
}

/**
 * RÈGLE DE SÉCURITÉ : un allergène exclu écarte toute recette qui le contient, sans exception.
 * Si la liste d'allergènes d'une recette est absente ou illisible, on suppose qu'elle en contient (on écarte).
 */
export function contientAllergene(recette, allergenes) {
  if (!allergenes.length) return false;
  if (!Array.isArray(recette.allergenes)) return true;
  return allergenes.some((a) => recette.allergenes.includes(a));
}

function mots(q) {
  return normaliser(q).split(/[^a-z0-9]+/).filter(Boolean)
    .map((m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m));
}

/**
 * Applique la recherche (titre, ingrédients, tags) et les filtres cumulables.
 * Les critères se combinent par « et » ; plusieurs valeurs d'un même critère (catégorie, difficulté,
 * saison, appareil) se combinent par « ou » ; plusieurs régimes doivent être tous respectés.
 * `recettes` : entrées de l'index avec _titre et _autres (texte normalisé), voir core/catalogue.js.
 */
export function filtrerRecettes(recettes, f, favoris = new Set()) {
  const jetons = mots(f.q);
  const resultats = recettes.filter((r) =>
    !contientAllergene(r, f.allergenes)
    && (!f.categories.length || f.categories.includes(r.categorie))
    && f.regimes.every((g) => r.regimes.includes(g))
    && (!f.tempsMax || r.temps <= f.tempsMax)
    && (!f.difficultes.length || f.difficultes.includes(r.difficulte))
    && (!f.saisons.length || f.saisons.some((s) => r.saisons.includes(s) || r.saisons.includes('toute_annee')))
    && (!f.appareils.length || f.appareils.some((a) => r.appareils.includes(a)))
    && (!f.favoris || favoris.has(r.id))
    && !(f.exclusions || []).some((x) => (r._ingr || '').includes(x) || r._titre.includes(x))
    && jetons.every((j) => r._titre.includes(j) || r._autres.includes(j)));
  if (!jetons.length) return resultats;
  // Les recettes dont le titre contient tous les mots passent devant (ordre conservé sinon).
  const dansTitre = (r) => jetons.every((j) => r._titre.includes(j));
  return [...resultats.filter(dansTitre), ...resultats.filter((r) => !dansTitre(r))];
}

/** Ajoute ou retire une valeur d'une liste (pour les pastilles-filtres). */
export function basculer(liste, valeur) {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}
