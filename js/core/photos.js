// Photos des recettes : Pexels ou Unsplash (clé GRATUITE saisie dans les réglages, jamais dans le code).
// Une photo n'est cherchée qu'à l'ouverture d'une fiche, puis gardée en cache sur le téléphone, avec le crédit du photographe.
import { lire, ecrire } from './stockage.js';

export const FOURNISSEURS = {
  pexels: { nom: 'Pexels', site: 'pexels.com/api', delai: '200 photos par heure' },
  unsplash: { nom: 'Unsplash', site: 'unsplash.com/developers', delai: '50 photos par heure' },
};
/** Réglages : { fournisseur (principal), cles: { pexels, unsplash } }. L'ancien format (une seule clé) est repris tel quel. */
export function normaliserReglagesPhotos(brut) {
  const b = brut || {};
  const fournisseur = FOURNISSEURS[b.fournisseur] ? b.fournisseur : 'pexels';
  const cles = { pexels: '', unsplash: '', ...(b.cles || {}) };
  if (b.cle && !cles[fournisseur]) cles[fournisseur] = b.cle;       // ancien format
  return { fournisseur, cles, miniatures: b.miniatures !== false };
}
export const chargerReglagesPhotos = () => normaliserReglagesPhotos(lire('photos.reglages', {}));
/** Fournisseurs à essayer, dans l'ordre : le principal d'abord, puis l'autre, seulement ceux qui ont une clé. */
export const ordreFournisseurs = (reg) => [reg.fournisseur, ...Object.keys(FOURNISSEURS).filter((k) => k !== reg.fournisseur)].filter((k) => reg.cles[k]);
export const enregistrerReglagesPhotos = (r) => ecrire('photos.reglages', r);

const MOTS_VIDES = /\b(au|aux|a|la|le|les|de|du|des|d|l|et|en|avec|sans|sur|façon|facon|maison|petit|petite|petits|petites)\b/gi;
/** « Poulet rôti au thym et aux gousses d'ail » → « poulet rôti thym gousses ail » (3 à 5 mots) + « plat cuisiné ». */
export function requetePhoto(recette) {
  const mots = recette.titre.replace(/['’]/g, ' ').replace(MOTS_VIDES, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
  return `${mots} ${recette.categorie === 'Desserts' || recette.categorie === 'Goûters' ? 'dessert' : 'plat'}`.trim();
}

/** URL et en-têtes de la recherche pour un fournisseur. */
export function construireRequete(fournisseur, requete, cle) {
  const q = encodeURIComponent(requete);
  if (fournisseur === 'unsplash') return { url: `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape`, entetes: { Authorization: `Client-ID ${cle}`, 'Accept-Version': 'v1' } };
  return { url: `https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape&locale=fr-FR`, entetes: { Authorization: cle } };
}

/** Réponse d'un fournisseur → { url, credit, lien, fournisseur, telechargement? } ou null. */
export function lirePhoto(fournisseur, json) {
  if (fournisseur === 'unsplash') {
    const p = json && json.results && json.results[0];
    if (!p || !p.urls) return null;
    return { url: p.urls.regular || p.urls.small, mini: p.urls.small || p.urls.regular, credit: (p.user && p.user.name) || 'Photographe', lien: ((p.user && p.user.links && p.user.links.html) || 'https://unsplash.com') + '?utm_source=nutricoach&utm_medium=referral', fournisseur: 'Unsplash', telechargement: p.links && p.links.download_location };
  }
  const p = json && json.photos && json.photos[0];
  if (!p || !p.src) return null;
  return { url: p.src.large || p.src.medium, mini: p.src.medium || p.src.small || p.src.large, credit: p.photographer || 'Photographe', lien: p.photographer_url || p.url || 'https://www.pexels.com', fournisseur: 'Pexels' };
}

export const messageErreurPhotos = (statut) => (statut === 401 || statut === 403 ? 'La clé de photos est refusée : vérifiez-la dans Profil › Photos.' : statut === 429 ? 'Quota de photos atteint pour cette heure : elles reviendront plus tard.' : 'Photos indisponibles pour le moment.');

const MAX_CACHE = 150;
export const photoEnCache = (id) => (lire('photos', {}) || {})[id] || null;

// ---------- Miniatures de la liste : quota protégé ----------
export const MINIATURES_PAR_HEURE = 40;      // recherches de miniatures par heure (le reste du quota sert aux fiches)
/** Fenêtre d'une heure glissante : { debut, n } → { autorise, etat } (pure, testée). */
export function quotaMiniatures(etat, maintenant, limite = MINIATURES_PAR_HEURE) {
  const e = etat && maintenant - etat.debut < 3600000 ? etat : { debut: maintenant, n: 0 };
  return { autorise: e.n < limite, etat: e };
}
/** Deux recherches au plus en même temps : faire défiler la liste ne déclenche pas une rafale. */
let actives = 0;
const attente = [];
function enFile(travail) {
  return new Promise((ok, ko) => {
    const lancer = () => { actives++; travail().then(ok, ko).finally(() => { actives--; const suite = attente.shift(); if (suite) suite(); }); };
    if (actives < 2) lancer(); else attente.push(lancer);
  });
}

/**
 * Photo d'une recette : cache d'abord, sinon recherche chez le fournisseur principal puis, s'il échoue (quota, clé refusée,
 * aucune photo), chez l'autre. Retourne la photo, null s'il n'y en a pas ; lève une Error lisible si tous ont échoué.
 */
export async function photoDeRecette(recette, appeler = fetch, { miniature = false } = {}) {
  const dejaLa = photoEnCache(recette.id);
  if (dejaLa) return dejaLa.url ? dejaLa : null;                 // « aucune photo » est aussi mémorisé
  const reg = chargerReglagesPhotos();
  if (miniature) {
    if (!reg.miniatures) return null;
    const q = quotaMiniatures(lire('photos.quota', null), Date.now());
    if (!q.autorise) return null;                                // plafond atteint : pictogramme, rien en cache
    ecrire('photos.quota', { ...q.etat, n: q.etat.n + 1 });
    return enFile(() => photoDeRecette(recette, appeler));       // même logique, en file (2 à la fois)
  }
  const ordre = ordreFournisseurs(reg);
  if (!ordre.length) return null;
  let derniereErreur = null;
  let photo = null;
  let reponduSansPhoto = false;
  for (const f of ordre) {
    const { url, entetes } = construireRequete(f, requetePhoto(recette), reg.cles[f]);
    let rep;
    try { rep = await appeler(url, { headers: entetes }); } catch { derniereErreur = new Error(messageErreurPhotos(0)); continue; }
    if (!rep.ok) { derniereErreur = new Error(messageErreurPhotos(rep.status)); continue; }
    photo = lirePhoto(f, await rep.json());
    if (photo) {
      if (photo.telechargement) appeler(photo.telechargement, { headers: entetes }).catch(() => {});   // règle d'Unsplash : signaler l'usage
      break;
    }
    reponduSansPhoto = true;
  }
  if (!photo && derniereErreur && !reponduSansPhoto) throw derniereErreur;   // tout a échoué : on réessaiera plus tard (rien en cache)
  const cache = lire('photos', {}) || {};
  cache[recette.id] = photo || { url: null };
  const ids = Object.keys(cache);
  if (ids.length > MAX_CACHE) delete cache[ids[0]];
  ecrire('photos', cache);
  return photo;
}
