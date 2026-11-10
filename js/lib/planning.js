// Menus de la semaine : dates, contraintes du couple, choix des recettes. Fonctions pures, sans DOM.
import { filtresDuProfil, risquesPour } from './profils.js';
import { contientAllergene } from './recettes.js';
import { respecteRegime } from '../data/regimes.js';
import { normaliser } from './texte.js';
import { noterRecette } from './sante.js';

export const REPAS = [
  { id: 'dejeuner', nom: 'Déjeuner', icone: '☀️' },
  { id: 'diner', nom: 'Dîner', icone: '🌙' },
];
/** Tous les repas possibles d'une journée (petit-déjeuner et collation sont facultatifs). */
export const REPAS_COMPLETS = [
  { id: 'petit_dejeuner', nom: 'Petit-déjeuner', icone: '🥐' },
  { id: 'dejeuner', nom: 'Déjeuner', icone: '☀️' },
  { id: 'diner', nom: 'Dîner', icone: '🌙' },
  { id: 'collation', nom: 'Collation', icone: '🍎' },
];
export const repasActifs = (inclurePetitDej) => (inclurePetitDej ? REPAS_COMPLETS : REPAS);
const RATIO_KCAL = { petit_dejeuner: 0.25, dejeuner: 0.35, diner: 0.35, collation: 0.1 };
/** Un plat convient-il à ce moment de la journée ? Plats pour déjeuner/dîner ; petit-déjeuner et collations dans les goûters. */
function convientAuRepas(r, repas) {
  if (repas === 'petit_dejeuner') return r.categorie === 'Goûters' && r.sous_categorie === 'petit_dejeuner';
  if (repas === 'collation') return (r.categorie === 'Goûters' && r.sous_categorie !== 'petit_dejeuner') || (r.categorie === 'Desserts' && r.kcal <= 300);
  return r.categorie === 'Plats';
}
const SCORE_COUT = { economique: 1.2, moyen: 0, eleve: -2.5 };

// ---------- Équilibre « façon diététicien » ----------
/** Source de protéines principale d'un plat (d'après le titre et les mots-clés, sinon les premiers ingrédients). */
const CLASSES_PROTEINE = [
  ['poisson_gras', /\b(saumon|sardines?|maquereau|hareng|truite|thon)\b/],
  ['poisson', /\b(poisson|cabillaud|colin|merlu|dorade|bar|lotte|sole|haddock|morue|lieu|crevettes?|moules?|gambas|calamars?|saint-jacques|coquilles?)\b/],
  ['viande_rouge', /\b(boeuf|veau|agneau|steak|entrecote|bavette|gigot|bourguignon|blanquette|hache|rumsteck|onglet|mouton)\b/],
  ['porc', /\b(porc|jambon|lardons?|saucisse|saucisson|chorizo|bacon|filet mignon|rillettes|andouille|boudin|poitrine)\b/],
  ['volaille', /\b(poulet|dinde|canard|pintade|volaille|cuisse|magret|supreme|escalope)\b/],
  ['legumineuses', /\b(lentilles?|pois chiches?|haricots? (?:rouges?|blancs?|secs?)|feves?|pois casses|flageolets?|houmous|dal|chili)\b/],
  ['oeuf', /\b(oeufs?|omelette|quiche|frittata)\b/],
];
export function classeProteine(r) {
  if (r._classe) return r._classe;
  const principal = ` ${normaliser(`${r.titre} ${(r.tags || []).join(' ')}`)} `;
  const ingr = ` ${normaliser((r.ingredients || []).slice(0, 4).join(' | '))} `;
  for (const texte of [principal, ingr]) for (const [c, re] of CLASSES_PROTEINE) if (re.test(texte)) return c;
  return (r.regimes || []).includes('vegetarien') ? 'vegetal' : 'autre';
}
/** Plafonds et planchers hebdomadaires (repères PNNS / pratique diététique) : au plus 2 viandes rouges, 1 porc ou charcuterie, 3 volailles, 3 œufs ; au moins 2 légumineuses. */
const PLAFOND = { viande_rouge: 2, porc: 1, volaille: 3, oeuf: 3 };
const PLANCHER_LEGUMINEUSES = 2;

/**
 * Compteurs de la semaine (par classe de protéine) et recettes du jour, pour choisir un repas équilibré.
 * recettes : Map id → entrée d'index ; plan : { date: { repas: id } } ; jours : dates ; exclure : { jour, repas } (le repas qu'on remplace).
 */
