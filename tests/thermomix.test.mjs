import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pastilles, etapesThermomix, recetteThermomix, capaciteBol, ordrePesee, MODELES } from '../js/lib/thermomix.js';
import { methodeOriginale, promptReecriture, lireReecriture, METHODES, CONSIGNE_REECRITURE } from '../js/lib/methodes.js';
import { demanderJSON } from '../js/core/coach.js';

const toutes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const thermo = toutes.filter(recetteThermomix);
const textes = (r, m) => pastilles(r, m).pastilles.map((p) => p.texte);

test('une centaine de recettes ont de vraies étapes Thermomix', () => assert.ok(thermo.length >= 87, `${thermo.length}`));

test('pastilles : durée, température, vitesse, sens, accessoire', () => {
  assert.deepEqual(textes({ duree: '3 min', temperature: '120°C', vitesse: '1' }, 'TM6'), ['3 min', '120 °C', 'Vit. 1']);
  assert.deepEqual(textes({ duree: '5 min', temperature: 'Varoma', vitesse: 'mijotage', sens: 'inverse', accessoire: 'papillon' }, 'TM6'), ['5 min', 'Varoma', 'Mijotage', 'Sens inverse', 'Papillon']);
  assert.deepEqual(textes({ vitesse: 'turbo' }, 'TM5'), ['Turbo']);
  assert.deepEqual(textes({ vitesse: '0.5' }, 'TM6'), ['Vit. 0,5']);
  assert.deepEqual(textes({ vitesse: 'mijotage' }, 'TM31'), ['Vitesse cuillère']);
  assert.deepEqual(textes({ mode: 'pétrin', duree: '2 min' }, 'TM6'), ['2 min', 'Mode pétrin']);
  assert.deepEqual(pastilles({}, 'TM6').pastilles, []);
});

test('TM31 : 100 °C au maximum, pas de mode doux ; TM5/TM6 : 120 °C', () => {
  const a = pastilles({ temperature: '120°C', vitesse: '1' }, 'TM31');
  assert.equal(a.pastilles.find((p) => p.cle === 'temperature').texte, '100 °C');
  assert.match(a.avertissements[0], /100 °C au maximum/);
  assert.equal(pastilles({ temperature: '120°C' }, 'TM6').avertissements.length, 0);
  const doux = pastilles({ mode: 'doux' }, 'TM31');
  assert.ok(doux.pastilles.some((p) => p.cle === 'sens') && doux.avertissements.length === 1);
  assert.ok(pastilles({ mode: 'doux' }, 'TM6').pastilles.some((p) => p.texte === 'Mode doux'));
  assert.equal(MODELES.TM31.tempMax, 100);
});

test('toutes les étapes Thermomix du catalogue donnent des pastilles lisibles sur les 3 modèles', () => {
  let n = 0;
  for (const r of thermo) for (const modele of Object.keys(MODELES)) for (const e of etapesThermomix(r, modele)) {
    for (const p of e.pastilles) { assert.ok(p.texte && !/undefined|NaN/.test(p.texte), `${r.id} ${p.texte}`); n++; }
  }
  assert.ok(n > 500);
});

test('capacité du bol : volume estimé, dépassement, plusieurs fournées', () => {
  const r = thermo[0];
  const c = capaciteBol(r, r.portions_base);
  assert.ok(c.volume_ml > 0 && c.max_ml >= 2000 && Number.isFinite(c.rempli));
  const grosse = { portions_base: 4, ingredients: [{ aliment: 'bouillon', quantite: 3, unite: 'l' }], etapes: [{ texte: 'Chauffez', reglages: { temperature: '100°C' } }] };
  const g = capaciteBol(grosse, 4);
  assert.ok(g.depasse && g.fournees === 2 && g.portionsParFournee === 2);
  assert.match(g.conseil, /en 2 fois/);
  assert.ok(!capaciteBol(grosse, 1).depasse, 'moins de portions : tient dans le bol');
  const froid = capaciteBol({ ...grosse, etapes: [{ texte: 'Mixez', reglages: { vitesse: '8' } }] }, 4);
  assert.equal(froid.max_ml, 2200, 'sans chauffe : 2,2 L');
  const petrin = capaciteBol({ portions_base: 4, ingredients: [{ aliment: 'farine', quantite: 900, unite: 'g' }, { aliment: 'eau', quantite: 500, unite: 'ml' }], etapes: [{ texte: 'Pétrissez', reglages: { mode: 'pétrin' } }] }, 4);
  assert.match(petrin.conseilPetrin, /1 kg/);
});

