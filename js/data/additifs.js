// Table de référence des additifs (E-numbers) : niveau de risque indicatif, versionnée avec les règles d'alerte.
// Niveaux : eleve (à éviter), modere (à limiter), limite (réserves mineures), faible (sans souci connu), sans (neutre).
// Table INDICATIVE construite d'après les avis publics (EFSA, ANSES, CIRC) : à faire relire, voir docs/sources.md.
export const VERSION_ADDITIFS = '2026-11';
export const NIVEAUX_ADDITIFS = {
  eleve: { nom: 'Risque élevé', points: 15 },
  modere: { nom: 'Risque modéré', points: 5 },
  limite: { nom: 'Risque limité', points: 2 },
  faible: { nom: 'Risque faible', points: 1 },
  sans: { nom: 'Sans risque connu', points: 0 },
};

const T = (niveau, nom, note) => ({ niveau, nom, note });
export const ADDITIFS = {
  // Colorants
  E100: T('sans', 'Curcumine'), E101: T('sans', 'Riboflavine'), E120: T('faible', 'Carmin', 'Origine animale (cochenille), allergies possibles'),
  E102: T('modere', 'Tartrazine', 'Colorant azoïque : peut gêner l\'attention des enfants (mention obligatoire en UE)'),
  E104: T('modere', 'Jaune de quinoléine', 'Peut gêner l\'attention des enfants'), E110: T('modere', 'Jaune orangé S', 'Peut gêner l\'attention des enfants'),
  E122: T('modere', 'Azorubine', 'Peut gêner l\'attention des enfants'), E124: T('modere', 'Ponceau 4R', 'Peut gêner l\'attention des enfants'),
  E129: T('modere', 'Rouge allura', 'Peut gêner l\'attention des enfants'), E123: T('eleve', 'Amarante', 'Colorant controversé, interdit dans certains pays'),
  E128: T('eleve', 'Rouge 2G', 'Interdit dans l\'Union européenne'), E131: T('modere', 'Bleu patenté V'), E132: T('limite', 'Indigotine'),
  E133: T('modere', 'Bleu brillant FCF'), E142: T('modere', 'Vert S'), E150: T('limite', 'Caramel', 'Les caramels « ammoniacal » et « sulfite ammoniacal » sont les plus discutés'),
  E160: T('faible', 'Caroténoïdes'), E161: T('faible', 'Xanthophylles'), E162: T('sans', 'Rouge de betterave'), E163: T('sans', 'Anthocyanes'),
  E171: T('eleve', 'Dioxyde de titane', 'Interdit comme additif alimentaire dans l\'UE depuis 2022'), E172: T('faible', 'Oxydes de fer'),
  // Conservateurs
  E200: T('faible', 'Acide sorbique'), E202: T('faible', 'Sorbate de potassium'), E210: T('modere', 'Acide benzoïque'), E211: T('modere', 'Benzoate de sodium'),
  E212: T('modere', 'Benzoate de potassium'), E220: T('modere', 'Dioxyde de soufre', 'Sulfite : allergène, déclencheur d\'asthme possible'),
  E221: T('modere', 'Sulfite de sodium'), E223: T('modere', 'Métabisulfite de sodium'), E224: T('modere', 'Métabisulfite de potassium'), E228: T('modere', 'Bisulfite de potassium'),
  E249: T('eleve', 'Nitrite de potassium', 'Nitrites : formation de nitrosamines ; charcuteries classées « cancérogènes » par le CIRC'),
  E250: T('eleve', 'Nitrite de sodium', 'Nitrites : formation de nitrosamines ; charcuteries classées « cancérogènes » par le CIRC'),
  E251: T('modere', 'Nitrate de sodium'), E252: T('modere', 'Nitrate de potassium'), E260: T('sans', 'Acide acétique'), E270: T('sans', 'Acide lactique'),
  E280: T('limite', 'Acide propionique'), E282: T('limite', 'Propionate de calcium'),
  // Antioxydants
  E300: T('sans', 'Acide ascorbique (vitamine C)'), E301: T('sans', 'Ascorbate de sodium'), E306: T('sans', 'Tocophérols (vitamine E)'), E304: T('faible', 'Palmitate d\'ascorbyle'),
  E320: T('modere', 'BHA', 'Perturbateur endocrinien suspecté'), E321: T('modere', 'BHT'), E310: T('limite', 'Gallate de propyle'),
  // Acidifiants, régulateurs
  E330: T('sans', 'Acide citrique'), E331: T('sans', 'Citrates de sodium'), E332: T('sans', 'Citrates de potassium'), E334: T('sans', 'Acide tartrique'),
  E338: T('limite', 'Acide phosphorique', 'Phosphates : excès déconseillé (reins, os)'), E339: T('limite', 'Phosphates de sodium'), E340: T('limite', 'Phosphates de potassium'),
  E450: T('modere', 'Diphosphates', 'Phosphates ajoutés : excès déconseillé (reins, os)'), E451: T('modere', 'Triphosphates'), E452: T('modere', 'Polyphosphates'),
  E500: T('sans', 'Carbonates de sodium'), E501: T('sans', 'Carbonates de potassium'), E503: T('sans', 'Carbonates d\'ammonium'), E504: T('sans', 'Carbonates de magnésium'),
  E507: T('sans', 'Acide chlorhydrique'), E524: T('limite', 'Hydroxyde de sodium'), E509: T('sans', 'Chlorure de calcium'),
  // Épaississants, émulsifiants, gélifiants
  E322: T('faible', 'Lécithines'), E401: T('faible', 'Alginate de sodium'), E406: T('faible', 'Agar-agar'), E407: T('modere', 'Carraghénanes', 'Effets inflammatoires discutés'),
  E410: T('faible', 'Farine de graines de caroube'), E412: T('faible', 'Gomme guar'), E413: T('faible', 'Gomme adragante'), E414: T('faible', 'Gomme arabique'),
  E415: T('faible', 'Gomme xanthane'), E416: T('faible', 'Gomme karaya'), E417: T('faible', 'Gomme tara'), E422: T('sans', 'Glycérol'), E425: T('faible', 'Konjac'),
  E433: T('modere', 'Polysorbate 80', 'Effets sur le microbiote étudiés'), E440: T('sans', 'Pectines'), E460: T('faible', 'Cellulose'), E461: T('faible', 'Méthylcellulose'),
  E466: T('faible', 'Carboxyméthylcellulose'), E471: T('limite', 'Mono- et diglycérides d\'acides gras'), E472: T('limite', 'Esters de mono- et diglycérides'),
  E475: T('limite', 'Esters polyglycériques'), E476: T('limite', 'Polyricinoléate de polyglycérol'), E481: T('limite', 'Stéaroyl-2-lactylate de sodium'),
  E491: T('limite', 'Monostéarate de sorbitane'), E551: T('limite', 'Dioxyde de silicium'), E553: T('modere', 'Talc / silicates de magnésium'), E555: T('limite', 'Silicate d\'aluminium potassium'),
  E558: T('limite', 'Bentonite'), E570: T('sans', 'Acides gras'), E901: T('faible', 'Cire d\'abeille'), E903: T('faible', 'Cire de carnauba'), E904: T('limite', 'Gomme-laque'),
  E920: T('limite', 'L-cystéine'), E924: T('eleve', 'Bromate de potassium', 'Interdit dans l\'Union européenne'), E927: T('limite', 'Azodicarbonamide'),
  // Exhausteurs de goût
  E620: T('limite', 'Acide glutamique'), E621: T('limite', 'Glutamate monosodique', 'Exhausteur de goût'), E627: T('limite', 'Guanylate disodique'), E631: T('limite', 'Inosinate disodique'),
  E635: T('limite', 'Ribonucléotides disodiques'),
  // Édulcorants
  E420: T('faible', 'Sorbitol', 'Effet laxatif à forte dose'), E421: T('faible', 'Mannitol'), E950: T('modere', 'Acésulfame K'), E951: T('modere', 'Aspartame', 'Classé « peut-être cancérogène » (2B) par le CIRC en 2023, dose journalière admissible inchangée'),
  E952: T('modere', 'Cyclamates'), E954: T('modere', 'Saccharine'), E955: T('modere', 'Sucralose'), E960: T('faible', 'Glycosides de stéviol'), E965: T('faible', 'Maltitol'),
  E966: T('faible', 'Lactitol'), E967: T('faible', 'Xylitol'), E968: T('faible', 'Érythritol'),
  // Épaississant / gaz / divers courants
  E170: T('sans', 'Carbonate de calcium'), E290: T('sans', 'Dioxyde de carbone'), E941: T('sans', 'Azote'), E948: T('sans', 'Oxygène'),
};

/** « en:e322i » ou « E322 » → « E322 » (les sous-lettres sont ramenées au numéro de base). */
export function codeAdditif(tag) {
  const m = /^(?:[a-z]{2}:)?e(\d{3,4})[a-z]*$/i.exec(String(tag).trim());
  return m ? `E${m[1]}` : null;
}

/** Niveau de risque d'un additif (inconnu : « limite » avec la mention « non classé »). */
export function risqueAdditif(tag) {
  const code = codeAdditif(tag);
  if (!code) return null;
  const a = ADDITIFS[code];
  return a ? { code, ...a } : { code, niveau: 'limite', nom: code, note: 'Non classé dans notre table : prudence par défaut' };
}
