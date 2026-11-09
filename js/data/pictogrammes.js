// Un pictogramme par sous-catégorie (photo : phase ultérieure). Les règles sont testées dans l'ordre.
import { normaliser } from '../lib/texte.js';

const REGLES = [
  [/crustace/, '🦐'], [/coquillage|mollusque/, '🦪'], [/poisson|saumon/, '🐟'],
  [/poulet|dinde|pintade|canard/, '🍗'], [/boeuf|bœuf|agneau|veau|porc|viande|hachee/, '🥩'],
  [/pates/, '🍝'], [/riz|cereale/, '🍚'], [/asiatique/, '🍜'], [/oriental/, '🥙'], [/americain/, '🍔'],
  [/soupe|veloute/, '🍲'], [/salade|crudite|bowl|cru_marine/, '🥗'], [/oeuf/, '🍳'],
  [/curry|mijote/, '🥘'], [/legume|legumineuse|vegan|proteine/, '🥦'], [/gratin/, '🧀'],
  [/chocolat/, '🍫'], [/glace|sorbet/, '🍨'], [/crepe|gaufre/, '🥞'], [/biscuit/, '🍪'],
  [/muffin|madeleine|gateau|buche|entremets|choux/, '🍰'], [/tarte|feuillete|clafoutis|crumble/, '🥧'],
  [/brioche|pain|toast|tartine|petit_dejeuner/, '🥖'], [/confiture|compote|fruit/, '🍓'],
  [/creme|flan|mousse|verrine/, '🍮'], [/brochette/, '🍢'], [/bouchee|farci|beignet/, '🥟'],
  [/dip|tartinade|terrine/, '🫕'],
];
const PAR_CATEGORIE = { 'Entrées': '🥗', 'Plats': '🍽️', 'Desserts': '🍰', 'Goûters': '🍪', 'Apéros': '🥂' };

export function pictogramme(sousCategorie, categorie) {
  const s = normaliser(sousCategorie);
  for (const [re, emoji] of REGLES) if (re.test(s)) return emoji;
  return PAR_CATEGORIE[categorie] || '🍽️';
}
