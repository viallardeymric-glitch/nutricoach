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

const CHAMPS_PROFIL = ['sexe', 'naissance', 'age', 'poids_kg', 'taille_cm', 'activite', 'objectif', 'grossesse', 'allaitement',
  'sportif', 'convalescence', 'conditions', 'regimes', 'allergenes', 'exclusions', 'appliquer', 'modifie', 'secondaires', 'objectifDate', 'sport'];

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

// ---------- Planning : un document par jour (planning/AAAA-MM-JJ) ----------
const REPAS_IDS = ['dejeuner', 'diner'];

/** Documents « planning » → { 'AAAA-MM-JJ': { dejeuner, diner } } (jours et recettes invalides ignorés). */
export function docsVersPlan(docs) {
  const plan = {};
  for (const d of docs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.id)) continue;
    const jour = {};
    for (const repas of REPAS_IDS) if (/^REC-\d+$/.test(d[repas])) jour[repas] = d[repas];
    if (Object.keys(jour).length) plan[d.id] = jour;
  }
  return plan;
}

/** Repas d'un jour → document Firestore (champs présents seulement). */
export function jourVersDoc(date, repas) {
  const doc = { date, modifie: Date.now() };
  for (const r of REPAS_IDS) if (repas[r]) doc[r] = repas[r];
  return doc;
}

// ---------- Courses (shoppingLists), stock (pantry), scans ----------
// Chaque article est son PROPRE document (shoppingLists/{liste}__{article}) : deux personnes qui cochent ou ajoutent en même
// temps ne s'écrasent jamais. Les listes sont des documents de type « liste » dans la même collection.
export const LISTE_PAR_DEFAUT = { id: 'semaine', nom: 'Courses de la semaine' };
export const idDocArticle = (liste, id) => `${liste}__${id}`;

export function articleVersDoc(a) {
  return {
    kind: 'article', liste: a.liste, id: a.id, nom: String(a.nom).slice(0, 80), quantite: a.quantite, unite: a.unite, rayon: a.rayon || 'autre',
    cle: a.cle || '', coche: Boolean(a.coche), par: a.par || '', cochePar: a.cochePar || '', source: a.source || 'manuel',
    recettes: (a.recettes || []).slice(0, 20), modifie: Date.now(),
  };
}
export function listeVersDoc(l) { return { kind: 'liste', id: l.id, nom: String(l.nom).slice(0, 60), archivee: Boolean(l.archivee), cree: l.cree || Date.now(), par: l.par || '' }; }

/** Documents « shoppingLists » → { listes, articles } ; la liste par défaut existe toujours. */
export function docsVersCourses(docs) {
  const listes = [];
  const articles = [];
  for (const d of docs) {
    if (d.kind === 'liste' && d.id) listes.push({ id: d.id, nom: d.nom || d.id, archivee: Boolean(d.archivee), cree: d.cree || 0, par: d.par || '' });
    else if (d.kind === 'article' && d.liste && d.id && d.nom && typeof d.quantite === 'number') {
      const id = String(d.id).startsWith(d.liste + '__') ? String(d.id).slice(d.liste.length + 2) : d.id;
      articles.push({ id, liste: d.liste, nom: d.nom, quantite: d.quantite, unite: d.unite || 'pièce', rayon: d.rayon || 'autre', cle: d.cle || '',
        coche: Boolean(d.coche), par: d.par || '', cochePar: d.cochePar || '', source: d.source || 'manuel', recettes: d.recettes || [], modifie: d.modifie || 0 });
    }
  }
  if (!listes.some((l) => l.id === LISTE_PAR_DEFAUT.id)) listes.unshift({ ...LISTE_PAR_DEFAUT, archivee: false, cree: 0, par: '' });
  return { listes, articles };
}

export const idDocStock = (cle) => encodeURIComponent(cle).slice(0, 150);
export function stockVersDoc(s) { return { cle: s.cle, nom: String(s.nom).slice(0, 80), quantite: s.quantite, unite: s.unite, rayon: s.rayon || 'autre', maj: Date.now() }; }
export const docsVersStock = (docs) => docs.filter((d) => d.cle && typeof d.quantite === 'number').map((d) => ({ cle: d.cle, nom: d.nom || d.cle, quantite: d.quantite, unite: d.unite, rayon: d.rayon || 'autre' }));

export function scanVersDoc(s) {
  return { code: s.code, produit: s.produit, t: s.t || Date.now(), par: s.par || '', favoriPar: s.favoriPar || [], eviterPar: s.eviterPar || [], saisie: Boolean(s.saisie) };
}
/** Documents « scans » → [{ code, produit, t, par, favoriPar, eviterPar }], les plus récents d'abord. */
export function docsVersScans(docs) {
  return docs.filter((d) => /^\d{8,14}$/.test(d.code || '') && d.produit && d.produit.nom)
    .map((d) => ({ code: d.code, produit: d.produit, t: d.t || 0, par: d.par || '', favoriPar: d.favoriPar || [], eviterPar: d.eviterPar || [], saisie: Boolean(d.saisie) }))
    .sort((a, b) => b.t - a.t);
}

