// Moteur de substitutions : remplace les ingrédients incompatibles avec un profil et recalcule la nutrition (estimation).
import { normaliser } from './texte.js';
import { SUBSTITUTIONS } from '../data/substitutions.js';

/** Contraintes d'un profil (adulte ou enfant) sous forme de clés « allergen:lait », « regime:vegan », « situation:grossesse »… */
export function contraintesDeProfil(p) {
  const c = new Set();
  if (!p || p.appliquer === false) return c;
  for (const a of p.allergenes || []) c.add(`allergen:${a}`);
  for (const r of p.regimes || []) c.add(`regime:${r}`);
  if (p.grossesse > 0) c.add('situation:grossesse');
  if (p.allaitement) c.add('situation:allaitement');
  if (p.prenom !== undefined) c.add('regime:enfant');   // enfant du foyer : pas d'alcool
  return c;
}

const compatible = (option, contraintes) => !option.exclut.some((x) => contraintes.has(x));

/**
 * Substitutions à appliquer à une recette (fiche complète) pour un ensemble de contraintes.
 * Retourne [{ index, ancien, nouveau, ratio, unite?, note, regle }] : au plus une substitution par ingrédient.
 */
export function substitutionsPour(recette, contraintes) {
  const res = [];
  recette.ingredients.forEach((ing, index) => {
    const nom = normaliser(ing.aliment).replace(/\([^)]*\)/g, '').trim();
    for (const regle of SUBSTITUTIONS) {
      if (!regle.pour.some((x) => contraintes.has(x))) continue;
      if (!regle.motif.test(nom)) continue;
      const option = regle.options.find((o) => compatible(o, contraintes));
      if (!option) continue;
      res.push({ index, ancien: ing.aliment, nouveau: option.nom, ratio: option.ratio, depuisPiece: option.depuisPiece || null, unite: option.unite || null, note: option.note || '', regle: regle.id, option, ancienn: regle.ancien || null });
      return;
    }
  });
  return res;
}

/** Ingrédients après substitutions (la précision rappelle l'ingrédient remplacé). */
export function appliquerSubstitutions(ingredients, subs) {
  const par = new Map(subs.map((s) => [s.index, s]));
  return ingredients.map((ing, i) => {
    const s = par.get(i);
    if (!s) return ing;
    let quantite = ing.quantite * s.ratio;
    let unite = ing.unite;
    if (s.depuisPiece && ing.unite === 'pièce') { quantite = ing.quantite * s.depuisPiece * s.ratio; unite = s.unite || 'g'; }
    return { ...ing, aliment: s.nouveau, quantite, unite, precision: `remplace : ${ing.aliment}${s.note ? ` (${s.note})` : ''}` };
  });
}

// Poids d'une unité, en g ou ml, pour estimer la nutrition (uniquement g, kg, ml, cl, l et œufs).
function grammes(ing, regle) {
  switch (ing.unite) {
    case 'g': case 'ml': return ing.quantite;
    case 'kg': case 'l': return ing.quantite * 1000;
    case 'cl': return ing.quantite * 10;
    case 'pièce': return regle && regle.poidsPiece ? ing.quantite * regle.poidsPiece : null;
    default: return null;
  }
}

/**
 * Nutrition par portion après substitutions (estimation : seules les substitutions chiffrables comptent).
 * Retourne { kcal, p, g, l, nb, total } ou null si aucune substitution n'est chiffrable.
 */
export function nutritionAdaptee(recette, subs) {
  const base = recette.nutrition_par_portion;
  let k = 0; let p = 0; let g = 0; let l = 0; let nb = 0;
  for (const s of subs) {
    const regle = SUBSTITUTIONS.find((r) => r.id === s.regle);
    const nouveau = s.option.n; const ancien = regle && regle.ancien;
    if (!nouveau || !ancien) continue;
    const ing = recette.ingredients[s.index];
    const q = grammes(ing, regle);
    if (q === null) continue;
    const qNouveau = s.depuisPiece && ing.unite === 'pièce' ? ing.quantite * s.depuisPiece * s.ratio : q * s.ratio;
    const f = 1 / recette.portions_base / 100;
    k += (qNouveau * nouveau.k - q * ancien.k) * f; p += (qNouveau * nouveau.p - q * ancien.p) * f;
    g += (qNouveau * nouveau.g - q * ancien.g) * f; l += (qNouveau * nouveau.l - q * ancien.l) * f;
    nb++;
  }
  if (!nb) return null;
  const r = (v) => Math.max(0, Math.round(v * 10) / 10);          // une estimation ne descend jamais sous zéro
  return { kcal: Math.max(0, Math.round(base.calories_kcal + k)), p: r(base.proteines_g + p), g: r(base.glucides_g + g), l: r(base.lipides_g + l), nb, total: subs.length };
}

/** Une recette est « adaptable » si chaque ingrédient en conflit avec les contraintes a une substitution. */
export function conflitsSansSubstitution(recette, contraintes, motsConflit) {
  const subs = new Set(substitutionsPour(recette, contraintes).map((s) => s.index));
  return recette.ingredients.map((ing, i) => [ing, i]).filter(([ing, i]) => motsConflit(normaliser(ing.aliment)) && !subs.has(i)).map(([ing]) => ing.aliment);
}
