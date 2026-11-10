// Régimes avancés, exclusions et régimes médicaux. Chaque règle s'applique à une entrée d'index (voir lib/index-entree.js).
// Ce sont des SÉLECTIONS INDICATIVES fondées sur les macros par portion et les ingrédients : elles ne remplacent pas un suivi.
// Les régimes « médical » exigent le rappel « à suivre sur avis médical » partout où ils sont proposés.
import { normaliser } from '../lib/texte.js';
import { REGIMES } from './libelles.js';

export const FAMILLES_REGIMES = {
  mode: 'Modes d\'alimentation',
  populaire: 'Régimes populaires',
  exclusion: 'Exclusions',
  medical: 'Médicaux (avis médical obligatoire)',
};

const ingr = (r) => (r._ingr !== undefined ? r._ingr : normaliser((r.ingredients || []).join(' | ')));
const texte = (r) => `${ingr(r)} | ${normaliser(r.titre || '')}`;
const mots = (r, re) => re.test(texte(r));
const sansMots = (re) => (r) => !mots(r, re);
const VIANDE = /\b(poulet|dinde|canard|boeuf|veau|agneau|porc|jambon|lardon|saucisse|steak|escalope|magret|lapin|cote|roti|viande|bacon|chorizo|merguez|poitrine|cuisse|filet mignon|hache|gigot|boudin|pintade|caille)\b/;
const ALCOOL = /\b(vin|biere|rhum|cognac|calvados|armagnac|porto|madere|vermouth|pastis|liqueur|kirsch|whisky|vodka|champagne|prosecco|cidre|amaretto|cointreau|grand marnier|marsala|sake|mirin)\b/;

const R = (famille, nom, aide, test, extra = {}) => ({ famille, nom, aide, test, ...extra });

