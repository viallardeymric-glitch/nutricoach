// Liste de courses : fusion des ingrédients, conversion d'unités, stock, saisie libre. Fonctions pures, testées.
import { normaliser } from './texte.js';
import { graine } from './planning.js';
import { formaterNombre } from './adaptation.js';
import { rayonDe } from '../data/rayons.js';

const A_IGNORER = /^eau( (froide|chaude|tiede|glacee|bouillante|fraiche|du robinet|plate))?$|papier|^pic |^plaque de/; // eau du robinet, matériel : pas dans les courses
const UNITES_PLURIEL = new Set(['pincée', 'gousse', 'branche', 'tranche', 'feuille', 'sachet', 'noix']);

export const estAlimentaire = (aliment) => !A_IGNORER.test(normaliser(aliment));

/** Clé de fusion d'un aliment : sans accents ni pluriel (« pommes de terre » = « pomme de terre »). */
export function cleAliment(aliment) {
  return normaliser(aliment).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m)).join(' ');
}

/** Ramène une quantité à l'unité de base de sa famille : g/kg → g, ml/cl/l → ml ; les autres unités restent seules. */
export function versBase(quantite, unite) {
  switch (unite) {
    case 'kg': return { quantite: quantite * 1000, unite: 'g' };
    case 'cl': return { quantite: quantite * 10, unite: 'ml' };
    case 'l': return { quantite: quantite * 1000, unite: 'ml' };
    default: return { quantite, unite };
  }
}
export const cleArticle = (aliment, unite) => `${cleAliment(aliment)}|${versBase(1, unite).unite}`;
export const idArticle = (cle) => 'g-' + graine(cle).toString(36);

/** Fusionne des lignes { aliment, quantite, unite, recette? } : 2 × 100 g + 250 g de farine = 450 g. */
export function fusionner(lignes) {
  const m = new Map();
  for (const l of lignes) {
    if (!estAlimentaire(l.aliment) || !(l.quantite > 0)) continue;
    const base = versBase(l.quantite, l.unite);
    const cle = `${cleAliment(l.aliment)}|${base.unite}`;
    const a = m.get(cle) || { cle, id: idArticle(cle), nom: l.aliment, quantite: 0, unite: base.unite, rayon: rayonDe(l.aliment), recettes: [] };
    a.quantite += base.quantite;
    if (l.recette && !a.recettes.includes(l.recette)) a.recettes.push(l.recette);
    m.set(cle, a);
  }
  return [...m.values()];
}

/** Arrondi « de courses » (toujours vers le haut) et passage à l'unité lisible (1 250 g → 1,25 kg). */
export function arrondirCourses({ quantite, unite }) {
  const haut = (q, pas) => Math.ceil(q / pas - 1e-9) * pas;
  if (unite === 'g' || unite === 'ml') {
    const q = quantite < 100 ? haut(quantite, 5) : quantite < 500 ? haut(quantite, 10) : haut(quantite, 50);
    if (q >= 1000) return { quantite: Math.round(q) / 1000, unite: unite === 'g' ? 'kg' : 'l' };
    return { quantite: q, unite };
  }
  if (unite === 'c. à soupe' || unite === 'c. à café') return { quantite: haut(quantite, 0.5), unite };
  return { quantite: Math.max(1, Math.ceil(quantite - 1e-9)), unite };
}

/** « 450 g », « 1,25 kg », « 3 » (pièces), « 2 gousses », « 1 ½ c. à soupe ». */
export function libelleQuantite({ quantite, unite }) {
  const fractions = unite === 'c. à soupe' || unite === 'c. à café';
  const n = formaterNombre(quantite, fractions);
  if (unite === 'pièce') return n;
  return `${n} ${unite}${quantite >= 2 && UNITES_PLURIEL.has(unite) ? 's' : ''}`;
}

