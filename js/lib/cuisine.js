// Mode cuisine : lecture des durées d'étape pour le minuteur.

/**
 * « 20 min », « 30 sec », « 1 h 30 », « 5 à 7 min », « 45 minutes » → secondes (null si aucune durée).
 * Pour une fourchette (« 5 à 7 min ») on prend la valeur haute.
 */
export function dureeEnSecondes(texte) {
  if (!texte) return null;
  const t = String(texte).toLowerCase().replace(',', '.');
  const heures = /(\d+(?:\.\d+)?)\s*h(?:eures?)?\b/.exec(t);
  const fourchette = /(\d+(?:\.\d+)?)\s*(?:à|a|-|–)\s*(\d+(?:\.\d+)?)\s*(min|sec|s\b)/.exec(t);
  let secondes = 0;
  if (heures) {
    secondes += Number(heures[1]) * 3600;
    // « 1 h 30 » : les minutes suivent l'heure sans unité.
    const suite = /^\s*(\d{1,2})\b(?!\s*(?:min|sec|s\b|h))/.exec(t.slice(heures.index + heures[0].length));
    if (suite) secondes += Number(suite[1]) * 60;
  }
  if (fourchette) {
    const v = Number(fourchette[2]);
    secondes += fourchette[3] === 'min' ? v * 60 : v;
  } else {
    const minutes = /(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?)\b/.exec(t);
    const sec = /(\d+(?:\.\d+)?)\s*(?:sec(?:ondes?)?|s)\b/.exec(t);
    if (minutes) secondes += Number(minutes[1]) * 60;
    if (sec) secondes += Number(sec[1]);
  }
  return secondes > 0 ? Math.round(secondes) : null;
}

/** Durée d'une étape : le réglage « duree » s'il existe, sinon une durée citée dans le texte (« pendant 10 minutes »). */
export function dureeEtape(etape) {
  return dureeEnSecondes(etape.reglages && etape.reglages.duree) ?? dureeEnSecondes(etape.texte);
}

export function formaterMinuteur(secondes) {
  const s = Math.max(0, Math.round(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const deux = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${deux(m)}:${deux(r)}` : `${deux(m)}:${deux(r)}`;
}
