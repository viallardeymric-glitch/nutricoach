// Libellés français des valeurs du catalogue (cahier des charges §4).
export const CATEGORIES = ['Entrées', 'Plats', 'Desserts', 'Goûters', 'Apéros'];
export const REGIMES = {
  omnivore: 'Omnivore', sans_gluten: 'Sans gluten', sans_lactose: 'Sans lactose',
  sans_porc: 'Sans porc', halal: 'Halal', pescetarien: 'Pescétarien',
  vegetarien: 'Végétarien', vegan: 'Végan', hypocalorique: 'Hypocalorique',
  riche_en_proteines: 'Riche en protéines', sportif: 'Sportif', diabetique: 'Diabétique',
  sans_sel_ajoute: 'Sans sel ajouté', enceinte: 'Enceinte',
};
export const ALLERGENES = {
  gluten: 'Gluten', lait: 'Lait', oeuf: 'Œuf', poisson: 'Poisson', crustaces: 'Crustacés',
  mollusques: 'Mollusques', arachides: 'Arachides', fruits_a_coque: 'Fruits à coque',
  soja: 'Soja', celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame',
  sulfites: 'Sulfites', lupin: 'Lupin',
};
export const PROFILS = {
  femme_enceinte: 'Femme enceinte', allaitante: 'Femme allaitante',
  enfant_moins_de_3_ans: 'Enfant de moins de 3 ans', enfant: 'Enfant',
  senior: 'Senior', diabetique: 'Personne diabétique', hypertendu: 'Personne hypertendue',
  immunodeprime: 'Personne immunodéprimée',
};
export const SAISONS = {
  printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver', toute_annee: 'Toute l\'année',
};
export const APPAREILS = {
  classique: 'Plaques', four: 'Four', thermomix: 'Thermomix', cookeo: 'Cookeo',
  airfryer: 'Airfryer', multicuiseur: 'Multicuiseur',
};
export const DIFFICULTES = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
export const COUTS = { economique: 'Économique', moyen: 'Moyen', eleve: 'Élevé' };
export const TEMPS_MAX = [15, 30, 45, 60, 90];
export const NUTRITION = [
  ['calories_kcal', 'Calories', 'kcal'], ['proteines_g', 'Protéines', 'g'],
  ['glucides_g', 'Glucides', 'g'], ['sucres_g', 'dont sucres', 'g'],
  ['lipides_g', 'Lipides', 'g'], ['fibres_g', 'Fibres', 'g'], ['sel_g', 'Sel', 'g'],
];
export const REGLAGES = {
  mode: 'Mode', temperature: 'Température', duree: 'Durée', feu: 'Feu',
  vitesse: 'Vitesse', sens: 'Sens', accessoire: 'Accessoire', pression: 'Pression',
  position_grille: 'Grille',
};

/** Libellé d'une valeur, ou la valeur elle-même lisible si elle est inconnue. */
export const lib = (table, cle) => table[cle] || String(cle).replace(/_/g, ' ');

/** « poulet rôti et grillé », « curry_mijote » → « Poulet rôti et grillé », « Curry mijote ». */
export function libSousCategorie(s) {
  const t = String(s).replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
