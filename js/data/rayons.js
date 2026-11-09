// Rayons de supermarché et classement des aliments par mots-clés (le premier motif qui correspond l'emporte).
// L'ordre de RAYONS est l'ordre de parcours par défaut du magasin ; il est personnalisable dans les réglages.
export const RAYONS = [
  { id: 'fruits_legumes', nom: 'Fruits et légumes', icone: '🥬' },
  { id: 'boulangerie', nom: 'Boulangerie', icone: '🥖' },
  { id: 'boucherie', nom: 'Boucherie et volaille', icone: '🥩' },
  { id: 'poissonnerie', nom: 'Poissonnerie', icone: '🐟' },
  { id: 'cremerie', nom: 'Crèmerie, œufs et fromages', icone: '🧀' },
  { id: 'charcuterie', nom: 'Charcuterie et traiteur', icone: '🥓' },
  { id: 'epicerie_salee', nom: 'Épicerie salée', icone: '🥫' },
  { id: 'epicerie_sucree', nom: 'Épicerie sucrée', icone: '🍫' },
  { id: 'condiments', nom: 'Condiments, huiles et épices', icone: '🧂' },
  { id: 'boissons', nom: 'Boissons', icone: '🥤' },
  { id: 'surgeles', nom: 'Surgelés', icone: '🧊' },
  { id: 'autre', nom: 'Autre', icone: '🛒' },
];

