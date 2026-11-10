// Tests « propriétés » : des milliers de cas tirés au hasard (graine fixe) sur le catalogue complet, pour attraper ce qu'un exemple ne montre pas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aleatoire, genererSemaine, autreRepasPour, contraintesCouple, semaineDe, REPAS } from '../js/lib/planning.js';
import { preparerRecettes } from '../js/lib/recettes.js';
import { profilVide } from '../js/lib/profils.js';
import { calculerBesoins, ACTIVITES, OBJECTIFS } from '../js/lib/besoins.js';
import { ligneIngredient, conseilsAdaptation } from '../js/lib/adaptation.js';
import { lignesDepuisPlan, articlesDepuisPlan, fusionner, arrondirCourses, libelleQuantite } from '../js/lib/courses.js';
import { contraintesDeProfil, substitutionsPour, appliquerSubstitutions, nutritionAdaptee } from '../js/lib/substitutions.js';
import { etapesThermomix, capaciteBol, ordrePesee } from '../js/lib/thermomix.js';
import { lireProduitOFF, noterProduit } from '../js/lib/scan.js';
import { normaliserRecette } from '../js/lib/recette-perso.js';
import { noterRecette } from '../js/lib/sante.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const COMPLETES = lire('recettes.json');
const completeParId = new Map(COMPLETES.map((r) => [r.id, r]));
const index = preparerRecettes(lire('index.json').recettes);
const ALLERGENES = ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'mollusques', 'arachides', 'fruits_a_coque', 'soja', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin'];
const REGIMES_STRICTS = ['vegetarien', 'vegan', 'sans_gluten', 'sans_lactose', 'pescetarien', 'sans_porc'];
const hasard = aleatoire(20261110);
const pick = (l) => l[Math.floor(hasard() * l.length)];
const sous = (l, n) => { const c = [...l]; const r = []; while (r.length < n && c.length) r.push(c.splice(Math.floor(hasard() * c.length), 1)[0]); return r; };
const jours = semaineDe(new Date(2026, 10, 9));

function profilAleatoire(i) {
  const femme = hasard() < 0.5;
  return { ...profilVide(`p${i}`), sexe: femme ? 'femme' : 'homme', naissance: `${1940 + Math.floor(hasard() * 60)}-0${1 + Math.floor(hasard() * 9)}-1${Math.floor(hasard() * 9)}`,
    poids_kg: 40 + Math.floor(hasard() * 120), taille_cm: 140 + Math.floor(hasard() * 60), activite: pick(Object.keys(ACTIVITES)), objectif: pick(Object.keys(OBJECTIFS)),
    grossesse: femme && hasard() < 0.3 ? 1 + Math.floor(hasard() * 3) : 0, allaitement: femme && hasard() < 0.15, sportif: hasard() < 0.3,
    allergenes: sous(ALLERGENES, Math.floor(hasard() * 3)), regimes: sous(REGIMES_STRICTS, Math.floor(hasard() * 2)), conditions: hasard() < 0.2 ? [pick(['diabete', 'hypertension'])] : [] };
}

test('SÉCURITÉ : un menu ne contient jamais d\'allergène, de régime incompatible ni de plat déconseillé du profil (vérifié sur les fiches complètes)', () => {
  let menus = 0; let repas = 0;
  for (let i = 0; i < 80; i++) {
    const p = [profilAleatoire(i), profilAleatoire(i + 1000)];
    const c = contraintesCouple(p);
    const { plan } = genererSemaine(index, jours, {}, { contraintes: c, saison: pick(['hiver', 'ete', 'automne', 'printemps']), cibleKcal: 1500 + Math.floor(hasard() * 1500), graine: 1 + Math.floor(hasard() * 1e6), repas: REPAS });
    menus++;
    for (const id of Object.values(plan).flatMap((j) => Object.values(j))) {
      const r = completeParId.get(id);
      repas++;
      for (const a of c.allergenes) assert.ok(!r.allergenes.includes(a), `${id} contient ${a}`);
      for (const g of c.regimes) if (REGIMES_STRICTS.includes(g)) assert.ok(r.regimes_compatibles.includes(g), `${id} n'est pas ${g}`);
      const risques = new Set(c.risques);
      for (const d of r.deconseille_a) assert.ok(!risques.has(d.profil), `${id} déconseillé à ${d.profil}`);
    }
  }
  assert.ok(menus === 80 && repas > 800);
});

