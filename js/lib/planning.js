// Menus de la semaine : dates, contraintes du couple, choix des recettes. Fonctions pures, sans DOM.
import { filtresDuProfil, risquesPour } from './profils.js';
import { contientAllergene } from './recettes.js';
import { respecteRegime } from '../data/regimes.js';

export const REPAS = [
  { id: 'dejeuner', nom: 'Déjeuner', icone: '☀️' },
  { id: 'diner', nom: 'Dîner', icone: '🌙' },
];
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ---------- Dates (toutes en heure locale ; une date s'écrit « AAAA-MM-JJ ») ----------
export const nomJour = (d) => JOURS[(d.getDay() + 6) % 7];
export const nomMois = (d) => MOIS[d.getMonth()];
export const cleDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function dateDepuisCle(cle) { const [a, m, j] = cle.split('-').map(Number); return new Date(a, m - 1, j); }
export function ajouterJours(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
export const lundiDe = (d) => ajouterJours(d, -((d.getDay() + 6) % 7));
export const semaineDe = (d) => Array.from({ length: 7 }, (_, i) => cleDate(ajouterJours(lundiDe(d), i)));
export function saisonDe(d) {
  const m = d.getMonth();
  return m >= 2 && m <= 4 ? 'printemps' : m >= 5 && m <= 7 ? 'ete' : m >= 8 && m <= 10 ? 'automne' : 'hiver';
}
export const estWeekEnd = (d) => d.getDay() === 0 || d.getDay() === 6;

// ---------- Hasard reproductible : une même graine donne toujours le même menu ----------
export function graine(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function aleatoire(g) {
  let a = g >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Contraintes du couple : ce qui ne convient à AUCUN des deux est écarté ----------
// Pour un menu, les allergies, aliments évités, régimes et risques de CHACUN sont toujours respectés
// (même si l'interrupteur « profil appliqué » est coupé pour la navigation).
export function contraintesCouple(profils) {
  const c = { regimes: new Set(), allergenes: new Set(), exclusions: new Set(), risques: new Set() };
  for (const p of profils.filter(Boolean)) {
    const f = filtresDuProfil({ ...p, appliquer: true });
    f.regimes.forEach((x) => c.regimes.add(x));
    f.allergenes.forEach((x) => c.allergenes.add(x));
    f.exclusions.forEach((x) => c.exclusions.add(x));
    risquesPour(p).forEach((x) => c.risques.add(x));
  }
  return { regimes: [...c.regimes], allergenes: [...c.allergenes], exclusions: [...c.exclusions], risques: [...c.risques] };
}

/** Une recette de l'index (avec _titre et _ingr) convient-elle aux contraintes ? */
export function convient(r, c) {
  return !contientAllergene(r, c.allergenes)
    && c.regimes.every((g) => respecteRegime(r, g))
    && !c.exclusions.some((x) => (r._ingr || '').includes(x) || r._titre.includes(x))
    && !(r.risques || []).some((x) => c.risques.includes(x));
}

const EST_POISSON = (r) => r.allergenes.includes('poisson');
const EST_VEGE = (r) => r.regimes.includes('vegetarien');
const SOUS_CATEGORIES_ECARTEES = new Set(['enfants', 'fete', 'batch']);

/**
 * Classe les recettes pour un repas : saison, temps (rapide en semaine), calories proches de la cible,
 * variété (pas deux fois le même type de plat). Retourne les `n` meilleures, mélangées de façon reproductible.
 * options : { jour: Date, repas, saison, cibleKcal, utilises: Set d'ids, types: Map sous-catégorie → nombre,
 *             graine, n, rapideMax, filtre }
 */
export function proposer(recettes, c, options) {
  const { jour, repas = 'diner', saison, cibleKcal = 2000, utilises = new Set(), types = new Map(),
    graine: g = 1, n = 3, rapideMax = null, filtre = () => true } = options;
  const hasard = aleatoire(g);
  const cibleRepas = cibleKcal * 0.35;
  const semaine = !estWeekEnd(jour);
  const notes = [];
  for (const r of recettes) {
    if (r.categorie !== 'Plats' || utilises.has(r.id) || SOUS_CATEGORIES_ECARTEES.has(r.sous_categorie)) continue;
    if (!convient(r, c) || !filtre(r)) continue;
    if (rapideMax && r.temps > rapideMax) continue;
    let s = hasard() * 2;
    s += r.saisons.includes(saison) ? 2 : r.saisons.includes('toute_annee') ? 1 : -2;
    if (semaine) s += r.temps <= 45 ? 2 : r.temps > 75 ? -3 : 0; else s += r.temps > 45 ? 1 : 0;
    if (r.sous_categorie === 'dominical' && jour.getDay() === 0 && repas === 'dejeuner') s += 3;
    if (r.kcal) s -= (Math.abs(r.kcal - cibleRepas) / cibleRepas) * 2;
    s -= (types.get(r.sous_categorie) || 0) * 3;
    notes.push([s, r]);
  }
  notes.sort((a, b) => b[0] - a[0]);
  return notes.slice(0, n).map((x) => x[1]);
}

/**
 * Complète la semaine : remplit les repas vides de `plan` ({ date: { dejeuner, diner } }) sans toucher aux autres.
 * Vise au moins 2 repas de poisson et 2 végétariens par semaine quand les contraintes le permettent.
 * Retourne { plan, manquants } (manquants : repas pour lesquels rien ne convenait).
 */
export function genererSemaine(recettes, jours, plan, { contraintes, saison, cibleKcal, graine: g = 1 }) {
  const hasard = aleatoire(g);
  const suivant = {};
  for (const j of jours) suivant[j] = { ...(plan[j] || {}) };
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const utilises = new Set();
  const types = new Map();
  let poissons = 0;
  let vegetariens = 0;
  for (const j of jours) for (const id of Object.values(suivant[j])) {
    const r = parId.get(id);
    if (!r) continue;
    utilises.add(id);
    types.set(r.sous_categorie, (types.get(r.sous_categorie) || 0) + 1);
    if (EST_POISSON(r)) poissons++;
    if (EST_VEGE(r)) vegetariens++;
  }
  const vides = [];
  for (const j of jours) for (const { id } of REPAS) if (!suivant[j][id]) vides.push([j, id]);
  // Quotas : on réserve d'abord des repas au hasard pour le poisson et le végétarien.
  const ordre = vides.map((v) => [hasard(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const exigences = new Map();
  let i = 0;
  for (let k = poissons; k < 2 && i < ordre.length; k++) exigences.set(ordre[i++].join('|'), EST_POISSON);
  for (let k = vegetariens; k < 2 && i < ordre.length; k++) exigences.set(ordre[i++].join('|'), EST_VEGE);

  const manquants = [];
  for (const [j, repas] of vides) {
    const options = { jour: dateDepuisCle(j), repas, saison, cibleKcal, utilises, types, graine: g + graine(j + repas), n: 1 };
    let choix = proposer(recettes, contraintes, { ...options, filtre: exigences.get(`${j}|${repas}`) || (() => true) });
    if (!choix.length) choix = proposer(recettes, contraintes, options); // exigence impossible : on prend le meilleur plat
    if (!choix.length) { manquants.push([j, repas]); continue; }
    suivant[j][repas] = choix[0].id;
    utilises.add(choix[0].id);
    types.set(choix[0].sous_categorie, (types.get(choix[0].sous_categorie) || 0) + 1);
  }
  return { plan: suivant, manquants };
}
