// Sauvegarde / restauration des données locales d'un téléphone (fichier JSON). Les secrets n'y entrent JAMAIS :
// code PIN, clé Face ID, clés d'API (coach, photos), compte Open Food Facts. Les caches se recréent tout seuls.
export const EXCLUES = /^nutricoach\.(pin|biometrie|coach\.reglages|coach\.conversation|photos\.reglages|photos\.quota|photos|off\.compte|derniere_visite)$/;
export const TAILLE_MAX = 5 * 1024 * 1024;

export const cleSauvegardable = (k) => typeof k === 'string' && k.startsWith('nutricoach.') && !EXCLUES.test(k);

/** { cle: valeur } des données à sauvegarder. `stockage` : { length, key(i), getItem(k) } (localStorage). */
export function construireSauvegarde(stockage) {
  const copie = {};
  for (let i = 0; i < stockage.length; i++) { const k = stockage.key(i); if (cleSauvegardable(k)) copie[k] = stockage.getItem(k); }
  return copie;
}

/** Texte d'un fichier → { entrees: [[cle, valeur]], ignorees } ou { erreur }. Seules les données valides et non sensibles sont gardées. */
export function lireSauvegarde(texte) {
  if (typeof texte !== 'string' || texte.length > TAILLE_MAX) return { erreur: 'Ce fichier est trop gros pour être une sauvegarde NutriCoach.' };
  let o;
  try { o = JSON.parse(texte); } catch { return { erreur: 'Ce fichier n\'est pas une sauvegarde NutriCoach (JSON illisible).' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { erreur: 'Ce fichier n\'est pas une sauvegarde NutriCoach.' };
  const entrees = []; let ignorees = 0;
  for (const [k, v] of Object.entries(o)) {
    if (!cleSauvegardable(k) || typeof v !== 'string') { ignorees++; continue; }
    try { JSON.parse(v); } catch { ignorees++; continue; }
    entrees.push([k, v]);
  }
  return entrees.length ? { entrees, ignorees } : { erreur: 'Aucune donnée NutriCoach reconnue dans ce fichier.' };
}