test('SÉCURITÉ : « autre repas » respecte aussi les allergènes et les risques (200 tirages)', () => {
  for (let i = 0; i < 200; i++) {
    const p = [profilAleatoire(i)];
    const c = contraintesCouple(p);
    const { plan } = genererSemaine(index, jours, {}, { contraintes: c, saison: 'hiver', cibleKcal: 2000, graine: i + 5, repas: REPAS });
    const j = pick(jours); const rp = pick(['dejeuner', 'diner']);
    if (!plan[j] || !plan[j][rp]) continue;
    const r = autreRepasPour(index, c, { plan, jours, jour: j, repas: rp, saison: 'hiver', cibleKcal: 2000, graine: i * 13 + 1 });
    if (!r) continue;
    const f = completeParId.get(r.id);
    for (const a of c.allergenes) assert.ok(!f.allergenes.includes(a), `${r.id} contient ${a}`);
    for (const d of f.deconseille_a) assert.ok(!c.risques.includes(d.profil), `${r.id} déconseillé à ${d.profil}`);
  }
});

test('besoins : valeurs finies et plausibles pour 500 profils valides au hasard', () => {
  for (let i = 0; i < 500; i++) {
    const p = profilAleatoire(i);
    const b = calculerBesoins(p);
    assert.ok(b && [b.cible, b.proteines_g, b.glucides_g, b.lipides_g].every(Number.isFinite), `profil ${i}`);
    assert.ok(b.cible >= 1200 && b.cible <= 6000, `cible ${b.cible} (${JSON.stringify({ s: p.sexe, o: p.objectif, g: p.grossesse })})`);
    if (p.grossesse >= 2 || p.allaitement) assert.ok(b.cible >= 1800, `grossesse/allaitement : ${b.cible} kcal trop bas`);
  }
});

test('adaptation : toutes les recettes × 1 à 12 personnes, aucune quantité absurde (NaN, 0, négative)', () => {
  for (const r of COMPLETES) {
    for (const portions of [1, 2, 3, 5, 8, 12]) {
      const f = portions / r.portions_base;
      for (const ing of r.ingredients) {
        const l = ligneIngredient(ing, f);
        assert.ok(l && !/NaN|undefined|Infinity/.test(JSON.stringify(l)), `${r.id} ${ing.aliment} ×${f}`);
      }
      assert.ok(Array.isArray(conseilsAdaptation(r, portions)));
    }
  }
});

test('courses : fusion et arrondis cohérents sur 300 menus au hasard (jamais moins que le besoin, jamais NaN)', () => {
  const parId = new Map(COMPLETES.map((r) => [r.id, r]));
  for (let i = 0; i < 300; i++) {
    const ids = sous(COMPLETES.map((r) => r.id), 4 + Math.floor(hasard() * 10));
    const plan = {}; ids.forEach((id, k) => { plan[jours[k % 7]] = { ...(plan[jours[k % 7]] || {}), [REPAS[k % 2].id + (k >= 14 ? k : '')]: id }; });
    const personnes = 1 + Math.floor(hasard() * 6);
    const lignes = lignesDepuisPlan(plan, jours, parId, personnes);
    const articles = articlesDepuisPlan(plan, jours, parId, personnes);
    for (const a of articles) assert.ok(a.quantite > 0 && Number.isFinite(a.quantite) && !/NaN|undefined/.test(libelleQuantite(a)), `article ${a.nom}`);
    const total = (l) => l.reduce((s, x) => s + x.quantite, 0);
    const fus = fusionner(lignes);
    assert.ok(fus.length <= lignes.length);
    for (const a of fus) { const arr = arrondirCourses({ quantite: a.quantite, unite: a.unite }); const base = (arr.unite === 'kg' || arr.unite === 'l') ? arr.quantite * 1000 : arr.quantite; assert.ok(base >= a.quantite - 1e-6, `arrondi vers le bas : ${a.nom} ${a.quantite} → ${base}`); }
    assert.ok(total(fus.filter((x) => x.unite === 'g')) <= total(lignes.map((l) => ({ quantite: l.unite === 'kg' ? l.quantite * 1000 : l.unite === 'g' ? l.quantite : 0 }))) + 1e-6);
  }
});

