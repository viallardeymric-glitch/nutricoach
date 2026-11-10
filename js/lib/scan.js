// Produits scannés : lecture des données Open Food Facts, note sur 100 (nos règles, publiques), alertes de profil.
// Fonctions pures, testées dans tests/scan.test.mjs.
import { codeAdditif, risqueAdditif, NIVEAUX_ADDITIFS } from '../data/additifs.js';
import { alertesTexte } from './alertes.js';
import { profilsARisque } from './profils.js';
import { ALLERGENES, lib } from '../data/libelles.js';

const TAGS_ALLERGENES = {
  gluten: 'gluten', milk: 'lait', eggs: 'oeuf', fish: 'poisson', crustaceans: 'crustaces', molluscs: 'mollusques', peanuts: 'arachides',
  nuts: 'fruits_a_coque', soybeans: 'soja', celery: 'celeri', mustard: 'moutarde', 'sesame-seeds': 'sesame',
  'sulphur-dioxide-and-sulphites': 'sulfites', lupin: 'lupin',
};
const versAllergenes = (tags) => [...new Set((tags || []).map((t) => TAGS_ALLERGENES[String(t).replace(/^[a-z]{2}:/, '')]).filter(Boolean))];

/** Contrôle d'un code-barres EAN/UPC (8, 12, 13 ou 14 chiffres, clé de contrôle GS1). */
export function codeBarresValide(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const chiffres = code.split('').map(Number);
  const cle = chiffres.pop();
  const somme = chiffres.reverse().reduce((s, c, i) => s + c * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (somme % 10)) % 10 === cle;
}

const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null));

/** Réponse Open Food Facts → produit compact (petit : il est mis en cache et synchronisé). Null si le produit n'existe pas. */
export function lireProduitOFF(code, json) {
  const p = json && json.product;
  if (!json || json.status === 0 || !p) return null;
  const n = p.nutriments || {};
  const kcal = nombre(n['energy-kcal_100g']) ?? (nombre(n['energy_100g']) != null ? Math.round(nombre(n['energy_100g']) / 4.184) : null);
  const sel = nombre(n.salt_100g) ?? (nombre(n.sodium_100g) != null ? nombre(n.sodium_100g) * 2.5 : null);
  const labels = (p.labels_tags || []).map((l) => String(l).replace(/^[a-z]{2}:/, ''));
  return {
    code,
    nom: p.product_name_fr || p.product_name || 'Produit sans nom',
    marque: (p.brands || '').split(',')[0].trim(),
    quantite: p.quantity || '',
    image: p.image_front_small_url || p.image_front_url || p.image_url || '',
    ingredients: String(p.ingredients_text_fr || p.ingredients_text || '').slice(0, 1500),
    allergenes: versAllergenes(p.allergens_tags),
    traces: versAllergenes(p.traces_tags),
    additifs: [...new Set((p.additives_tags || []).map(codeAdditif).filter(Boolean))],
    nutriscore: /^[a-e]$/.test(p.nutriscore_grade || '') ? p.nutriscore_grade : null,
    nova: [1, 2, 3, 4].includes(Number(p.nova_group)) ? Number(p.nova_group) : null,
    ecoscore: /^[a-e]$/.test(p.ecoscore_grade || '') ? p.ecoscore_grade : null,
    bio: labels.some((l) => /^(organic|eu-organic|bio|ab-agriculture-biologique)/.test(l)),
    labels: labels.filter((l) => /label-rouge|aop|igp|fairtrade|max-havelaar|msc|rainforest|bio|organic|bleu-blanc-coeur/.test(l)).slice(0, 6),
    categories: (p.categories_tags || []).map((c) => String(c).replace(/^[a-z]{2}:/, '')).slice(-6),
    vegan: (p.ingredients_analysis_tags || []).includes('en:vegan') ? true : (p.ingredients_analysis_tags || []).includes('en:non-vegan') ? false : null,
    vegetarien: (p.ingredients_analysis_tags || []).includes('en:vegetarian') ? true : (p.ingredients_analysis_tags || []).includes('en:non-vegetarian') ? false : null,
    nutrition: {
      kcal, graisses: nombre(n.fat_100g), satures: nombre(n['saturated-fat_100g']), glucides: nombre(n.carbohydrates_100g),
      sucres: nombre(n.sugars_100g), fibres: nombre(n.fiber_100g), proteines: nombre(n.proteins_100g), sel,
    },
  };
}

