// Recettes ajoutées à la main ou importées depuis un fichier. Elles ne modifient JAMAIS data/recettes.json : elles sont gardées à part
// (ce téléphone, et partagées avec l'autre via la base), avec des identifiants REC-900001 et suivants.
// Tout ce qui entre est validé et normalisé au schéma des recettes (docs/schema-recette.md) ; les allergènes sont complétés
// automatiquement d'après les ingrédients pour que le filtre d'allergènes ne laisse jamais passer une recette qui en contient.
import { normaliser } from './texte.js';
import { CATEGORIES, REGIMES, ALLERGENES, SAISONS, APPAREILS, DIFFICULTES, COUTS, PROFILS } from '../data/libelles.js';
import { REGLES_ALERTE, allergenesDansTexte, nettoyerPourRegles } from '../data/deconseilles.js';

export const ID_PREMIER = 900001;
export const estRecettePerso = (id) => /^REC-9\d{5}$/.test(String(id || ''));
export const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'c. à café', 'c. à soupe', 'pincée', 'gousse', 'tranche', 'branche', 'feuille', 'pièce', 'sachet', 'noix'];
const MAX_TEXTE = 4000;

const SYNONYMES_UNITES = [
  [/^(kg|kilos?|kilogrammes?)$/i, 'kg'], [/^(g|gr|grammes?)$/i, 'g'], [/^(ml|millilitres?)$/i, 'ml'], [/^(cl|centilitres?)$/i, 'cl'], [/^(l|litres?)$/i, 'l'],
  [/^(c\.?\s?à\s?(?:s|soupe)\.?|cuill?[eè]res? à soupe|cs|càs)$/i, 'c. à soupe'], [/^(c\.?\s?à\s?(?:c|café)\.?|cuill?[eè]res? à café|cc|càc)$/i, 'c. à café'],
  [/^pinc[ée]es?$/i, 'pincée'], [/^gousses?$/i, 'gousse'], [/^tranches?$/i, 'tranche'], [/^branches?$/i, 'branche'], [/^feuilles?$/i, 'feuille'],
  [/^(pi[eè]ces?|unit[ée]s?|u)$/i, 'pièce'], [/^sachets?$/i, 'sachet'], [/^noix$/i, 'noix'],
];
const nombreDe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v || '').trim().replace(',', '.').replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75');
  const f = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (f && Number(f[2]) > 0) return Number(f[1]) / Number(f[2]);
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : null;
};
const unite = (u) => { const t = String(u || '').trim().replace(/\.$/, ''); const m = SYNONYMES_UNITES.find(([re]) => re.test(t)); return m ? m[1] : (UNITES.includes(t) ? t : null); };

