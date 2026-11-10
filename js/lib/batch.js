// Batch cooking : choix des recettes depuis le menu, quantités fusionnées, planning chronométré avec tâches en parallèle,
// conditionnement (boîtes, étiquettes, conservation) et stock de plats préparés. Fonctions pures, testées.
import { dureeEtape } from './cuisine.js';
import { fusionner, arrondirCourses } from './courses.js';
import { cleDate, dateDepuisCle, ajouterJours } from './planning.js';

const DUREE_ACTIVE_PAR_DEFAUT = 4;      // minutes pour une étape sans durée indiquée
const PRECHAUFFAGE_MIN = 10;

/** Recettes du menu des prochains jours, du plus fréquent au moins fréquent (sans doublon). */
export function recettesDuMenu(plan, jours, max = 5) {
  const n = new Map();
  for (const j of jours) for (const id of Object.values(plan[j] || {})) n.set(id, (n.get(id) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}

/** Nombre de fois que chaque recette revient dans le menu des jours donnés : { id: repas }. */
export function comptesDuMenu(plan, jours) {
  const n = {};
  for (const j of jours) for (const id of Object.values(plan[j] || {})) n[id] = (n[id] || 0) + 1;
  return n;
}

/** Portions à cuisiner pour `repas` repas de `portionsParRepas` portions (une par personne de la famille), arrondies au-dessus. */
export const portionsPourRepas = (repas, portionsParRepas) => Math.max(1, Math.ceil(repas * portionsParRepas));

/** Courses de la session : quantités des recettes multipliées (portions / portions de base), fusionnées. selection : [{ recette (fiche), portions }]. */
export function articlesBatch(selection) {
  const lignes = [];
  for (const { recette, portions } of selection) {
    const f = portions / recette.portions_base;
    for (const i of recette.ingredients) lignes.push({ aliment: i.aliment, quantite: i.quantite * f, unite: i.unite, recette: recette.id });
  }
  return fusionner(lignes).map((a) => ({ ...a, ...arrondirCourses(a) }));
}

// ---------- Étapes -> tâches ----------
function classer(etape, appareils) {
  const t = `${etape.texte} ${Object.values(etape.reglages || {}).join(' ')}`.toLowerCase();
  const secondes = dureeEtape(etape);                       // dureeEtape rend des secondes
  const d = secondes === null ? null : Math.max(1, Math.round(secondes / 60));   // minutes
  const prechauffage = /préchauff/.test(t);
  let ressource = null;
  if (/\bfour\b|enfourn|gratiner|papillote/.test(t)) ressource = 'four';
  else if (/thermomix|varoma|\bvitesse\b/.test(t) || (etape.reglages && etape.reglages.vitesse)) ressource = appareils.thermomix ? 'thermomix' : null;
  else if (/cookeo|pression/.test(t) || (etape.reglages && etape.reglages.pression)) ressource = appareils.cookeo ? 'cookeo' : null;
  else if (/\bmultiboutons|multicuiseur/.test(t)) ressource = appareils.multicuiseur ? 'multicuiseur' : null;
  else if (/mijot|cuisez|cuire|poêle|casserole|faitout|sauteuse|feu |frémissement|saisir|dorez|revenir/.test(t) || (etape.reglages && etape.reglages.feu)) ressource = 'plaque';
  const attente = /laissez (reposer|refroidir|lever|mariner|reposer|gonfler|tiédir|infuser)|réfrigérateur|au frais|repos|pousse/.test(t);
  const passive = prechauffage || (d !== null && d >= 8 && (ressource !== null || attente));
  if (passive && attente && !ressource) return { duree: d || 15, actif: false, ressource: null, bloquant: true };
  if (prechauffage) return { duree: d && d > 1 ? d : PRECHAUFFAGE_MIN, actif: false, ressource: 'four', bloquant: false };
  if (passive) return { duree: d, actif: false, ressource, bloquant: true };
  return { duree: d || DUREE_ACTIVE_PAR_DEFAUT, actif: true, ressource: null, bloquant: true };
}

/**
 * Planning chronométré de la session : les tâches « passives » (four, mijotage, repos) tournent pendant que vous préparez autre chose.
 * selection : [{ recette (fiche) }]. appareils : { plaques, four, thermomix, cookeo, multicuiseur }.
 * Retourne { taches: [{ debut, fin, recette, titre, etape, texte, actif, ressource }], duree, sequentiel, gain, lavages, avertissements }.
 */
export function planningSession(selection, { dureeDispo = null, appareils = {} } = {}) {
  const cap = { plaque: appareils.plaques || 3, four: appareils.four === false ? 0 : 2, thermomix: appareils.thermomix ? 1 : 0, cookeo: appareils.cookeo ? 1 : 0, multicuiseur: appareils.multicuiseur ? 1 : 0 };
  const files = { plaque: [], four: [], thermomix: [], cookeo: [], multicuiseur: [] };     // heures de libération des places
  const recettes = selection.map(({ recette }) => ({
    r: recette, i: 0, pret: 0,
    etapes: recette.etapes.map((e) => ({ e, ...classer(e, appareils) })),
  }));
  for (const x of recettes) x.passifTotal = x.etapes.filter((s) => !s.actif).reduce((t, s) => t + s.duree, 0);
  const taches = [];
  let tMain = 0;
  let sequentiel = 0;
  const avertissements = [];
  const libre = (res, depuis) => {
    if (!res || cap[res] === undefined) return depuis;
    if (cap[res] === 0) return depuis;                      // pas d'appareil de ce type : géré comme une étape sans contrainte
    const f = files[res];
    if (f.length < cap[res]) return depuis;
    return Math.max(depuis, Math.min(...f));
  };
  const occupe = (res, debut, fin) => {
    if (!res || !cap[res]) return;
    const f = files[res];
    f.push(fin);
    f.sort((a, b) => a - b);
    while (f.length > cap[res]) f.shift();
    void debut;
  };
  let restantes = recettes.reduce((n, x) => n + x.etapes.length, 0);
  while (restantes > 0) {
    let meilleur = null;
    for (const x of recettes) {
      if (x.i >= x.etapes.length) continue;
      const s = x.etapes[x.i];
      let debut = x.pret;
      if (s.actif) debut = Math.max(debut, tMain);
      else debut = libre(s.ressource, debut);
      const cle = [debut, -x.passifTotal];
      if (!meilleur || cle[0] < meilleur.cle[0] || (cle[0] === meilleur.cle[0] && cle[1] < meilleur.cle[1])) meilleur = { x, s, debut, cle };
    }
    const { x, s, debut } = meilleur;
    const fin = debut + s.duree;
    taches.push({ debut, fin, recette: x.r.id, titre: x.r.titre, etape: x.i + 1, texte: x.etapes[x.i].e.texte, actif: s.actif, ressource: s.ressource });
    sequentiel += s.duree;
    if (s.actif) { tMain = fin; x.pret = fin; }
    else { occupe(s.ressource, debut, fin); x.pret = s.bloquant ? fin : debut; }
    x.i++; restantes--;
  }
  taches.sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  const duree = taches.reduce((m, t) => Math.max(m, t.fin), 0);
  const ustensiles = new Set(selection.flatMap(({ recette }) => recette.ustensiles || []));
  const total = selection.reduce((n, { recette }) => n + (recette.ustensiles || []).length, 0);
  if (dureeDispo && duree > dureeDispo) avertissements.push(`La session dure environ ${duree} min : plus que les ${dureeDispo} min prévues. Retirez une recette ou partagez la session en deux jours.`);
  return { taches, duree, sequentiel, gain: Math.max(0, sequentiel - duree), lavages: ustensiles.size, lavagesEvites: Math.max(0, total - ustensiles.size), avertissements };
}

/** Heure « HH:MM » d'une minute de session à partir d'une heure de début « HH:MM ». */
export function heureDe(debut, minutes) {
  const [h, m] = debut.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ---------- Conditionnement ----------
/** Boîtes, étiquettes et dates limites. selection : [{ recette, portions }] ; date : jour de préparation « AAAA-MM-JJ ». */
export function conditionnement(selection, date, portionsParBoite = 2) {
  return selection.map(({ recette, portions }) => {
    const c = recette.conservation || {};
    const frigo = c.frigo_jours > 0 ? c.frigo_jours : 3;
    const boites = Math.ceil(portions / Math.max(1, portionsParBoite));
    return {
      recette: recette.id, titre: recette.titre, portions, boites, portionsParBoite,
      preparation: date,
      limiteFrigo: cleDate(ajouterJours(dateDepuisCle(date), frigo)),
      frigoJours: frigo,
      congelationMois: c.congelation_mois > 0 ? c.congelation_mois : 0,
      limiteCongelation: c.congelation_mois > 0 ? cleDate(ajouterJours(dateDepuisCle(date), c.congelation_mois * 30)) : null,
      reechauffage: c.reechauffage || 'Réchauffer à cœur (au moins 74 °C).',
      decongelation: 'Décongeler la veille au réfrigérateur, jamais à température ambiante.',
    };
  });
}

export function texteEtiquette(c, congele = false) {
  return `${c.titre}\nPréparé le ${c.preparation.split('-').reverse().join('/')}\nÀ consommer avant le ${(congele ? c.limiteCongelation || c.limiteFrigo : c.limiteFrigo).split('-').reverse().join('/')}${congele ? ' (congelé)' : ' (frigo)'}\n${c.reechauffage}`;
}

// ---------- Stock de plats préparés ----------
/** Plats de toutes les sessions encore disponibles, ceux à manger en premier d'abord (date limite la plus proche). */
export function platsEnStock(sessions, aujourdhui = new Date()) {
  const auj = cleDate(aujourdhui);
  const plats = [];
  for (const s of sessions) for (const p of s.plats || []) {
    if (!(p.restant > 0)) continue;
    const limite = p.congele ? p.limiteCongelation || p.limiteFrigo : p.limiteFrigo;
    const jours = Math.round((dateDepuisCle(limite) - dateDepuisCle(auj)) / 86400000);
    plats.push({ ...p, session: s.id, limite, joursRestants: jours, urgent: jours <= 1, perime: jours < 0 });
  }
  return plats.sort((a, b) => a.joursRestants - b.joursRestants);
}

/** Entrée d'une session pour le stock : un plat par recette avec ses boîtes. */
export function platsDeSession(cond) {
  return cond.map((c) => ({ recette: c.recette, titre: c.titre, portions: c.portions, restant: c.portions, limiteFrigo: c.limiteFrigo, limiteCongelation: c.limiteCongelation, congele: false }));
}