// ---------- Note sur 100 : nutrition 65 + additifs 15 + transformation 15 + bonus bio/labels 5 ----------
const PALIERS = {
  energie: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],   // kJ pour 100 g
  sucres: [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45],                    // g
  satures: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],                                // g
  sodium: [90, 180, 270, 360, 450, 540, 630, 720, 810, 900],               // mg
  fibres: [0.9, 1.9, 2.8, 3.7, 4.7],                                       // g
  proteines: [1.6, 3.2, 4.8, 6.4, 8.0],                                    // g
};
const points = (valeur, paliers) => paliers.filter((p) => valeur > p).length;

export function couleurNote(note) {
  return note >= 75 ? 'excellent' : note >= 50 ? 'bon' : note >= 25 ? 'mediocre' : 'mauvais';
}
export const LIBELLE_COULEUR = { excellent: 'Excellent', bon: 'Bon', mediocre: 'Médiocre', mauvais: 'Mauvais' };

const decrire = (v, p, max) => (p === 0 ? 'faible' : p <= max * 0.4 ? 'modéré' : p <= max * 0.7 ? 'élevé' : 'très élevé');
const arr = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

/**
 * Note du produit : { note, couleur, partiel, details: [{ rubrique, points, max, lignes: [{ type: '+' | '-', texte }] }] }.
 * La partie nutrition suit la méthode publique du Nutri-Score (négatifs : énergie, sucres, graisses saturées, sel ;
 * positifs : fibres, protéines), convertie en 65 points (0 dès que le total dépasse 25). Sans données nutritionnelles, on retombe sur la lettre Nutri-Score.
 */
export function noterProduit(p) {
  const details = [];
  const n = p.nutrition || {};

  // 1. Nutrition (55)
  let nut;
  const lignesN = [];
  const aDonnees = n.kcal != null && n.sucres != null && n.satures != null && n.sel != null;
  if (aDonnees) {
    const kj = n.kcal * 4.184;
    const pe = points(kj, PALIERS.energie); const ps = points(n.sucres, PALIERS.sucres);
    const pg = points(n.satures, PALIERS.satures); const pn = points(n.sel / 2.5 * 1000, PALIERS.sodium);
    const negatifs = pe + ps + pg + pn;
    const pf = n.fibres != null ? points(n.fibres, PALIERS.fibres) : 0;
    const pp = negatifs >= 11 ? 0 : (n.proteines != null ? points(n.proteines, PALIERS.proteines) : 0);
    const brut = negatifs - pf - pp;                       // de −10 (excellent) à 40 (très mauvais)
    nut = Math.round(Math.max(0, Math.min(65, 65 * (1 - (brut + 5) / 30))));
    if (ps > 0) lignesN.push({ type: '-', texte: `Sucres ${decrire(n.sucres, ps, 10)} : ${arr(n.sucres)} g pour 100 g` });
    if (pg > 0) lignesN.push({ type: '-', texte: `Graisses saturées ${decrire(n.satures, pg, 10)} : ${arr(n.satures)} g pour 100 g` });
    if (pn > 0) lignesN.push({ type: '-', texte: `Sel ${decrire(n.sel, pn, 10)} : ${arr(n.sel, 2)} g pour 100 g` });
    if (pe > 3) lignesN.push({ type: '-', texte: `Calorique : ${Math.round(n.kcal)} kcal pour 100 g` });
    if (pf > 0) lignesN.push({ type: '+', texte: `Fibres : ${arr(n.fibres)} g pour 100 g` });
    if (pp > 0) lignesN.push({ type: '+', texte: `Protéines : ${arr(n.proteines)} g pour 100 g` });
    if (!lignesN.length) lignesN.push({ type: '+', texte: 'Profil nutritionnel équilibré pour 100 g' });
  } else if (p.nutriscore) {
    nut = { a: 65, b: 52, c: 36, d: 20, e: 6 }[p.nutriscore];
    lignesN.push({ type: p.nutriscore <= 'b' ? '+' : '-', texte: `Nutri-Score ${p.nutriscore.toUpperCase()} (valeurs détaillées indisponibles)` });
  } else {
    nut = 33;
    lignesN.push({ type: '-', texte: 'Valeurs nutritionnelles inconnues : note prudente' });
  }
  details.push({ rubrique: 'Qualité nutritionnelle', points: nut, max: 65, lignes: lignesN });

  // 2. Additifs (25)
  const risques = (p.additifs || []).map(risqueAdditif).filter(Boolean);
  let add = 15;
  const lignesA = [];
  for (const r of risques) {
    add -= NIVEAUX_ADDITIFS[r.niveau].points;
    if (r.niveau !== 'sans') lignesA.push({ type: '-', texte: `${r.code} ${r.nom} : ${NIVEAUX_ADDITIFS[r.niveau].nom.toLowerCase()}${r.note ? ` (${r.note})` : ''}` });
  }
  add = Math.max(0, add);
  if (!lignesA.length) lignesA.push({ type: '+', texte: risques.length ? 'Additifs sans risque connu' : 'Aucun additif' });
  details.push({ rubrique: 'Additifs', points: add, max: 15, lignes: lignesA });

  // 3. Transformation (15) — NOVA
  const tr = p.nova ? { 1: 15, 2: 12, 3: 7, 4: 0 }[p.nova] : 8;
  details.push({ rubrique: 'Transformation', points: tr, max: 15, lignes: [p.nova
    ? { type: p.nova <= 2 ? '+' : '-', texte: `NOVA ${p.nova} : ${['', 'aliment brut ou peu transformé', 'ingrédient culinaire', 'aliment transformé', 'produit ultra-transformé'][p.nova]}` }
    : { type: '-', texte: 'Degré de transformation inconnu' }] });

  // 4. Bonus bio / labels (5)
  const bonus = p.bio ? 5 : (p.labels || []).length ? 2 : 0;
  details.push({ rubrique: 'Bio et labels', points: bonus, max: 5, lignes: [bonus
    ? { type: '+', texte: p.bio ? 'Produit bio' : `Label : ${(p.labels || []).join(', ')}` } : { type: '-', texte: 'Pas de label bio ou de qualité' }] });

  let note = nut + add + tr + bonus;
  const eleve = risques.some((r) => r.niveau === 'eleve');
  if (eleve && note > 49) { note = 49; details.push({ rubrique: 'Plafond', points: 0, max: 0, lignes: [{ type: '-', texte: 'Un additif à risque élevé limite la note à 49' }] }); }
  note = Math.max(0, Math.min(100, Math.round(note)));
  return { note, couleur: couleurNote(note), partiel: !aDonnees, details };
}

