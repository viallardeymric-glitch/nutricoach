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

import { choisirModeleFlash } from '../js/core/coach.js';
test('modèle disparu (404) : le coach détecte un modèle flash disponible et réessaie', async () => {
  const liste = [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
  ];
  assert.equal(choisirModeleFlash(liste), 'gemini-3-flash');
  assert.equal(choisirModeleFlash([]), null);
  const appels = [];
  const appeler = async (url, o) => {
    appels.push(url);
    if (url.includes('gemini-2.5-flash:generateContent')) return { ok: false, status: 404, json: async () => ({}) };
    if (/\/models\?/.test(url)) return { ok: true, status: 200, json: async () => ({ models: liste }) };
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Bonjour' }] } }] }) };
  };
  const t = await demanderAuCoach({ cle: 'k', modele: 'gemini-2.5-flash', historique: [{ role: 'user', texte: 'salut' }], contexte: '' }, appeler);
  assert.equal(t, 'Bonjour');
  assert.ok(appels.some((u) => u.includes('gemini-3-flash:generateContent')));
  // si aucun modèle n'est disponible : message clair
  const sans = async (url) => (/\/models\?/.test(url) ? { ok: true, status: 200, json: async () => ({ models: [] }) } : { ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(demanderAuCoach({ cle: 'k', historique: [{ role: 'user', texte: 'a' }], contexte: '' }, sans), /modèle/);
});

import { repondre, demanderAGroq, choisirModeleGroq, messagesGroq } from '../js/core/coach.js';
const reponseGemini = (t) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
const reponseGroq = (t) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: t } }] }) });
const histo = [{ role: 'user', texte: 'Bonjour' }];

