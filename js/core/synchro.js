// Conversions entre l'état de l'appli et les documents Firestore. Fonctions pures, testées.
import { profilVide } from '../lib/profils.js';

export const PERSONNES_IDS = ['E', 'M'];

/** Identifiant du document favori : une ligne par recette et par personne. */
export const idFavori = (recette, qui) => `${recette}_${qui}`;
export const donneesFavori = (recette, qui) => ({ recette, par: qui, t: Date.now() });

/** Documents « favorites » → [{ recette, par }] (documents invalides ignorés, doublons retirés). */
export function docsVersFavoris(docs) {
  const vus = new Set();
  const liste = [];
  for (const d of docs) {
    if (!/^REC-\d+$/.test(d.recette) || !PERSONNES_IDS.includes(d.par)) continue;
    const cle = idFavori(d.recette, d.par);
    if (!vus.has(cle)) { vus.add(cle); liste.push({ recette: d.recette, par: d.par }); }
  }
  return liste;
}

/** Favoris de l'autre et les miens : Map recette → ['E', 'M'] (ordre stable). */
export function favorisParRecette(favoris) {
  const m = new Map();
  for (const { recette, par } of favoris) m.set(recette, [...(m.get(recette) || []), par].sort());
  return m;
}

const CHAMPS_PROFIL = ['sexe', 'age', 'poids_kg', 'taille_cm', 'activite', 'objectif', 'grossesse', 'allaitement',
  'sportif', 'convalescence', 'conditions', 'regimes', 'allergenes', 'exclusions', 'appliquer', 'modifie'];

/** Profil → document Firestore : seuls les champs connus, jamais de valeur undefined. */
export function profilVersDoc(p) {
  const v = profilVide(p.id);
  const doc = { id: p.id };
  for (const c of CHAMPS_PROFIL) doc[c] = p[c] === undefined ? v[c] : p[c];
  return doc;
}
export const docVersProfil = (id, d) => ({ ...profilVide(id), ...Object.fromEntries(CHAMPS_PROFIL.filter((c) => d[c] !== undefined).map((c) => [c, d[c]])), id });

/** Qui a raison en cas de modification des deux côtés : la plus récente gagne (« dernière modification gagnante »). */
export function choisirVersion(local, nuage) {
  const l = (local && local.modifie) || 0;
  const n = (nuage && nuage.modifie) || 0;
  if (n > l) return 'nuage';
  if (l > n) return 'local';
  return 'identique';
}
