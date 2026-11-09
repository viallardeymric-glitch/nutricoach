// Génère data/index.json (index léger) à partir des fichiers data/recettes*.json.
// Usage : node scripts/build-index.mjs            (écrit data/index.json)
// Un nouveau fichier data/recettes-2.json est pris en compte sans toucher au code de l'appli.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossierData = join(racine, 'data');

/** Liste des fichiers de recettes (recettes.json, recettes-2.json…), triés. */
export function fichiersRecettes() {
  return readdirSync(dossierData).filter((f) => /^recettes.*\.json$/.test(f)).sort();
}

/** Construit l'index léger. `parFichier` : { 'recettes.json': [recette, …], … } */
export function construireIndex(parFichier) {
  const fichiers = Object.keys(parFichier);
  const vus = new Set();
  const recettes = [];
  fichiers.forEach((fichier, f) => {
    for (const r of parFichier[fichier]) {
      if (vus.has(r.id)) throw new Error(`Identifiant en double : ${r.id}`);
      vus.add(r.id);
      recettes.push({
        id: r.id,
        titre: r.titre,
        categorie: r.categorie,
        sous_categorie: r.sous_categorie,
        regimes: r.regimes_compatibles,
        allergenes: r.allergenes,
        temps: r.temps.total_min,
        difficulte: r.difficulte,
        saisons: r.saisons,
        appareils: r.appareils_possibles,
        tags: r.tags,
        risques: [...new Set(r.deconseille_a.map((d) => d.profil))],
        ingredients: [...new Set(r.ingredients.map((i) => i.aliment))],
        f,
      });
    }
  });
  return { version: 1, fichiers, recettes };
}

export function lireRecettes() {
  const parFichier = {};
  for (const f of fichiersRecettes()) {
    parFichier[f] = JSON.parse(readFileSync(join(dossierData, f), 'utf8'));
  }
  return parFichier;
}

export function indexSerialise() {
  return JSON.stringify(construireIndex(lireRecettes()));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const texte = indexSerialise();
  writeFileSync(join(dossierData, 'index.json'), texte);
  console.log(`data/index.json : ${JSON.parse(texte).recettes.length} recettes, ${(texte.length / 1024).toFixed(0)} Ko`);
}
