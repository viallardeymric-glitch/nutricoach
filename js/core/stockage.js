// Stockage local (mode sans Firebase). Tout reste sur l'appareil.
const PREFIXE = 'nutricoach.';

/** Le type de la valeur lue est-il celui de la valeur par défaut ? (tableau, objet simple, texte, nombre, booléen). Sans défaut typé, tout est accepté. */
function memeType(valeur, defaut) {
  if (defaut === null || defaut === undefined) return true;
  if (Array.isArray(defaut)) return Array.isArray(valeur);
  if (typeof defaut === 'object') return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
  return typeof valeur === typeof defaut;
}

/** Lit une valeur locale ; une valeur illisible ou d'un autre type que le défaut (données corrompues) est ignorée au profit du défaut. */
export function lire(cle, defaut) {
  try {
    const v = localStorage.getItem(PREFIXE + cle);
    if (v == null) return defaut;
    const valeur = JSON.parse(v);
    return memeType(valeur, defaut) ? valeur : defaut;
  } catch { return defaut; }
}

export function ecrire(cle, valeur) {
  try { localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur)); return true; } catch { return false; }
}
