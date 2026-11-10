import test from 'node:test';
import assert from 'node:assert/strict';
import { codeBarresValide, lireProduitOFF, noterProduit, alertesProduit, couleurNote } from '../js/lib/scan.js';
import { codeAdditif, risqueAdditif, ADDITIFS, VERSION_ADDITIFS } from '../js/data/additifs.js';
import { profilVide } from '../js/lib/profils.js';

const off = (p) => ({ status: 1, product: p });
const nutella = off({ product_name: 'Pâte à tartiner', brands: 'Marque A, Marque B', quantity: '400 g', allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'], traces_tags: ['en:gluten'],
  additives_tags: ['en:e322', 'en:e322i'], nutriscore_grade: 'e', nova_group: 4, labels_tags: [], categories_tags: ['en:spreads', 'en:chocolate-spreads'],
  ingredients_text: 'Sucre, huile de palme, noisettes 13%, lait écrémé, cacao', nutriments: { 'energy-kcal_100g': 539, fat_100g: 30.9, 'saturated-fat_100g': 10.6, carbohydrates_100g: 57.5, sugars_100g: 56.3, fiber_100g: 3.4, proteins_100g: 6.3, salt_100g: 0.107 } });
const pommes = off({ product_name: 'Compote de pommes sans sucres ajoutés', brands: 'Bio Village', allergens_tags: [], additives_tags: [], nutriscore_grade: 'a', nova_group: 3,
  labels_tags: ['en:organic', 'en:eu-organic'], nutriments: { 'energy-kcal_100g': 52, fat_100g: 0.2, 'saturated-fat_100g': 0.1, carbohydrates_100g: 11.5, sugars_100g: 10.8, fiber_100g: 1.5, proteins_100g: 0.4, salt_100g: 0.01 } });
const jambon = off({ product_name: 'Jambon cru', additives_tags: ['en:e250', 'en:e301'], nova_group: 4, nutriscore_grade: 'd', categories_tags: ['en:cured-hams'],
  ingredients_text: 'Porc, sel, conservateur : nitrite de sodium', ingredients_analysis_tags: ['en:non-vegan', 'en:non-vegetarian'],
  nutriments: { 'energy-kcal_100g': 240, fat_100g: 12, 'saturated-fat_100g': 4.5, carbohydrates_100g: 0.5, sugars_100g: 0.5, fiber_100g: 0, proteins_100g: 30, salt_100g: 4.2 } });

test('codes-barres : clé de contrôle', () => {
  assert.ok(codeBarresValide('3017620422003'));
  assert.ok(codeBarresValide('5449000000996'));
  assert.ok(codeBarresValide('96385074'));
  assert.ok(!codeBarresValide('3017620422004'));
  assert.ok(!codeBarresValide('12345'));
  assert.ok(!codeBarresValide('abcdefghijklm'));
});

test('lecture Open Food Facts : produit compact', () => {
  const p = lireProduitOFF('3017620422003', nutella);
  assert.equal(p.nom, 'Pâte à tartiner');
  assert.equal(p.marque, 'Marque A');
  assert.deepEqual(p.allergenes.sort(), ['fruits_a_coque', 'lait', 'soja']);
  assert.deepEqual(p.traces, ['gluten']);
  assert.deepEqual(p.additifs, ['E322'], 'doublons et sous-lettres ramenés au numéro');
  assert.equal(p.nutriscore, 'e'); assert.equal(p.nova, 4);
  assert.equal(p.nutrition.kcal, 539);
  assert.equal(lireProduitOFF('1', { status: 0 }), null);
  assert.equal(lireProduitOFF('1', null), null);
  assert.ok(JSON.stringify(p).length < 3000, 'assez petit pour être synchronisé');
  assert.equal(lireProduitOFF('2', off({ product_name: 'X', nutriments: { 'energy_100g': 418.4, sodium_100g: 0.4 } })).nutrition.kcal, 100);
  assert.equal(lireProduitOFF('2', off({ nutriments: { sodium_100g: 0.4 } })).nutrition.sel, 1);
});

