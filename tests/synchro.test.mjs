import test from 'node:test';
import assert from 'node:assert/strict';
import { docsVersFavoris, favorisParRecette, idFavori, profilVersDoc, docVersProfil, choisirVersion } from '../js/core/synchro.js';
import { creerPin, verifierPin, pinValide, doitVerrouiller } from '../js/core/pin.js';
import { profilVide } from '../js/lib/profils.js';

test('favoris : documents invalides ignorés, doublons retirés', () => {
  const docs = [{ recette: 'REC-000001', par: 'E' }, { recette: 'REC-000001', par: 'E' }, { recette: 'REC-000001', par: 'M' },
    { recette: 'pas-une-recette', par: 'E' }, { recette: 'REC-000002', par: 'X' }, {}];
  const f = docsVersFavoris(docs);
  assert.equal(f.length, 2);
  assert.deepEqual([...favorisParRecette(f)], [['REC-000001', ['E', 'M']]]);
  assert.equal(idFavori('REC-000001', 'M'), 'REC-000001_M');
});

test('profil ↔ document : aucun champ undefined, aucun champ inconnu, ≤ 60 clés', () => {
  const p = { ...profilVide('M'), sexe: 'femme', age: 34, modifie: 5, intrus: 'x', regimes: ['vegan'] };
  const d = profilVersDoc(p);
  assert.ok(!('intrus' in d));
  assert.ok(Object.values(d).every((v) => v !== undefined));
  assert.ok(Object.keys(d).length <= 60);
  const retour = docVersProfil('M', d);
  assert.deepEqual(retour, { ...profilVide('M'), ...d });
  assert.equal(docVersProfil('E', { age: 40 }).regimes.length, 0, 'champs manquants : valeurs par défaut');
});

test('dernière modification gagnante', () => {
  assert.equal(choisirVersion({ modifie: 5 }, { modifie: 9 }), 'nuage');
  assert.equal(choisirVersion({ modifie: 9 }, { modifie: 5 }), 'local');
  assert.equal(choisirVersion({ modifie: 5 }, { modifie: 5 }), 'identique');
  assert.equal(choisirVersion({ modifie: 0 }, null), 'identique');
  assert.equal(choisirVersion(null, { modifie: 1 }), 'nuage');
});

test('PIN : PBKDF2, jamais en clair, mauvais code refusé', async () => {
  assert.ok(pinValide('1234') && pinValide('12345678'));
  assert.ok(!pinValide('123') && !pinValide('abcd') && !pinValide('123456789') && !pinValide(''));
  const e = await creerPin('4821');
  assert.ok(!JSON.stringify(e).includes('4821'));
  assert.equal(e.iterations, 150000);
  assert.ok(await verifierPin('4821', e));
  assert.ok(!(await verifierPin('4822', e)));
  assert.ok(!(await verifierPin('', e)));
  const e2 = await creerPin('4821');
  assert.notEqual(e.sel, e2.sel, 'sel aléatoire');
  await assert.rejects(creerPin('12'));
});

test('reverrouillage après 1 minute en arrière-plan', () => {
  assert.equal(doitVerrouiller(1000, 1000 + 59_999), false);
  assert.equal(doitVerrouiller(1000, 1000 + 60_000), true);
  assert.equal(doitVerrouiller(null, 99999), false);
});

import { docsVersPlan, jourVersDoc } from '../js/core/synchro.js';
test('planning ↔ documents', () => {
  const plan = docsVersPlan([
    { id: '2026-11-09', dejeuner: 'REC-000010', diner: 'REC-000020' },
    { id: '2026-11-10', diner: 'REC-000030', dejeuner: 'n\'importe quoi' },
    { id: 'pas-une-date', diner: 'REC-000040' }, { id: '2026-11-11' },
  ]);
  assert.deepEqual(plan, { '2026-11-09': { dejeuner: 'REC-000010', diner: 'REC-000020' }, '2026-11-10': { diner: 'REC-000030' } });
  const d = jourVersDoc('2026-11-09', { diner: 'REC-000020' });
  assert.deepEqual(Object.keys(d).sort(), ['date', 'diner', 'modifie']);
  assert.ok(!('dejeuner' in d));
});