// ---------- Journal alimentaire (journal) et poids (weights) ----------
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export function journalVersDoc(e) {
  const d = { type: e.type === 'eau' ? 'eau' : 'repas', date: e.date, par: e.par, t: e.t || Date.now(), prive: Boolean(e.prive) };
  if (d.type === 'eau') return { ...d, ml: Math.round(e.ml) };
  return { ...d, repas: e.repas || 'collation', nom: String(e.nom).slice(0, 80), kcal: Math.round(e.kcal || 0), p: e.p || 0, g: e.g || 0, l: e.l || 0,
    source: e.source || 'manuel', ref: e.ref || '', portion: e.portion || '' };
}
/** Documents « journal » → entrées valides (id = identifiant du document). */
export function docsVersJournal(docs) {
  return docs.filter((d) => DATE_OK.test(d.date || '') && PERSONNES_IDS.includes(d.par) && (d.type === 'eau' ? d.ml > 0 : d.type === 'repas' && d.nom))
    .map((d) => ({ ...d, kcal: d.kcal || 0, p: d.p || 0, g: d.g || 0, l: d.l || 0, prive: Boolean(d.prive) }));
}
export const idDocPoids = (date, par) => `${date}_${par}`;
export function poidsVersDoc(p) {
  const mesures = {};
  for (const [k, v] of Object.entries(p.mesures || {})) if (Number.isFinite(v) && v > 0) mesures[k] = v;
  return { date: p.date, par: p.par, kg: p.kg, mesures, prive: Boolean(p.prive), t: Date.now() };
}
export function docsVersPoids(docs) {
  return docs.filter((d) => DATE_OK.test(d.date || '') && PERSONNES_IDS.includes(d.par) && Number.isFinite(d.kg) && d.kg > 20 && d.kg < 400)
    .map((d) => ({ id: d.id, date: d.date, par: d.par, kg: d.kg, mesures: d.mesures || {}, prive: Boolean(d.prive) }));
}
/** Ce que `qui` a le droit de voir : tout, sauf les données marquées « privé » de l'autre personne (affichage seulement). */
export const visiblePour = (items, qui) => items.filter((x) => !x.prive || x.par === qui);

// ---------- Enfants du foyer : documents profiles/enfant-xxx ----------
export function enfantVersDoc(e) {
  return { prenom: String(e.prenom).slice(0, 30), naissance: e.naissance || '', allergenes: e.allergenes || [], regimes: e.regimes || [], exclusions: String(e.exclusions || '').slice(0, 200),
    appliquer: e.appliquer !== false, dansMenus: e.dansMenus !== false, modifie: Date.now() };
}
export function docsVersEnfants(docs) {
  return docs.filter((d) => /^enfant-/.test(String(d.id)) && d.prenom && /^\d{4}-\d{2}-\d{2}$/.test(d.naissance || ''))
    .map((d) => ({ id: d.id, prenom: d.prenom, naissance: d.naissance, allergenes: d.allergenes || [], regimes: d.regimes || [], exclusions: d.exclusions || '', appliquer: d.appliquer !== false, dansMenus: d.dansMenus !== false, modifie: d.modifie || 0 }));
}

// ---------- Séances de sport (workouts) ----------
export function seanceVersDoc(s) {
  return { date: s.date, par: s.par, type: ['courte', 'longue', 'fractionne'].includes(s.type) ? s.type : 'courte', duree_min: Math.round(s.duree_min || 0),
    distance_km: Math.round((s.distance_km || 0) * 10) / 10, denivele_m: Math.round(s.denivele_m || 0), source: s.source || 'manuel', t: s.t || Date.now() };
}
export function docsVersSeances(docs) {
  return docs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && PERSONNES_IDS.includes(d.par) && d.duree_min > 0)
    .map((d) => ({ id: d.id, date: d.date, par: d.par, type: d.type, duree_min: d.duree_min, distance_km: d.distance_km || 0, denivele_m: d.denivele_m || 0, source: d.source || 'manuel' }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Sessions de batch cooking (batchSessions) : une session = les plats préparés avec leurs dates limites ----------
export function sessionBatchVersDoc(s) {
  return { date: s.date, par: s.par, t: s.t || Date.now(), plats: (s.plats || []).slice(0, 12).map((p) => ({ recette: p.recette, titre: String(p.titre).slice(0, 80), portions: p.portions, restant: p.restant,
    limiteFrigo: p.limiteFrigo, limiteCongelation: p.limiteCongelation || '', congele: Boolean(p.congele) })) };
}
export function docsVersSessionsBatch(docs) {
  return docs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && Array.isArray(d.plats))
    .map((d) => ({ id: d.id, date: d.date, par: d.par, plats: d.plats.filter((p) => /^REC-\d+$/.test(p.recette || '') && /^\d{4}-\d{2}-\d{2}$/.test(p.limiteFrigo || '')).map((p) => ({ ...p, limiteCongelation: p.limiteCongelation || null })) }));
}
