// Budget : estimation du coût des recettes, des menus et des listes de courses (ordres de grandeur, à ajuster).
export const COUT_PORTION = { economique: 2.2, moyen: 3.8, eleve: 6.5 };   // € par portion adulte
export const PRIX_ARTICLE_MANUEL = 2;                                       // € estimés pour un article saisi à la main

export const coutRecette = (r, portions = 1) => (COUT_PORTION[r.cout] ?? COUT_PORTION.moyen) * portions;

/** Coût estimé des repas d'un menu pour `convives` portions adultes. parId : Map id → entrée d'index. */
export function budgetMenu(plan, jours, parId, convives) {
  const parJour = {};
  let total = 0; let repas = 0;
  for (const j of jours) {
    let s = 0;
    for (const id of Object.values(plan[j] || {})) { const r = parId.get(id); if (r) { s += coutRecette(r, convives); repas++; } }
    parJour[j] = Math.round(s * 10) / 10; total += s;
  }
  return { total: Math.round(total), parJour, repas, parPersonneParJour: repas ? Math.round((total / convives / jours.length) * 10) / 10 : 0 };
}

/** Estimation d'une liste : les recettes qui ont servi à la générer (une fois chacune) + les articles saisis à la main. */
export function budgetListe(articles, parId, convives) {
  const recettes = new Set(articles.flatMap((a) => a.recettes || []));
  let total = 0;
  for (const id of recettes) { const r = parId.get(id); if (r) total += coutRecette(r, convives); }
  const manuels = articles.filter((a) => !(a.recettes || []).length).length;
  return { total: Math.round(total + manuels * PRIX_ARTICLE_MANUEL), recettes: recettes.size, manuels };
}
