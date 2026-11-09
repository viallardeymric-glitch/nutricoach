// Aliments déconseillés selon le profil : une règle = un motif (texte sans accents) + la raison en une phrase.
// niveau « rouge » : à éviter ; « orange » : à limiter ou à adapter. Sources : voir data/sources.js.
// Les règles sont GÉNÉRALES : à faire relire par un professionnel de santé avant de s'y fier (voir docs/sources.md).
const GROSSESSE = ['femme_enceinte'];
const ALLAIT = ['femme_enceinte', 'allaitante'];
const LISTERIA = ['femme_enceinte', 'immunodeprime'];
const PETITS = ['enfant_moins_de_3_ans', 'enfant'];

export const REGLES_ALERTE = [
  { id: 'alcool', profils: [...ALLAIT, ...PETITS], niveau: 'rouge', source: 'SPF', exclure: /sans alcool|0[.,]0 ?%|desalcoolise|vinaigre|vinaigrette/,
    motif: /\b(vin|vins|biere|bieres|cidre|champagne|prosecco|alcool|whisky|vodka|rhum|cognac|liqueur|aperitif|pastis|calvados|armagnac|porto|vermouth|gin|cocktail)\b/,
    raison: 'L\'alcool est déconseillé : il passe chez le bébé et aucune dose n\'est connue pour être sans risque.' },
  { id: 'lait-cru', profils: [...LISTERIA, ...PETITS], niveau: 'rouge', source: 'SPF',
    motif: /\blait cru\b|au lait cru|non pasteuris/,
    raison: 'Le lait cru et les fromages au lait cru peuvent contenir la bactérie de la listériose, dangereuse pour le bébé.' },
  { id: 'fromage-croute', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /\b(camembert|brie|munster|maroilles|pont l eveque|livarot|epoisses|reblochon|roquefort|gorgonzola|bleu|saint-marcellin|coulommiers|chaource)\b/,
    raison: 'Fromage à pâte molle ou persillée : à choisir pasteurisé et à consommer sans la croûte (risque de listériose).' },
  { id: 'charcuterie-crue', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /\b(jambon cru|saucisson|chorizo|rillettes?|pate|terrine|foie gras|coppa|bresaola|prosciutto|speck|rosette|salami|mortadelle|jambon sec|pancetta|andouille)\b/,
    raison: 'Charcuterie crue, pâtés et rillettes : à éviter ou à bien cuire (risque de listériose et de toxoplasmose).' },
  { id: 'poisson-cru', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /saumon fume|truite fumee|poisson fume|\b(sushi|sashimi|ceviche|tarama|huitres?)\b|carpaccio de (saumon|poisson|thon)|coquillages? crus?|poisson cru/,
    raison: 'Poisson ou coquillage cru ou fumé : à éviter (listériose, parasites). Bien cuit, c\'est possible.' },
  { id: 'viande-crue', profils: [...LISTERIA, ...PETITS], niveau: 'orange', source: 'SPF',
    motif: /\b(tartare|carpaccio|viande crue|steak tartare)\b/,
    raison: 'Viande crue ou peu cuite : à éviter (toxoplasmose, bactéries). Bien cuite à cœur, c\'est possible.' },
  { id: 'oeuf-cru', profils: [...LISTERIA, ...PETITS], niveau: 'orange', source: 'SPF',
    motif: /oeufs? crus?|mayonnaise (maison|fraiche|artisanale)|mousse au chocolat|tiramisu|chocolat mousse/,
    raison: 'Œuf cru ou peu cuit : à éviter (salmonelle). Les œufs bien cuits sont possibles.' },
  { id: 'mercure', profils: [...ALLAIT, ...PETITS], niveau: 'orange', source: 'ANSES',
    motif: /\b(espadon|requin|marlin|siki|lamproie)\b/,
    raison: 'Poisson prédateur riche en mercure : à éviter pendant la grossesse, l\'allaitement et chez le jeune enfant.' },
  { id: 'foie', profils: GROSSESSE, niveau: 'orange', source: 'ANSES',
    motif: /\bfoie\b|pate de foie|foie gras/,
    raison: 'Le foie contient beaucoup de vitamine A : un excès est déconseillé pendant la grossesse.' },
  { id: 'germes-crus', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /graines? germees?|pousses? de (soja|luzerne|alfalfa)|alfalfa|germes? de (soja|luzerne)/,
    raison: 'Graines germées crues : à éviter (bactéries). Bien cuites, c\'est possible.' },
  { id: 'cafeine', profils: [...ALLAIT, ...PETITS], niveau: 'orange', source: 'ANSES',
    exclure: /decafeine|sans cafeine/, motif: /\b(cafe|energy|boisson energisante|guarana|red bull)\b/,
    raison: 'Caféine : à limiter (environ 200 mg par jour pendant la grossesse) ; déconseillée aux enfants.' },
  { id: 'sucres-rapides', profils: ['diabetique'], niveau: 'orange', source: 'PNNS',
    motif: /\b(soda|sirop|limonade|bonbons?|confiserie|jus de fruits?|confiture|biscuits? (sucres?|chocolat)|gaufre|nectar)\b/,
    raison: 'Sucres rapides : ils font monter la glycémie. À limiter ou à intégrer à un repas, sur avis médical.' },
  { id: 'sel', profils: ['hypertendu'], niveau: 'orange', source: 'PNNS',
    motif: /\b(bouillon cube|sauce soja|anchois|olives?|chips|saucisson|jambon|charcuterie|fromage frais sale|cornichons?)\b/,
    raison: 'Aliment riche en sel : à limiter en cas d\'hypertension (repère : moins de 5 g de sel par jour).' },
];

// Mots qui trahissent un allergène dans un nom d'aliment (quand on n'a pas la liste officielle, comme sur une liste de courses).
export const MOTS_ALLERGENES = {
  gluten: /\b(farine|ble|pain|pate|pates|spaghetti|semoule|couscous|boulgour|biscuit|chapelure|seigle|orge|epeautre|brioche|baguette|pizza|gateau|croissant|biere)\b/,
  lait: /\b(lait|beurre|creme|fromage|yaourt|parmesan|mozzarella|gruyere|emmental|comte|chevre|feta|ricotta|mascarpone|camembert|brie|raclette|cheddar|skyr|kefir)\b/,
  oeuf: /\b(oeufs?|mayonnaise|meringue|jaune d.oeuf)\b/,
  poisson: /\b(poisson|saumon|thon|cabillaud|sardine|maquereau|merlu|colin|truite|anchois|dorade|sole|bar|lotte|haddock|morue)\b/,
  crustaces: /\b(crevettes?|gambas|homard|langoustines?|crabe|ecrevisse)\b/,
  mollusques: /\b(moules?|huitres?|calamars?|poulpe|seiche|escargots?|saint-jacques|coquillages?|palourdes?)\b/,
  arachides: /\b(arachides?|cacahuetes?)\b/,
  fruits_a_coque: /\b(amandes?|noisettes?|noix|pistaches?|cajou|pecan|macadamia|praline)\b/,
  soja: /\b(soja|tofu|edamame|tempeh|miso)\b/,
  celeri: /\bceleri\b/,
  moutarde: /\bmoutarde\b/,
  sesame: /\b(sesame|tahini|houmous)\b/,
  sulfites: /\b(vin|vinaigre|fruits? secs?)\b/,
  lupin: /\blupin\b/,
};
