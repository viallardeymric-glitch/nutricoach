// Guide alimentation et grossesse : repères généraux issus des recommandations françaises (Santé publique France / Manger Bouger,
// ANSES, HAS, Assurance maladie). À faire relire par un professionnel de santé. En cas de doute : sage-femme, médecin, pharmacien.
// statut : interdit (à ne pas consommer) · eviter (déconseillé) · limiter (avec modération) · ok (autorisé, avec précautions éventuelles)
export const STATUTS = {
  interdit: { nom: 'Interdit', icone: '⛔', ordre: 0 },
  eviter: { nom: 'À éviter', icone: '🚫', ordre: 1 },
  limiter: { nom: 'À limiter', icone: '⚠️', ordre: 2 },
  ok: { nom: 'Autorisé', icone: '✅', ordre: 3 },
};

export const CATEGORIES_GROSSESSE = {
  boissons: 'Boissons', viandes: 'Viandes et charcuteries', poissons: 'Poissons et fruits de mer', laitiers: 'Fromages et produits laitiers',
  oeufs: 'Œufs', vegetaux: 'Fruits, légumes et céréales', autres: 'Autres aliments', hygiene: 'Hygiène et conservation',
};

export const ALIMENTS_GROSSESSE = [
  // Boissons
  { id: 'alcool', nom: 'Alcool (bière, vin, cidre, spiritueux, même en petite quantité)', mots: ['alcool', 'vin', 'biere', 'cidre', 'champagne', 'whisky', 'cocktail', 'apero'], cat: 'boissons', statut: 'interdit',
    pourquoi: 'Aucune quantité d\'alcool n\'est sans risque pour le bébé (syndrome d\'alcoolisation fœtale).', conseil: 'Zéro alcool pendant toute la grossesse. Pensez aussi aux plats cuisinés à l\'alcool flambé non cuit et aux « sans alcool » mal étiquetés.' },
  { id: 'cafe', nom: 'Café et boissons à la caféine', mots: ['cafe', 'expresso', 'cafeine', 'the', 'cola', 'coca', 'boisson energisante', 'redbull'], cat: 'boissons', statut: 'limiter',
    pourquoi: 'La caféine passe chez le bébé et peut augmenter le risque de petit poids de naissance.', conseil: 'Pas plus de 200 mg de caféine par jour (environ 2 tasses de café ou 3 à 4 tasses de thé, en comptant le cola et le chocolat). Évitez les boissons énergisantes.' },
  { id: 'boisson_energisante', nom: 'Boissons énergisantes', mots: ['energisante', 'redbull', 'monster', 'energy'], cat: 'boissons', statut: 'eviter',
    pourquoi: 'Très riches en caféine et en autres stimulants.', conseil: 'À éviter pendant la grossesse.' },
  { id: 'lait_cru', nom: 'Lait cru et jus de fruits frais non pasteurisés', mots: ['lait cru', 'jus frais', 'jus presse', 'non pasteurise', 'kombucha'], cat: 'boissons', statut: 'eviter',
    pourquoi: 'Risque de listériose et d\'autres infections.', conseil: 'Buvez du lait pasteurisé ou UHT. Pressez vous-même vos jus et buvez-les tout de suite, ou prenez des jus pasteurisés. Le kombucha non pasteurisé est à éviter.' },
  { id: 'tisanes', nom: 'Tisanes et infusions de plantes', mots: ['tisane', 'infusion', 'plante', 'reglisse', 'verveine', 'camomille'], cat: 'boissons', statut: 'limiter',
    pourquoi: 'Certaines plantes ne sont pas recommandées pendant la grossesse (la réglisse en particulier fait monter la tension).', conseil: 'Gardez les tisanes occasionnelles et demandez conseil à votre pharmacien ou sage-femme pour un mélange précis. Évitez la réglisse.' },
  { id: 'eau', nom: 'Eau du robinet ou en bouteille', mots: ['eau', 'robinet', 'minerale'], cat: 'boissons', statut: 'ok',
    pourquoi: 'Aucun risque particulier.', conseil: 'Buvez régulièrement, environ 1,5 litre par jour. L\'eau du robinet est contrôlée.' },

  // Viandes
  { id: 'viande_crue', nom: 'Viande crue ou peu cuite (steak tartare, carpaccio, viande saignante, bœuf à point)', mots: ['viande crue', 'tartare', 'carpaccio', 'saignant', 'bleu', 'a point', 'rosee', 'boeuf', 'canard', 'magret'], cat: 'viandes', statut: 'interdit',
    pourquoi: 'Risque de toxoplasmose et d\'infections bactériennes (salmonelles, E. coli).', conseil: 'Cuisez la viande à cœur (plus de rose, jus clair), surtout la viande hachée. Le magret et le canard aussi.' },
  { id: 'charcuterie_crue', nom: 'Charcuterie crue (jambon cru, saucisson, chorizo, coppa, lard cru, bacon cru)', mots: ['jambon cru', 'saucisson', 'chorizo', 'coppa', 'lard', 'bacon', 'pancetta', 'speck', 'bresaola', 'jambon de pays', 'serrano', 'parme'], cat: 'viandes', statut: 'eviter',
    pourquoi: 'Risque de toxoplasmose et de listériose.', conseil: 'Évitez-la, ou consommez-la seulement bien cuite (pizza, quiche, plat chaud) : la cuisson à cœur détruit les germes. Le jambon cuit est autorisé.' },
  { id: 'rillettes_pate', nom: 'Rillettes, pâtés, foie gras, produits en gelée, fromage de tête', mots: ['rillettes', 'pate', 'foie gras', 'gelee', 'fromage de tete', 'terrine', 'mousse de foie'], cat: 'viandes', statut: 'eviter',
    pourquoi: 'Risque de listériose.', conseil: 'À éviter, y compris les pâtés en croûte. Les conserves stérilisées industrielles sont plus sûres, mais à consommer rapidement après ouverture.' },
  { id: 'jambon_cuit', nom: 'Jambon cuit, blanc de poulet, charcuterie cuite en tranches', mots: ['jambon cuit', 'jambon blanc', 'blanc de poulet', 'dinde', 'charcuterie cuite', 'saucisse'], cat: 'viandes', statut: 'limiter',
    pourquoi: 'Peut contenir de la listeria si elle est mal conservée.', conseil: 'Préférez le jambon sous vide, à consommer dans les 24 heures après ouverture ; retirez la couenne. Évitez la découpe à la coupe en rayon.' },
  { id: 'foie', nom: 'Foie (veau, volaille, porc) et produits à base de foie', mots: ['foie', 'abats', 'vitamine a'], cat: 'viandes', statut: 'eviter',
    pourquoi: 'Très riche en vitamine A, qui peut être néfaste pour le bébé en excès.', conseil: 'Évitez le foie et ses dérivés pendant la grossesse.' },
  { id: 'viande_cuite', nom: 'Viande, volaille et jambon bien cuits (cuisson à cœur)', mots: ['poulet', 'viande cuite', 'porc', 'veau', 'agneau', 'dinde'], cat: 'viandes', statut: 'ok',
    pourquoi: 'La cuisson à cœur (au moins 70 °C) détruit les parasites et les bactéries.', conseil: 'Plus de rose à l\'intérieur, jus clair. Lavez-vous les mains et la planche après avoir manipulé de la viande crue.' },

  // Poissons
  { id: 'poisson_cru', nom: 'Poissons et coquillages crus (sushi, sashimi, huîtres, moules crues, tartare, ceviche)', mots: ['sushi', 'sashimi', 'huitre', 'moule crue', 'tartare de poisson', 'ceviche', 'poisson cru', 'coquillage', 'makis', 'bulot', 'palourde'], cat: 'poissons', statut: 'interdit',
    pourquoi: 'Risque de listériose, d\'intoxication et de parasites.', conseil: 'Cuisez-les bien (poisson à cœur, coquillages à l\'ébullition). Les makis végétariens ou à poisson cuit sont autorisés.' },
  { id: 'poisson_fume', nom: 'Poisson fumé ou mariné (saumon fumé, truite fumée, hareng mariné)', mots: ['saumon fume', 'truite fumee', 'fume', 'marine', 'hareng', 'gravlax'], cat: 'poissons', statut: 'eviter',
    pourquoi: 'Risque de listériose.', conseil: 'À éviter, ou à consommer bien cuit (en plat chaud, tarte).' },
  { id: 'poisson_mercure', nom: 'Gros poissons prédateurs : espadon, marlin, requin, lamproie, siki', mots: ['espadon', 'marlin', 'requin', 'lamproie', 'siki', 'mercure'], cat: 'poissons', statut: 'interdit',
    pourquoi: 'Forte teneur en mercure, toxique pour le système nerveux du bébé.', conseil: 'À ne pas consommer pendant la grossesse.' },
  { id: 'poisson_limiter', nom: 'Thon, bar, lotte, brochet, dorade, raie, bonite : poissons à limiter', mots: ['thon', 'bar', 'lotte', 'brochet', 'dorade', 'raie', 'bonite', 'saumon sauvage'], cat: 'poissons', statut: 'limiter',
    pourquoi: 'Ils peuvent contenir du mercure ou des polluants.', conseil: 'Pas plus d\'une portion par semaine de ces poissons, et pas d\'autre poisson prédateur la même semaine. Le thon en boîte : limitez-le aussi.' },
  { id: 'poisson_cuit', nom: 'Poisson bien cuit (saumon, sardine, maquereau, cabillaud, colin, truite, hareng frais)', mots: ['saumon', 'sardine', 'maquereau', 'cabillaud', 'colin', 'truite', 'merlu', 'poisson', 'crevette', 'omega 3'], cat: 'poissons', statut: 'ok',
    pourquoi: 'Source de protéines, d\'iode et d\'oméga-3 utiles au développement du bébé.', conseil: 'Visez 2 portions de poisson par semaine, dont 1 de poisson gras (sardine, maquereau, saumon), bien cuites. Variez les espèces. Les crevettes et fruits de mer bien cuits sont autorisés.' },

  // Laitiers
  { id: 'fromage_lait_cru', nom: 'Fromages au lait cru ou à croûte (camembert, brie, munster, reblochon, pont-l\'évêque, chèvre frais)', mots: ['camembert', 'brie', 'munster', 'reblochon', 'pont eveque', 'chevre', 'lait cru', 'croute', 'epoisses', 'livarot', 'maroilles', 'coulommiers', 'fromage'], cat: 'laitiers', statut: 'eviter',
    pourquoi: 'Risque de listériose.', conseil: 'Évitez les fromages au lait cru et la croûte de tous les fromages. Cuits (gratin, raclette bien chaude, tartiflette), ils sont autorisés.' },
  { id: 'fromage_persille', nom: 'Fromages à pâte persillée (roquefort, bleu d\'Auvergne, gorgonzola, fourme d\'Ambert)', mots: ['roquefort', 'bleu', 'gorgonzola', 'persille', 'fourme', 'stilton'], cat: 'laitiers', statut: 'eviter',
    pourquoi: 'Risque de listériose.', conseil: 'À éviter crus ; autorisés bien cuits (sauce, gratin).' },
  { id: 'fromage_cuit', nom: 'Fromages à pâte pressée cuite (comté, emmental, gruyère, beaufort), fromages fondus, mozzarella pasteurisée', mots: ['comte', 'emmental', 'gruyere', 'beaufort', 'parmesan', 'fondu', 'mozzarella', 'cheddar', 'edam', 'gouda', 'raclette', 'vache qui rit', 'fromage rape'], cat: 'laitiers', statut: 'ok',
    pourquoi: 'Faible risque : pâte cuite ou pasteurisée.', conseil: 'Retirez la croûte. Vérifiez que la mozzarella, la feta et la ricotta sont pasteurisées.' },
  { id: 'laitages', nom: 'Yaourts, fromage blanc, petits-suisses, lait pasteurisé ou UHT', mots: ['yaourt', 'fromage blanc', 'petit suisse', 'lait', 'skyr', 'kefir'], cat: 'laitiers', statut: 'ok',
    pourquoi: 'Bonne source de calcium et de protéines.', conseil: 'Visez 3 produits laitiers par jour. Le kéfir et les laits fermentés du commerce pasteurisés sont autorisés.' },

  // Oeufs
  { id: 'oeuf_cru', nom: 'Œufs crus ou peu cuits (mayonnaise maison, mousse au chocolat, tiramisu, œuf coque, œuf mollet, crème anglaise)', mots: ['oeuf cru', 'mayonnaise', 'mousse au chocolat', 'tiramisu', 'oeuf coque', 'mollet', 'creme anglaise', 'meringue', 'pate a cookie', 'sabayon', 'sauce hollandaise'], cat: 'oeufs', statut: 'eviter',
    pourquoi: 'Risque de salmonellose.', conseil: 'Cuisez les œufs jusqu\'à ce que le blanc et le jaune soient fermes. Les préparations industrielles pasteurisées sont plus sûres.' },
  { id: 'oeuf_cuit', nom: 'Œufs durs, omelettes et œufs bien cuits', mots: ['oeuf', 'omelette', 'oeuf dur', 'brouille', 'quiche'], cat: 'oeufs', statut: 'ok',
    pourquoi: 'Bien cuits, ils ne présentent pas de risque.', conseil: 'Lavez-vous les mains après avoir manipulé des œufs crus.' },

  // Végétaux
  { id: 'legumes_crus', nom: 'Fruits et légumes crus, herbes fraîches (salades, radis, fraises, persil…)', mots: ['salade', 'legume cru', 'crudite', 'fruit', 'herbe', 'persil', 'fraise', 'framboise', 'radis', 'carotte', 'terre'], cat: 'vegetaux', statut: 'limiter',
    pourquoi: 'La terre peut contenir le parasite de la toxoplasmose.', conseil: 'Lavez-les soigneusement à l\'eau, épluchez-les si possible. Lavez-vous les mains après le jardinage ou en rentrant des courses.' },
  { id: 'germes_crus', nom: 'Graines germées crues (soja, alfalfa, radis, luzerne)', mots: ['germe', 'germee', 'pousse', 'alfalfa', 'luzerne', 'soja germe'], cat: 'vegetaux', statut: 'eviter',
    pourquoi: 'Elles se contaminent facilement (salmonelles, E. coli) car elles germent dans l\'humidité.', conseil: 'Mangez-les seulement bien cuites.' },
  { id: 'legumineuses', nom: 'Légumes secs, céréales complètes, pain complet, fruits à coque', mots: ['lentille', 'pois chiche', 'haricot', 'cereale', 'complet', 'noix', 'amande', 'noisette', 'quinoa', 'riz', 'pates', 'avoine'], cat: 'vegetaux', statut: 'ok',
    pourquoi: 'Apportent fibres, fer, magnésium et folates.', conseil: 'Faites tremper et cuire les légumes secs. Fruits à coque : autorisés sauf allergie connue.' },
  { id: 'reglisse', nom: 'Réglisse (confiserie et plante)', mots: ['reglisse', 'bonbon'], cat: 'autres', statut: 'eviter',
    pourquoi: 'En quantité, la réglisse peut faire monter la tension et peser sur la grossesse.', conseil: 'Évitez la réglisse en grande quantité.' },

  // Autres
  { id: 'plats_prepares', nom: 'Plats préparés, sandwichs, salades du commerce et plats du traiteur', mots: ['sandwich', 'traiteur', 'plat prepare', 'salade composee', 'fast food', 'kebab', 'restaurant'], cat: 'autres', statut: 'limiter',
    pourquoi: 'Chaîne du froid parfois irrégulière : risque de listériose.', conseil: 'Choisissez des plats bien chauds, à consommer le jour même. Retirez le fromage au lait cru, le saumon fumé et la charcuterie crue des sandwichs.' },
  { id: 'miel', nom: 'Miel', mots: ['miel'], cat: 'autres', statut: 'ok',
    pourquoi: 'L\'interdit du miel concerne les bébés de moins d\'un an, pas la femme enceinte.', conseil: 'Autorisé, avec modération (c\'est du sucre).' },
  { id: 'sucre', nom: 'Sucre, sodas et aliments très sucrés', mots: ['sucre', 'soda', 'sucrerie', 'gateau', 'confiserie', 'diabete gestationnel', 'bonbon'], cat: 'autres', statut: 'limiter',
    pourquoi: 'Un excès de sucre favorise la prise de poids et le diabète gestationnel.', conseil: 'Limitez les boissons sucrées et les desserts. En cas de diabète gestationnel, suivez les conseils de votre équipe médicale.' },
  { id: 'sel', nom: 'Sel et aliments très salés', mots: ['sel', 'sale', 'chips', 'tension'], cat: 'autres', statut: 'limiter',
    pourquoi: 'Un excès de sel favorise la rétention d\'eau et peut gêner si la tension monte.', conseil: 'Pas besoin de supprimer le sel, mais ne salez pas en plus.' },
  { id: 'edulcorants', nom: 'Édulcorants (aspartame, stévia, sucralose…)', mots: ['edulcorant', 'aspartame', 'stevia', 'sucralose', 'light', 'zero'], cat: 'autres', statut: 'limiter',
    pourquoi: 'Peu de données sur de grandes quantités.', conseil: 'À consommer occasionnellement. Évitez surtout l\'abus de boissons « zéro ».' },
  { id: 'complements', nom: 'Compléments alimentaires, huiles essentielles, plantes en gélules', mots: ['complement', 'supplement', 'huile essentielle', 'gelule', 'vitamine', 'phyto', 'ginseng', 'curcuma', 'spiruline'], cat: 'autres', statut: 'eviter',
    pourquoi: 'Beaucoup de plantes et de compléments n\'ont pas été étudiés pendant la grossesse, certains sont risqués.', conseil: 'Ne prenez rien sans l\'avis de votre médecin, sage-femme ou pharmacien. Seuls les folates (vitamine B9) et la vitamine D sont généralement prescrits.' },
  { id: 'soja', nom: 'Produits à base de soja (boissons, desserts, tofu)', mots: ['soja', 'tofu', 'tempeh', 'lait de soja'], cat: 'autres', statut: 'limiter',
    pourquoi: 'Le soja contient des phytoestrogènes ; l\'ANSES recommande la modération.', conseil: 'Consommation modérée. Évitez les compléments de soja ou d\'isoflavones.' },

  // Hygiène
  { id: 'restes', nom: 'Restes, plats cuisinés conservés au frigo', mots: ['reste', 'conservation', 'frigo', 'plat cuisine', 'date', 'limite'], cat: 'hygiene', statut: 'limiter',
    pourquoi: 'La listeria peut se développer même au froid.', conseil: 'Gardez les restes 2 à 3 jours au maximum, au frigo à 4 °C ; réchauffez-les bien (plus de 70 °C). Respectez les dates limites.' },
  { id: 'hygiene_toxo', nom: 'Hygiène contre la toxoplasmose et la listériose', mots: ['hygiene', 'toxoplasmose', 'listeriose', 'lavage', 'chat', 'jardin'], cat: 'hygiene', statut: 'ok',
    pourquoi: 'Ces infections sont rares mais graves pendant la grossesse.', conseil: 'Lavez-vous les mains avant de cuisiner et de manger, nettoyez le frigo, lavez les planches et couteaux après viande crue. Évitez la litière du chat (ou portez des gants).' },
];

/** Sans accents, minuscules. */
const nu = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Recherche tolérante dans les aliments (nom, mots-clés, conseils). Les plus risqués d'abord. */
export function chercherGrossesse(requete, liste = ALIMENTS_GROSSESSE) {
  const q = nu(requete);
  if (!q) return [];
  const mots = q.split(/\s+/).filter((m) => m.length > 1);
  return liste
    .map((a) => {
      const champs = [nu(a.nom), ...a.mots.map(nu)];
      const tout = champs.join(' ') + ' ' + nu(a.conseil);
      let score = 0;
      if (champs.some((c) => c === q)) score += 10;
      const debutMot = new RegExp('(^|[^a-z])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (champs.some((c) => debutMot.test(c))) score += 6;
      if (mots.length && mots.every((m) => new RegExp('(^|[^a-z])' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(tout))) score += 3;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => STATUTS[x.a.statut].ordre - STATUTS[y.a.statut].ordre || y.score - x.score)
    .map((x) => x.a);
}