export const REGIMES_AVANCES = {
  // Modes d'alimentation
  flexitarien: R('mode', 'Flexitarien', 'Peu de viande : plus de légumes, de légumineuses et de poisson (menus 3 végétariens + 2 poissons par semaine).', () => true, { quotas: { vege: 3, poisson: 2 } }),
  ovo_lacto: R('mode', 'Ovo-lacto-végétarien', 'Sans viande ni poisson ; œufs et produits laitiers acceptés.', (r) => r.regimes.includes('vegetarien')),
  crudivore: R('mode', 'Crudivore léger', 'Recettes sans cuisson.', (r) => r.cuisson === 0),
  // Régimes populaires
  mediterraneen: R('populaire', 'Méditerranéen', 'Huile d\'olive, légumes, légumineuses, poisson ; peu de beurre, de crème et de charcuterie.',
    (r) => mots(r, /\b(huile d olive|olive|poisson|saumon|sardine|thon|dorade|lentille|pois chiche|aubergine|courgette|tomate|feta)\b/) && !mots(r, /\b(beurre|creme|lardon|saucisse|bacon|chorizo|saucisson)\b/)),
  dash: R('populaire', 'DASH (tension)', 'Peu de sel, riche en fibres, légumes et fruits.', (r) => r.nut.sel <= 1.5 && r.nut.f >= 3 && !mots(r, /\b(bouillon cube|sauce soja|anchois|jambon|lardon|saucisson)\b/)),
  nordique: R('populaire', 'Nordique', 'Poissons gras, céréales complètes, baies, légumes racines, chou.', (r) => mots(r, /\b(saumon|hareng|maquereau|truite|seigle|avoine|myrtille|airelle|chou|betterave|pomme de terre|aneth|navet)\b/)),
  anti_inflammatoire: R('populaire', 'Anti-inflammatoire', 'Poissons gras, curcuma, gingembre, légumes verts, huile d\'olive ; peu de sucres et de charcuterie.',
    (r) => mots(r, /\b(curcuma|gingembre|saumon|maquereau|sardine|huile d olive|noix|brocoli|epinard|myrtille|chou kale|avocat)\b/) && r.nut.s <= 10 && !mots(r, /\b(saucisson|lardon|bacon|chorizo|saucisse)\b/)),
  hyperproteine: R('populaire', 'Hyperprotéiné', '25 g de protéines ou plus par portion.', (r) => r.nut.p >= 25),
  low_carb: R('populaire', 'Low carb', '25 g de glucides ou moins par portion.', (r) => r.nut.g <= 25),
  cetogene: R('populaire', 'Cétogène', 'Très peu de glucides (10 g ou moins) et riche en lipides.', (r) => r.nut.g <= 10 && r.kcal > 0 && (r.nut.l * 9) / r.kcal >= 0.6),
  paleo: R('populaire', 'Paléo', 'Sans céréales, laitages, légumineuses ni sucre ajouté.', (r) => !r.allergenes.includes('gluten') && !r.allergenes.includes('lait') && !r.allergenes.includes('soja')
    && !mots(r, /\b(riz|pates|pois chiche|lentille|haricot rouge|haricot blanc|quinoa|sucre|semoule|boulgour|farine|pain|avoine)\b/)),
  jeune: R('populaire', 'Jeûne intermittent', 'Fenêtre alimentaire limitée (16/8, 14/10…) : les menus ne placent des repas que dans la fenêtre.', () => true, { fenetre: true }),
  points: R('populaire', 'Suivi de points maison', 'Chaque recette a des points (calculés par NutriCoach) ; vous gardez un budget de points par jour.', () => true, { points: true }),
  hypocalorique: R('populaire', 'Hypocalorique', '400 kcal ou moins par portion.', (r) => r.regimes.includes('hypocalorique') || r.kcal <= 400),
  hypercalorique: R('populaire', 'Hypercalorique', '600 kcal ou plus par portion.', (r) => r.kcal >= 600),
  // Exclusions
  sans_oeuf: R('exclusion', 'Sans œuf', 'Aucun œuf.', (r) => !r.allergenes.includes('oeuf')),
  sans_arachide: R('exclusion', 'Sans arachide', 'Aucune arachide.', (r) => !r.allergenes.includes('arachides')),
  sans_fruits_a_coque: R('exclusion', 'Sans fruits à coque', 'Aucun fruit à coque.', (r) => !r.allergenes.includes('fruits_a_coque')),
  sans_soja: R('exclusion', 'Sans soja', 'Aucun soja.', (r) => !r.allergenes.includes('soja')),
  sans_poisson: R('exclusion', 'Sans poisson ni fruits de mer', 'Ni poisson, ni crustacés, ni mollusques.', (r) => !['poisson', 'crustaces', 'mollusques'].some((a) => r.allergenes.includes(a))),
  sans_sucre_ajoute: R('exclusion', 'Sans sucre ajouté', 'Peu de sucres et aucun sucre, miel ou sirop dans les ingrédients.', (r) => r.nut.s <= 5 && !mots(r, /\b(sucre|miel|sirop|confiture|cassonade|nappage)\b/)),
  casher: R('exclusion', 'Casher (indicatif)', 'Sans porc, sans crustacés ni mollusques, sans mélange viande et produits laitiers. À confirmer selon votre pratique.',
    (r) => r.regimes.includes('sans_porc') && !r.allergenes.includes('crustaces') && !r.allergenes.includes('mollusques') && !(mots(r, VIANDE) && r.allergenes.includes('lait'))),
  sans_alcool: R('exclusion', 'Sans alcool', 'Aucun alcool dans les ingrédients.', sansMots(ALCOOL)),
  // Médicaux
  diabete_ig: R('medical', 'Diabète / index glycémique bas', 'Peu de glucides et de sucres, des fibres.', (r) => r.regimes.includes('diabetique') || (r.nut.g <= 35 && r.nut.s <= 8 && r.nut.f >= 3), { medical: true }),
  hypertension: R('medical', 'Hypertension / pauvre en sel', '1 g de sel ou moins par portion, sans produits très salés.', (r) => r.nut.sel <= 1 && !mots(r, /\b(bouillon cube|sauce soja|anchois|olive|jambon|lardon|saucisson|chorizo|fromage)\b/), { medical: true }),
  cholesterol: R('medical', 'Cholestérol', 'Peu de graisses, sans beurre, crème, charcuterie ni abats.', (r) => r.nut.l <= 20 && !mots(r, /\b(beurre|creme|lardon|saucisse|saucisson|bacon|chorizo|foie|rognon|jaune d oeuf|fromage)\b/), { medical: true }),
  goutte: R('medical', 'Goutte / pauvre en purines', 'Sans abats, anchois, sardine, maquereau, hareng, fruits de mer, gibier ni viande rouge.', sansMots(/\b(foie|rognon|anchois|sardine|maquereau|hareng|moule|crevette|gambas|homard|crabe|coquille|gibier|boeuf|veau|agneau|porc|canard|biere|lapin)\b/), { medical: true }),
  reflux: R('medical', 'Reflux gastrique', 'Peu gras, sans tomate, agrumes, piment, oignon, café, chocolat ni menthe.', (r) => r.nut.l <= 15 && !mots(r, /\b(tomate|citron|orange|piment|oignon|cafe|chocolat|menthe|vin|vinaigre|ail|curry|poivre)\b/), { medical: true }),
  fodmap: R('medical', 'FODMAP (intestin irritable)', 'Sans ail, oignon, blé, légumineuses, pomme, miel, lait… (liste simplifiée).',
    sansMots(/\b(ail|oignon|echalote|poireau|ble|farine|pates|haricot|lentille|pois chiche|pomme|poire|miel|lait|yaourt|creme|chou fleur|champignon|avocat|mangue|artichaut|asperge|betterave|celeri|prune|semoule|couscous)\b/), { medical: true }),
  coeliaque: R('medical', 'Maladie cœliaque', 'Aucun gluten. Attention aux traces : vérifiez toujours les étiquettes.', (r) => !r.allergenes.includes('gluten'), { medical: true }),
  renal: R('medical', 'Insuffisance rénale (potassium, phosphore, protéines)', 'Protéines modérées, sans aliments très riches en potassium ou en phosphore. À valider avec le néphrologue.',
    (r) => r.nut.p <= 20 && !mots(r, /\b(banane|tomate|pomme de terre|epinard|avocat|chocolat|noix|amande|noisette|champignon|lait|fromage|soja|haricot|lentille|pois chiche)\b/), { medical: true }),
  bariatrique: R('medical', 'Post-bariatrique', 'Petites portions riches en protéines, peu de sucres et de graisses.', (r) => r.kcal <= 450 && r.nut.p >= 15 && r.nut.s <= 8 && r.nut.l <= 20, { medical: true }),
  thyroide: R('medical', 'Hypothyroïdie', 'Sans soja ni crucifères crus en excès (sélection simplifiée).', (r) => !r.allergenes.includes('soja') && !mots(r, /\b(chou cru|brocoli cru|soja)\b/), { medical: true }),
};