test('note : une compote bio ressort bien, une pâte à tartiner mal, un additif à risque élevé plafonne', () => {
  const a = noterProduit(lireProduitOFF('1', pommes));
  const b = noterProduit(lireProduitOFF('2', nutella));
  const c = noterProduit(lireProduitOFF('3', jambon));
  assert.ok(a.note >= 75 && a.couleur === 'excellent', `compote ${a.note}`);
  
  assert.ok(c.note <= 49 && c.couleur === 'mauvais', `jambon avec nitrite ${c.note}`);
  assert.ok(b.note < 25 && b.couleur === 'mauvais', `pâte à tartiner ${b.note}`);
  const plafonne = noterProduit({ ...lireProduitOFF('1', pommes), additifs: ['E171'] });
  assert.ok(plafonne.note <= 49 && plafonne.details.some((d) => d.rubrique === 'Plafond'), 'bon produit + additif à risque élevé : plafonné à 49');
  assert.equal(a.details.length, 4);
  assert.equal(a.details.reduce((s, d) => s + d.max, 0), 100, 'nutrition 65 + additifs 15 + transformation 15 + bonus 5');
  assert.ok(b.details[0].lignes.some((l) => l.type === '-' && /Sucres/.test(l.texte)), 'le « pourquoi » : les sucres sont cités');
  assert.ok(a.details[3].lignes[0].texte.includes('bio'));
});

test('note : bornes, données manquantes, couleurs', () => {
  assert.equal(couleurNote(75), 'excellent'); assert.equal(couleurNote(74), 'bon'); assert.equal(couleurNote(50), 'bon');
  assert.equal(couleurNote(49), 'mediocre'); assert.equal(couleurNote(25), 'mediocre'); assert.equal(couleurNote(24), 'mauvais');
  const vide = noterProduit({ code: '1', nom: 'x', nutrition: {}, additifs: [] });
  assert.ok(vide.partiel && vide.note >= 0 && vide.note <= 100);
  const eau = noterProduit({ code: '2', nom: 'Eau', nutrition: { kcal: 0, sucres: 0, satures: 0, sel: 0.01, fibres: 0, proteines: 0 }, additifs: [], nova: 1 });
  assert.ok(eau.note >= 75, `eau ${eau.note}`);
  const lettre = noterProduit({ code: '3', nom: 'y', nutrition: {}, nutriscore: 'a', additifs: [] });
  assert.ok(lettre.details[0].points === 65);
  for (const p of [lireProduitOFF('1', pommes), lireProduitOFF('2', nutella), lireProduitOFF('3', jambon)]) {
    const n = noterProduit(p); assert.ok(Number.isInteger(n.note) && n.note >= 0 && n.note <= 100);
  }
});

test('additifs : table versionnée, codes lus, inconnus prudents', () => {
  assert.ok(VERSION_ADDITIFS);
  assert.equal(codeAdditif('en:e322i'), 'E322'); assert.equal(codeAdditif('E171'), 'E171'); assert.equal(codeAdditif('n-importe-quoi'), null);
  assert.equal(risqueAdditif('en:e250').niveau, 'eleve');
  assert.equal(risqueAdditif('en:e330').niveau, 'sans');
  assert.equal(risqueAdditif('en:e999').niveau, 'limite');
  assert.ok(Object.keys(ADDITIFS).length > 100);
});

test('alertes du scan selon le profil de la personne qui scanne', () => {
  const enceinte = { ...profilVide('M'), sexe: 'femme', naissance: '1991-05-14', grossesse: 2 };
  const fromage = lireProduitOFF('4', off({ product_name: 'Camembert au lait cru', categories_tags: ['en:cheeses'], allergens_tags: ['en:milk'], nutriments: {} }));
  const a = alertesProduit(fromage, enceinte);
  assert.equal(a[0].niveau, 'rouge');
  assert.ok(a.some((x) => x.id === 'lait-cru' && /listériose/.test(x.raison)), 'scan d\'un fromage au lait cru par un profil grossesse : avertissement rouge expliqué');
  assert.deepEqual(alertesProduit(fromage, { ...profilVide('E'), sexe: 'homme', naissance: '1988-01-02' }), [], 'pas d\'alerte pour un autre profil');
  const p = { ...profilVide('E'), sexe: 'homme', naissance: '1988-01-02', allergenes: ['lait', 'gluten'], regimes: ['vegan'], objectif: 'perte' };
  const n = alertesProduit(lireProduitOFF('2', nutella), p);
  assert.ok(n.some((x) => x.id === 'allergie-lait' && x.niveau === 'rouge'));
  assert.ok(n.some((x) => x.id === 'traces-gluten' && x.niveau === 'orange'));
  assert.ok(n.some((x) => x.id === 'obj-kcal'));
  const j = alertesProduit(lireProduitOFF('3', jambon), { ...p, allergenes: [], conditions: ['hypertension'] });
  assert.ok(j.some((x) => x.id === 'regime-vegan') && j.some((x) => x.id === 'obj-sel'));
  assert.deepEqual(alertesProduit(fromage, { ...enceinte, appliquer: false }), []);
  assert.ok(alertesProduit(lireProduitOFF('3', jambon), enceinte).some((x) => x.id === 'additifs-eleves'));
});

