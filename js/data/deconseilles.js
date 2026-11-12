// Aliments déconseillés selon le profil : une règle = un motif (texte sans accents) + la raison en une phrase.
// niveau « rouge » : à éviter ; « orange » : à limiter ou à adapter. Sources : voir data/sources.js.
// Les règles sont GÉNÉRALES : à faire relire par un professionnel de santé avant de s'y fier (voir docs/sources.md).
const GROSSESSE = ['femme_enceinte'];
const ALLAIT = ['femme_enceinte', 'allaitante'];
const LISTERIA = ['femme_enceinte', 'immunodeprime'];
const PETITS = ['enfant_moins_de_3_ans', 'enfant'];

export const REGLES_ALERTE = [
  { id: 'alcool', profils: [...ALLAIT, ...PETITS], niveau: 'rouge', source: 'SPF', exclure: /sans alcool|0[.,]0 ?%|desalcoolise|vinaigre|vinaigrette|cocktail de (?:fruits de mer|crevettes)|sauce cocktail/,
    motif: /\b(vin|vins|biere|bieres|cidre|champagne|prosecco|alcool|whisky|vodka|rhum|cognac|liqueur|aperitif|pastis|calvados|armagnac|porto|vermouth|gin|cocktail)\b/,
    raison: 'L\'alcool est déconseillé : il passe chez le bébé et aucune dose n\'est connue pour être sans risque.' },
  { id: 'lait-cru', profils: [...LISTERIA, ...PETITS], niveau: 'rouge', source: 'SPF',
    motif: /\blait cru\b|au lait cru|non pasteuris/,
    raison: 'Le lait cru et les fromages au lait cru peuvent contenir la bactérie de la listériose, dangereuse pour le bébé.' },
  { id: 'fromage-croute', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /\b(camembert|brie|munster|maroilles|pont l eveque|livarot|epoisses|reblochon|roquefort|gorgonzola|bleu|saint-marcellin|coulommiers|chaource)\b/,
    raison: 'Fromage à pâte molle ou persillée : à choisir pasteurisé et à consommer sans la croûte (risque de listériose).' },
  { id: 'charcuterie-crue', profils: LISTERIA, niveau: 'orange', source: 'SPF',
    motif: /\b(jambon cru|saucisson|chorizo|rillettes?|pate (?:de campagne|en croute|de foie|de canard|de lapin|de tete|de porc|de volaille|de gibier|de poisson|breton|de merle)|terrine|foie gras|coppa|bresaola|prosciutto|speck|rosette|salami|mortadelle|jambon sec|pancetta|andouille)\b/,
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
  { id: 'miel-bebe', profils: ['bebe'], niveau: 'rouge', source: 'ANSES', motif: /\bmiel\b|sirop d agave/,
    raison: 'Le miel est déconseillé avant 1 an : risque de botulisme infantile.' },
  { id: 'lait-vache-bebe', profils: ['bebe'], niveau: 'orange', source: 'PNNS', motif: /\blait (de vache|demi|entier|ecreme)\b|\blait\b(?! infantile| maternel)/,
    raison: 'Avant 1 an, le lait de vache ne remplace pas le lait infantile ou maternel (fer, reins).' },
  { id: 'etouffement', profils: ['enfant_moins_de_3_ans'], niveau: 'orange', source: 'PNNS',
    motif: /\b(cacahuetes?|arachides?|noix|noisettes?|amandes?|pistaches?|raisins?|tomates? cerises?|olives?|pop ?corn|bonbons? durs?|carottes? crues?|saucisson|chewing)\b/,
    raison: 'Risque d\'étouffement avant 3 ans : fruits à coque, raisins, tomates cerises… à écraser, mixer ou couper en petits morceaux.' },
  { id: 'sel-petit', profils: ['bebe', 'enfant_moins_de_3_ans'], niveau: 'orange', source: 'PNNS', motif: /\b(bouillon cube|sauce soja|chips|jambon|saucisson|charcuterie|anchois)\b/,
    raison: 'Trop salé pour un jeune enfant : ses reins ne savent pas encore éliminer l\'excès de sel.' },
  { id: 'allergenes-bebe', profils: ['bebe'], niveau: 'orange', source: 'PNNS', motif: /\b(oeufs?|arachides?|cacahuetes?|poisson|crevettes?|sesame|noisettes?|amandes?|soja|ble|gluten)\b/,
    raison: 'Allergène courant : à introduire progressivement, en petite quantité, et en suivant l\'avis du pédiatre.' },
  { id: 'boisson-sucree-enfant', profils: ['enfant', 'enfant_moins_de_3_ans'], niveau: 'orange', source: 'PNNS', motif: /\b(soda|sirop|jus de fruits?|boisson energisante|limonade|nectar)\b/,
    raison: 'Boisson sucrée : à limiter chez l\'enfant, l\'eau reste la meilleure boisson.' },
  { id: 'sucres-rapides', profils: ['diabetique'], niveau: 'orange', source: 'PNNS',
    motif: /\b(soda|sirop|limonade|bonbons?|confiserie|jus de fruits?|confiture|biscuits? (sucres?|chocolat)|gaufre|nectar)\b/,
    raison: 'Sucres rapides : ils font monter la glycémie. À limiter ou à intégrer à un repas, sur avis médical.' },
  { id: 'sel', profils: ['hypertendu'], niveau: 'orange', source: 'PNNS',
    motif: /\b(bouillon cube|sauce soja|anchois|olives?|chips|saucisson|jambon|charcuterie|fromage frais sale|cornichons?)\b/,
    raison: 'Aliment riche en sel : à limiter en cas d\'hypertension (repère : moins de 5 g de sel par jour).' },
];

// Faux amis : retirés ou simplifiés avant la recherche d'allergènes (« lait de coco » n'est pas du lait, « noix de muscade » n'est pas un fruit à coque…).
// 1) expressions supprimées entièrement ; 2) « lait/crème/yaourt/beurre/pâte de X » : on garde X (le lait d'amande reste un fruit à coque).
const SUPPRIMER_FAUX = /\bcreme de tartre\b|\bnoix (?:de|d') ?(?:muscade|coco)\b|\bpate (?:de|d') ?(?:curry|miso|piment|tomate|fruits?|coing|datte|sesame)\b|\bbeurre de (?:cacao|karite)\b|\bsans gluten\b|\bsans lactose\b|\bsans lait\b/g;
const GARDER_PLANTE = /\b(?:lait|creme|yaourt|beurre|fromage|pate|farine|semoule|flocons|galette|pain|biscuits?|nouilles|vermicelles?|spaghetti|pates) (?:de |d')?(coco|soja|amandes?|avoine|riz|cajou|noisettes?|cacahuetes?|marrons?|chataignes?|epeautre|chanvre|pistaches?|mais|sarrasin|quinoa|millet|pois chiches?|lentilles?)\b/g;

// Mots qui trahissent un allergène dans un nom d'aliment (quand on n'a pas la liste officielle, comme sur une liste de courses ou une recette ajoutée à la main).
export const MOTS_ALLERGENES = {
  gluten: /\b(farine|ble|pain|pate|pates|spaghetti|semoule|couscous|boulgour|biscuit|biscuits|chapelure|panure|panko|seigle|orge|epeautre|avoine|brioche|baguette|pizza|gateau|croissant|biere|malt|macaroni|penne|rigatoni|farfalle|linguine|tagliatelles?|fusilli|lasagnes?|coquillettes?|vermicelles?|nouilles|gnocchi|tortellini|ravioli|seitan|feuilles? de brick|sauce soja|teriyaki|tamari|shoyu|speculoos|pain d epices|fondant patissier|wrap|galette|cracker|crackers|muesli|granola|kamut|triticale)\b/,
  lait: /\b(lait|beurre|creme|fromage|yaourt|parmesan|mozzarella|gruyere|emmental|comte|chevre|feta|ricotta|mascarpone|camembert|brie|raclette|cheddar|skyr|kefir|cantal|roquefort|bleu|gorgonzola|reblochon|beaufort|pecorino|tomme|munster|maroilles|morbier|salers|manchego|halloumi|burrata|cottage|faisselle|petit suisse|chantilly|bechamel|ghee|babeurre|lactose|caseine|whey|lactoserum|glaces? (?:a la )?(?:vanille|chocolat|fraise|pistache)|creme glacee|chocolat blanc|chocolat au lait|pesto|pate feuilletee|pate brisee|pate sablee|pain brioche|brioche|nougatine|praline|fondant patissier|tiramisu|flan|clafoutis)\b/,
  oeuf: /\b(oeufs?|mayonnaise|meringue|sabayon|jaune d.oeuf|blanc d.oeuf|pates? fraiches?|tagliatelles? fraiches?|brioche|pain brioche|glaces? (?:a la )?(?:vanille|chocolat|fraise|pistache)|creme glacee|creme anglaise|gaufre|crepes?|biscuit a la cuillere|fondant patissier|tiramisu|flan|aioli|hollandaise|bearnaise)\b/,
  poisson: /\b(poissons?|saumon|thon|cabillaud|sardines?|maquereau|merlu|colin|truite|anchois|dorade|daurade|sole|bar|lotte|haddock|morue|lieu|rouget|eglefin|fletan|raie|espadon|julienne|turbot|merlan|limande|hareng|sandre|brochet|perche|mulet|rascasse|congre|baudroie|maigre|saint-pierre|barbue|roussette|carrelet|nuoc[ -]?mam|fumet|court-bouillon|tarama|surimi|worcestershire|poutargue|oeufs? de (?:lump|saumon|truite|poisson)|caviar)\b/,
  crustaces: /\b(crevettes?|gambas|homard|langoustines?|langoustes?|crabe|tourteau|araignee de mer|ecrevisses?|bisque|cocktail de fruits de mer|fruits de mer|scampi)\b/,
  mollusques: /\b(moules?|huitres?|calamars?|encornets?|poulpe|pieuvre|seiche|escargots?|saint-jacques|coquilles?|coquillages?|palourdes?|coques|praires?|couteaux|bulots?|bigorneaux?|oursins?|ormeaux?|fruits de mer|cocktail de fruits de mer)\b/,
  arachides: /\b(arachides?|cacahuetes?|satay|huile d arachide)\b/,
  fruits_a_coque: /\b(amandes?|noisettes?|noix|pistaches?|cajou|pecans?|macadamia|praline|pignons?|pesto|noix du bresil|gianduja|nougat|frangipane|massepain|pate d amande)\b/,
  soja: /\b(soja|tofu|edamame|tempeh|miso|tamari|shoyu|teriyaki|sauce soja|yuba|natto|lecithine de soja)\b/,
  celeri: /\b(celeri|celeri-rave|sel de celeri)\b/,
  moutarde: /\b(moutarde|mayonnaise|graines de moutarde|sauce tartare|ravigote)\b/,
  sesame: /\b(sesame|tahini|houmous|halva|gomasio)\b/,
  sulfites: /\b(vin|vins|vinaigre|fruits? secs?|cidre|biere|champagne|porto|madere|marsala|xeres|cornichons?|abricots? secs?|pruneaux?|pruneau|raisins? secs?|cranberries sechees|vermouth|prosecco|cremant)\b/,
  lupin: /\blupin\b/,
};

/** Allergènes mentionnés dans un texte normalisé (plusieurs aliments séparés par « | » possibles) : faux amis écartés, « sans gluten / sans lait » respectés. */
export function allergenesDansTexte(texte) {
  const res = new Set();
  for (const part of String(texte).split('|')) {
    const sansGluten = /sans gluten/.test(part); const sansLait = /sans (?:lait|lactose)/.test(part);
    const p = ` ${part} `.replace(SUPPRIMER_FAUX, ' ').replace(GARDER_PLANTE, ' $1 ').replace(/noix (?:de|d') ?saint-jacques/g, ' saint-jacques ');
    for (const a of Object.keys(MOTS_ALLERGENES)) {
      if (a === 'gluten' && sansGluten) continue;
      if (a === 'lait' && sansLait) continue;
      if (MOTS_ALLERGENES[a].test(p)) res.add(a);
    }
  }
  return [...res];
}

/** Faux amis pour les règles d'alerte : « huile d'olive » n'est pas « olives » (riche en sel, risque d'étouffement). */
export const nettoyerPourRegles = (t) => String(t).replace(/huile d['’ ]?olive/g, ' huile ');