/** « 200 g de farine, tamisée » → { quantite: 200, unite: 'g', aliment: 'farine', precision: 'tamisée' } (null si la ligne est vide). */
export function ingredientDepuisTexte(ligne) {
  const t = String(ligne || '').trim().replace(/\s+/g, ' ').replace(/^[-•*]\s*/, '');
  if (!t) return null;
  const [corps, ...suite] = t.split(/\s*(?:;|(?<!\d),|,(?!\d))\s*/);
  const precision = suite.join(', ');
  const m = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾])\s*(.*)$/.exec(corps);
  let quantite = 1; let u = 'pièce'; let reste = corps;
  if (m) {
    quantite = nombreDe(m[1]) || 1; reste = m[2];
    const mot = /^(c\.?\s?à\s?(?:soupe|café|s|c)\.?|cuill?[eè]res? à (?:soupe|café)|[a-zA-Zàéèç]+\.?)\s*(.*)$/.exec(reste);
    const u2 = mot && unite(mot[1]);
    if (u2) { u = u2; reste = mot[2]; }
  } else { quantite = 1; }
  const aliment = reste.replace(/^(de |d'|du |des )/i, '').trim().toLowerCase();
  return aliment ? { section: 'Ingrédients', quantite, unite: u, aliment, precision } : null;
}

/** Ingrédients en objets : accepte du texte (une ligne par ingrédient) ou une liste de textes / d'objets. Retourne { liste, erreurs }. */
function lireIngredients(brut, erreurs) {
  const lignes = Array.isArray(brut) ? brut : String(brut || '').split(/\r?\n/);
  const liste = [];
  for (const l of lignes) {
    if (typeof l === 'string') { const i = ingredientDepuisTexte(l); if (i) liste.push(i); continue; }
    if (l && typeof l === 'object') {
      const q = nombreDe(l.quantite); const aliment = String(l.aliment || '').trim().toLowerCase();
      if (!aliment) continue;
      if (!(q > 0)) { erreurs.push(`Ingrédient « ${aliment} » : la quantité doit être un nombre positif.`); continue; }
      const u = unite(l.unite);
      liste.push({ section: String(l.section || 'Ingrédients').slice(0, 60), quantite: Math.round(q * 100) / 100, unite: u || 'pièce', aliment: aliment.slice(0, 80), precision: String(l.precision || '').slice(0, 80) });
    }
  }
  return liste;
}

function lireEtapes(brut) {
  const lignes = Array.isArray(brut) ? brut : String(brut || '').split(/\r?\n/);
  const etapes = [];
  for (const l of lignes) {
    const texte = String(typeof l === 'string' ? l : (l && l.texte) || '').trim().replace(/^\d+\s*[.)-]\s*/, '');
    if (!texte) continue;
    const reglages = l && typeof l === 'object' && l.reglages && typeof l.reglages === 'object' && !Array.isArray(l.reglages) ? Object.fromEntries(Object.entries(l.reglages).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => [k.slice(0, 30), String(v).slice(0, 60)])) : {};
    etapes.push({ numero: etapes.length + 1, texte: texte.slice(0, 600), reglages });
  }
  return etapes;
}
/** Catégorie du catalogue d'après un texte libre (« plat principal », « dessert », « goûter », « apéritif »… : accents et pluriels ignorés). Défaut : Plats. */
export function categorieDepuis(texte) {
  const t = normaliser(String(texte || ''));
  if (/\bentrees?\b/.test(t)) return 'Entrées';
  if (/\bdesserts?\b|\bpatisseries?\b|\bgateaux?\b/.test(t)) return 'Desserts';
  if (/\bgouters?\b|\bcollations?\b|\bpetit[ -]dejeuner\b|\bgoutes?\b/.test(t)) return 'Goûters';
  if (/\baperos?\b|\baperitifs?\b/.test(t)) return 'Apéros';
  return 'Plats';
}
const liste = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map((x) => String(x).trim()).filter(Boolean);
const choisir = (v, autorises, defaut) => (Object.keys(autorises).includes(v) ? v : defaut);
const entierPos = (v, defaut, max) => { const n = nombreDe(v); return n != null && n >= 0 ? Math.min(max, Math.round(n)) : defaut; };
const decimal = (v, max) => { const n = nombreDe(v); return n != null && n >= 0 ? Math.min(max, Math.round(n * 10) / 10) : 0; };

/** Allergènes trouvés dans les noms d'ingrédients (liste de mots clés de l'appli). */
export function allergenesDetectes(ingredients) {
  const t = ` ${normaliser(ingredients.map((i) => i.aliment).join(' | '))} `;
  return allergenesDansTexte(t);
}
const VIANDE = /\b(poulet|dinde|canard|boeuf|veau|agneau|porc|jambon|lardons?|saucisses?|saucisson|chorizo|bacon|steaks?|escalopes?|entrecote|bavette|gigot|cotelettes?|merguez|lapin|pintade|magret|filet mignon|rosbif|roti|viande|hachee?|bresaola|coppa|pancetta|andouille|boudin|foie|rillettes|terrine|paleron|joue|osso|blanc de poulet|cuisses?|pilons?|gesiers?|mortadelle|salami|gelatine)\b/;
const PORC = /\b(porc|jambon|lardons?|lard|saucisses?|saucisson|chorizo|bacon|pancetta|andouille|boudin|rillettes|coppa|mortadelle|saindoux|couenne|salami|filet mignon)\b/;
const ALCOOL = /\b(vin|vins|biere|cidre|rhum|whisky|vodka|porto|madere|champagne|liqueur|calvados|cognac|armagnac|alcool|kirsch|amaretto|marsala|xeres|pastis|prosecco|vermouth|gin|saké|sake|mirin)\b/;
const MIEL = /\b(miel|gelatine)\b/;