const UNITES_SAISIE = [
  [/^(kg|kilos?)$/i, 'kg'], [/^(g|gr|grammes?)$/i, 'g'], [/^(ml|millilitres?)$/i, 'ml'], [/^(cl|centilitres?)$/i, 'cl'],
  [/^(l|litres?)$/i, 'l'], [/^(c\.?\s?à\s?(?:s|soupe)\.?|cuill?[eè]res? à soupe|cs|càs)$/i, 'c. à soupe'], [/^(c\.?\s?à\s?(?:c|café)\.?|cuill?[eè]res? à café|cc|càc)$/i, 'c. à café'],
];
/** « 2 kg pommes de terre », « 250 g de farine », « 6 œufs », « lait » → { quantite, unite, nom }. */
export function analyserSaisie(texte) {
  const t = String(texte).trim().replace(/\s+/g, ' ');
  const m = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(t);
  if (!m) return { quantite: 1, unite: 'pièce', nom: t };
  const quantite = Number(m[1].replace(',', '.'));
  let reste = m[2];
  let unite = 'pièce';
  const mot = /^(c\.?\s?à\s?(?:soupe|café)|cuill?[eè]res? à (?:soupe|café)|[a-zA-Zàéèç]+\.?)\b\.?\s*(.*)$/.exec(reste);
  if (mot) {
    for (const [re, u] of UNITES_SAISIE) if (re.test(mot[1].replace(/\.$/, ''))) { unite = u; reste = mot[2]; break; }
  }
  const nom = reste.replace(/^(de |d'|du |des )/i, '').trim();
  return nom ? { quantite, unite, nom: nom.charAt(0).toUpperCase() + nom.slice(1) } : { quantite: 1, unite: 'pièce', nom: t };
}

/** Lignes d'ingrédients de tous les repas du plan, pour `personnes` convives. */
export function lignesDepuisPlan(plan, jours, recettes, personnes) {
  const lignes = [];
  for (const j of jours) for (const id of Object.values(plan[j] || {})) {
    const r = recettes.get(id);
    if (!r) continue;
    const f = personnes / r.portions_base;
    for (const i of r.ingredients) lignes.push({ aliment: i.aliment, quantite: i.quantite * f, unite: i.unite, recette: id });
  }
  return lignes;
}

/** Articles de courses d'un plan : fusionnés, arrondis, avec rayon. */
export function articlesDepuisPlan(plan, jours, recettes, personnes) {
  return fusionner(lignesDepuisPlan(plan, jours, recettes, personnes)).map((a) => ({ ...a, ...arrondirCourses(a) }));
}

/** Déduit le stock ({ cle, quantite, unite }) des articles ; retourne { articles, enStock: [noms entièrement couverts] }. */
export function deduireStock(articles, stock) {
  const parCle = new Map(stock.map((s) => [s.cle, s]));
  const enStock = [];
  const restants = [];
  for (const a of articles) {
    const s = parCle.get(a.cle);
    if (!s) { restants.push(a); continue; }
    const besoin = versBase(a.quantite, a.unite).quantite;
    const reste = besoin - s.quantite;
    if (reste <= 0) enStock.push(a.nom);
    else restants.push({ ...a, ...arrondirCourses({ quantite: reste, unite: versBase(1, a.unite).unite }) });
  }
  return { articles: restants, enStock };
}

/** Ajoute des articles achetés au stock (même clé = quantités additionnées). */
export function ajouterAuStock(stock, achetes) {
  const m = new Map(stock.map((s) => [s.cle, { ...s }]));
  for (const a of achetes) {
    const b = versBase(a.quantite, a.unite);
    const cle = a.cle || cleArticle(a.nom, a.unite);
    const s = m.get(cle) || { cle, nom: a.nom, quantite: 0, unite: b.unite, rayon: a.rayon };
    s.quantite += b.quantite;
    m.set(cle, s);
  }
  return [...m.values()];
}

/**
 * Compare la liste actuelle aux articles générés depuis le menu, sans rien perdre :
 * les articles saisis à la main et ceux déjà cochés ne sont jamais touchés.
 * Retourne { ecrire: [articles à créer/mettre à jour], supprimer: [ids] }.
 */
export function planifierMiseAJour(existants, generes) {
  const parId = new Map(existants.map((a) => [a.id, a]));
  const ids = new Set(generes.map((g) => g.id));
  const ecrire = [];
  for (const g of generes) {
    const e = parId.get(g.id);
    if (!e) ecrire.push({ ...g, source: 'recette', coche: false });
    else if (!e.coche && (e.quantite !== g.quantite || e.unite !== g.unite)) ecrire.push({ ...e, quantite: g.quantite, unite: g.unite, recettes: g.recettes });
  }
  const supprimer = existants.filter((e) => e.source === 'recette' && !e.coche && !ids.has(e.id)).map((e) => e.id);
  return { ecrire, supprimer };
}
