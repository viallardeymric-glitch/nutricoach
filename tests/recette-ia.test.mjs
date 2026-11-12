import test from 'node:test';
import assert from 'node:assert/strict';
import { veutUneRecette, lireRecetteIA, conflitsRecette, promptRecette, CONSIGNE_RECETTE } from '../js/lib/recette-ia.js';
import { premierReussi } from '../js/core/coach.js';

test('demande de recette détectée (et pas les autres questions)', () => {
  for (const t of ['Je veux pas forcément que tu utilises tous les ingrédients, je veux que tu me crée une recette pour midi pour 2 adultes et 1 enfant', 'Crée-moi une recette', 'Invente un plat avec du poulet', 'Peux-tu me proposer une recette végétarienne ?', 'fais moi une recette de gratin']) assert.equal(veutUneRecette(t), true, t);
  for (const t of ['Que cuisiner ce soir ?', 'Comment équilibrer ma semaine ?', 'Puis-je manger du saumon fumé ?', 'Explique la recette de la fiche', 'Combien de calories dans une pomme ?']) assert.equal(veutUneRecette(t), false, t);
});

test('recette de l\'IA : lue même entourée de ```json, normalisée, étiquetée « coach »', () => {
  const json = JSON.stringify({ titre: 'Poulet aux courgettes', portions_base: 5, temps: { preparation_min: 10, cuisson_min: 25 }, ingredients: ['3 escalopes de poulet', '2 courgettes', '2 c. à soupe d\'huile d\'olive'], etapes: ['Couper.', 'Cuire 25 minutes.', 'Servir.'], nutrition_par_portion: { calories_kcal: 380, proteines_g: 35, glucides_g: 12, lipides_g: 20 } });
  const r = lireRecetteIA('```json\n' + json + '\n```', 3);
  assert.equal(r.erreurs.length, 0);
  assert.equal(r.recette.portions_base, 3, 'le nombre de portions du foyer prime');
  assert.ok(r.recette.tags.includes('coach') && r.recette.origine === 'coach');
  assert.equal(r.recette.etapes.length, 3);
  assert.equal(r.recette.temps.total_min, 35);
  assert.match(lireRecetteIA('désolé je ne peux pas', 3).erreurs[0], /exploitable/);
  assert.match(lireRecetteIA('{pas du json}', 3).erreurs[0], /illisible/);
  assert.equal(lireRecetteIA('{"titre":"x"}', 3).recette, null, 'sans ingrédients ni étapes : refusée');
});

test('contrôle de sécurité : allergène du foyer = bloquant, régime et aliment déconseillé = avertissement', () => {
  const { recette } = lireRecetteIA(JSON.stringify({ titre: 'Toast', ingredients: ['4 tranches de pain', '100 g de saumon fumé', '20 cl de crème fraîche'], etapes: ['Assembler.'] }), 3);
  const c = conflitsRecette(recette, { allergenes: ['lait'], regimes: ['vegetarien'], risques: ['femme_enceinte'] });
  assert.ok(c.some((x) => x.type === 'allergene' && /lait/.test(x.texte)));
  assert.ok(c.some((x) => x.type === 'regime'));
  assert.ok(c.some((x) => x.type === 'risque' && /listériose/.test(x.texte)));
  assert.deepEqual(conflitsRecette(recette, { allergenes: [], regimes: [], risques: [] }), []);
  assert.ok(conflitsRecette(recette, { allergenes: [], regimes: [], risques: [], exclusions: ['saumon'] }).some((x) => x.type === 'exclusion'), 'aliment évité');
});

test('prompt : demande, portions, contexte et conversation récente; consigne de sécurité', () => {
  const p = promptRecette({ demande: 'Une recette pour midi', historique: [{ role: 'user', texte: 'J\'ai de la crème et des lardons' }, { role: 'coach', recette: { titre: 'Pâtes carbonara' } }], contexte: 'ALLERGIES : lait', portions: 3, noms: 'Eymric, Marie et Léa' });
  for (const t of ['Une recette pour midi', '3 (Eymric, Marie et Léa)', 'ALLERGIES : lait', 'crème et des lardons', 'Pâtes carbonara']) assert.ok(p.includes(t), t);
  assert.ok(/allergies/i.test(CONSIGNE_RECETTE) && /grossesse/i.test(CONSIGNE_RECETTE) && /JSON/.test(CONSIGNE_RECETTE));
});

test('premierReussi : préférence de qualité dans le délai de grâce, sinon le plus rapide ; erreurs gérées', async () => {
  const dans = (ms, v, rejet) => new Promise((ok, ko) => setTimeout(() => (rejet ? ko(new Error(v)) : ok(v)), ms));
  assert.equal(await premierReussi([{ prefere: true, p: dans(40, 'gemini') }, { p: dans(5, 'groq') }], 500), 'gemini');
  assert.equal(await premierReussi([{ prefere: true, p: dans(300, 'gemini') }, { p: dans(5, 'groq') }], 30), 'groq');
  assert.equal(await premierReussi([{ prefere: true, p: dans(5, 'panne', true) }, { p: dans(20, 'groq') }], 500), 'groq');
  assert.equal(await premierReussi([{ prefere: true, p: dans(30, 'gemini') }, { p: dans(5, 'panne', true) }], 500), 'gemini');
  await assert.rejects(premierReussi([{ prefere: true, p: dans(5, 'a', true) }, { p: dans(8, 'b', true) }], 500), /a/);
});
