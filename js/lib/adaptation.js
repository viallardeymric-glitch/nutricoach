// Adaptation des quantités au nombre de personnes, avec arrondis lisibles.
// Fonctions pures, sans DOM : testées dans tests/adaptation.test.mjs.

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const UNITES_DISCRETES = new Set(['pièce', 'gousse', 'tranche', 'branche', 'feuille', 'sachet', 'noix']);
const UNITES_AVEC_DE = new Set(['g', 'kg', 'ml', 'cl', 'l', 'c. à soupe', 'c. à café', 'pincée',
  'gousse', 'branche', 'tranche', 'feuille', 'sachet', 'noix']);
const UNITES_PLURIEL = new Set(['pincée', 'gousse', 'branche', 'tranche', 'feuille', 'sachet', 'noix']);
const ADJECTIFS = { rouge: 'rouges', vert: 'verts', jaune: 'jaunes', mûr: 'mûrs', nouveau: 'nouveaux',
  entier: 'entiers', blanc: 'blancs', noir: 'noirs', bleu: 'bleus', rose: 'roses', orange: 'oranges' };

const pas = (q, p) => Math.round(q / p) * p;
const nettoyer = (q) => Math.round(q * 1000) / 1000; // évite 0,30000000000000004

/** Arrondit une quantité « à la façon d'une recette » et change d'unité si utile (g → kg…). */
export function arrondirQuantite(q, unite) {
  switch (unite) {
    case 'g':
      if (q < 5) return { q: Math.max(0.5, pas(q, 0.5)), unite };
      if (q < 20) return { q: pas(q, 1), unite };
      if (q < 100) return { q: pas(q, 5), unite };
      if (q < 995) return { q: pas(q, 10), unite };
      return arrondirQuantite(q / 1000, 'kg');
    case 'kg':
      return { q: Math.max(0.05, q < 2 ? pas(q, 0.05) : pas(q, 0.1)), unite };
    case 'ml':
      if (q < 5) return { q: Math.max(0.5, pas(q, 0.5)), unite };
      if (q < 20) return { q: pas(q, 1), unite };
      if (q < 100) return { q: pas(q, 5), unite };
      if (q < 995) return { q: pas(q, 10), unite };
      return arrondirQuantite(q / 1000, 'l');
    case 'cl':
      if (q >= 99.5) return arrondirQuantite(q / 100, 'l');
      return { q: Math.max(0.5, q < 10 ? pas(q, 0.5) : pas(q, 1)), unite };
    case 'l':
      return { q: Math.max(0.05, pas(q, q < 1 ? 0.05 : 0.1)), unite };
    case 'c. à café':
    case 'c. à soupe':
      return { q: Math.max(0.25, pas(q, 0.25)), unite };
    case 'pincée':
      return { q: Math.max(1, Math.round(q)), unite };
    default: // pièce, gousse, tranche, branche, feuille, sachet, noix
      return { q: q < 3 ? Math.max(0.5, pas(q, 0.5)) : Math.round(q), unite };
  }
}

/** Écrit un nombre à la française : 1 ½, 2,5, 250. */
export function formaterNombre(q, fractions = false) {
  q = nettoyer(q);
  const entier = Math.floor(q);
  const reste = nettoyer(q - entier);
  if (fractions && FRACTIONS[reste]) return entier ? `${entier} ${FRACTIONS[reste]}` : FRACTIONS[reste];
  return String(q).replace('.', ',');
}

/** Pluriel simple d'un nom d'aliment : « poivron rouge » → « poivrons rouges ». */
export function pluraliserAliment(aliment) {
  const mots = aliment.split(' ');
  const t = mots[0];
  if (!/[sxz]$/i.test(t)) mots[0] = t + 's';
  const dernier = mots[mots.length - 1];
  if (mots.length > 1 && ADJECTIFS[dernier]) mots[mots.length - 1] = ADJECTIFS[dernier];
  return mots.join(' ');
}

/**
 * Prépare l'affichage d'un ingrédient pour un facteur donné (nouvelles portions / portions de base).
 * Facteur 1 : la quantité d'origine est affichée telle quelle, sans arrondi.
 * Retourne { quantite: '2 gousses', aliment: "d'ail", precision }.
 */
export function ligneIngredient(ing, facteur = 1) {
  let { quantite: q, unite } = ing;
  if (facteur !== 1) ({ q, unite } = arrondirQuantite(q * facteur, unite));
  const fractions = unite === 'c. à soupe' || unite === 'c. à café' || UNITES_DISCRETES.has(unite);
  const texteQ = formaterNombre(q, fractions);
  const pluriel = q >= 2;

  let uniteAffichee = unite === 'pièce' ? '' : unite;
  if (pluriel && UNITES_PLURIEL.has(unite)) uniteAffichee += 's';

  let aliment = ing.aliment;
  if (unite === 'pièce') {
    if (pluriel) aliment = pluraliserAliment(aliment);
  } else if (UNITES_AVEC_DE.has(unite)) {
    aliment = (/^[aeiouyhàâéèêëîïôöûüœ]/i.test(aliment) ? "d'" : 'de ') + aliment;
  }
  return {
    quantite: [texteQ, uniteAffichee].filter(Boolean).join(' '),
    aliment,
    precision: ing.precision || '',
  };
}

/**
 * Conseils quand le nombre de personnes change : temps de cuisson et taille du moule / plat.
 * Indicatifs : retourne une liste de phrases (vide si rien à signaler).
 */
export function conseilsAdaptation(recette, portions) {
  const facteur = portions / recette.portions_base;
  if (facteur === 1) return [];
  const conseils = [];
  const contenants = recette.ustensiles.filter((u) =>
    /\b(moule|plat|cocotte|poêle|casserole|faitout|sauteuse|plaque|marmite|cercle)/i.test(u));
  if (contenants.length) {
    conseils.push(facteur > 1
      ? `Prévoyez un contenant plus grand (${contenants.slice(0, 2).join(', ')}) ou faites deux fournées.`
      : `Prenez un contenant plus petit (${contenants.slice(0, 2).join(', ')}) pour garder la même épaisseur.`);
  }
  if (recette.temps.cuisson_min > 0 && (facteur >= 1.5 || facteur <= 0.67)) {
    conseils.push(facteur > 1
      ? 'Le temps de cuisson peut être un peu plus long : surveillez avant de sortir le plat.'
      : 'Le temps de cuisson peut être plus court : surveillez avant la fin indiquée.');
  }
  return conseils;
}
