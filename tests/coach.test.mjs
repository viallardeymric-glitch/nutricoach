import test from 'node:test';
import assert from 'node:assert/strict';
import { construireContexte, construireRequete, extraireTexte, demanderAuCoach, CONSIGNES, messageErreurCoach } from '../js/core/coach.js';

test('contexte : profil, allergies en évidence, rien sans profil', () => {
  const c = construireContexte({
    profil: { sexe: 'femme', grossesse: 2, objectif: 'equilibre', allergenes: ['lait'], regimes: ['vegetarien'], exclusions: 'coriandre', conditions: [] },
    besoins: { cible: 2180, proteines_g: 68, glucides_g: 313, lipides_g: 73 }, prenom: 'Marie', saison: 'automne', repasSemaine: ['Lundi dîner : Soupe'],
  });
  assert.match(c, /enceinte \(2e trimestre\)/);
  assert.match(c, /ALLERGIES.*lait/);
  assert.match(c, /2180 kcal/);
  assert.match(c, /Menu de la semaine : Lundi dîner : Soupe/);
  assert.equal(construireContexte({}), '');
});

test('requête Gemini : consignes de sécurité, rôles user/model, aucune clé dans le corps', () => {
  const r = construireRequete({ historique: [{ role: 'user', texte: 'Idée pour ce soir ?' }, { role: 'coach', texte: 'Une soupe.' }], contexte: 'Saison : hiver.' });
  assert.match(r.systemInstruction.parts[0].text, /Ne propose jamais de régime extrême/);
  assert.match(r.systemInstruction.parts[0].text, /Saison : hiver/);
  assert.deepEqual(r.contents.map((c) => c.role), ['user', 'model']);
  assert.ok(CONSIGNES.includes('STRICTEMENT les allergies'));
  assert.ok(!JSON.stringify(r).includes('AIza'));
});

test('lecture de la réponse', () => {
  assert.equal(extraireTexte({ candidates: [{ content: { parts: [{ text: 'Bonjour ' }, { text: 'Marie' }] } }] }), 'Bonjour Marie');
  assert.equal(extraireTexte({ candidates: [] }), null);
  assert.equal(extraireTexte({}), null);
  assert.equal(extraireTexte(null), null);
});

test('appel : clé dans l\'en-tête (pas dans l\'URL), erreurs lisibles', async () => {
  let vu;
  const ok = async (url, opts) => { vu = { url, opts }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Salut' }] } }] }) }; };
  assert.equal(await demanderAuCoach({ cle: 'CLE-SECRETE', historique: [{ role: 'user', texte: 'Hello' }] }, ok), 'Salut');
  assert.ok(!vu.url.includes('CLE-SECRETE'), 'la clé n\'apparaît pas dans l\'URL');
  assert.equal(vu.opts.headers['x-goog-api-key'], 'CLE-SECRETE');
  assert.match(vu.url, /generativelanguage\.googleapis\.com.*:generateContent$/);
  await assert.rejects(demanderAuCoach({ cle: '', historique: [] }, ok), /clé Gemini/);
  await assert.rejects(demanderAuCoach({ cle: 'x', historique: [] }, async () => ({ ok: false, status: 403 })), /refusée/);
  await assert.rejects(demanderAuCoach({ cle: 'x', historique: [] }, async () => ({ ok: false, status: 429 })), /quota/);
  await assert.rejects(demanderAuCoach({ cle: 'x', historique: [] }, async () => { throw new TypeError('réseau'); }), /réseau/);
  await assert.rejects(demanderAuCoach({ cle: 'x', historique: [] }, async () => ({ ok: true, json: async () => ({}) })), /pas pu répondre/);
  assert.match(messageErreurCoach(404), /modèle/);
});
