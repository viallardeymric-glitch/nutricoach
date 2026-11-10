import test from 'node:test';
import assert from 'node:assert/strict';
import { construireSauvegarde, lireSauvegarde, cleSauvegardable } from '../js/lib/sauvegarde.js';

const faux = (o) => { const k = Object.keys(o); return { length: k.length, key: (i) => k[i], getItem: (c) => o[c] }; };

test('sauvegarde : les secrets n\'y entrent jamais', () => {
  const s = faux({
    'nutricoach.profil.E': '{"sexe":"homme"}', 'nutricoach.favoris': '[]', 'nutricoach.theme': '"rose"',
    'nutricoach.pin': '{"sel":"x"}', 'nutricoach.biometrie': '{"id":"x"}', 'nutricoach.coach.reglages': '{"cle":"AIza-secret","cleGroq":"gsk_secret"}',
    'nutricoach.photos.reglages': '{"cles":{"pexels":"secret"}}', 'nutricoach.off.compte': '{"mot_de_passe":"secret"}', 'nutricoach.coach.conversation': '[]',
    'nutricoach.photos': '{}', 'autre.appli': '1',
  });
  const c = construireSauvegarde(s);
  assert.deepEqual(Object.keys(c).sort(), ['nutricoach.favoris', 'nutricoach.profil.E', 'nutricoach.theme']);
  assert.ok(!JSON.stringify(c).includes('secret'));
});
test('restauration : fichier valide, secrets et valeurs douteuses ignorés', () => {
  const r = lireSauvegarde(JSON.stringify({ 'nutricoach.favoris': '["REC-000001"]', 'nutricoach.pin': '{"sel":"pirate"}', 'nutricoach.coach.reglages': '{"cle":"x"}', 'autre': '1', 'nutricoach.x': 'pas du json{' }));
  assert.deepEqual(r.entrees, [['nutricoach.favoris', '["REC-000001"]']]);
  assert.equal(r.ignorees, 4);
  assert.match(lireSauvegarde('pas du json').erreur, /illisible/);
  assert.match(lireSauvegarde('[1,2]').erreur, /pas une sauvegarde/);
  assert.match(lireSauvegarde('{"autre":"1"}').erreur, /Aucune donnée/);
  assert.match(lireSauvegarde('x'.repeat(6 * 1024 * 1024)).erreur, /trop gros/);
  assert.equal(cleSauvegardable('nutricoach.pin'), false);
  assert.equal(cleSauvegardable('nutricoach.profil.M'), true);
});
