// Vérification avant commit : node scripts/verifier.mjs
// Contrôle les 1 610 recettes, l'index, le service worker et les règles de sécurité.
// Sans dépendance : Node 20+ uniquement.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { lireRecettes, indexSerialise } from './build-index.mjs';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const erreurs = [];
const ko = (msg) => { if (erreurs.length < 40) erreurs.push(msg); else if (erreurs.length === 40) erreurs.push('… (suite masquée)'); };
const section = (nom) => console.log(`\n# ${nom}`);

const REGIMES = ['omnivore', 'sans_gluten', 'sans_lactose', 'sans_porc', 'halal', 'pescetarien', 'vegetarien', 'vegan', 'hypocalorique', 'riche_en_proteines', 'sportif', 'diabetique', 'sans_sel_ajoute', 'enceinte'];
const ALLERGENES = ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'mollusques', 'arachides', 'fruits_a_coque', 'soja', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin'];
const PROFILS = ['femme_enceinte', 'allaitante', 'enfant_moins_de_3_ans', 'enfant', 'senior', 'diabetique', 'hypertendu', 'immunodeprime'];
const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'c. à café', 'c. à soupe', 'pincée', 'gousse', 'tranche', 'branche', 'feuille', 'pièce', 'sachet', 'noix'];
const SAISONS = ['printemps', 'ete', 'automne', 'hiver', 'toute_annee'];
const APPAREILS = ['thermomix', 'cookeo', 'classique', 'four', 'airfryer', 'multicuiseur'];
const NUTRITION = ['calories_kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g', 'sucres_g', 'sel_g'];

const parFichier = lireRecettes();
const toutes = Object.values(parFichier).flat();

// 1. Données ---------------------------------------------------------------
section(`Catalogue : ${toutes.length} recettes`);
const dans = (liste, v, ou) => { if (!liste.includes(v)) ko(`${ou} : valeur inconnue « ${v} »`); };
for (const r of toutes) {
  const o = r.id;
  if (!/^REC-\d{6}$/.test(r.id)) ko(`${o} : identifiant invalide`);
  for (const c of ['titre', 'categorie', 'sous_categorie', 'description']) if (typeof r[c] !== 'string' || !r[c]) ko(`${o} : « ${c} » manquant`);
  if (!Number.isInteger(r.portions_base) || r.portions_base < 1) ko(`${o} : portions_base invalide`);
  for (const c of ['regimes_compatibles', 'allergenes', 'deconseille_a', 'saisons', 'appareils_possibles', 'tags', 'ustensiles', 'astuces', 'ingredients', 'etapes']) {
    if (!Array.isArray(r[c])) ko(`${o} : « ${c} » n'est pas une liste`);
  }
  if (!Array.isArray(r.allergenes)) continue;
  r.regimes_compatibles.forEach((x) => dans(REGIMES, x, `${o} régime`));
  r.allergenes.forEach((x) => dans(ALLERGENES, x, `${o} allergène`));
  r.deconseille_a.forEach((d) => { dans(PROFILS, d.profil, `${o} profil`); if (!d.raison) ko(`${o} : avertissement sans raison`); });
  r.saisons.forEach((x) => dans(SAISONS, x, `${o} saison`));
  r.appareils_possibles.forEach((x) => dans(APPAREILS, x, `${o} appareil`));
  if (!r.ingredients.length) ko(`${o} : aucun ingrédient`);
  r.ingredients.forEach((i) => {
    dans(UNITES, i.unite, `${o} unité`);
    if (!(typeof i.quantite === 'number' && i.quantite > 0)) ko(`${o} : quantité invalide pour « ${i.aliment} »`);
    if (!i.aliment) ko(`${o} : ingrédient sans nom`);
  });
  if (!r.etapes.length) ko(`${o} : aucune étape`);
  NUTRITION.forEach((k) => { if (typeof r.nutrition_par_portion?.[k] !== 'number') ko(`${o} : nutrition.${k} manquant`); });
  if (typeof r.temps?.total_min !== 'number') ko(`${o} : temps.total_min manquant`);
  if (!r.conservation) ko(`${o} : conservation manquante`);
}

// 2. Index à jour ----------------------------------------------------------
section('Index léger');
const indexDisque = existsSync(join(racine, 'data/index.json')) ? readFileSync(join(racine, 'data/index.json'), 'utf8') : '';
if (indexDisque !== indexSerialise()) ko('data/index.json n\'est pas à jour : lancez « node scripts/build-index.mjs »');
else console.log('à jour');

// 3. Service worker : tous les fichiers de l'appli sont précachés ------------
section('Service worker');
const sw = readFileSync(join(racine, 'sw.js'), 'utf8');
const versionSw = sw.match(/const VERSION = '(\d+)'/)?.[1];
const html = readFileSync(join(racine, 'index.html'), 'utf8');
const versions = [...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
if (!versionSw) ko('sw.js : VERSION introuvable');
if (!versions.length || versions.some((v) => v !== versionSw)) ko(`index.html : les ?v=N (${versions.join(',')}) doivent valoir la VERSION de sw.js (${versionSw})`);
const lister = (dossier) => !existsSync(join(racine, dossier)) ? [] : readdirSync(join(racine, dossier), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? lister(join(dossier, e.name)) : [relative(racine, join(racine, dossier, e.name))]);
for (const f of [...lister('js'), ...lister('css'), ...lister('vendor'), ...lister('icons')]) {
  if (!sw.includes(`'${f}'`)) ko(`sw.js : « ${f} » n'est pas dans la liste de précache`);
}
if (!existsSync(join(racine, '.nojekyll'))) ko('.nojekyll manquant');

// 4. Aucune donnée personnelle ni clé dans le dépôt --------------------------
section('Secrets');
const suspect = /(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
// js/core/firebase-config.js : clé web Firebase, publique par conception (voir le commentaire du fichier).
for (const f of [...lister('js'), 'index.html', 'sw.js', ...lister('scripts')].filter((x) => x !== 'js/core/firebase-config.js')) {
  if (suspect.test(readFileSync(join(racine, f), 'utf8'))) ko(`${f} : ressemble à une clé d'API`);
}
console.log('rien de suspect');

// 5. Modules de js/lib (importés dynamiquement s'ils existent) ---------------
const verifsLib = join(racine, 'scripts/verifs-lib.mjs');
if (existsSync(verifsLib)) {
  section('Fonctions de js/lib sur toutes les recettes');
  const { verifier } = await import(verifsLib);
  verifier({ parFichier, toutes, ko, ALLERGENES });
}

if (erreurs.length) {
  console.error(`\n✗ ${erreurs.length} problème(s) :\n- ` + erreurs.join('\n- '));
  process.exit(1);
}
console.log('\n✓ Tout est bon');
