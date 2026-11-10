// Autres méthodes de cuisson : liste, méthode d'origine d'une recette, consigne envoyée à l'IA et lecture de sa réponse.
export const METHODES = {
  thermomix: 'Thermomix', four: 'Four', plaque: 'Plaques', cocotte: 'Cocotte', cookeo: 'Cookeo',
  airfryer: 'Airfryer', multicuiseur: 'Multicuiseur', sans_cuisson: 'Sans cuisson',
};
const CLES_REGLAGES = ['duree', 'temperature', 'vitesse', 'sens', 'accessoire', 'mode', 'feu', 'pression', 'position_grille'];

/** Méthode pour laquelle les étapes du catalogue sont rédigées. */
export const methodeOriginale = (r) => (r.appareil_principal === 'classique' ? 'plaque' : r.appareil_principal);

export const CONSIGNE_REECRITURE = `Tu es chef cuisinier. Tu réécris les ÉTAPES d'une recette pour une autre méthode de cuisson.
Réponds UNIQUEMENT par un objet JSON, sans texte autour, de la forme :
{"etapes":[{"texte":"phrase à l'impératif, 2e personne du pluriel","duree":"20 min","temperature":"180°C"}],"remarques":["conseil court"]}
Règles : mêmes ingrédients et mêmes quantités ; ne rien inventer d'autre ; 4 à 15 étapes ; clés facultatives par étape : duree, temperature, vitesse, sens, accessoire, mode, feu, pression, position_grille ; durées au format « 20 min » ou « 30 sec ».
Sécurité : températures à cœur correctes pour viandes, volailles et poissons ; ne propose rien de dangereux ; si la recette ne s'adapte pas à cette méthode, renvoie {"etapes":[],"remarques":["explication"]}.`;

export function promptReecriture(recette, methode, modele = 'TM6') {
  const ing = recette.ingredients.map((i) => `- ${i.quantite} ${i.unite} ${i.aliment}${i.precision ? ` (${i.precision})` : ''}`).join('\n');
  const etapes = recette.etapes.map((e) => `${e.numero}. ${e.texte}`).join('\n');
  const extra = methode === 'thermomix'
    ? `Méthode cible : Thermomix ${modele} (bol de 2,2 L${modele === 'TM31' ? ', 100 °C au maximum' : ', jusqu\'à 120 °C'}). Utilise vitesse (0,5 à 10, « mijotage », « turbo »), sens « inverse » si besoin, accessoire (lame, papillon, panier, varoma).`
    : `Méthode cible : ${METHODES[methode] || methode}.`;
  return `${extra}\nRecette : ${recette.titre} (${recette.portions_base} portions, méthode d'origine : ${methodeOriginale(recette)}).\nIngrédients :\n${ing}\nÉtapes d'origine :\n${etapes}`;
}

/** Réponse de l'IA → { etapes: [{ numero, texte, reglages }], remarques } ou null si inutilisable. Le texte reste du texte (jamais de HTML). */
export function lireReecriture(texte) {
  if (!texte) return null;
  const brut = String(texte).replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const debut = brut.indexOf('{'); const fin = brut.lastIndexOf('}');
  if (debut < 0 || fin <= debut) return null;
  let o;
  try { o = JSON.parse(brut.slice(debut, fin + 1)); } catch { return null; }
  if (!o || !Array.isArray(o.etapes)) return null;
  const etapes = [];
  for (const e of o.etapes.slice(0, 25)) {
    const t = e && typeof e.texte === 'string' ? e.texte.trim() : '';
    if (t.length < 5 || t.length > 500) continue;
    const reglages = {};
    for (const k of CLES_REGLAGES) if (e[k] !== undefined && e[k] !== null && String(e[k]).length <= 30 && String(e[k]).trim()) reglages[k] = String(e[k]).trim();
    etapes.push({ numero: etapes.length + 1, texte: t, reglages });
  }
  const remarques = Array.isArray(o.remarques) ? o.remarques.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim().slice(0, 300)).slice(0, 5) : [];
  if (!etapes.length && !remarques.length) return null;
  return { etapes, remarques };
}