test('Groq : requête au format OpenAI avec clé en en-tête, réponse lue', async () => {
  let vu = null;
  const t = await demanderAGroq({ cle: 'gsk_x', historique: [{ role: 'user', texte: 'a' }, { role: 'coach', texte: 'b' }, { role: 'user', texte: 'c' }], contexte: 'Saison : hiver' }, async (url, o) => { vu = { url, o }; return reponseGroq('Salut'); });
  assert.equal(t, 'Salut');
  assert.equal(vu.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(vu.o.headers.Authorization, 'Bearer gsk_x');
  const corps = JSON.parse(vu.o.body);
  assert.deepEqual(corps.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assert.ok(corps.messages[0].content.includes('Saison : hiver'));
  assert.ok(!vu.url.includes('gsk_x'));
  assert.equal(choisirModeleGroq([{ id: 'whisper-large-v3' }, { id: 'llama-3.1-8b-instant' }, { id: 'llama-3.3-70b-versatile' }]), 'llama-3.3-70b-versatile');
  assert.equal(choisirModeleGroq([]), null);
});
test('Groq : modèle retiré (404) → détection d\'un autre modèle, puis réponse', async () => {
  const appels = [];
  const t = await demanderAGroq({ cle: 'k', modele: 'ancien', historique: histo, contexte: '' }, async (url, o) => {
    appels.push(url);
    if (url.endsWith('/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }) };
    return JSON.parse(o.body).model === 'ancien' ? { ok: false, status: 404, json: async () => ({}) } : reponseGroq('ok');
  });
  assert.equal(t, 'ok');
  await assert.rejects(demanderAGroq({ cle: 'k', historique: histo, contexte: '' }, async () => ({ ok: false, status: 401, json: async () => ({}) })), /clé Groq est refusée/);
});
test('deux IA en même temps : la plus rapide gagne, l\'autre en panne ne gêne pas', async () => {
  const attente = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
  const lent = async (url) => (url.includes('groq') ? attente(5, reponseGroq('réponse Groq')) : attente(60, reponseGemini('réponse Gemini')));
  const r = await repondre({ reg: { cle: 'a', cleGroq: 'b' }, historique: histo, contexte: '' }, lent);
  assert.deepEqual(r, { texte: 'réponse Groq', via: 'Groq' });
  const groqKo = async (url) => (url.includes('groq') ? { ok: false, status: 500, json: async () => ({}) } : attente(20, reponseGemini('ok Gemini')));
  assert.equal((await repondre({ reg: { cle: 'a', cleGroq: 'b' }, historique: histo, contexte: '' }, groqKo)).via, 'Gemini');
  const toutKo = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(repondre({ reg: { cle: 'a', cleGroq: 'b' }, historique: histo, contexte: '' }, toutKo));
  await assert.rejects(repondre({ reg: {}, historique: histo, contexte: '' }, toutKo), /clé Gemini ou Groq/);
});
test('photo ou PDF joint : seul Gemini est interrogé (Groq ne lit pas les images)', async () => {
  const urls = [];
  const f = async (url) => { urls.push(url); return reponseGemini('vu'); };
  const r = await repondre({ reg: { cle: 'a', cleGroq: 'b' }, historique: histo, contexte: '', pieces: [{ mime: 'image/jpeg', data: 'X' }] }, f);
  assert.equal(r.via, 'Gemini');
  assert.ok(urls.every((u) => !u.includes('groq')));
  await assert.rejects(repondre({ reg: { cleGroq: 'b' }, historique: histo, contexte: '', pieces: [{ mime: 'image/jpeg', data: 'X' }] }, f), /Groq ne lit pas/);
});
test('Gemini 2.5 flash : mode « réflexion » coupé pour répondre plus vite', async () => {
  let corps = null;
  await demanderAuCoach({ cle: 'k', modele: 'gemini-2.5-flash', historique: histo, contexte: '' }, async (u, o) => { corps = JSON.parse(o.body); return reponseGemini('ok'); });
  assert.equal(corps.generationConfig.thinkingConfig.thinkingBudget, 0);
  await demanderAuCoach({ cle: 'k', modele: 'gemini-3-flash', historique: histo, contexte: '' }, async (u, o) => { corps = JSON.parse(o.body); return reponseGemini('ok'); });
  assert.equal(corps.generationConfig.thinkingConfig, undefined);
});

import { avertissementSante, reperesGrossesse, decrireProfil } from '../js/core/coach.js';
test('contexte complet : conjoint(e), enfants, sport, frigo, courses, poids, repères grossesse', () => {
  const marie = { sexe: 'femme', grossesse: 2, allergenes: ['lait'] };
  const c = construireContexte({
    profil: { sexe: 'homme', sportif: true }, prenom: 'Eymric', saison: 'hiver',
    partenaire: { profil: marie, prenom: 'Marie', besoins: { cible: 2200, proteines_g: 90, glucides_g: 250, lipides_g: 70 } },
    enfants: [{ prenom: 'Léa', naissance: '2020-01-01', allergenes: ['arachides'], exclusions: '' }],
    sport: { epreuve: 'Marathon', date: '2027-04-04', reste: 60, phase: 'Développement', charge: 'Sortie longue 120 min', kcal: 3100, glucides_g: 480 },
    stock: ['lait', 'oeufs'], aConsommer: ['yaourts'], courses: ['pommes'], poids: [{ date: '2026-11-01', kg: 80 }, { date: '2026-11-08', kg: 79.5 }],
  });
  for (const t of ['Conjoint(e) : Marie', 'enceinte (2e trimestre)', 'Léa', 'arachides', 'Marathon', 'J-60', 'Développement', 'Sortie longue 120 min', 'lait, oeufs', 'À consommer vite : yaourts', 'pommes', '79.5 kg', 'INTERDIT']) assert.ok(c.includes(t), t);
  assert.ok(!construireContexte({ profil: { sexe: 'homme' }, prenom: 'E' }).includes('INTERDIT'), 'repères grossesse seulement si concerné');
  assert.ok(reperesGrossesse()[0].includes('Alcool'));
  assert.ok(decrireProfil({ profil: marie, prenom: 'Marie' })[0].includes('enceinte'));
});
test('consignes du coach : base médicale, jamais de diagnostic, « pas médecin » et grossesse/allaitement', () => {
  for (const t of ['ne poses JAMAIS de diagnostic', 'pas un médecin', 'grossesse', 'allaitement', 'le 15', 'sage-femme']) assert.ok(CONSIGNES.includes(t), t);
});
test('avertissement « je ne suis pas médecin » : toujours en grossesse/allaitement, sinon si la question touche à la santé', () => {
  assert.match(avertissementSante({ profil: { grossesse: 1 }, question: 'Une idée de dessert ?' }), /sage-femme/);
  assert.match(avertissementSante({ profil: { allaitement: true }, question: 'salut' }), /pas médecin/);
  assert.match(avertissementSante({ profil: {}, question: 'J\'ai de la fièvre, que manger ?' }), /pas médecin/);
  assert.equal(avertissementSante({ profil: {}, question: 'Une idée de dessert ?' }), null);
});

import { demanderJSONRapide } from '../js/core/coach.js';
test('réécriture de recette : Gemini et Groq en même temps, JSON demandé aux deux', async () => {
  const vus = [];
  const f = async (url, o) => {
    vus.push(url);
    if (url.includes('groq')) { const c = JSON.parse(o.body); assert.equal(c.response_format.type, 'json_object'); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"etapes":[]}' } }] }) }; }
    return new Promise((r) => setTimeout(() => r({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"etapes":[1]}' }] } }] }) }), 30));
  };
  assert.equal(await demanderJSONRapide({ reg: { cle: 'a', cleGroq: 'b' }, systeme: 's JSON', message: 'm' }, f), '{"etapes":[]}');
  assert.equal(vus.length, 2);
  assert.equal(await demanderJSONRapide({ reg: { cle: 'a' }, systeme: 's', message: 'm' }, f), '{"etapes":[1]}');
  await assert.rejects(demanderJSONRapide({ reg: {}, systeme: 's', message: 'm' }, f), /clé Gemini ou Groq/);
});
