import test from 'node:test';
import assert from 'node:assert/strict';
import { evenements, totalEvenements } from '../js/lib/activite.js';

test('activité de l\'autre depuis la dernière visite : regroupée, sans mes propres actions', () => {
  const t0 = 1000;
  const src = {
    articles: [{ par: 'M', coche: false, modifie: 2000, source: 'manuel' }, { par: 'M', coche: false, modifie: 2100, source: 'scan' }, { par: 'M', coche: false, modifie: 2200, source: 'manuel' },
      { par: 'M', coche: false, modifie: 2300, source: 'recette' }, { par: 'E', coche: false, modifie: 2400, source: 'manuel' }, { par: 'E', cochePar: 'M', coche: true, modifie: 2500 }, { par: 'M', coche: false, modifie: 500, source: 'manuel' }],
    favoris: [{ par: 'M', t: 3000 }, { par: 'E', t: 3000 }, { par: 'M', t: 100 }],
    scans: [{ par: 'M', t: 4000 }], journal: [{ par: 'M', type: 'repas', t: 5000 }, { par: 'M', type: 'eau', t: 5000 }],
    planning: [{ par: 'M', modifie: 6000 }, { par: 'M', modifie: 6100 }], sessions: [{ par: 'M', t: 7000 }], poids: [{ par: 'M', t: 8000 }],
  };
  const e = evenements(src, 'M', t0);
  const par = Object.fromEntries(e.map((x) => [x.type, x]));
  assert.equal(par.ajouts.nombre, 3, 'articles ajoutés à la main ou par scan (pas ceux générés depuis le menu)');
  assert.match(par.ajouts.texte, /a ajouté 3 articles aux courses/);
  assert.equal(par.coches.nombre, 1);
  assert.match(par.coches.texte, /a coché 1 article$/);
  assert.equal(par.favoris.nombre, 1);
  assert.equal(par.scans.nombre, 1);
  assert.equal(par.journal.nombre, 1, 'l\'eau n\'est pas un repas');
  assert.match(par.menu.texte, /2 jours/);
  assert.match(par.batch.texte, /1 session de batch cooking/);
  assert.equal(totalEvenements(e), 3 + 1 + 1 + 1 + 1 + 2 + 1 + 1);
  assert.deepEqual(evenements(src, 'M', 99999), [], 'rien de nouveau');
  assert.deepEqual(evenements({}, 'M', 0), []);
  assert.equal(evenements(src, 'E', t0).find((x) => x.type === 'ajouts').nombre, 1, 'du point de vue de Marie : ce qu\'a fait Eymric');
});
