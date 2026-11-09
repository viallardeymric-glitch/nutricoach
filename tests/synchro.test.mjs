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
