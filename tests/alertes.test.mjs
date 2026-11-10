import test from 'node:test';
import assert from 'node:assert/strict';
import { alertesTexte, pireNiveau } from '../js/lib/alertes.js';
import { profilVide } from '../js/lib/profils.js';
import { REGLES_ALERTE } from '../js/data/deconseilles.js';
import { SOURCES } from '../js/data/sources.js';

const enceinte = { ...profilVide('M'), sexe: 'femme', naissance: '1991-05-14', grossesse: 2 };
const ids = (t, p) => alertesTexte(t, p).map((a) => a.id);

test('grossesse : un fromage au lait cru donne un avertissement ROUGE avec la raison', () => {
  const a = alertesTexte('Camembert de Normandie au lait cru', enceinte);
  assert.equal(pireNiveau(a), 'rouge');
  assert.ok(a.some((x) => x.id === 'lait-cru' && /listériose/.test(x.raison) && x.source === 'SPF'));
  assert.ok(a.some((x) => x.id === 'fromage-croute'));
});

test('grossesse : les aliments déconseillés du cahier sont signalés', () => {
  for (const [texte, id] of [['Saumon fumé 4 tranches', 'poisson-cru'], ['Jambon cru de Parme', 'charcuterie-crue'], ['Rillettes de canard', 'charcuterie-crue'],
    ['Steak tartare', 'viande-crue'], ['Espadon', 'mercure'], ['Pâté de foie', 'foie'], ['Pousses de soja', 'germes-crus'], ['Vin rouge', 'alcool'], ['Mousse au chocolat', 'oeuf-cru'], ['Café moulu', 'cafeine']]) {
    assert.ok(ids(texte, enceinte).includes(id), `${texte} → ${id}`);
  }
});

test('pas de faux positifs évidents', () => {
  for (const t of ['Vinaigre balsamique', 'Bière sans alcool', 'Gruyère', 'Café décaféiné', 'Poulet rôti', 'Pâtes complètes', 'Comté 18 mois', 'Saumon frais']) {
    const a = ids(t, enceinte);
    assert.ok(!a.includes('alcool') && !a.includes('lait-cru') && !a.includes('cafeine') && !a.includes('poisson-cru') || t === 'x', `${t} : ${a}`);
  }
  assert.deepEqual(ids('Poulet rôti', enceinte), []);
  assert.deepEqual(ids('Comté 18 mois', enceinte), []);
});

test('alertes propres à chaque profil, et rien sans profil ou profil non appliqué', () => {
  const homme = { ...profilVide('E'), sexe: 'homme', naissance: '1988-01-02' };
  assert.deepEqual(alertesTexte('Camembert au lait cru', homme), []);
  assert.deepEqual(alertesTexte('Camembert au lait cru', null), []);
  assert.deepEqual(alertesTexte('Camembert au lait cru', { ...enceinte, appliquer: false }), []);
  assert.ok(ids('Soda', { ...homme, conditions: ['diabete'] }).includes('sucres-rapides'));
  assert.ok(ids('Olives noires', { ...homme, conditions: ['hypertension'] }).includes('sel'));
  assert.ok(ids('Boisson énergisante', { ...homme, sexe: 'femme', allaitement: true }).includes('cafeine'));
});

test('allergies et aliments évités : exclusion stricte, en rouge pour les allergies', () => {
  const p = { ...enceinte, allergenes: ['arachides', 'lait'], exclusions: 'coriandre, olives' };
  const a = alertesTexte('Beurre de cacahuètes', p);
  assert.ok(a.some((x) => x.id === 'allergie-arachides' && x.niveau === 'rouge'));
  assert.ok(ids('Yaourt nature', p).includes('allergie-lait'));
  assert.ok(ids('Olives vertes', p).includes('exclusion-olive'));
  assert.equal(alertesTexte('Beurre de cacahuètes', p)[0].niveau, 'rouge', 'les rouges d\'abord');
});

test('chaque règle a un id unique, une source connue, une raison d\'une phrase', () => {
  const sources = new Set(SOURCES.map((s) => s.id));
  assert.equal(new Set(REGLES_ALERTE.map((r) => r.id)).size, REGLES_ALERTE.length);
  for (const r of REGLES_ALERTE) {
    assert.ok(sources.has(r.source), r.id);
    assert.ok(r.raison.length > 20 && r.raison.length < 200, r.id);
    assert.ok(r.profils.length > 0 && ['rouge', 'orange'].includes(r.niveau));
  }
});

import { enfantVide, risquesPour } from '../js/lib/profils.js';
import { contraintesCouple } from '../js/lib/planning.js';
test('bébé, petit enfant, enfant : règles selon l\'âge', () => {
  const ref = new Date();
  const naiss = (mois) => { const d = new Date(ref.getFullYear(), ref.getMonth() - mois, 1); return d.toISOString().slice(0, 10); };
  const bebe = { ...enfantVide('enfant-b'), prenom: 'Bébé', naissance: naiss(8) };
  const petit = { ...enfantVide('enfant-p'), prenom: 'Petit', naissance: naiss(24) };
  const enfant = { ...enfantVide('enfant-e'), prenom: 'Léa', naissance: naiss(60) };
  assert.ok(ids('Miel d\'acacia', bebe).includes('miel-bebe') && alertesTexte('Miel', bebe)[0].niveau === 'rouge', 'miel avant 1 an');
  assert.ok(!ids('Miel d\'acacia', petit).includes('miel-bebe'));
  assert.ok(ids('Cacahuètes grillées', petit).includes('etouffement'));
  assert.ok(!ids('Cacahuètes grillées', enfant).includes('etouffement'), 'étouffement : avant 3 ans seulement');
  assert.ok(ids('Lait entier', bebe).includes('lait-vache-bebe'));
  assert.ok(ids('Bouillon cube', petit).includes('sel-petit'));
  assert.ok(ids('Soda', enfant).includes('boisson-sucree-enfant'));
  assert.ok(ids('Camembert au lait cru', enfant).includes('lait-cru') && ids('Vin rouge', enfant).includes('alcool'));
  assert.deepEqual(ids('Poulet', enfant), []);
  assert.deepEqual(risquesPour(enfant), ['enfant']);
  assert.ok(contraintesCouple([enfant, enceinte]).risques.includes('enfant'), 'un enfant dans les menus : ses risques s\'ajoutent');
  assert.ok(ids('Allergie', { ...enfant, allergenes: ['arachides'] }).length === 0);
  assert.ok(ids('Beurre de cacahuètes', { ...enfant, allergenes: ['arachides'] }).includes('allergie-arachides'));
});
