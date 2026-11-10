// Entrée d'index d'une recette : le résumé léger utilisé pour la recherche, les filtres, les menus et les régimes.
// Partagé par scripts/build-index.mjs (génération) et l'appli (régimes appliqués à une fiche complète).
const un = (v) => Math.round((v || 0) * 10) / 10;

export function entreeIndex(r) {
  const n = r.nutrition_par_portion || {};
  const t = r.temps || {};
  return {
    id: r.id,
    titre: r.titre,
    categorie: r.categorie,
    sous_categorie: r.sous_categorie,
    regimes: r.regimes_compatibles || [],
    allergenes: r.allergenes || [],
    temps: t.total_min || 0,
    cuisson: t.cuisson_min || 0,
    kcal: Math.round(n.calories_kcal || 0),
    nut: { p: un(n.proteines_g), g: un(n.glucides_g), l: un(n.lipides_g), f: un(n.fibres_g), s: un(n.sucres_g), sel: un(n.sel_g) },
    difficulte: r.difficulte,
    cout: r.cout,
    saisons: r.saisons || [],
    appareils: r.appareils_possibles || [],
    occasions: r.occasions || [],
    tags: r.tags || [],
    risques: [...new Set((r.deconseille_a || []).map((d) => d.profil))],
    ingredients: [...new Set((r.ingredients || []).map((i) => i.aliment))],
  };
}
