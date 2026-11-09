import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleAliment, versBase, fusionner, arrondirCourses, libelleQuantite, analyserSaisie, articlesDepuisPlan, deduireStock, ajouterAuStock, planifierMiseAJour, estAlimentaire } from '../js/lib/courses.js';
import { rayonDe } from '../js/data/rayons.js';
import { semaineDe, genererSemaine, contraintesCouple } from '../js/lib/planning.js';
import { preparerRecettes } from '../js/lib/recettes.js';

test('fusion : 2 × 100 g + 250 g de farine = 450 g, kg et pluriels compris', () => {
  const a = fusionner([
    { aliment: 'farine de blé', quantite: 100, unite: 'g' }, { aliment: 'farine de blé', quantite: 100, unite: 'g' },
    { aliment: 'Farine de blé', quantite: 0.25, unite: 'kg' },
    { aliment: 'pommes de terre', quantite: 2, unite: 'pièce' }, { aliment: 'pomme de terre', quantite: 1, unite: 'pièce' },
    { aliment: 'lait', quantite: 25, unite: 'cl' }, { aliment: 'lait', quantite: 0.5, unite: 'l' },
    { aliment: 'eau', quantite: 500, unite: 'ml' },
  ]);
  const par = Object.fromEntries(a.map((x) => [cleAliment(x.nom), x]));
  assert.equal(par['farine de ble'].quantite, 450);
  assert.equal(par['pomme de terre'].quantite, 3);
  assert.equal(par['lait'].quantite, 750);
  assert.equal(par['lait'].unite, 'ml');
  assert.equal(a.length, 3, 'l\'eau n\'est pas une course');
  assert.ok(!estAlimentaire('eau froide') && estAlimentaire('eau de fleur d\'oranger') === true);
});

test('unités : familles séparées (g ≠ ml ≠ pièce) et conversions', () => {
  assert.deepEqual(versBase(2, 'kg'), { quantite: 2000, unite: 'g' });
  assert.deepEqual(versBase(3, 'cl'), { quantite: 30, unite: 'ml' });
  assert.equal(fusionner([{ aliment: 'beurre', quantite: 50, unite: 'g' }, { aliment: 'beurre', quantite: 1, unite: 'c. à soupe' }]).length, 2);
});

test('arrondis de courses : toujours vers le haut, unité lisible', () => {
  assert.deepEqual(arrondirCourses({ quantite: 62, unite: 'g' }), { quantite: 65, unite: 'g' });
  assert.deepEqual(arrondirCourses({ quantite: 243, unite: 'g' }), { quantite: 250, unite: 'g' });
  assert.deepEqual(arrondirCourses({ quantite: 1180, unite: 'g' }), { quantite: 1.2, unite: 'kg' });
  assert.deepEqual(arrondirCourses({ quantite: 1250, unite: 'ml' }), { quantite: 1.25, unite: 'l' });
  assert.deepEqual(arrondirCourses({ quantite: 2.2, unite: 'pièce' }), { quantite: 3, unite: 'pièce' });
  assert.deepEqual(arrondirCourses({ quantite: 0.3, unite: 'gousse' }), { quantite: 1, unite: 'gousse' });
  assert.deepEqual(arrondirCourses({ quantite: 1.1, unite: 'c. à soupe' }), { quantite: 1.5, unite: 'c. à soupe' });
  assert.equal(libelleQuantite({ quantite: 1.25, unite: 'kg' }), '1,25 kg');
  assert.equal(libelleQuantite({ quantite: 3, unite: 'pièce' }), '3');
  assert.equal(libelleQuantite({ quantite: 4, unite: 'gousse' }), '4 gousses');
  assert.equal(libelleQuantite({ quantite: 1.5, unite: 'c. à soupe' }), '1 ½ c. à soupe');
});

test('saisie libre', () => {
  assert.deepEqual(analyserSaisie('250 g de farine'), { quantite: 250, unite: 'g', nom: 'Farine' });
  assert.deepEqual(analyserSaisie('2 kg pommes de terre'), { quantite: 2, unite: 'kg', nom: 'Pommes de terre' });
  assert.deepEqual(analyserSaisie('6 oeufs'), { quantite: 6, unite: 'pièce', nom: 'Oeufs' });
  assert.deepEqual(analyserSaisie('lait'), { quantite: 1, unite: 'pièce', nom: 'lait' });
  assert.deepEqual(analyserSaisie('1,5 l de lait'), { quantite: 1.5, unite: 'l', nom: 'Lait' });
  assert.deepEqual(analyserSaisie('3 c. à soupe de miel'), { quantite: 3, unite: 'c. à soupe', nom: 'Miel' });
  assert.deepEqual(analyserSaisie('12'), { quantite: 1, unite: 'pièce', nom: '12' });
});