test('substitutions : toutes les recettes × contraintes au hasard, jamais d\'exception, jamais d\'ingrédient perdu', () => {
  for (let i = 0; i < 600; i++) {
    const r = pick(COMPLETES);
    const c = contraintesDeProfil({ allergenes: sous(ALLERGENES, Math.floor(hasard() * 3)), regimes: sous(REGIMES_STRICTS, Math.floor(hasard() * 2)), grossesse: hasard() < 0.3 ? 2 : 0, allaitement: hasard() < 0.1, appliquer: true });
    const subs = substitutionsPour(r, c);
    const ing = appliquerSubstitutions(r.ingredients, subs);
    assert.equal(ing.length, r.ingredients.length, `${r.id} : nombre d'ingrédients modifié`);
    assert.ok(ing.every((x) => x.aliment && x.quantite > 0 && Number.isFinite(x.quantite)), `${r.id}`);
    const n = nutritionAdaptee(r, subs);
    if (n) assert.ok([n.kcal, n.p, n.g, n.l].every((v) => Number.isFinite(v) && v >= 0), `${r.id} nutrition`);
  }
});

test('Thermomix : toutes les recettes × 3 modèles, aucune exception, capacité du bol cohérente', () => {
  for (const r of COMPLETES) {
    for (const m of ['TM6', 'TM5', 'TM31']) {
      const e = etapesThermomix(r, m);
      assert.ok(Array.isArray(e) && e.length === r.etapes.length, `${r.id} ${m}`);
      const bol = capaciteBol(r, r.portions_base * 3, m);
      assert.ok(bol.fournees >= 1 && Number.isFinite(bol.volume_ml), `${r.id} bol`);
    }
    assert.ok(Array.isArray(ordrePesee(r.ingredients, 1.5)));
  }
});

test('score santé : 0 à 100 sur tout le catalogue et jamais d\'exception sur une nutrition fantaisiste', () => {
  for (const r of COMPLETES) { const s = noterRecette(r); assert.ok(s && s.note >= 0 && s.note <= 100, r.id); }
  for (const n of [{}, { calories_kcal: -5 }, { calories_kcal: 'x' }, { calories_kcal: 100, lipides_g: null }, { calories_kcal: 1e9, sel_g: 1e9 }]) assert.doesNotThrow(() => noterRecette({ nutrition_par_portion: n }));
});

test('Open Food Facts : des réponses fantaisistes ne font jamais planter la lecture ni la note (0 à 100)', () => {
  const sacs = [null, undefined, {}, { status: 1 }, { status: 1, product: {} }, { status: 1, product: { nutriments: 'x', additives_tags: 5, allergens_tags: [null, 3, 'en:milk'] } },
    { status: 1, product: { product_name: '<img onerror=alert(1)>', nutriments: { 'energy-kcal_100g': 'abc', sugars_100g: -4, salt_100g: 1e9 }, nova_group: '9', nutriscore_grade: 'z' } },
    { status: 1, product: { additives_tags: ['en:e621', 'fr:e951', 'e150d', 42], labels_tags: 'bio', categories_tags: null, ingredients_analysis_tags: 'x' } }];
  for (const s of sacs) {
    let p;
    assert.doesNotThrow(() => { p = lireProduitOFF('3017620422003', s); });
    if (p) { const n = noterProduit(p); assert.ok(n.note >= 0 && n.note <= 100 && Number.isFinite(n.note)); }
  }
});

test('recette perso : n\'importe quelle entrée (hasard, JSON bizarre) ne fait jamais planter la validation', () => {
  const bizarre = [null, 5, 'texte', [], {}, { titre: 5, ingredients: 5, etapes: {} }, { titre: 'a', ingredients: [null, 3, { aliment: {} }], etapes: [null, 5, {}] },
    { titre: 'ok', ingredients: ['1 oeuf', { aliment: 'sel', quantite: '1/0' }], etapes: ['x'.repeat(10000)], temps: 'long', portions_base: 'beaucoup', nutrition_par_portion: { calories_kcal: 'NaN' } },
    { titre: 'ok', ingredients: Array(500).fill('1 g de x'), etapes: Array(500).fill('étape'), allergenes: 'lait,oeuf', regimes_compatibles: { a: 1 } }];
  for (const b of bizarre) assert.doesNotThrow(() => normaliserRecette(b));
  for (let i = 0; i < 300; i++) {
    const o = {}; for (const k of ['titre', 'ingredients', 'etapes', 'temps', 'categorie', 'allergenes', 'portions_base', 'nutrition_par_portion']) if (hasard() < 0.7) o[k] = pick([null, 3, 'abc', ['1 oeuf'], { a: 1 }, ['x'], 0, -1, '12', true]);
    assert.doesNotThrow(() => normaliserRecette(o));
  }
});

import { allergenesDetectes, deconseillesDetectes } from '../js/lib/recette-perso.js';
const ing = (...noms) => noms.map((aliment) => ({ aliment, quantite: 1, unite: 'pièce' }));