test('pesée guidée : secs, solides, liquides, puis le reste', () => {
  const o = ordrePesee([
    { aliment: 'huile d\'olive', quantite: 2, unite: 'c. à soupe' }, { aliment: 'oignon', quantite: 200, unite: 'g' }, { aliment: 'farine', quantite: 100, unite: 'g' },
    { aliment: 'œuf', quantite: 2, unite: 'pièce' }, { aliment: 'lait', quantite: 25, unite: 'cl' }, { aliment: 'carottes', quantite: 300, unite: 'g' },
  ], 2);
  assert.deepEqual(o.map((x) => x.groupe), ['sec', 'solide', 'solide', 'liquide', 'liquide', 'a_part']);
  assert.equal(o[0].aliment, 'farine'); assert.equal(o[0].quantite, 200);
  assert.deepEqual(o.map((x) => x.ordre), [1, 2, 3, 4, 5, 6]);
});

test('autres méthodes : liste, méthode d\'origine, consigne', () => {
  assert.deepEqual(Object.keys(METHODES).sort(), ['airfryer', 'cocotte', 'cookeo', 'four', 'multicuiseur', 'plaque', 'sans_cuisson', 'thermomix']);
  assert.equal(methodeOriginale({ appareil_principal: 'classique' }), 'plaque');
  assert.equal(methodeOriginale({ appareil_principal: 'four' }), 'four');
  const p = promptReecriture(toutes[0], 'thermomix', 'TM31');
  assert.match(p, /Thermomix TM31/); assert.match(p, /100 °C au maximum/); assert.match(p, new RegExp(toutes[0].titre.slice(0, 15)));
  assert.match(promptReecriture(toutes[0], 'airfryer'), /Airfryer/);
  assert.match(CONSIGNE_REECRITURE, /UNIQUEMENT par un objet JSON/);
});

test('lecture de la réponse de l\'IA : JSON propre, balises de code, valeurs invalides écartées', () => {
  const ok = '```json\n{"etapes":[{"texte":"Préchauffez l\'airfryer à 180 °C.","duree":"5 min","temperature":"180°C","bidule":"x"},{"texte":"ok"},{"texte":"Enfournez les morceaux pendant 20 minutes."}],"remarques":["Retournez à mi-cuisson."]}\n```';
  const r = lireReecriture(ok);
  assert.equal(r.etapes.length, 2);
  assert.deepEqual(r.etapes[0].reglages, { duree: '5 min', temperature: '180°C' }, 'clés inconnues ignorées');
  assert.equal(r.etapes[1].numero, 2);
  assert.deepEqual(r.remarques, ['Retournez à mi-cuisson.']);
  assert.equal(lireReecriture('pas du json'), null);
  assert.equal(lireReecriture('{"etapes":"non"}'), null);
  assert.equal(lireReecriture(null), null);
  assert.deepEqual(lireReecriture('{"etapes":[],"remarques":["Pas adapté à cette méthode."]}').etapes, []);
  const html = lireReecriture('{"etapes":[{"texte":"<img src=x onerror=alert(1)> Mélangez bien."}]}');
  assert.ok(html.etapes[0].texte.startsWith('<img'), 'le texte est conservé tel quel : il n\'est jamais interprété comme du HTML (affiché en texte)');
});

test('appel IA : clé en en-tête, JSON demandé, erreurs lisibles', async () => {
  let vu;
  const ok = async (url, o) => { vu = { url, o }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"etapes":[]}' }] } }] }) }; };
  assert.equal(await demanderJSON({ cle: 'K', systeme: 'S', message: 'M' }, ok), '{"etapes":[]}');
  assert.ok(!vu.url.includes('K')); assert.equal(vu.o.headers['x-goog-api-key'], 'K');
  assert.equal(JSON.parse(vu.o.body).generationConfig.responseMimeType, 'application/json');
  await assert.rejects(demanderJSON({ cle: '', systeme: 'S', message: 'M' }, ok), /clé Gemini/);
  await assert.rejects(demanderJSON({ cle: 'K', systeme: 'S', message: 'M' }, async () => ({ ok: false, status: 429 })), /quota/);
});
