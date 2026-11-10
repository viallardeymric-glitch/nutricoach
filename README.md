# NutriCoach

PWA de coach alimentaire pour deux (Eymric et Marie). Hébergée sur GitHub Pages, sans compilation : Preact + htm en copie locale (`vendor/`).

Cahier des charges : `docs/cahier-des-charges.md` (suivi : `docs/avancement.md`). Règles de travail : `CLAUDE.md`.

## État
Toutes les fonctions du cahier des charges sont en place, sauf les 10 000 recettes (le catalogue en compte 1 610), les photos, l'import de ses propres recettes et les notifications push. Détail section par section, avec les écarts et les points à faire relire : `docs/avancement.md`. Guide pas à pas : `docs/guide.md`.

## Compte et synchro
`js/core/firebase-config.js` contient la configuration web du projet Firebase (publique par conception). Les données sont sous `households/foyer/…` ; les règles Firestore (`docs/firestore.rules.exemple`, à remplir avec vos deux adresses et à coller dans la console) n'autorisent que les deux comptes. Mettre `FIREBASE_CONFIG` à `null` pour revenir au mode local.
Les données de santé ne vont que dans Firestore, jamais dans le dépôt.

## Arborescence
- `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `css/app.css`, `vendor/`
- `js/main.js` (routage), `js/core` (catalogue, favoris, stockage), `js/lib` (recherche, filtres, adaptation : fonctions pures testées), `js/data` (libellés, pictogrammes), `js/ui`, `js/views`
- `data/recettes.json` (lecture seule), `data/index.json` (index léger généré)
- `scripts/`, `tests/`, `docs/`

## Commandes (Node 20+)
```bash
node scripts/build-index.mjs          # régénère data/index.json (après tout changement du catalogue)
node scripts/exemples.mjs             # régénère docs/recettes-exemples.md
node --test tests/*.test.mjs          # tests unitaires (lancés aussi avant chaque commit)
node scripts/verifier.mjs             # contrôle des 1 610 recettes, de l'index, du service worker (lancé avant chaque commit)
node scripts/verifier-affichage.mjs   # affiche les 1 610 fiches dans Chromium (Playwright requis)
node scripts/test-navigateur.mjs      # parcours complet au format téléphone, mode local (Playwright requis)
node scripts/test-synchro.mjs         # connexion + synchro à deux téléphones avec un faux Firebase (Playwright requis)
git config core.hooksPath scripts/hooks   # lance verifier.mjs avant chaque commit (à faire une fois par clone)
```

## Publier une mise à jour
Changer `VERSION` dans `sw.js` **et** les `?v=N` dans `index.html` (le script de vérification contrôle qu'ils concordent). Les téléphones récupèrent la nouvelle version à la prochaine ouverture avec du réseau.

## Ajouter des recettes
Ajouter un fichier `data/recettes-2.json` (même format), puis `node scripts/build-index.mjs`. L'appli lit la liste des fichiers dans l'index : aucun changement de code.