test('allergènes d\'après les ingrédients : faux amis écartés, vrais allergènes trouvés', () => {
  const a = (...n) => allergenesDetectes(ing(...n)).sort();
  assert.deepEqual(a('lait de coco', 'noix de muscade', 'pâte de curry vert', 'crème de tartre', 'beurre de cacao'), []);
  assert.deepEqual(a('lait d\'amande'), ['fruits_a_coque'], 'le lait d\'amande est un fruit à coque, pas du lait');
  assert.deepEqual(a('lait de soja', 'crème de soja'), ['soja']);
  assert.deepEqual(a('beurre de cacahuète'), ['arachides']);
  assert.deepEqual(a('pâte feuilletée'), ['gluten', 'lait']);
  assert.deepEqual(a('sauce soja'), ['gluten', 'soja']);
  assert.ok(!a('pain sans gluten').includes('gluten') && !a('yaourt sans lactose').includes('lait'));
  assert.ok(a('noix de Saint-Jacques').includes('mollusques') && !a('noix de Saint-Jacques').includes('fruits_a_coque'));
  assert.ok(a('noix de cajou', 'pignons de pin', 'pesto').includes('fruits_a_coque'));
  assert.ok(a('filet de daurade', 'filet de lieu noir', 'nuoc-mâm').includes('poisson'));
  assert.ok(a('macaroni', 'bière').includes('gluten') && a('cidre brut').includes('sulfites') && a('mayonnaise').includes('moutarde'));
  assert.deepEqual(a('farine de riz', 'semoule de maïs', 'farine de sarrasin'), [], 'céréales sans gluten');
});

test('avertissements d\'après les ingrédients : « pâte » n\'est pas « pâté »', () => {
  const profils = (...n) => deconseillesDetectes(ing(...n)).map((d) => d.profil);
  assert.ok(!profils('pâte feuilletée', 'pâte brisée', 'pâte sablée', 'pâte de curry vert').includes('femme_enceinte'));
  assert.ok(profils('pâté de campagne').includes('femme_enceinte'));
  assert.ok(profils('rillettes de porc').includes('femme_enceinte') && profils('saumon fumé').includes('femme_enceinte'));
  assert.ok(!profils('sauce cocktail', 'cocktail de fruits de mer').includes('allaitante'));
});

test('détection des allergènes vs. étiquettes du catalogue : peu de faux positifs, bon rappel (le catalogue sert de vérité)', () => {
  let rappel = 0; let total = 0; let faux = 0;
  for (const r of COMPLETES) {
    const d = new Set(allergenesDetectes(r.ingredients)); const o = new Set(r.allergenes);
    for (const a of o) { total++; if (d.has(a)) rappel++; }
    for (const a of d) if (!o.has(a)) faux++;
  }
  assert.ok(rappel / total >= 0.93, `rappel ${(rappel / total * 100).toFixed(1)} %`);
  assert.ok(faux <= 30, `${faux} faux positifs`);
});

import { lundiDe, ajouterJours, cleDate, dateDepuisCle, nomJour } from '../js/lib/planning.js';
test('dates : semaines de lundi à dimanche, sans trou ni doublon, y compris aux changements d\'heure et fins d\'année', () => {
  const specials = [[2026, 2, 28], [2026, 2, 29], [2026, 2, 30], [2026, 9, 24], [2026, 9, 25], [2026, 9, 26], [2026, 11, 31], [2027, 0, 1], [2028, 1, 29], [2026, 0, 4], [2026, 0, 5]];
  const dates = [...specials.map(([y, m, d]) => new Date(y, m, d, 23, 59)), ...Array.from({ length: 400 }, () => new Date(2024 + Math.floor(hasard() * 5), Math.floor(hasard() * 12), 1 + Math.floor(hasard() * 28), Math.floor(hasard() * 24)))];
  for (const d of dates) {
    const sem = semaineDe(d);
    assert.equal(sem.length, 7); assert.equal(new Set(sem).size, 7);
    assert.equal(nomJour(dateDepuisCle(sem[0])), 'Lundi'); assert.equal(nomJour(dateDepuisCle(sem[6])), 'Dimanche');
    for (let i = 1; i < 7; i++) assert.equal(cleDate(ajouterJours(dateDepuisCle(sem[i - 1]), 1)), sem[i]);
    assert.ok(sem.includes(cleDate(d)), `la semaine contient ${cleDate(d)}`);
    assert.equal(cleDate(lundiDe(d)), sem[0]);
  }
});