export function contexteEquilibre(parId, plan, jours, exclure = null) {
  const compteurs = {}; const types = new Map(); const memeJour = {};
  for (const j of jours) {
    for (const [rp, id] of Object.entries(plan[j] || {})) {
      if (exclure && exclure.jour === j && exclure.repas === rp) continue;
      const r = parId.get(id);
      if (!r) continue;
      (memeJour[j] = memeJour[j] || []).push(r);
      if (rp !== 'dejeuner' && rp !== 'diner') continue;
      const c = classeProteine(r);
      compteurs[c] = (compteurs[c] || 0) + 1;
      types.set(r.sous_categorie, (types.get(r.sous_categorie) || 0) + 1);
    }
  }
  return { compteurs, types, memeJour };
}

/** Bonus / malus d'un plat selon l'équilibre de la semaine, du jour et le profil de santé. */
function noteEquilibre(r, { compteurs = {}, memeJour = [], risques = [] }) {
  let s = 0;
  const c = classeProteine(r);
  // Variété dans la journée : pas le même type de plat ni la même source de protéines que l'autre repas
  for (const autre of memeJour) {
    if (autre.sous_categorie === r.sous_categorie) s -= 10;
    if (c !== 'vegetal' && c !== 'autre' && classeProteine(autre) === c) s -= 6;
    const communs = (r.ingredients || []).filter((i) => (autre.ingredients || []).includes(i)).length;
    if (communs >= 3) s -= 3;
  }
  // Équilibre de la semaine
  if (PLAFOND[c] != null && (compteurs[c] || 0) >= PLAFOND[c]) s -= 8;
  if (c === 'legumineuses' && (compteurs.legumineuses || 0) < PLANCHER_LEGUMINEUSES) s += 3;
  if ((c === 'poisson' || c === 'poisson_gras') && (compteurs.poisson || 0) + (compteurs.poisson_gras || 0) < 2) s += 2;
  if (c === 'poisson_gras' && !(compteurs.poisson_gras || 0)) s += 1.5;
  // Qualité nutritionnelle (score santé de l'appli) et profil
  const sante = noterRecette(r);
  if (sante) s += (sante.note - 55) / 8;
  const n = r.nut || {};
  if (risques.includes('diabetique') && n.s > 12) s -= (n.s - 12) / 3;
  if (risques.includes('hypertendu') && n.sel > 1.8) s -= (n.sel - 1.8) * 3;
  if (n.f != null && n.f < 2) s -= 1;
  return s;
}
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
    graine: g = 1, n = 3, rapideMax = null, filtre = () => true, bonus = null, budgetSerre = false, equilibre = null, kcalDeja = 0 } = options;
  const hasard = aleatoire(g);
  const ratio = RATIO_KCAL[repas] || 0.35;
  let cibleRepas = cibleKcal * ratio;
  // Journée équilibrée : si un autre repas est déjà prévu, celui-ci complète la journée (entre 60 % et 140 % de la part normale)
  if (kcalDeja > 0 && (repas === 'dejeuner' || repas === 'diner')) cibleRepas = Math.min(cibleRepas * 1.4, Math.max(cibleRepas * 0.6, cibleKcal * 0.7 - kcalDeja));
  const semaine = !estWeekEnd(jour);
  const notes = [];
  for (const r of recettes) {
    if (!convientAuRepas(r, repas) || utilises.has(r.id) || (r.categorie === 'Plats' && SOUS_CATEGORIES_ECARTEES.has(r.sous_categorie))) continue;
    if (!convient(r, c) || !filtre(r)) continue;
    if (rapideMax && r.temps > rapideMax) continue;
    let s = hasard() * 2;
    s += r.saisons.includes(saison) ? 2 : r.saisons.includes('toute_annee') ? 1 : -2;
    if (semaine) s += r.temps <= 45 ? 2 : r.temps > 75 ? -3 : 0; else s += r.temps > 45 ? 1 : 0;
    if (r.sous_categorie === 'dominical' && jour.getDay() === 0 && repas === 'dejeuner') s += 3;
    if (r.kcal) s -= (Math.abs(r.kcal - cibleRepas) / cibleRepas) * 2;
    s -= (types.get(r.sous_categorie) || 0) * 3;
    if (bonus) s += bonus(r);
    if (equilibre) s += noteEquilibre(r, equilibre);
    if (budgetSerre) s += SCORE_COUT[r.cout] || 0;
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
export function genererSemaine(recettes, jours, plan, { contraintes, saison, cibleKcal, graine: g = 1, parJour = {}, repas: repasUtilises = REPAS, bonus = null, budgetSerre = false }) {
  const hasard = aleatoire(g);
  const suivant = {};
  for (const j of jours) suivant[j] = { ...(plan[j] || {}) };
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const utilises = new Set();
  const types = new Map();
  let poissons = 0;
  let vegetariens = 0;
  for (const j of jours) for (const [rp, id] of Object.entries(suivant[j])) {
    const r = parId.get(id);
    if (!r) continue;
    utilises.add(id);
    if (rp !== 'dejeuner' && rp !== 'diner') continue;
    types.set(r.sous_categorie, (types.get(r.sous_categorie) || 0) + 1);
    if (EST_POISSON(r)) poissons++;
    if (EST_VEGE(r)) vegetariens++;
  }
  const vides = [];
  for (const j of jours) for (const { id } of repasUtilises) if (!suivant[j][id]) vides.push([j, id]);
  // Quotas : on réserve d'abord des repas au hasard pour le poisson et le végétarien.
  const ordre = vides.filter((v) => v[1] === 'dejeuner' || v[1] === 'diner').map((v) => [hasard(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const exigences = new Map();
  let i = 0;
  for (let k = poissons; k < 2 && i < ordre.length; k++) exigences.set(ordre[i++].join('|'), EST_POISSON);
  for (let k = vegetariens; k < 2 && i < ordre.length; k++) exigences.set(ordre[i++].join('|'), EST_VEGE);

  const ctx = contexteEquilibre(parId, suivant, jours);
  const manquants = [];
  for (const [j, repas] of vides) {
    const pj = parJour[j] || {};                                    // sport : cible et filtre propres à la journée
    const options = { jour: dateDepuisCle(j), repas, saison, cibleKcal: pj.cibleKcal || cibleKcal, utilises, types, graine: g + graine(j + repas), n: 1, bonus, budgetSerre,
      equilibre: { compteurs: ctx.compteurs, memeJour: ctx.memeJour[j] || [], risques: contraintes.risques || [] },
      kcalDeja: (ctx.memeJour[j] || []).filter((x) => x.categorie === 'Plats').reduce((t, x) => t + (x.kcal || 0), 0) };
    const exigence = exigences.get(`${j}|${repas}`) || (() => true);
    const filtreJour = pj.filtre || (() => true);
    let choix = proposer(recettes, contraintes, { ...options, filtre: (r) => exigence(r) && filtreJour(r) });
    if (!choix.length) choix = proposer(recettes, contraintes, { ...options, filtre: filtreJour });
    if (!choix.length) choix = proposer(recettes, contraintes, options); // exigence impossible : on prend le meilleur plat
    if (!choix.length) { manquants.push([j, repas]); continue; }
    suivant[j][repas] = choix[0].id;
    utilises.add(choix[0].id);
    if (repas === 'dejeuner' || repas === 'diner') { const c = classeProteine(choix[0]); ctx.compteurs[c] = (ctx.compteurs[c] || 0) + 1; }
    (ctx.memeJour[j] = ctx.memeJour[j] || []).push(choix[0]);
    types.set(choix[0].sous_categorie, (types.get(choix[0].sous_categorie) || 0) + 1);
  }
  return { plan: suivant, manquants };
}

/**
 * Remplace UN repas par un autre : jamais le même plat, jamais un plat déjà au menu de la semaine, et pas le même type de plat
 * ni la même source de protéines que l'autre repas du jour (déjeuner ≠ dîner). Retourne la recette choisie ou null.
 */
export function autreRepasPour(recettes, c, { plan, jours, jour, repas, saison, cibleKcal, filtre, bonus = null, budgetSerre = false, graine: g = 1 }) {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const actuel = parId.get((plan[jour] || {})[repas]);
  const ctx = contexteEquilibre(parId, plan, jours, { jour, repas });
  const utilises = new Set(jours.flatMap((x) => Object.values(plan[x] || {})));
  const autresDuJour = ctx.memeJour[jour] || [];
  const options = { jour: dateDepuisCle(jour), repas, saison, cibleKcal, utilises, types: ctx.types, graine: g, n: 1, bonus, budgetSerre,
    equilibre: { compteurs: ctx.compteurs, memeJour: autresDuJour, risques: c.risques || [] },
    kcalDeja: autresDuJour.filter((x) => x.categorie === 'Plats').reduce((t, x) => t + (x.kcal || 0), 0) };
  const filtreJour = filtre || (() => true);
  const different = (r) => !(actuel && (r.sous_categorie === actuel.sous_categorie)) && !autresDuJour.some((x) => x.sous_categorie === r.sous_categorie && (repas === 'dejeuner' || repas === 'diner'));
  let [choix] = proposer(recettes, c, { ...options, filtre: (r) => filtreJour(r) && different(r) });
  if (!choix) [choix] = proposer(recettes, c, { ...options, filtre: filtreJour });
  if (!choix) [choix] = proposer(recettes, c, options);
  return choix || null;
}