/** Régimes déclarés (par la personne ou l'IA) qui contredisent les ingrédients : on ne les garde pas. On ne DÉDUIT jamais un régime d'après les mots (trop d'erreurs : « hoki », « rumsteck », « pennes »…), on ne fait que retirer les affirmations contredites. */
export function regimesContredits(ingredients, allergenes) {
  const t = ` ${normaliser(ingredients.map((i) => i.aliment).join(' | '))} `;
  const viande = VIANDE.test(t); const poissons = ['poisson', 'crustaces', 'mollusques'].some((a) => allergenes.includes(a));
  const res = [];
  if (viande) res.push(['vegetarien', 'la recette contient de la viande'], ['vegan', 'la recette contient de la viande'], ['pescetarien', 'la recette contient de la viande']);
  if (PORC.test(t)) res.push(['sans_porc', 'la recette contient du porc'], ['halal', 'la recette contient du porc']);
  if (ALCOOL.test(t)) res.push(['halal', 'la recette contient de l\'alcool']);
  if (MIEL.test(t)) res.push(['vegan', 'la recette contient du miel ou de la gélatine']);
  return res;
}

/** Avertissements de profil (femme enceinte, enfants…) d'après les ingrédients : mêmes règles que les courses et les scans. */
export function deconseillesDetectes(ingredients) {
  const t = ` ${nettoyerPourRegles(normaliser(ingredients.map((i) => i.aliment).join(' | ')))} `;
  const res = [];
  for (const r of REGLES_ALERTE) {
    if (r.exclure && r.exclure.test(t)) continue;
    if (r.motif.test(t)) for (const p of r.profils) if (PROFILS[p] && !res.some((x) => x.profil === p && x.raison === r.raison)) res.push({ profil: p, raison: r.raison });
  }
  return res;
}

/**
 * Valide et normalise une recette (formulaire ou fichier). Retourne { recette, erreurs, avertissements } ;
 * `recette` est null s'il y a des erreurs. L'identifiant n'est pas attribué ici (voir attribuerIds).
 */
