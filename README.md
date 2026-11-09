# NutriCoach

PWA de coach alimentaire pour deux (Eymric et Marie). Hébergée sur GitHub Pages, sans compilation : Preact + htm en copie locale (`vendor/`).

Cahier des charges : `cahier-des-charges.md`. Règles de travail : `CLAUDE.md`.

## État
Phase 1 (noyau) : liste, recherche, filtres, fiche recette, nombre de personnes, favoris, hors-ligne. Les phases suivantes sont décrites dans le cahier des charges.

## Arborescence
- `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `css/app.css`, `vendor/`
- `js/main.js` (routage), `js/core` (catalogue, favoris, stockage), `js/lib` (recherche, filtres, adaptation : fonctions pures testées), `js/data` (libellés, pictogrammes), `js/ui`, `js/views`
- `data/recettes.json` (lecture seule), `data/index.json` (index léger généré)
- `scripts/`, `tests/`

## Commandes (Node 20+)
```bash
node scripts/build-index.mjs          # régénère data/index.json (après tout changement du catalogue)
node --test tests/*.test.mjs          # tests unitaires
node scripts/verifier.mjs             # contrôle des 1 610 recettes, de l'index, du service worker (lancé avant chaque commit)
node scripts/verifier-affichage.mjs   # affiche les 1 610 fiches dans Chromium (Playwright requis)
node scripts/test-navigateur.mjs      # parcours complet au format téléphone (Playwright requis)
git config core.hooksPath scripts/hooks   # lance verifier.mjs avant chaque commit (à faire une fois par clone)
```

## Publier une mise à jour
Changer `VERSION` dans `sw.js` **et** les `?v=N` dans `index.html` (le script de vérification contrôle qu'ils concordent). Les téléphones récupèrent la nouvelle version à la prochaine ouverture avec du réseau.

## Ajouter des recettes
Ajouter un fichier `data/recettes-2.json` (même format), puis `node scripts/build-index.mjs`. L'appli lit la liste des fichiers dans l'index : aucun changement de code.
