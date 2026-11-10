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

const MAX_CACHE = 1700;   // toutes les recettes du catalogue (une entrée = une URL et un crédit)
let memoire = null;                      // cache lu une fois en mémoire (la liste interroge souvent)
const cacheLu = () => { if (!memoire) memoire = lire('photos', {}) || {}; return memoire; };
const cacheEcrit = (c) => { memoire = c; ecrire('photos', c); };
export const photoEnCache = (id) => cacheLu()[id] || null;
/** Photo trouvée par l'autre téléphone (ou null). */
export const photoPartagee = (id) => { const p = partage && partage.lire(id); return p && p.url ? p : null; };

// ---------- Quotas gratuits : suivis séparément pour chaque fournisseur (heure glissante) ----------
// Plafonds d'usage : une marge est gardée pour les fiches (les miniatures s'arrêtent avant la limite du fournisseur).
export const LIMITES = { pexels: { total: 190, miniatures: 150 }, unsplash: { total: 45, miniatures: 30 } };
/** Fenêtre d'une heure glissante : { debut, n } → { autorise, etat } (pure, testée). */
export function quotaFournisseur(etat, maintenant, limite) {
  const e = etat && maintenant - etat.debut < 3600000 ? etat : { debut: maintenant, n: 0 };
  return { autorise: e.n < limite, etat: e };
}
export const MINIATURES_PAR_HEURE = LIMITES.unsplash.miniatures + LIMITES.pexels.miniatures;
export const quotaMiniatures = quotaFournisseur;
const lireQuota = () => lire('photos.quota', {}) || {};
/** Reste-t-il du quota chez ce fournisseur ? (`miniature` : plafond plus bas, pour garder de la marge aux fiches) */
export function quotaDisponible(f, miniature, maintenant = Date.now()) {
  const q = quotaFournisseur(lireQuota()[f], maintenant, LIMITES[f][miniature ? 'miniatures' : 'total']);
  return q.autorise;
}
function compter(f, maintenant = Date.now()) {
  const tout = lireQuota();
  const q = quotaFournisseur(tout[f], maintenant, Infinity);
  tout[f] = { ...q.etat, n: q.etat.n + 1 };
  ecrire('photos.quota', tout);
}
/** Au moins un fournisseur équipé d'une clé a-t-il du quota pour des miniatures ? (sert à arrêter un préchargement) */
export function peutChercherMiniature() {
  const reg = chargerReglagesPhotos();
  return reg.miniatures && ordreFournisseurs(reg).some((f) => quotaDisponible(f, true));
}

// ---------- Photos partagées entre les deux téléphones (via Firestore : un document par recette) ----------
let partage = null;
/** `partage` : { lire(id) → photo | undefined, ecrire(id, photo) } fourni par l'appli quand elle est connectée. */
export const definirPartage = (p) => { partage = p; };
/** Deux recherches au plus en même temps : faire défiler la liste ne déclenche pas une rafale. */
let actives = 0;
const attente = [];
function enFile(travail) {
  return new Promise((ok, ko) => {
    const lancer = () => { actives++; travail().then(ok, ko).finally(() => { actives--; const suite = attente.shift(); if (suite) suite(); }); };
    if (actives < 2) lancer(); else attente.push(lancer);
  });
}

/** Recherche réseau d'une photo : fournisseur principal puis l'autre, chacun dans la limite de son quota. */
async function chercher(recette, appeler, miniature) {
  const reg = chargerReglagesPhotos();
  const ordre = ordreFournisseurs(reg);
  if (!ordre.length) return null;
  let derniereErreur = null;
  let photo = null;
  let reponduSansPhoto = false;
  let quotaEpuise = false;
  for (const f of ordre) {
    if (!quotaDisponible(f, miniature)) { quotaEpuise = true; continue; }       // plafond atteint chez ce fournisseur : on passe au suivant
    compter(f);
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
  if (!photo && !reponduSansPhoto) {
    if (derniereErreur) throw derniereErreur;                                     // tout a échoué : on réessaiera plus tard (rien en cache)
    if (quotaEpuise) { if (miniature) return null; throw new Error(messageErreurPhotos(429)); }
  }
  const cache = { ...cacheLu() };
  cache[recette.id] = photo || { url: null };
  const ids = Object.keys(cache);
  if (ids.length > MAX_CACHE) delete cache[ids[0]];
  cacheEcrit(cache);
  if (photo && partage) partage.ecrire(recette.id, photo);                         // l'autre téléphone n'aura pas à la chercher
  return photo;
}

/**
 * Photo d'une recette : cache, puis photo trouvée par l'autre téléphone, puis recherche (principal puis relais).
 * `miniature` : liste de recettes (plafond plus bas, deux recherches à la fois). Retourne la photo ou null ;
 * lève une Error lisible si les recherches ont échoué.
 */
export async function photoDeRecette(recette, appeler = fetch, { miniature = false } = {}) {
  const dejaLa = photoEnCache(recette.id);
  if (dejaLa) return dejaLa.url ? dejaLa : null;                 // « aucune photo » est aussi mémorisé
  const partagee = partage && partage.lire(recette.id);
  if (partagee && partagee.url) { cacheEcrit({ ...cacheLu(), [recette.id]: partagee }); return partagee; }
  if (!miniature) return chercher(recette, appeler, false);
  if (!chargerReglagesPhotos().miniatures) return null;
  return enFile(() => chercher(recette, appeler, true));
}
