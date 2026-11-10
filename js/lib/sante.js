// Score santé des recettes et des menus (sur 100), calculé à partir de la nutrition PAR PORTION. Estimation simple et transparente :
// 5 rubriques de 20 points (sel, sucres, fibres, protéines, graisses et énergie). Pas un avis médical.
import { couleurNote } from './scan.js';

export const MENTION_SCORE_SANTE = 'Score santé estimé d\'après la nutrition par portion (sel, sucres, fibres, protéines, graisses). C\'est un repère, pas un avis médical.';

const palier = (v, seuils) => { for (const [max, pts] of seuils) if (v <= max) return pts; return 0; };

/** Nutrition par portion d'une fiche complète OU d'une entrée d'index (kcal + nut). */
function nutritionDe(r) {
  if (!r) return null;
  if (r.nutrition_par_portion) return r.nutrition_par_portion;
  if (r.nut && r.kcal) return { calories_kcal: r.kcal, proteines_g: r.nut.p, glucides_g: r.nut.g, lipides_g: r.nut.l, fibres_g: r.nut.f, sucres_g: r.nut.s, sel_g: r.nut.sel };
  return null;
}

/** { note, couleur, details: [{ rubrique, points, max, texte }] } ou null si la nutrition est absente. */
export function noterRecette(r) {
  const n = nutritionDe(r);
  if (!n || !Number.isFinite(n.calories_kcal) || n.calories_kcal <= 0) return null;
  const v = (x) => (Number.isFinite(x) ? x : 0);
  const arr = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const sel = palier(v(n.sel_g), [[0.6, 20], [1.2, 15], [1.8, 8], [2.5, 3]]);
  const sucres = palier(v(n.sucres_g), [[5, 20], [10, 15], [18, 8], [25, 3]]);
  const f = v(n.fibres_g);
  const fibres = f >= 8 ? 20 : f >= 5 ? 15 : f >= 3 ? 10 : f >= 1.5 ? 5 : 0;
  const p = v(n.proteines_g);
  const prot = p >= 25 ? 20 : p >= 15 ? 15 : p >= 8 ? 8 : p >= 3 ? 3 : 0;
  const partLip = (v(n.lipides_g) * 9) / n.calories_kcal;
  let gras = palier(partLip, [[0.3, 20], [0.38, 14], [0.45, 7]]);
  if (n.calories_kcal > 900) gras = Math.min(gras, 5);
  const details = [
    { rubrique: 'Sel', points: sel, max: 20, texte: `${arr(v(n.sel_g))} g par portion` },
    { rubrique: 'Sucres', points: sucres, max: 20, texte: `${arr(v(n.sucres_g))} g par portion` },
    { rubrique: 'Fibres', points: fibres, max: 20, texte: `${arr(f)} g par portion` },
    { rubrique: 'Protéines', points: prot, max: 20, texte: `${arr(p)} g par portion` },
    { rubrique: 'Graisses et énergie', points: gras, max: 20, texte: `${Math.round(partLip * 100)} % des calories en graisses, ${Math.round(n.calories_kcal)} kcal` },
  ];
  const note = details.reduce((s, d) => s + d.points, 0);
  return { note, couleur: couleurNote(note), details };
}

/** Score moyen d'une liste de recettes (pondéré par les calories). null si aucune n'est notable. */
export function noterMenu(recettes) {
  const notes = (recettes || []).map((r) => ({ s: noterRecette(r), kcal: (nutritionDe(r) || {}).calories_kcal || 0 })).filter((x) => x.s);
  if (!notes.length) return null;
  const poids = notes.reduce((s, x) => s + x.kcal, 0);
  const note = Math.round(notes.reduce((s, x) => s + x.s.note * x.kcal, 0) / poids);
  return { note, couleur: couleurNote(note), nb: notes.length };
}
