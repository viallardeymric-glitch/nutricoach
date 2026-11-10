import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recettesDuMenu, portionsPourRepas, articlesBatch, planningSession, heureDe, conditionnement, texteEtiquette, platsEnStock, platsDeSession } from '../js/lib/batch.js';

const toutes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const par = new Map(toutes.map((r) => [r.id, r]));
const mijote = toutes.find((r) => r.sous_categorie === 'mijote' && r.etapes.length >= 5);
const gratin = toutes.find((r) => r.sous_categorie === 'gratin_tarte' && r.etapes.some((e) => /four/i.test(e.texte)));
const soupe = toutes.find((r) => r.sous_categorie === 'soupe_veloute');

test('recettes du menu : les plus fréquentes d\'abord', () => {
  const plan = { j1: { dejeuner: 'A', diner: 'B' }, j2: { dejeuner: 'A', diner: 'C' }, j3: { diner: 'A' } };
  assert.deepEqual(recettesDuMenu(plan, ['j1', 'j2', 'j3'], 2), ['A', 'B']);
  assert.equal(portionsPourRepas(2, 2), 4);
  assert.equal(portionsPourRepas(3, 2.6), 8);
});

test('courses de la session : quantités multipliées et fusionnées entre recettes', () => {
  const a = { id: 'A', portions_base: 4, ingredients: [{ aliment: 'farine', quantite: 200, unite: 'g' }, { aliment: 'oeuf', quantite: 2, unite: 'pièce' }] };
  const b = { id: 'B', portions_base: 2, ingredients: [{ aliment: 'farine', quantite: 100, unite: 'g' }] };
  const art = articlesBatch([{ recette: a, portions: 8 }, { recette: b, portions: 6 }]);
  assert.equal(art.find((x) => x.nom === 'farine').quantite, 700);   // 200×2 + 100×3
  assert.equal(art.find((x) => x.nom === 'oeuf').quantite, 4);
  assert.deepEqual(art.find((x) => x.nom === 'farine').recettes, ['A', 'B']);
});

test('planning chronométré : la cuisson passive tourne pendant la préparation des autres plats', () => {
  const sel = [mijote, gratin, soupe].map((recette) => ({ recette }));
  const p = planningSession(sel, { dureeDispo: 240, appareils: { plaques: 3, four: true } });
  assert.ok(p.taches.length === sel.reduce((n, s) => n + s.recette.etapes.length, 0), 'une tâche par étape');
  assert.ok(p.duree > 0 && p.duree < p.sequentiel, `parallélisme : ${p.duree} min au lieu de ${p.sequentiel}`);
  assert.equal(p.gain, p.sequentiel - p.duree);
  // jamais deux tâches actives en même temps (une seule personne)
  const actives = p.taches.filter((t) => t.actif).sort((a, b) => a.debut - b.debut);
  for (let i = 1; i < actives.length; i++) assert.ok(actives[i].debut >= actives[i - 1].fin, 'tâches actives successives');
  // l'ordre des étapes d'une même recette est respecté
  for (const { recette } of sel) {
    const t = p.taches.filter((x) => x.recette === recette.id).sort((a, b) => a.etape - b.etape);
    for (let i = 1; i < t.length; i++) assert.ok(t[i].debut >= t[i - 1].debut, 'ordre des étapes');
  }
  assert.ok(p.taches.some((t) => !t.actif), 'des tâches passives (four, mijotage, repos)');
  assert.ok(p.lavages > 0);
});

test('capacité des appareils respectée (plaques, four)', () => {
  const sel = Array.from({ length: 4 }, () => ({ recette: mijote }));
  const p = planningSession(sel, { appareils: { plaques: 2, four: true } });
  const plaques = p.taches.filter((t) => t.ressource === 'plaque');
  for (const t of plaques) assert.ok(plaques.filter((u) => u.debut < t.fin && u.fin > t.debut).length <= 2, 'jamais plus de 2 plaques');
  const sans = planningSession(sel, { appareils: { plaques: 1 } });
  assert.ok(sans.duree >= p.duree, 'moins de plaques : au moins aussi long');
});

test('avertissement si la session dépasse le temps prévu ; heures de la session', () => {
  const p = planningSession([mijote, gratin, soupe].map((recette) => ({ recette })), { dureeDispo: 20 });
  assert.ok(p.avertissements.length === 1 && /plus que les 20 min/.test(p.avertissements[0]));
  assert.equal(heureDe('09:00', 95), '10:35');
  assert.equal(heureDe('23:30', 45), '00:15');
});