export function normaliserRecette(brut) {
  const erreurs = []; const avertissements = [];
  const b = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const titre = String(b.titre || '').trim().replace(/\s+/g, ' ');
  if (titre.length < 2) erreurs.push('Le titre est obligatoire.');
  const ingredients = lireIngredients(b.ingredients, erreurs);
  if (!ingredients.length) erreurs.push('Ajoutez au moins un ingrédient (par exemple « 200 g de farine »).');
  const etapes = lireEtapes(b.etapes);
  if (!etapes.length) erreurs.push('Ajoutez au moins une étape.');
  if (erreurs.length) return { recette: null, erreurs, avertissements };

  const t = b.temps && typeof b.temps === 'object' ? b.temps : {};
  const prep = entierPos(t.preparation_min ?? b.preparation_min, 15, 1440); const cuis = entierPos(t.cuisson_min ?? b.cuisson_min, 0, 1440); const repos = entierPos(t.repos_min ?? b.repos_min, 0, 4320);
  const detectes = allergenesDetectes(ingredients);
  const declares = liste(b.allergenes).map((a) => normaliser(a).replace(/\s+/g, '_')).map((a) => (a === 'oeufs' ? 'oeuf' : a)).filter((a) => ALLERGENES[a]);
  const allergenes = [...new Set([...declares, ...detectes])];
  const ajoutes = detectes.filter((a) => !declares.includes(a));
  if (ajoutes.length) avertissements.push(`Allergènes ajoutés d'après les ingrédients : ${ajoutes.map((a) => ALLERGENES[a].toLowerCase()).join(', ')}.`);
  let regimes = [...new Set(['omnivore', ...liste(b.regimes_compatibles || b.regimes).map((r) => normaliser(r).replace(/\s+/g, '_')).filter((r) => REGIMES[r])])];
  const retirer = (r, motif) => { if (regimes.includes(r)) { regimes = regimes.filter((x) => x !== r); avertissements.push(`Régime « ${REGIMES[r]} » retiré : ${motif}.`); } };
  for (const [r, motif] of regimesContredits(ingredients, allergenes)) retirer(r, motif);
  if (allergenes.includes('gluten')) retirer('sans_gluten', 'la recette contient du gluten');
  if (allergenes.includes('lait')) retirer('sans_lactose', 'la recette contient du lait');
  if (['lait', 'oeuf', 'poisson', 'crustaces', 'mollusques'].some((a) => allergenes.includes(a))) retirer('vegan', 'la recette contient des produits animaux');
  if (['poisson', 'crustaces', 'mollusques'].some((a) => allergenes.includes(a))) retirer('vegetarien', 'la recette contient du poisson ou des fruits de mer');
  const n = b.nutrition_par_portion && typeof b.nutrition_par_portion === 'object' ? b.nutrition_par_portion : (b.nutrition && typeof b.nutrition === 'object' ? b.nutrition : {});
  const nutrition = { calories_kcal: Math.round(decimal(n.calories_kcal ?? n.kcal, 3000)), proteines_g: decimal(n.proteines_g ?? n.proteines, 300), glucides_g: decimal(n.glucides_g ?? n.glucides, 500), lipides_g: decimal(n.lipides_g ?? n.lipides, 300), fibres_g: decimal(n.fibres_g ?? n.fibres, 100), sucres_g: decimal(n.sucres_g ?? n.sucres, 300), sel_g: decimal(n.sel_g ?? n.sel, 50) };
  if (!nutrition.calories_kcal) avertissements.push('Nutrition non renseignée : le score santé et les calories ne seront pas affichés.');
  const c = b.conservation && typeof b.conservation === 'object' ? b.conservation : {};
  const appareils = liste(b.appareils_possibles).filter((a) => APPAREILS[a]);
  const principal = choisir(b.appareil_principal, APPAREILS, appareils[0] || 'classique');
  const recette = {
    titre: titre.slice(0, 120),
    categorie: CATEGORIES.includes(b.categorie) ? b.categorie : categorieDepuis(b.categorie),
    sous_categorie: String(b.sous_categorie || 'recettes perso').trim().slice(0, 60) || 'recettes perso',
    description: String(b.description || '').trim().slice(0, 600),
    portions_base: Math.max(1, entierPos(b.portions_base ?? b.portions, 4, 50)),
    temps: { preparation_min: prep, cuisson_min: cuis, repos_min: repos, total_min: prep + cuis + repos },
    difficulte: choisir(b.difficulte, DIFFICULTES, 'facile'),
    cout: choisir(b.cout, COUTS, 'moyen'),
    appareil_principal: principal,
    appareils_possibles: [...new Set([principal, ...appareils])],
    ingredients: ingredients.slice(0, 60),
    ustensiles: liste(b.ustensiles).slice(0, 20).map((x) => x.slice(0, 60)),
    etapes: etapes.slice(0, 40),
    astuces: liste(Array.isArray(b.astuces) ? b.astuces : String(b.astuces || '').split(/\r?\n/)).slice(0, 10).map((x) => x.slice(0, 300)),
    conservation: { frigo_jours: entierPos(c.frigo_jours, 3, 30), congelation_mois: entierPos(c.congelation_mois, 0, 24), reechauffage: String(c.reechauffage || '').slice(0, 200) },
    nutrition_par_portion: nutrition,
    regimes_compatibles: regimes,
    allergenes,
    deconseille_a: deconseillesDetectes(ingredients),
    saisons: (() => { const s = liste(b.saisons).filter((x) => SAISONS[x]); return s.length ? s : ['toute_annee']; })(),
    occasions: liste(b.occasions).slice(0, 8).map((x) => x.slice(0, 40)),
    tags: [...new Set(['perso', ...liste(b.tags).slice(0, 10).map((x) => x.toLowerCase().slice(0, 30))])],
    origine: 'perso',
  };
  const aTexteLong = JSON.stringify(recette).length > MAX_TEXTE * 20;
  if (aTexteLong) return { recette: null, erreurs: ['Cette recette est trop longue.'], avertissements };
  return { recette, erreurs: [], avertissements };
}

/** Prochain identifiant libre : REC-900001, REC-900002… */
export function prochainId(existants) {
  let max = ID_PREMIER - 1;
  for (const id of existants) { const n = Number(String(id).slice(4)); if (estRecettePerso(id) && n > max) max = n; }
  return `REC-${String(max + 1).padStart(6, '0')}`;
}

