import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTS_GROSSESSE, STATUTS, CATEGORIES_GROSSESSE, chercherGrossesse } from '../js/data/grossesse.js';
import { construireRequete } from '../js/core/coach.js';
import { typeDePiece, texteAvecPieces } from '../js/core/pieces.js';

test('guide grossesse : fiches complètes, identifiants uniques, catégories et statuts valides', () => {
  assert.ok(ALIMENTS_GROSSESSE.length >= 30);
  assert.equal(new Set(ALIMENTS_GROSSESSE.map((a) => a.id)).size, ALIMENTS_GROSSESSE.length);
  for (const a of ALIMENTS_GROSSESSE) {
    assert.ok(STATUTS[a.statut], a.id);
    assert.ok(CATEGORIES_GROSSESSE[a.cat], a.id);
    assert.ok(a.nom && a.pourquoi && a.conseil && a.mots.length, a.id);
  }
});
test('guide grossesse : les cas classiques sont bien classés', () => {
  const statut = (q) => chercherGrossesse(q)[0].statut;
  assert.equal(statut('alcool'), 'interdit');
  assert.equal(statut('vin'), 'interdit');
  assert.equal(statut('sushi'), 'interdit');
  assert.equal(statut('espadon'), 'interdit');
  assert.equal(statut('steak tartare'), 'interdit');
  assert.equal(statut('camembert'), 'eviter');
  assert.equal(statut('saumon fumé'), 'eviter');
  assert.equal(statut('mayonnaise'), 'eviter');
  assert.equal(statut('café'), 'limiter');
  assert.equal(chercherGrossesse('comté')[0].statut, 'ok');
  assert.equal(chercherGrossesse('miel')[0].statut, 'ok');
  assert.deepEqual(chercherGrossesse('zzzzzz'), []);
  assert.deepEqual(chercherGrossesse(''), []);
  assert.ok(chercherGrossesse('œuf').length >= 2, 'ligature œ reconnue');
});
test('guide grossesse : le plus risqué est affiché en premier pour un même mot', () => {
  const r = chercherGrossesse('jambon');
  const ordre = r.map((a) => STATUTS[a.statut].ordre);
  assert.deepEqual(ordre, [...ordre].sort((x, y) => x - y));
});
test('coach : pièces jointes seulement sur le dernier message de la personne', () => {
  const req = construireRequete({ historique: [{ role: 'user', texte: 'a' }, { role: 'coach', texte: 'b' }, { role: 'user', texte: 'c' }], contexte: '', pieces: [{ mime: 'image/jpeg', data: 'XYZ' }, { mime: 'text/plain', texte: 'x' }] });
  assert.equal(req.contents[0].parts.length, 1);
  assert.equal(req.contents[2].parts.length, 2);
  assert.equal(req.contents[2].parts[1].inlineData.data, 'XYZ');
});
test('pièces jointes : types reconnus, fichiers texte ajoutés à la question', () => {
  assert.equal(typeDePiece('photo.HEIC', ''), 'image');
  assert.equal(typeDePiece('x.pdf', ''), 'pdf');
  assert.equal(typeDePiece('notes.txt', 'text/plain'), 'texte');
  assert.equal(typeDePiece('virus.exe', 'application/octet-stream'), null);
  const t = texteAvecPieces('Question', [{ type: 'texte', nom: 'bilan.txt', texte: 'Fer 8' }, { type: 'image', nom: 'a.png' }]);
  assert.ok(t.startsWith('Question') && t.includes('bilan.txt') && t.includes('Fer 8') && !t.includes('a.png'));
});