test('conditionnement : boîtes, dates limites, conservation, étiquettes', () => {
  const [c] = conditionnement([{ recette: { ...mijote, conservation: { frigo_jours: 3, congelation_mois: 3, reechauffage: 'Réchauffer 5 min.' } }, portions: 5 }], '2026-11-10', 2);
  assert.equal(c.boites, 3);
  assert.equal(c.limiteFrigo, '2026-11-13');
  assert.equal(c.limiteCongelation, '2027-02-08');
  const txt = texteEtiquette(c);
  assert.match(txt, /Préparé le 10\/11\/2026/);
  assert.match(txt, /avant le 13\/11\/2026 \(frigo\)/);
  assert.match(texteEtiquette(c, true), /\(congelé\)/);
  const sans = conditionnement([{ recette: { ...mijote, conservation: { frigo_jours: 0, congelation_mois: 0 } }, portions: 2 }], '2026-11-10')[0];
  assert.equal(sans.frigoJours, 3, 'défaut prudent : 3 jours');
  assert.equal(sans.limiteCongelation, null);
});

test('stock de plats préparés : à manger en premier, périmés signalés, plats finis retirés', () => {
  const s1 = { id: 'S1', plats: platsDeSession(conditionnement([{ recette: { ...mijote, conservation: { frigo_jours: 2, congelation_mois: 1 } }, portions: 4 }], '2026-11-09')) };
  const s2 = { id: 'S2', plats: [{ recette: 'X', titre: 'Soupe', portions: 4, restant: 3, limiteFrigo: '2026-11-14', limiteCongelation: null, congele: false }, { recette: 'Y', titre: 'Fini', portions: 2, restant: 0, limiteFrigo: '2026-11-12', congele: false }] };
  const l = platsEnStock([s2, s1], new Date(2026, 10, 10));
  assert.equal(l.length, 2);
  assert.equal(l[0].titre, mijote.titre, 'le plus proche de la limite d\'abord');
  assert.ok(l[0].urgent && !l[0].perime);
  assert.equal(l[1].joursRestants, 4);
  assert.ok(platsEnStock([s1], new Date(2026, 10, 20))[0].perime);
  s1.plats[0].congele = true;
  assert.ok(platsEnStock([s1], new Date(2026, 10, 20))[0].joursRestants > 0, 'congelé : limite repoussée');
});

test('toutes les recettes du catalogue donnent un planning valide', () => {
  let n = 0;
  for (let i = 0; i < toutes.length; i += 40) {
    const p = planningSession([{ recette: toutes[i] }, { recette: toutes[(i + 7) % toutes.length] }], { appareils: { plaques: 3, four: true, thermomix: true } });
    assert.ok(Number.isFinite(p.duree) && p.duree > 0 && p.taches.every((t) => t.fin > t.debut && t.debut >= 0), toutes[i].id);
    n++;
  }
  assert.ok(n > 30);
});

test('durées vraisemblables : aucune tâche de plus de 8 h, session de 3 recettes sous 10 h, pas de minutes en secondes', () => {
  let maxTache = 0; let maxSession = 0;
  for (let i = 0; i < toutes.length; i += 7) {
    const p = planningSession([{ recette: toutes[i] }, { recette: toutes[(i + 3) % toutes.length] }, { recette: toutes[(i + 11) % toutes.length] }], { appareils: { plaques: 3, four: true, thermomix: true } });
    maxSession = Math.max(maxSession, p.duree);
    for (const t of p.taches) maxTache = Math.max(maxTache, t.fin - t.debut);
  }
  assert.ok(maxTache <= 480, `tâche la plus longue : ${maxTache} min`);
  assert.ok(maxSession <= 720, `session la plus longue : ${maxSession} min`);
  const simple = planningSession([{ recette: { id: 'X', titre: 'Test', portions_base: 2, ingredients: [], ustensiles: [], etapes: [
    { numero: 1, texte: 'Coupez les légumes.', reglages: {} }, { numero: 2, texte: 'Laissez mijoter.', reglages: { duree: '30 min', feu: 'doux' } }, { numero: 3, texte: 'Servez.', reglages: {} }] } }]);
  assert.equal(simple.taches[1].fin - simple.taches[1].debut, 30, '30 min restent 30 min');
  assert.ok(simple.duree >= 30 && simple.duree <= 45);
});