/** Contenu d'un fichier (texte JSON) → { recettes: [{ recette, avertissements }], erreurs }. Accepte une recette, une liste, ou { recettes: [...] }. */
export function lireFichierRecettes(texte, titresExistants = []) {
  if (typeof texte !== 'string' || texte.length > 4 * 1024 * 1024) return { recettes: [], erreurs: ['Ce fichier est trop gros.'] };
  let o;
  try { o = JSON.parse(texte); } catch { return { recettes: [], erreurs: ['Ce fichier n\'est pas un JSON valide. Utilisez le modèle proposé dans « Mes recettes ».'] }; }
  const liste = Array.isArray(o) ? o : (o && Array.isArray(o.recettes) ? o.recettes : (o && typeof o === 'object' ? [o] : []));
  if (!liste.length) return { recettes: [], erreurs: ['Aucune recette trouvée dans ce fichier.'] };
  const vus = new Set(titresExistants.map((t) => normaliser(t)));
  const recettes = []; const erreurs = [];
  liste.slice(0, 200).forEach((brut, i) => {
    const r = normaliserRecette(brut);
    const nom = (brut && brut.titre) ? `« ${String(brut.titre).slice(0, 50)} »` : `n° ${i + 1}`;
    if (!r.recette) { erreurs.push(`Recette ${nom} : ${r.erreurs.join(' ')}`); return; }
    const cle = normaliser(r.recette.titre);
    if (vus.has(cle)) { erreurs.push(`Recette ${nom} : une recette de ce nom existe déjà, ignorée.`); return; }
    vus.add(cle);
    recettes.push({ recette: r.recette, avertissements: r.avertissements });
  });
  return { recettes, erreurs };
}

/** Fichier modèle à remplir (téléchargeable) : une recette d'exemple et l'aide sur les valeurs autorisées. */
export function modeleFichier() {
  return {
    _aide: [
      'Modèle de recette NutriCoach. Remplacez l\'exemple par vos recettes, puis importez le fichier dans Mes recettes.',
      'Seuls « titre », « ingredients » et « etapes » sont obligatoires. Les ingrédients peuvent s\'écrire en une ligne (« 200 g de farine, tamisée ») ou en objet.',
      'Plusieurs recettes : mettez-les dans la liste « recettes ». Les allergènes sont complétés automatiquement d\'après les ingrédients.',
      'La nutrition est facultative (par portion). Sans elle, les calories et le score santé ne s\'affichent pas.',
    ],
    _valeurs_autorisees: {
      categorie: CATEGORIES, difficulte: Object.keys(DIFFICULTES), cout: Object.keys(COUTS), appareil_principal: Object.keys(APPAREILS), unites: UNITES,
      regimes_compatibles: Object.keys(REGIMES), allergenes: Object.keys(ALLERGENES), saisons: Object.keys(SAISONS),
    },
    recettes: [{
      titre: 'Gratin de courgettes (exemple)', categorie: 'Plats', description: 'Un gratin simple et léger.', portions_base: 4,
      temps: { preparation_min: 15, cuisson_min: 35, repos_min: 0 }, difficulte: 'facile', cout: 'economique', appareil_principal: 'four',
      ingredients: ['800 g de courgettes', '2 oeufs', '20 cl de crème', '80 g de gruyère râpé', '1 pincée de sel', '1 gousse d\'ail, hachée'],
      etapes: ['Préchauffez le four à 180 °C.', 'Coupez les courgettes en rondelles et faites-les revenir 10 minutes.', 'Mélangez les oeufs, la crème et l\'ail, versez sur les courgettes, ajoutez le gruyère.', 'Enfournez 25 minutes.'],
      astuces: ['Salez les courgettes à la fin pour qu\'elles rendent moins d\'eau.'],
      nutrition_par_portion: { calories_kcal: 280, proteines_g: 13, glucides_g: 9, lipides_g: 21, fibres_g: 2.5, sucres_g: 4, sel_g: 0.9 },
      regimes_compatibles: ['vegetarien'], saisons: ['ete'], tags: ['gratin', 'légumes'],
    }],
  };
}

/** Recettes à exporter : sans identifiant (un nouveau sera attribué à l'import) ni champs internes. */
export function exporterRecettes(recettes) {
  return { recettes: recettes.map(({ id, perso, modifie, ...reste }) => reste) };
}

/** Ingrédient → ligne de texte modifiable (« 200 g de farine, tamisée »). */
export function ingredientVersTexte(i) {
  const q = String(Math.round(i.quantite * 100) / 100).replace('.', ',');
  return `${q}${i.unite && i.unite !== 'pièce' ? ' ' + i.unite : ''} ${i.aliment}${i.precision ? ', ' + i.precision : ''}`.trim();
}
