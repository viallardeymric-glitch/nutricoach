// Recette créée par le coach IA : détection de la demande, consigne, lecture de la réponse (JSON) et contrôle de sécurité avec les profils du foyer.
import { normaliserRecette } from './recette-perso.js';
import { normaliser } from './texte.js';

/** Le message demande-t-il de créer / inventer une recette ? (« crée-moi une recette », « invente un plat », « propose une recette pour midi »…) */
export function veutUneRecette(texte) {
  const t = normaliser(texte);
  if (!/\brecettes?\b|\bplat\b/.test(t)) return false;
  return /\b(cree|creer|creez|cree moi|inventes?|inventer|propose|proposer|propose moi|fais moi|fait moi|faire moi|elabore|genere|generer|donne moi|donne|trouve moi|imagine|concocte|prepare moi)\b/.test(t) || /\bune recette pour\b|\bune recette avec\b|\brecette (?:pour|avec) (?:midi|ce soir|le soir|diner|dejeuner)/.test(t);
}

export const CONSIGNE_RECETTE = `Tu es chef cuisinier et diététicien. Tu CRÉES UNE recette complète à partir de la demande, en respectant strictement les contraintes de santé données.
Réponds UNIQUEMENT par un objet JSON (sans texte autour) de cette forme :
{"titre":"...","description":"une phrase","categorie":"Plats","portions_base":3,"temps":{"preparation_min":15,"cuisson_min":20,"repos_min":0},"difficulte":"facile","cout":"economique",
"ingredients":["200 g de farine","2 oeufs","1 gousse d'ail, hachée"],
"etapes":["Étape 1 à l'impératif.","Étape 2…"],"astuces":["conseil court"],
"nutrition_par_portion":{"calories_kcal":450,"proteines_g":25,"glucides_g":50,"lipides_g":15,"fibres_g":6,"sucres_g":6,"sel_g":1.2},
"regimes_compatibles":["vegetarien"],"allergenes":["gluten"],"conservation":{"frigo_jours":2,"congelation_mois":0,"reechauffage":"..."}}
Règles :
- Le nombre de portions demandé est « portions_base ». Les quantités sont pour ce nombre de personnes.
- Ingrédients : une ligne par ingrédient, quantité + unité (g, kg, ml, cl, l, c. à café, c. à soupe, pincée, gousse, tranche, branche, feuille, pièce) puis le nom. 4 à 15 ingrédients.
- Étapes : 4 à 10 étapes claires, à l'impératif, avec les durées et températures de cuisson (cuisson à cœur pour viandes, volailles, poissons et œufs).
- Respecte TOUTES les allergies, régimes et aliments à éviter donnés. Grossesse / allaitement : rien de cru ou peu cuit à risque, pas d'alcool. Jeunes enfants : pas d'alcool, pas de morceaux durs entiers, peu de sel.
- Si on te donne des ingrédients disponibles, utilise-en une partie sans être obligé de tous les employer ; ne demande pas d'ingrédients exotiques ; le sel, l'huile, le poivre et les épices courantes sont supposés disponibles.
- Si la conversation précédente précise ou corrige la demande, tiens-en compte.
- Valeurs nutritionnelles : estimations raisonnables par portion.
- Ne propose jamais rien de dangereux. Réponds en français.`;

/** Prompt de la demande : demande, nombre de personnes, conversation récente, ce que l'appli sait des profils et du stock. */
export function promptRecette({ demande, historique = [], contexte = '', portions = 3, noms = '' }) {
  const recent = historique.slice(-6).map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Coach'} : ${String(m.texte || (m.recette && m.recette.titre) || '').slice(0, 400)}`).join('\n');
  return `Demande : ${demande}
Nombre de portions : ${portions}${noms ? ` (${noms})` : ''}
${contexte ? `\nContraintes et contexte (à respecter) :\n${contexte}\n` : ''}${recent ? `\nConversation récente :\n${recent}\n` : ''}`;
}

/** Réponse de l'IA (texte JSON) → { recette, avertissements, erreurs } (la recette est normalisée comme une recette ajoutée à la main). */
export function lireRecetteIA(texte, portions) {
  const brut = String(texte || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const d = brut.indexOf('{'); const f = brut.lastIndexOf('}');
  if (d < 0 || f <= d) return { recette: null, avertissements: [], erreurs: ['La réponse de l\'IA n\'est pas une recette exploitable. Réessayez.'] };
  let o;
  try { o = JSON.parse(brut.slice(d, f + 1)); } catch { return { recette: null, avertissements: [], erreurs: ['La réponse de l\'IA est illisible. Réessayez.'] }; }
  const r = normaliserRecette({ ...o, portions_base: portions || o.portions_base });
  if (r.recette) { r.recette.tags = [...new Set([...r.recette.tags, 'coach'])]; r.recette.origine = 'coach'; }
  return r;
}

/**
 * Conflits entre la recette et les profils du foyer (allergènes, régimes, aliments déconseillés) : [{ type: 'allergene' | 'regime' | 'risque', texte }].
 * Les allergènes sont « bloquants » : la recette ne s'ajoute pas.
 */
export function conflitsRecette(recette, contraintes) {
  const res = [];
  for (const a of contraintes.allergenes || []) if (recette.allergenes.includes(a)) res.push({ type: 'allergene', texte: `contient ${a.replace('_', ' ')}, que quelqu'un du foyer évite` });
  for (const g of contraintes.regimes || []) if (['vegetarien', 'vegan', 'sans_gluten', 'sans_lactose', 'pescetarien', 'sans_porc'].includes(g) && !recette.regimes_compatibles.includes(g)) res.push({ type: 'regime', texte: `n'est pas compatible avec le régime « ${g.replace('_', ' ')} »` });
  const texte = normaliser(`${recette.titre} | ${recette.ingredients.map((i) => i.aliment).join(' | ')}`);
  for (const x of contraintes.exclusions || []) if (texte.includes(x)) res.push({ type: 'exclusion', texte: `contient « ${x} », un aliment que quelqu'un du foyer évite` });
  const vus = new Set();
  for (const d of recette.deconseille_a || []) if ((contraintes.risques || []).includes(d.profil) && !vus.has(d.raison)) { vus.add(d.raison); res.push({ type: 'risque', texte: d.raison }); }
  return res;
}
