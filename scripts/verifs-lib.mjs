// Contrôles des fonctions de js/lib sur les 1 610 recettes (appelé par verifier.mjs).
import { construireIndex } from './build-index.mjs';
import { filtrerRecettes, FILTRES_VIDES } from '../js/lib/recettes.js';
import { normaliser } from '../js/lib/texte.js';
import { ligneIngredient, conseilsAdaptation } from '../js/lib/adaptation.js';
import { PORTIONS_MIN, PORTIONS_MAX } from '../js/core/config.js';
import { alertesProfil, conflitsProfil, profilVide } from '../js/lib/profils.js';

export function verifier({ parFichier, toutes, ko, ALLERGENES }) {
  const index = construireIndex(parFichier).recettes.map((r) => ({
    ...r, _titre: normaliser(r.titre), _autres: normaliser([...r.ingredients, ...r.tags].join(' | ')),
  }));
  const complet = new Map(toutes.map((r) => [r.id, r]));

  // Règle de sécurité : pour chaque allergène (et pour toutes les paires), aucune recette de la
  // FICHE COMPLÈTE affichée ne contient l'allergène exclu.
  let nb = 0;
  const groupes = [...ALLERGENES.map((a) => [a]), ['lait', 'gluten'], ['oeuf', 'fruits_a_coque', 'soja']];
  for (const exclus of groupes) {
    const gardees = filtrerRecettes(index, { ...FILTRES_VIDES, allergenes: exclus });
    for (const r of gardees) {
      nb++;
      if (exclus.some((a) => complet.get(r.id).allergenes.includes(a))) ko(`${r.id} : affichée malgré l'exclusion de ${exclus.join('+')}`);
    }
    const attendu = toutes.filter((r) => !exclus.some((a) => r.allergenes.includes(a))).length;
    if (gardees.length !== attendu) ko(`exclusion ${exclus.join('+')} : ${gardees.length} recettes au lieu de ${attendu}`);
  }
  console.log(`filtre d'allergènes : ${groupes.length} exclusions contrôlées (${nb} recettes gardées)`);

  // L'index doit reprendre fidèlement les allergènes et régimes de chaque fiche.
  for (const r of index) {
    const c = complet.get(r.id);
    if (JSON.stringify(r.allergenes) !== JSON.stringify(c.allergenes)) ko(`${r.id} : allergènes de l'index ≠ fiche`);
    if (JSON.stringify(r.regimes) !== JSON.stringify(c.regimes_compatibles)) ko(`${r.id} : régimes de l'index ≠ fiche`);
  }

  // Alertes de profil : l'index (risques) et les fiches (deconseille_a) disent la même chose.
  const profilsTypes = {
    enceinte: { ...profilVide('M'), sexe: 'femme', age: 30, grossesse: 2 },
    allaitante: { ...profilVide('M'), sexe: 'femme', age: 30, allaitement: true },
    senior: { ...profilVide('E'), sexe: 'homme', age: 70 },
    diabete: { ...profilVide('E'), sexe: 'homme', age: 40, conditions: ['diabete'] },
  };
  const cle = { enceinte: 'femme_enceinte', allaitante: 'allaitante', senior: 'senior', diabete: 'diabetique' };
  let alertes = 0;
  for (const r of index) {
    const c = complet.get(r.id);
    const attendu = [...new Set(c.deconseille_a.map((d) => d.profil))].sort();
    if (JSON.stringify([...r.risques].sort()) !== JSON.stringify(attendu)) ko(`${r.id} : risques de l'index ≠ fiche`);
    for (const [nom, p] of Object.entries(profilsTypes)) {
      const n = alertesProfil(c, p).length;
      alertes += n;
      if (n !== c.deconseille_a.filter((d) => d.profil === cle[nom]).length) ko(`${r.id} : alertes « ${nom} » incohérentes`);
    }
    conflitsProfil(c, { ...profilsTypes.enceinte, allergenes: ['lait'], regimes: ['vegan'], exclusions: 'ail, oignons' });
  }
  console.log(`alertes de profil : ${alertes} alertes calculées sur 4 profils types`);

  // Chaque recette se retrouve par son titre exact.
  for (const r of index.slice(0, 400)) {
    if (!filtrerRecettes(index, { ...FILTRES_VIDES, q: r.titre }).some((x) => x.id === r.id)) ko(`${r.id} : introuvable par son titre`);
  }

  // Adaptation : toutes les recettes, de 1 à 12 personnes.
  let lignes = 0;
  for (const r of toutes) {
    for (let p = PORTIONS_MIN; p <= PORTIONS_MAX; p++) {
      const facteur = p / r.portions_base;
      for (const ing of r.ingredients) {
        const l = ligneIngredient(ing, facteur);
        lignes++;
        if (!l.quantite || /NaN|undefined|Infinity/.test(l.quantite + l.aliment)) ko(`${r.id} (${p} pers.) : ligne illisible « ${l.quantite} ${l.aliment} »`);
        else if (/\d,\d{3}/.test(l.quantite)) ko(`${r.id} (${p} pers.) : quantité trop précise « ${l.quantite} »`);
        else if (/^0(\s|$)/.test(l.quantite)) ko(`${r.id} (${p} pers.) : quantité nulle « ${l.quantite} »`);
      }
      conseilsAdaptation(r, p);
    }
  }
  console.log(`adaptation : ${lignes} lignes d'ingrédients calculées (1 à ${PORTIONS_MAX} personnes)`);
}