/**
 * Alertes pour la personne qui scanne : allergies (liste officielle du produit), traces, régime, grossesse / enfant (mêmes règles
 * que les recettes et les courses), objectifs (sel, sucre, calories). Retourne [{ id, niveau, raison, source }], rouges d'abord.
 */
export function alertesProduit(p, profil) {
  if (!profil || profil.appliquer === false) return [];
  const res = [];
  for (const a of profil.allergenes || []) {
    if ((p.allergenes || []).includes(a)) res.push({ id: `allergie-${a}`, niveau: 'rouge', source: 'profil', raison: `Contient du ${lib(ALLERGENES, a).toLowerCase()}, que vous évitez.` });
    else if ((p.traces || []).includes(a)) res.push({ id: `traces-${a}`, niveau: 'orange', source: 'profil', raison: `Peut contenir des traces de ${lib(ALLERGENES, a).toLowerCase()}.` });
  }
  const r = profil.regimes || [];
  if (r.includes('vegan') && p.vegan === false) res.push({ id: 'regime-vegan', niveau: 'rouge', source: 'profil', raison: 'Ne convient pas à un régime végan.' });
  if ((r.includes('vegetarien') || r.includes('vegan')) && p.vegetarien === false) res.push({ id: 'regime-vegetarien', niveau: 'rouge', source: 'profil', raison: 'Ne convient pas à un régime végétarien.' });
  if (r.includes('sans_gluten') && (p.allergenes || []).includes('gluten')) res.push({ id: 'regime-gluten', niveau: 'rouge', source: 'profil', raison: 'Contient du gluten.' });
  if (r.includes('sans_lactose') && (p.allergenes || []).includes('lait')) res.push({ id: 'regime-lactose', niveau: 'rouge', source: 'profil', raison: 'Contient du lait (lactose).' });
  const texte = [p.nom, p.ingredients, (p.categories || []).join(' ')].join(' ');
  const vus = new Set(res.map((x) => x.id));
  for (const a of alertesTexte(texte, { ...profil, allergenes: [] })) if (!vus.has(a.id)) res.push(a);
  // Objectifs et santé : repères sur 100 g
  const n = p.nutrition || {};
  const risques = profilsARisque(profil);
  const sec = profil.secondaires || [];
  const reduitSel = risques.includes('hypertendu') || sec.includes('sel') || profil.objectif === 'sel';
  if (n.sel != null && n.sel > 1.5 && reduitSel) res.push({ id: 'obj-sel', niveau: 'orange', source: 'PNNS', raison: `Riche en sel (${arr(n.sel, 2)} g pour 100 g) : à limiter pour votre objectif.` });
  if (n.sucres != null && n.sucres > 15 && (risques.includes('diabetique') || sec.includes('sucre') || profil.objectif === 'sucre')) res.push({ id: 'obj-sucre', niveau: 'orange', source: 'PNNS', raison: `Riche en sucres (${arr(n.sucres)} g pour 100 g) : à limiter pour votre objectif.` });
  if (n.kcal != null && n.kcal > 400 && (profil.objectif === 'perte' || profil.objectif === 'seche')) res.push({ id: 'obj-kcal', niveau: 'orange', source: 'PNNS', raison: `Très calorique (${Math.round(n.kcal)} kcal pour 100 g) : à surveiller pour votre objectif.` });
  const dur = (p.additifs || []).map(risqueAdditif).filter((x) => x && x.niveau === 'eleve');
  if (dur.length && (risques.includes('femme_enceinte') || risques.includes('allaitante') || risques.includes('enfant') || risques.includes('enfant_moins_de_3_ans'))) {
    res.push({ id: 'additifs-eleves', niveau: 'orange', source: 'ANSES', raison: `Additif(s) à risque élevé : ${dur.map((x) => x.code).join(', ')}. À éviter en priorité dans votre situation.` });
  }
  return res.sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === 'rouge' ? -1 : 1));
}