test('stock : déduction partielle ou totale, et ajout après les courses', () => {
  const articles = fusionner([{ aliment: 'farine', quantite: 450, unite: 'g' }, { aliment: 'sucre', quantite: 100, unite: 'g' }, { aliment: 'lait', quantite: 1, unite: 'l' }]);
  const stock = [{ cle: 'farine|g', quantite: 200, unite: 'g' }, { cle: 'sucre|g', quantite: 500, unite: 'g' }];
  const { articles: reste, enStock } = deduireStock(articles, stock);
  assert.deepEqual(enStock, ['sucre']);
  assert.equal(reste.find((a) => a.nom === 'farine').quantite, 250);
  assert.equal(reste.find((a) => a.nom === 'lait').quantite, 1000);
  const s2 = ajouterAuStock(stock, [{ nom: 'farine', quantite: 1, unite: 'kg' }, { nom: 'riz', quantite: 500, unite: 'g' }]);
  assert.equal(s2.find((s) => s.cle === 'farine|g').quantite, 1200);
  assert.equal(s2.length, 3);
});

test('régénérer la liste ne perd rien : articles manuels et cochés conservés', () => {
  const g1 = fusionner([{ aliment: 'farine', quantite: 300, unite: 'g', recette: 'R1' }, { aliment: 'oeuf', quantite: 4, unite: 'pièce', recette: 'R1' }]);
  const premiere = planifierMiseAJour([], g1);
  assert.equal(premiere.ecrire.length, 2);
  const existants = premiere.ecrire.map((a) => ({ ...a }));
  existants.find((a) => a.nom === 'oeuf').coche = true;
  existants.push({ id: 'm-1', nom: 'Dentifrice', source: 'manuel', coche: false });
  const g2 = fusionner([{ aliment: 'farine', quantite: 500, unite: 'g', recette: 'R2' }, { aliment: 'oeuf', quantite: 6, unite: 'pièce' }, { aliment: 'beurre', quantite: 50, unite: 'g' }]);
  const m = planifierMiseAJour(existants, g2);
  assert.equal(m.ecrire.find((a) => a.nom === 'farine').quantite, 500, 'quantité mise à jour');
  assert.ok(!m.ecrire.some((a) => a.nom === 'oeuf'), 'article coché : intact');
  assert.ok(m.ecrire.some((a) => a.nom === 'beurre'), 'nouvel article ajouté');
  assert.deepEqual(m.supprimer, [], 'rien de supprimé');
  const m3 = planifierMiseAJour(existants, []);
  assert.deepEqual(m3.supprimer, [existants[0].id], 'seul l\'article généré non coché disparaît ; manuel et coché restent');
});

test('rayons : les ingrédients du catalogue sont classés à plus de 97 %', () => {
  const r = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
  let total = 0; let autres = 0;
  for (const x of r) for (const i of x.ingredients) { if (!estAlimentaire(i.aliment)) continue; total++; if (rayonDe(i.aliment) === 'autre') autres++; }
  assert.ok(autres / total < 0.03, `${autres}/${total} non classés`);
  assert.equal(rayonDe('sucre glace'), 'epicerie_sucree');
  assert.equal(rayonDe('pulpe de tomate'), 'epicerie_salee');
  assert.equal(rayonDe('filet de saumon'), 'poissonnerie');
  assert.equal(rayonDe('lardons fumés'), 'charcuterie');
});

test('liste d\'une vraie semaine : cohérente, sans NaN, groupée en rayons', () => {
  const index = preparerRecettes(JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).recettes);
  const complet = new Map(JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8')).map((r) => [r.id, r]));
  const jours = semaineDe(new Date(2026, 10, 9));
  const { plan } = genererSemaine(index, jours, {}, { contraintes: contraintesCouple([]), saison: 'automne', cibleKcal: 2000, graine: 9 });
  const articles = articlesDepuisPlan(plan, jours, complet, 2);
  assert.ok(articles.length > 30 && articles.length < 200, `${articles.length} articles`);
  for (const a of articles) {
    assert.ok(a.quantite > 0 && Number.isFinite(a.quantite) && a.nom && a.rayon && !/NaN/.test(libelleQuantite(a)), JSON.stringify(a));
  }
  const ids = new Set(articles.map((a) => a.id));
  assert.equal(ids.size, articles.length, 'identifiants uniques');
  assert.ok(articles.some((a) => a.recettes.length > 1), 'des ingrédients communs à plusieurs recettes sont fusionnés');
});
