import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noterRecette, noterMenu } from '../js/lib/sante.js';

const recettes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const rec = (n) => ({ nutrition_par_portion: { calories_kcal: 400, proteines_g: 20, glucides_g: 40, lipides_g: 12, fibres_g: 6, sucres_g: 4, sel_g: 0.5, ...n } });

test('score santé : plat équilibré bien noté, plat gras salé sucré mal noté', () => {
  const bon = noterRecette(rec({}));
  assert.equal(bon.note, 20 + 20 + 15 + 15 + 20);
  assert.equal(bon.couleur, 'excellent');
  const mauvais = noterRecette(rec({ calories_kcal: 950, proteines_g: 2, lipides_g: 60, fibres_g: 0, sucres_g: 40, sel_g: 4 }));
  assert.ok(mauvais.note <= 5, `note ${mauvais.note}`);
  assert.equal(mauvais.couleur, 'mauvais');
});
test('score santé : nutrition absente → null, menu pondéré par les calories', () => {
  assert.equal(noterRecette({}), null);
  assert.equal(noterRecette({ nutrition_par_portion: { calories_kcal: 0 } }), null);
  assert.equal(noterMenu([]), null);
  const m = noterMenu([rec({}), { titre: 'sans nutrition' }]);
  assert.equal(m.nb, 1);
  const a = rec({}); const b = rec({ calories_kcal: 800, proteines_g: 2, lipides_g: 50, fibres_g: 0, sucres_g: 30, sel_g: 3 });
  const deux = noterMenu([a, b]);
  assert.ok(deux.note < 50 && deux.note > noterRecette(b).note, `menu ${deux.note}`);
});
test('score santé sur les 1610 recettes : toujours 0 à 100, et vraiment discriminant', () => {
  const notes = recettes.map((r) => noterRecette(r)).filter(Boolean).map((x) => x.note);
  assert.ok(notes.length > 1500);
  assert.ok(notes.every((n) => n >= 0 && n <= 100 && Number.isInteger(n)));
  assert.ok(Math.min(...notes) < 30 && Math.max(...notes) > 80, `min ${Math.min(...notes)} max ${Math.max(...notes)}`);
  const moy = notes.reduce((s, n) => s + n, 0) / notes.length;
  assert.ok(moy > 35 && moy < 75, `moyenne ${moy}`);
});

test('score santé : une entrée d\'index donne la même note que la fiche complète', async () => {
  const { entreeIndex } = await import('../js/lib/index-entree.js');
  for (const r of recettes.slice(0, 300)) assert.equal((noterRecette(entreeIndex(r)) || {}).note, (noterRecette(r) || {}).note, r.id);
});