// ---------- Photo du tableau nutritionnel lue par l'IA ----------
export const CONSIGNE_TABLEAU = `Tu lis la photo d'un emballage alimentaire. Réponds uniquement avec un objet JSON :
{"nom": texte ou null, "marque": texte ou null, "kcal": nombre ou null, "graisses": nombre ou null, "satures": nombre ou null, "glucides": nombre ou null, "sucres": nombre ou null, "fibres": nombre ou null, "proteines": nombre ou null, "sel": nombre ou null, "ingredients": texte ou null}
Toutes les valeurs numériques sont POUR 100 g (ou 100 ml), en grammes sauf kcal. Si le tableau n'indique que la portion, convertis pour 100 g seulement si la portion est lisible, sinon null. Si seul le sodium est indiqué, multiplie par 2,5 pour le sel. N'invente rien : mets null si illisible.`;

const LIMITES_TABLEAU = { kcal: 950, graisses: 100, satures: 100, glucides: 100, sucres: 100, fibres: 100, proteines: 100, sel: 100 };

/** Réponse de l'IA (texte JSON) → valeurs prêtes pour le formulaire (chaînes), chiffres invraisemblables écartés. Null si illisible. */
export function lireTableauIA(texte) {
  let o;
  try { o = JSON.parse(String(texte).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const res = { nom: '', marque: '', ingredients: '' };
  for (const k of ['nom', 'marque']) if (typeof o[k] === 'string') res[k] = o[k].trim().slice(0, 80);
  if (typeof o.ingredients === 'string') res.ingredients = o.ingredients.trim().slice(0, 1500);
  let trouves = 0;
  for (const [k, max] of Object.entries(LIMITES_TABLEAU)) {
    const n = nombre(o[k]);
    if (n != null && n >= 0 && n <= max) { res[k] = String(Math.round(n * 10) / 10).replace('.', ','); trouves++; } else res[k] = '';
  }
  // Cohérence : sucres ≤ glucides, saturés ≤ graisses
  const v = (k) => (res[k] === '' ? null : Number(res[k].replace(',', '.')));
  if (v('sucres') != null && v('glucides') != null && v('sucres') > v('glucides')) res.sucres = '';
  if (v('satures') != null && v('graisses') != null && v('satures') > v('graisses')) res.satures = '';
  return trouves ? res : null;
}