import { lireTableauIA } from '../js/lib/scan.js';
test('photo du tableau : lecture de la réponse de l\'IA, valeurs invraisemblables écartées', () => {
  const r = lireTableauIA('```json\n{"nom":"Biscuits","marque":"Test","kcal":480,"graisses":20,"satures":9,"glucides":65,"sucres":30,"fibres":3.5,"proteines":6,"sel":0.8,"ingredients":"farine, sucre"}\n```');
  assert.equal(r.nom, 'Biscuits');
  assert.equal(r.kcal, '480');
  assert.equal(r.fibres, '3,5');
  assert.equal(r.sel, '0,8');
  const bad = lireTableauIA('{"kcal":5000,"sucres":80,"glucides":50,"satures":30,"graisses":10,"proteines":6}');
  assert.equal(bad.kcal, '', 'kcal impossible écarté');
  assert.equal(bad.sucres, '', 'sucres > glucides écarté');
  assert.equal(bad.satures, '', 'saturés > graisses écartés');
  assert.equal(bad.proteines, '6');
  assert.equal(lireTableauIA('pas du json'), null);
  assert.equal(lireTableauIA('{"nom":"x","kcal":null}'), null, 'aucun chiffre : null');
});

import { champsEnvoiOFF, problemeEnvoiOFF } from '../js/lib/scan.js';
test('envoi vers Open Food Facts : champs et garde-fous', () => {
  const prod = { code: '4006381333931', nom: 'Pain maison', marque: '', ingredients: '', nutrition: { kcal: 250, graisses: null, satures: 0.5, glucides: null, sucres: 3, fibres: null, proteines: 8, sel: 1.2 } };
  const compte = { utilisateur: ' eymric ', mot_de_passe: 'x' };
  const c = champsEnvoiOFF(prod, compte);
  assert.equal(c.user_id, 'eymric');
  assert.equal(c.code, '4006381333931');
  assert.equal(c['nutriment_energy-kcal'], '250');
  assert.equal(c['nutriment_energy-kcal_unit'], 'kcal');
  assert.equal(c['nutriment_saturated-fat_unit'], 'g');
  assert.equal(c.nutriment_fat, undefined, 'valeur absente omise');
  assert.equal(c.brands, undefined);
  assert.equal(problemeEnvoiOFF(prod, compte), null);
  assert.match(problemeEnvoiOFF(prod, { utilisateur: '', mot_de_passe: '' }), /mot de passe/);
  assert.match(problemeEnvoiOFF({ ...prod, code: '123' }, compte), /code-barres/);
  assert.match(problemeEnvoiOFF({ ...prod, nutrition: {} }, compte), /valeur nutritionnelle/);
});

import { envoyerProduitOFF } from '../js/core/off.js';
test('envoi OFF : succès, mauvais mot de passe, réseau coupé', async () => {
  const prod = { code: '4006381333931', nom: 'Pain', marque: '', ingredients: '', nutrition: { kcal: 250 } };
  const compte = { utilisateur: 'e', mot_de_passe: 'x' };
  let corps = null;
  const ok = async (url, o) => { corps = String(o.body); return { ok: true, status: 200, json: async () => ({ status: 1 }) }; };
  assert.equal(await envoyerProduitOFF(prod, compte, { appeler: ok }), true);
  assert.match(corps, /code=4006381333931/);
  const ko = async () => ({ ok: true, status: 200, json: async () => ({ status: 0, status_verbose: 'User not signed-in : wrong password' }) });
  await assert.rejects(envoyerProduitOFF(prod, compte, { appeler: ko }), /incorrect/);
  await assert.rejects(envoyerProduitOFF(prod, compte, { appeler: async () => { throw new Error('x'); } }), /joindre/);
  await assert.rejects(envoyerProduitOFF(prod, { utilisateur: '', mot_de_passe: '' }, { appeler: ok }), /mot de passe/);
});
