// Besoins énergétiques et repères nutritionnels. Estimations générales, jamais un avis médical.
// Formule de Mifflin-St Jeor pour le métabolisme de base. Fonctions pures, testées dans tests/besoins.test.mjs.

export const ACTIVITES = {
  sedentaire: { nom: 'Sédentaire', coef: 1.2, aide: 'Peu ou pas d\'exercice' },
  legere: { nom: 'Légère', coef: 1.375, aide: '1 à 3 séances par semaine' },
  moderee: { nom: 'Modérée', coef: 1.55, aide: '3 à 5 séances par semaine' },
  intense: { nom: 'Intense', coef: 1.725, aide: '6 à 7 séances par semaine' },
};
export const OBJECTIFS = {
  equilibre: 'Équilibre, sans régime',
  maintien: 'Maintenir mon poids',
  perte: 'Perdre du poids',
  prise: 'Prendre de la masse',
  seche: 'Sèche',
};

const PLANCHER_KCAL = { femme: 1200, homme: 1500 }; // jamais sous ce seuil (ni sous le métabolisme de base)
const arrondir = (v, pas) => Math.round(v / pas) * pas;

/**
 * Calcule calories cibles et macros d'un profil complet et valide (voir validerProfil).
 * Plafonds de sécurité : aucun régime amincissant pendant une grossesse, un allaitement, une convalescence
 * ou si l'IMC est inférieur à 18,5 ; jamais sous le plancher calorique ; déficit limité à 15 %.
 */
export function calculerBesoins(p) {
  const messages = [];
  const bmr = Math.round(10 * p.poids_kg + 6.25 * p.taille_cm - 5 * p.age + (p.sexe === 'homme' ? 5 : -161));
  const tdee = Math.round(bmr * (ACTIVITES[p.activite]?.coef ?? ACTIVITES.sedentaire.coef));
  const imc = Math.round((p.poids_kg / ((p.taille_cm / 100) ** 2)) * 10) / 10;
  const trimestre = p.grossesse || 0;

  let objectif = p.objectif || 'equilibre';
  const amincissant = objectif === 'perte' || objectif === 'seche';
  if (amincissant && (trimestre > 0 || p.allaitement || p.convalescence)) {
    objectif = 'maintien';
    messages.push('Pendant la grossesse, l\'allaitement ou une convalescence, aucun régime amincissant n\'est proposé : l\'objectif est ramené au maintien.');
  } else if (amincissant && imc < 18.5) {
    objectif = 'maintien';
    messages.push('Avec un IMC inférieur à 18,5, aucune perte de poids n\'est proposée : l\'objectif est ramené au maintien. Parlez-en à un médecin.');
  }

  const ajustement = { perte: -0.15, seche: -0.15, prise: 0.10 }[objectif] || 0;
  let cible = tdee * (1 + ajustement);
  if (trimestre === 2) cible += 340;
  if (trimestre === 3) cible += 450;
  if (p.allaitement) cible += 500;
  if (ajustement < 0) {
    const plancher = Math.max(bmr, PLANCHER_KCAL[p.sexe] ?? 1500);
    if (cible < plancher) {
      cible = plancher;
      messages.push('L\'apport a été relevé au minimum de sécurité : en dessous, un régime ne serait pas raisonnable.');
    }
  }
  cible = arrondir(cible, 10);

  let parKg = 1.0;
  if (p.age >= 65) parKg = Math.max(parKg, 1.2);
  if (p.sportif || objectif === 'perte' || objectif === 'seche') parKg = Math.max(parKg, 1.6);
  if (objectif === 'prise') parKg = Math.max(parKg, 1.8);
  if (trimestre > 0) parKg = Math.max(parKg, 1.1);
  if (p.allaitement) parKg = Math.max(parKg, 1.3);
  const proteines_g = Math.round(p.poids_kg * parKg);
  const lipides_g = Math.round((cible * 0.30) / 9);
  const glucides_g = Math.max(0, Math.round((cible - proteines_g * 4 - lipides_g * 9) / 4));

  return {
    bmr, tdee, cible, objectif, imc, proteines_g, lipides_g, glucides_g,
    fibres_g: cible > 2500 ? 30 : 25,
    sel_max_g: 5,
    messages,
  };
}