// [rayon, motif] : testé sur le nom sans accents ni majuscules.
const REGLES = [
  ['surgeles', /surgel|^glaces?\b|\bglace (a |au |vanille|chocolat|fraise)|sorbet/],
  ['boulangerie', /mini pain|mini-bouchee|croutes? de vol|^pain\b|\bpain (de|au|complet|burger|pita|naan)|baguette|brioche|tortilla|galette de (ble|sarrasin|riz)|wrap|\bpita\b|naan|biscotte|croissant|pain de mie/],
  ['poissonnerie', /saumon|cabillaud|thon|sardine|maquereau|merlu|colin|lieu |dorade|\bbar\b|loup|sole|truite|crevette|gambas|langoustine|homard|crabe|moule|huitre|saint-jacques|noix de saint|coquille|calamar|encornet|poulpe|seiche|poisson|haddock|morue|anchois|lotte|raie|turbot|bulot|bigorneau|crustace|escargot|fruits de mer|surimi|tarama|requin|espadon|flet|rouget|hareng|daurade|eglefin|julienne|hoki|mulet|saint-pierre|coque\b|coques|palourde|bouchee a la reine/],
  ['charcuterie', /jambon|lardon|bacon|chorizo|saucisson|saucisse|merguez|chipolata|andouille|boudin|rillette|pate de|terrine|foie gras|poitrine fum|speck|coppa|mortadelle|pancetta|lard\b|chair a saucisse|knack|francfort|salami|bresaola|rosette|prosciutto/],
  ['boucherie', /poulet|dinde|canard|magret|pintade|lapin|boeuf|veau|agneau|porc|filet mignon|cote |cotes|escalope|steak|bavette|entrecote|rumsteck|paleron|onglet|gigot|epaule|jarret|rouelle|travers|roti|viande|cuisse|aile de|blanc de|carre d|souris|joue de|queue de|noix de (veau|joue|jambon)|faux-filet|hache|hachee|osso|collier|echine|basse cote|tendron|rognon|foie de|poitrine (de|d)|gesier|cailles?\b|caille|poule|chapon|pigeon|volaille|plat de cote|macreuse|merlan|tournedos|aiguillette|hampe|poitrine de porc|ribs|cote de|\bfoie\b|langue/],
  ['cremerie', /\boeuf|jaune d.oeuf|blanc d.oeuf|beurre(?! de (cacahu|cajou|amande|sesame|karite))|creme(?! de (coco|marron|riz|soja|amande))|lait(?! de (coco|soja|amande|riz|avoine))|yaourt|yogourt|fromage|parmesan|mozzarella|gruyere|emmental|comte|cheddar|emental|brousse|chevre|feta|ricotta|mascarpone|camembert|brie|roquefort|gorgonzola|reblochon|raclette|cantal|maroilles|munster|burrata|halloumi|boursin|philadelphia|skyr|kefir|fromage blanc|faisselle|petit-suisse|petits-suisses|cream cheese|pecorino|grana|manchego|morbier|beaufort|tomme|saint-nectaire|mimolette|babybel|vache qui rit|creme fraiche|chantilly(?! en)|margarine|oeufs|ricotta|stracciatella|bleu d/],
  ['epicerie_salee', /(pulpe|coulis|concentre|puree|sauce|passata) (de |d.)?tomate|tomates? (sechee|concassee|pelee|en conserve)|sauce tomate/],
  ['fruits_legumes', /carotte|oignon|echalote|\bail\b|ail |pomme de terre|patate|courgette|tomate(?! sechee| concassee| pelee| en conserve)|poivron|aubergine|poireau|champignon|salade|laitue|roquette|epinard|mache|endive|chou|brocoli|haricot vert|petit pois|celeri|navet|radis|betterave|concombre|fenouil|asperge|artichaut|potiron|courge|butternut|potimarron|citrouille|panais|topinambour|rutabaga|persil|ciboulette|basilic|coriandre|menthe|thym|romarin|estragon|aneth|cerfeuil|laurier|sauge|origan(?! sec)|cresson|oseille|gingembre|citron|orange|pomme(?! de terre)|poire|banane|fraise|framboise|myrtille|mure|cerise|peche|abricot|prune|raisin|kiwi|ananas|mangue|melon|pasteque|figue|grenade|clementine|mandarine|pamplemousse|avocat|fruit|legume|herbe|echalion|mesclun|jeune pousse|pousse|germe|piment frais|cebette|ciboule|blette|cardon|fenugrec frais|physalis|litchi|papaye|rhubarbe|noix de coco fra|haricot (beurre|plat)|mais doux|mais en|pak|bok|shiitake|cepe|girolle|morille|pleurote|trompette|oignon nouveau|poivre vert frais|citronnelle|mangue|goyave|kaki|nectarine|coing|groseille|cassis|pomelo|yuzu|mirabelle|physalis|datte fra|bette|salicorne|cornichon frais|olive fra/],
  ['condiments', /\bsel\b|bouquet garni|graisse d.oie|cinq-parfums|ras.el.hanout|marjolaine|verveine|combava|cedrat|kimchi|truffe|poivre|epice|paprika|cumin|curcuma|cannelle|muscade|clou de girofle|girofle|curry|piment|cardamome|safran|vanille|anis|badiane|fenugrec|quatre-epices|ras el hanout|garam|za.atar|herbes de provence|origan|vinaigre|huile|moutarde|sauce soja|sauce|nuoc|miso|tahini|sesame|harissa|ketchup|mayonnaise|tabasco|sriracha|cornichon|capre|bouillon|fond de|extrait|colorant|arome|aquafaba|poudre a lever|sirop(?! d.erable)|wasabi|gingembre (moulu|confit)|zeste|poudre de|noix de muscade|baie|genievre|sumac|nigelle|moulu|sechee? |aromate|assaisonnement|concentre de tomate|worcestershire|pesto|tapenade|olive|raifort|gomasio|fleur de sel|levure de boulanger|gelatine|agar|bicarbonate|levure|vinaigrette/],
  ['epicerie_sucree', /sucre|chocolat|cacao|miel|confiture|nutella|pate a tartiner|caramel|sirop d.erable|sirop d.agave|farine|fecule|maizena|amande|noisette|noix|pistache|cajou|cacahuete|pecan|macadamia|pignon|raisin sec|fruit sec|datte|abricot sec|canneberge|cranberr|biscuit|speculoos|palet|meringue|praline|nougat|pepite|vermicelle|decor|nappage|gelee|compote|puree de (fruit|amande|noisette)|coco rape|noix de coco|flocons d.avoine|muesli|cereale|granola|poudre d.amande|mascarpone|creme de marron|bonbon|marshmallow|chamallow|pain d.epices|chataigne|marron|cassonade|fondant|genoise|graines de (pavot|tournesol)|graines de chia|rhum|kirsch|liqueur|amaretto|cointreau|grand marnier|sucre glace/],
  ['boissons', /calvados|pastis|armagnac|vin|biere|cidre|champagne|prosecco|jus |eau (petillante|gazeuse|minerale|de coco)|cafe|the\b|infusion|soda|limonade|tonic|alcool|whisky|vodka|gin\b|cognac|porto|madere|vermouth|sake|mirin|boisson|lait de (soja|amande|riz|avoine)/],
  ['epicerie_salee', /blinis|crepes?\b|cheveux d.ange|gnocchi|edamame|proteines? de soja|linguine|farfalle|rigatoni|conchigl|pappardelle|orecchiette|cannelloni|trenette|spirelli|tortellini|ravioli|crozet|wonton|cornflakes|crepe salee|pate|spaghetti|tagliatelle|penne|fusilli|macaroni|lasagne|vermicelle de riz|nouille|riz|semoule|boulgour|quinoa|couscous|lentille|pois chiche|haricot (rouge|blanc|noir|sec)|feve|flageolet|ble |ble$|polenta|millet|sarrasin|epeautre|orge|avoine|tomate (sechee|concassee|pelee)|pulpe de tomate|coulis|passata|conserve|thon en|sardine en|mais|lait de coco|creme de coco|chapelure|panure|tapioca|galette|chips|cracker|olives?\b|artichaut en|coeur de palmier|champignon (seche|en)|algue|nori|wakame|pate feuilletee|pate brisee|pate sablee|pate a pizza|pate filo|feuille de brick|pate (a|de)|cube|soupe|bouillon cube|sauce tomate|tofu|tempeh|seitan|houmous|falafel|haricots|pois|lupin|concentre|puree de tomate|ble|maïs|champignons? de paris en|petits pois en/],
];

/** Rayon d'un aliment (identifiant), « autre » si rien ne correspond. */
export function rayonDe(aliment) {
  const t = String(aliment).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [rayon, motif] of REGLES) if (motif.test(t)) return rayon;
  return 'autre';
}
