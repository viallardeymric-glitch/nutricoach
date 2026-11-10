// Frigo magique et anti-gaspi : quelles recettes avec ce qu'on a, et que cuisiner avant que ça se périme. Fonctions pures.
import { normaliser } from './texte.js';
import { cleAliment } from './courses.js';
import { cleDate, ajouterJours, dateDepuisCle } from './planning.js';

const BASIQUES = /\b(sel|poivre|eau|huile|vinaigre|sucre|farine|epices?|moutarde|bouillon)\b/;
/** Les produits de base (sel, huile, farine…) sont supposés disponibles : ils ne comptent ni comme couverts ni comme manquants. */
export const estBasique = (nom) => BASIQUES.test(normaliser(nom));

const jetons = (cle) => cle.split(' ').filter((m) => m.length > 1 && !['de', 'du', 'des', 'la', 'le', 'les', 'aux', 'au', 'en', 'et'].includes(m));
const memo = new WeakMap();
const clesIngredients = (r) => {
  if (!memo.has(r)) memo.set(r, r.ingredients.filter((i) => !estBasique(i)).map((i) => ({ nom: i, cle: cleAliment(i), jetons: jetons(cleAliment(i)) })));
  return memo.get(r);
};

/** « poulet » (stock) correspond à « blanc de poulet » (recette) et réciproquement. */
export function correspond(ingredient, article) {
  const a = ingredient.jetons; const b = article;
  if (!a.length || !b.length) return false;
  return b.every((m) => a.includes(m)) || a.every((m) => b.includes(m));
}

/** Couverture d'une recette (entrée d'index) par des articles { jetons } : { couverts, manquants, ratio, utilises }. */
export function couverture(r, articles) {
  const couverts = []; const manquants = []; const utilises = new Set();
  for (const ing of clesIngredients(r)) {
    const a = articles.find((x) => correspond(ing, x.jetons));
    if (a) { couverts.push(ing.nom); utilises.add(a.nom); } else manquants.push(ing.nom);
  }
  const total = couverts.length + manquants.length;
  return { couverts, manquants, ratio: total ? couverts.length / total : 1, utilises: [...utilises] };
}

export const articlesDuFrigo = (stock) => stock.map((s) => ({ nom: s.nom, jetons: jetons(cleAliment(s.nom)), peremption: s.peremption || null }));

/**
 * Frigo magique : recettes réalisables avec le stock (au moins `min` ingrédients couverts), les mieux couvertes d'abord.
 * options : { contraintes (fonction convient), min, ratioMin, max }.
 */
export function frigoMagique(recettes, articles, { convient = () => true, min = 2, ratioMin = 0.5, max = 12, prioritaires = [] } = {}) {
  const prio = new Set(prioritaires);
  const res = [];
  for (const r of recettes) {
    if (r.categorie === 'Apéros' || !convient(r)) continue;
    const c = couverture(r, articles);
    if (c.couverts.length < min || c.ratio < ratioMin) continue;
    const gaspi = c.utilises.filter((n) => prio.has(n)).length;
    res.push({ r, ...c, gaspi });
  }
  return res.sort((a, b) => b.gaspi - a.gaspi || b.ratio - a.ratio || a.manquants.length - b.manquants.length || a.r.temps - b.r.temps).slice(0, max);
}

/** Articles qui périment dans les `jours` prochains jours (périmés inclus), du plus pressé au moins pressé. */
export function aConsommerBientot(stock, aujourdhui = new Date(), jours = 3) {
  const limite = cleDate(ajouterJours(aujourdhui, jours));
  const auj = cleDate(aujourdhui);
  return stock.filter((s) => s.peremption && s.peremption <= limite)
    .map((s) => ({ ...s, joursRestants: Math.round((dateDepuisCle(s.peremption) - dateDepuisCle(auj)) / 86400000), perime: s.peremption < auj }))
    .sort((a, b) => a.joursRestants - b.joursRestants);
}

/** Bonus de score pour les menus et « ce soir » : recettes qui utilisent le stock, surtout ce qui périme. */
export function bonusStock(articles, urgents = []) {
  const prio = new Set(urgents.map((u) => u.nom));
  return (r) => { const c = couverture(r, articles); return c.couverts.length >= 2 ? c.ratio * 2.5 + c.utilises.filter((n) => prio.has(n)).length * 2 : 0; };
}