import { articleVersDoc, listeVersDoc, docsVersCourses, idDocArticle, idDocStock, docsVersStock, stockVersDoc, docsVersScans, scanVersDoc } from '../js/core/synchro.js';
test('courses : un document par article, liste par défaut toujours présente, documents invalides ignorés', () => {
  const a = articleVersDoc({ id: 'g-1', liste: 'semaine', nom: 'Farine', quantite: 450, unite: 'g', rayon: 'epicerie_sucree', cle: 'farine|g', par: 'M', recettes: ['REC-000001'] });
  assert.ok(Object.values(a).every((v) => v !== undefined) && Object.keys(a).length <= 60);
  assert.equal(idDocArticle('semaine', 'g-1'), 'semaine__g-1');
  assert.ok(!/^__.*__$/.test(idDocArticle('semaine', 'g-1')), 'identifiant autorisé par Firestore');
  const { listes, articles } = docsVersCourses([a, listeVersDoc({ id: 'marche', nom: 'Marché' }), { kind: 'article', liste: 'x' }, { kind: 'inconnu' }]);
  assert.deepEqual(listes.map((l) => l.id), ['semaine', 'marche']);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].nom, 'Farine');
  assert.equal(docsVersCourses([{ ...a, id: 'semaine__g-1' }]).articles[0].id, 'g-1', 'l\'identifiant de document Firestore est retiré');
  assert.equal(docsVersCourses([]).listes.length, 1);
});
test('stock et scans', () => {
  const s = stockVersDoc({ cle: "pomme de terre|g", nom: 'Pommes de terre', quantite: 500, unite: 'g' });
  assert.ok(!idDocStock(s.cle).includes('/'));
  assert.equal(docsVersStock([s, { nom: 'x' }]).length, 1);
  const sc = scanVersDoc({ code: '3017620422003', produit: { nom: 'Pâte', marque: 'X' }, par: 'E' });
  const l = docsVersScans([sc, { code: 'abc', produit: { nom: 'x' } }, { code: '3017620422003', produit: {} }, { ...sc, code: '5449000000996', t: sc.t + 5 }]);
  assert.deepEqual(l.map((x) => x.code), ['5449000000996', '3017620422003']);
});

import { journalVersDoc, docsVersJournal, poidsVersDoc, docsVersPoids, idDocPoids, visiblePour } from '../js/core/synchro.js';
test('journal et poids : documents valides, privé masqué à l\'autre', () => {
  const r = journalVersDoc({ type: 'repas', date: '2026-11-09', par: 'E', repas: 'diner', nom: 'Soupe', kcal: 250.4, p: 8, g: 30, l: 9, source: 'recette', ref: 'REC-000001' });
  const e = journalVersDoc({ type: 'eau', date: '2026-11-09', par: 'M', ml: 250.2 });
  assert.ok([r, e].every((d) => Object.values(d).every((v) => v !== undefined)));
  assert.equal(e.ml, 250);
  const l = docsVersJournal([{ ...r, id: 'a' }, { ...e, id: 'b' }, { type: 'repas', date: 'hier', par: 'E', nom: 'x' }, { type: 'eau', date: '2026-11-09', par: 'Z', ml: 1 }, { type: 'repas', date: '2026-11-09', par: 'E' }]);
  assert.equal(l.length, 2);
  const p = poidsVersDoc({ date: '2026-11-09', par: 'M', kg: 61.8, mesures: { tour_taille: 70, hanches: NaN, bras: 0 }, prive: true });
  assert.deepEqual(p.mesures, { tour_taille: 70 });
  assert.equal(idDocPoids('2026-11-09', 'M'), '2026-11-09_M');
  assert.equal(docsVersPoids([{ ...p, id: 'x' }, { date: '2026-11-09', par: 'E', kg: 5 }]).length, 1);
  const items = [{ par: 'M', prive: true, kg: 1 }, { par: 'E', prive: false, kg: 2 }, { par: 'E', prive: true, kg: 3 }];
  assert.deepEqual(visiblePour(items, 'M').map((x) => x.kg), [1, 2]);
  assert.deepEqual(visiblePour(items, 'E').map((x) => x.kg), [2, 3]);
});

import { enfantVersDoc, docsVersEnfants } from '../js/core/synchro.js';
test('enfants du foyer : documents valides, seuls les enfants sont retenus', () => {
  const d = enfantVersDoc({ prenom: 'Léa', naissance: '2021-03-01', allergenes: ['arachides'] });
  assert.ok(Object.values(d).every((v) => v !== undefined));
  const l = docsVersEnfants([{ ...d, id: 'enfant-1' }, { ...d, id: 'E' }, { ...d, id: 'enfant-2', naissance: 'bientôt' }, { ...d, id: 'enfant-3', prenom: '' }]);
  assert.deepEqual(l.map((x) => x.id), ['enfant-1']);
  assert.deepEqual(l[0].allergenes, ['arachides']);
});
