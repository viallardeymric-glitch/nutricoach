// Fil d'activité : ce que l'autre personne a fait depuis la dernière visite. Calculé à partir des données partagées
// (pas de notification push : il faudrait un serveur d'envoi, indisponible sur l'offre gratuite).

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Événements de `autre` depuis l'instant `depuis` (ms). sources : { articles, favoris, scans, journal, planning, sessions, poidsVisibles }
 * chacun avec { par, t | modifie } ; retourne [{ type, nombre, texte, icone }] (les types absents sont omis).
 */
export function evenements(sources, autre, depuis) {
  const apres = (x) => (x.t || x.modifie || 0) > depuis;
  const ajouts = (sources.articles || []).filter((a) => a.par === autre && !a.coche && (a.modifie || 0) > depuis && a.source !== 'recette').length;
  const coches = (sources.articles || []).filter((a) => a.cochePar === autre && a.coche && (a.modifie || 0) > depuis).length;
  const favoris = (sources.favoris || []).filter((f) => f.par === autre && apres(f)).length;
  const scans = (sources.scans || []).filter((s) => s.par === autre && apres(s)).length;
  const repas = (sources.journal || []).filter((j) => j.par === autre && j.type !== 'eau' && apres(j)).length;
  const menu = (sources.planning || []).filter((p) => p.par === autre && apres(p)).length;
  const batch = (sources.sessions || []).filter((s) => s.par === autre && apres(s)).length;
  const poids = (sources.poids || []).filter((p) => p.par === autre && apres(p)).length;
  const res = [];
  if (ajouts) res.push({ type: 'ajouts', nombre: ajouts, icone: '🛒', texte: `a ajouté ${pluriel(ajouts, 'article', 'articles')} aux courses` });
  if (coches) res.push({ type: 'coches', nombre: coches, icone: '✅', texte: `a coché ${pluriel(coches, 'article', 'articles')}` });
  if (menu) res.push({ type: 'menu', nombre: menu, icone: '📅', texte: `a modifié le menu (${pluriel(menu, 'jour', 'jours')})` });
  if (favoris) res.push({ type: 'favoris', nombre: favoris, icone: '♥', texte: `a ajouté ${pluriel(favoris, 'recette', 'recettes')} en favori` });
  if (scans) res.push({ type: 'scans', nombre: scans, icone: '📷', texte: `a scanné ${pluriel(scans, 'produit', 'produits')}` });
  if (repas) res.push({ type: 'journal', nombre: repas, icone: '📓', texte: `a noté ${pluriel(repas, 'repas', 'repas')} au journal` });
  if (batch) res.push({ type: 'batch', nombre: batch, icone: '🍱', texte: `a terminé ${pluriel(batch, 'session de batch cooking', 'sessions de batch cooking')}` });
  if (poids) res.push({ type: 'poids', nombre: poids, icone: '⚖️', texte: `a enregistré ${pluriel(poids, 'pesée', 'pesées')}` });
  return res;
}
export const totalEvenements = (evts) => evts.reduce((n, e) => n + e.nombre, 0);
