// Version Thermomix : pastilles d'étape (durée, température, vitesse, sens, accessoire) selon le modèle, capacité du bol, pesée guidée.
// Fonctions pures, testées dans tests/thermomix.test.mjs.
import { normaliser } from './texte.js';

export const MODELES = {
  TM6: { nom: 'Thermomix TM6', tempMax: 120, modeDoux: true, mijotage: 'Mijotage', capaciteMl: 2200 },
  TM5: { nom: 'Thermomix TM5', tempMax: 120, modeDoux: true, mijotage: 'Mijotage', capaciteMl: 2200 },
  TM31: { nom: 'Thermomix TM31', tempMax: 100, modeDoux: false, mijotage: 'Vitesse cuillère', capaciteMl: 2200 },
};
export const CUISSON_MAX_ML = 2000;       // niveau à ne pas dépasser en chauffant
export const PETRIN_MAX_G = 1000;         // pâte à pétrir : 1 kg au plus

/** Une recette a-t-elle de vraies étapes Thermomix (vitesses réglées) ? */
export const recetteThermomix = (r) => r.etapes.some((e) => e.reglages && e.reglages.vitesse);

const ACCESSOIRES = { lame: ['🔪', 'Lame'], papillon: ['🦋', 'Papillon'], panier: ['🧺', 'Panier'], varoma: ['♨', 'Varoma'] };

/**
 * Pastilles d'une étape pour un modèle : [{ cle, icone, texte }] et les avertissements propres au modèle.
 * TM31 : 100 °C au plus (ou Varoma), pas de « mode doux » (équivalent : vitesse 1 en sens inverse).
 */
export function pastilles(reglages = {}, modele = 'TM6') {
  const m = MODELES[modele] || MODELES.TM6;
  const p = [];
  const avertissements = [];
  if (reglages.duree) p.push({ cle: 'duree', icone: '⏱', texte: reglages.duree });
  if (reglages.temperature) {
    const t = String(reglages.temperature);
    const n = parseInt(t, 10);
    if (/varoma/i.test(t)) p.push({ cle: 'temperature', icone: '♨', texte: 'Varoma' });
    else if (Number.isFinite(n) && n > 0) {
      if (n > m.tempMax) { p.push({ cle: 'temperature', icone: '🌡', texte: `${m.tempMax} °C` }); avertissements.push(`${m.nom} : ${m.tempMax} °C au maximum (la recette indique ${n} °C). Prolongez un peu la cuisson.`); }
      else p.push({ cle: 'temperature', icone: '🌡', texte: `${n} °C` });
    }
  }
  let sensInverse = reglages.sens === 'inverse';
  if (reglages.vitesse !== undefined) {
    const v = String(reglages.vitesse).toLowerCase();
    if (v === 'mijotage') p.push({ cle: 'vitesse', icone: '⚙', texte: m.mijotage });
    else if (v === 'turbo') p.push({ cle: 'vitesse', icone: '⚙', texte: 'Turbo' });
    else p.push({ cle: 'vitesse', icone: '⚙', texte: `Vit. ${String(reglages.vitesse).replace('.', ',')}` });
  }
  if (reglages.mode) {
    const mode = normaliser(String(reglages.mode));
    if (/petrin/.test(mode)) p.push({ cle: 'mode', icone: '🍞', texte: 'Mode pétrin' });
    else if (/doux/.test(mode)) {
      if (m.modeDoux) p.push({ cle: 'mode', icone: '🥄', texte: 'Mode doux' });
      else { sensInverse = true; if (reglages.vitesse === undefined) p.push({ cle: 'vitesse', icone: '⚙', texte: m.mijotage }); avertissements.push(`${m.nom} n'a pas de mode doux : utilisez la vitesse cuillère en sens inverse.`); }
    }
  }
  if (sensInverse) p.push({ cle: 'sens', icone: '↺', texte: 'Sens inverse' });
  const acc = ACCESSOIRES[reglages.accessoire];
  if (acc) p.push({ cle: 'accessoire', icone: acc[0], texte: acc[1] });
  return { pastilles: p, avertissements };
}

/** Étapes de la recette avec leurs pastilles pour le modèle choisi. */
export function etapesThermomix(recette, modele = 'TM6') {
  return recette.etapes.map((e) => ({ ...e, ...pastilles(e.reglages, modele) }));
}

