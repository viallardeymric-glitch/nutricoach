import test from 'node:test';
import assert from 'node:assert/strict';
import { blocs, segments } from '../js/lib/texte-riche.js';

test('gras et listes', () => {
  assert.deepEqual(segments('Un **bon** plat'), [{ texte: 'Un ' }, { texte: 'bon', gras: true }, { texte: ' plat' }]);
  const b = blocs('Voici :\n- **Soupe** de légumes\n* Salade\n1. Fruit\n\n## Conclusion');
  assert.equal(b.length, 3);
  assert.equal(b[1].type, 'ul');
  assert.equal(b[1].items.length, 3);
  assert.deepEqual(b[2].segments, [{ texte: 'Conclusion' }]);
});

test('aucun HTML interprété : le texte reste du texte', () => {
  const b = blocs('<img src=x onerror=alert(1)> **gras**');
  assert.equal(b[0].segments[0].texte, '<img src=x onerror=alert(1)> ');
});