export const RAPPEL_MEDICAL = 'À suivre sur avis médical : cette sélection est indicative et ne remplace pas un suivi.';

/** Points « maison » d'une portion (suivi façon points) : plus c'est calorique, sucré, gras, plus il y en a ; protéines et fibres en retirent. */
export function pointsMaison(r) {
  return Math.max(0, Math.round(r.kcal * 0.03 + r.nut.s * 0.15 + r.nut.l * 0.1 - r.nut.p * 0.12 - r.nut.f * 0.25));
}
/** Budget de points par jour pour une cible calorique (environ 1 point pour 55 kcal, plancher 23). */
export const budgetPoints = (cibleKcal) => Math.max(23, Math.round(cibleKcal / 55));

/** La recette respecte-t-elle ce régime ? Régimes du catalogue (listes `regimes`) ou règles avancées ci-dessus. */
export function respecteRegime(r, id) {
  if (REGIMES_AVANCES[id]) return REGIMES_AVANCES[id].test(r);
  return (r.regimes || []).includes(id);
}

/** Nom affichable d'un régime (catalogue ou avancé). */
export const nomRegime = (id) => REGIMES[id] || (REGIMES_AVANCES[id] && REGIMES_AVANCES[id].nom) || String(id).replace(/_/g, ' ');