// ---------- Capacité du bol ----------
const ML = { ml: 1, cl: 10, l: 1000, 'c. à soupe': 15, 'c. à café': 5 };
const G = { g: 1, kg: 1000 };
const PIECE_G = { oeuf: 55, gousse: 5, branche: 2, tranche: 30, feuille: 1, sachet: 10, noix: 3, pincee: 0.3, defaut: 100 };
function volumeIngredient(ing) {
  if (ML[ing.unite]) return ing.quantite * ML[ing.unite];
  if (G[ing.unite]) return ing.quantite * G[ing.unite];            // 1 g ≈ 1 ml : approximation de volume
  const nom = normaliser(ing.aliment);
  if (ing.unite === 'pièce') return ing.quantite * (/oeuf/.test(nom) ? PIECE_G.oeuf : PIECE_G.defaut);
  if (ing.unite === 'pincée') return ing.quantite * PIECE_G.pincee;
  return ing.quantite * (PIECE_G[ing.unite] || 5);
}

/**
 * Le bol (2,2 L) peut-il contenir la recette pour `portions` ? Estimation d'après le volume des ingrédients
 * (1 g ≈ 1 ml). Si on dépasse, propose de cuire en plusieurs fois.
 */
export function capaciteBol(recette, portions, modele = 'TM6') {
  const m = MODELES[modele] || MODELES.TM6;
  const facteur = portions / recette.portions_base;
  const volume = Math.round(recette.ingredients.reduce((s, i) => s + volumeIngredient(i), 0) * facteur);
  const chauffe = recette.etapes.some((e) => e.reglages && e.reglages.temperature && e.reglages.temperature !== '0°C');
  const max = chauffe ? CUISSON_MAX_ML : m.capaciteMl;
  const petrin = recette.etapes.some((e) => /petri/.test(normaliser(`${e.texte} ${(e.reglages || {}).mode || ''}`)));
  const res = { volume_ml: volume, max_ml: max, rempli: Math.round((volume / max) * 100) / 100, depasse: volume > max, fournees: 1, parFournee_ml: volume, portionsParFournee: portions, conseil: null };
  if (res.depasse) {
    const fournees = Math.ceil(volume / (max * 0.85));
    res.fournees = fournees; res.parFournee_ml = Math.round(volume / fournees); res.portionsParFournee = Math.round((portions / fournees) * 10) / 10;
    res.conseil = `Volume estimé : ${volume} ml, au-delà de ${max} ml. Préparez la recette en ${fournees} fois (environ ${res.portionsParFournee} portions chacune).`;
  }
  if (petrin && volume > PETRIN_MAX_G) res.conseilPetrin = `Pâte estimée à ${volume} g : le bol pétrit 1 kg au plus. Divisez la pâte en deux.`;
  return res;
}

// ---------- Pesée guidée ----------
const SEC = /\b(farine|sucre|semoule|sel|levure|cacao|poudre|epices?|chapelure|fecule|maizena|flocons|bicarbonate|paprika|cumin|curcuma|cannelle)\b/;
const LIQUIDE = /\b(huile|lait|creme|vin|eau|jus|vinaigre|sauce|bouillon|coulis|sirop)\b/;
/**
 * Ordre de pesée dans le bol : secs d'abord, puis solides, puis liquides (pas de lavage entre les ajouts), le reste à part.
 * Retourne [{ ordre, groupe, aliment, quantite, unite, precision }].
 */
export function ordrePesee(ingredients, facteur = 1) {
  const groupe = (i) => {
    if (!ML[i.unite] && !G[i.unite]) return 'a_part';
    const nom = normaliser(i.aliment);
    if (SEC.test(nom)) return 'sec';
    if (ML[i.unite] || LIQUIDE.test(nom)) return 'liquide';
    return 'solide';
  };
  const ordre = { sec: 0, solide: 1, liquide: 2, a_part: 3 };
  return ingredients.map((i, k) => ({ ...i, groupe: groupe(i), quantite: i.quantite * facteur, k }))
    .sort((a, b) => ordre[a.groupe] - ordre[b.groupe] || a.k - b.k)
    .map(({ k, ...i }, idx) => ({ ordre: idx + 1, ...i }));
}
