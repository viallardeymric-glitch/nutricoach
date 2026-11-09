// Favoris : liste d'identifiants de recettes, gardée sur l'appareil.
import { lire, ecrire } from './stockage.js';

export function chargerFavoris() {
  const v = lire('favoris', []);
  return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
}

/** Retourne un nouvel ensemble avec le favori ajouté ou retiré, et l'enregistre. */
export function basculerFavori(favoris, id) {
  const suivant = new Set(favoris);
  if (!suivant.delete(id)) suivant.add(id);
  ecrire('favoris', [...suivant]);
  return suivant;
}
