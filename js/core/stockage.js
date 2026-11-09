// Stockage local (mode sans Firebase). Tout reste sur l'appareil.
const PREFIXE = 'nutricoach.';

export function lire(cle, defaut) {
  try {
    const v = localStorage.getItem(PREFIXE + cle);
    return v == null ? defaut : JSON.parse(v);
  } catch { return defaut; }
}

export function ecrire(cle, valeur) {
  try { localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur)); return true; } catch { return false; }
}
