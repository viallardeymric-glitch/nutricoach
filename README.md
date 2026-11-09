# NutriCoach

PWA de coach alimentaire pour deux (Eymric et Marie). Hébergée sur GitHub Pages, sans compilation : Preact + htm en copie locale (`vendor/`).

Cahier des charges : `docs/cahier-des-charges.md` (suivi : `docs/avancement.md`). Règles de travail : `CLAUDE.md`.

## État
- Phase 1 (noyau) : liste, recherche, filtres, fiche recette, nombre de personnes, favoris, hors-ligne.
- Phase 2 (en cours) : profils (date de naissance) et besoins, alertes de profil, connexion Firebase (un compte chacun), favoris, profils et menus synchronisés, vue « Nous deux », code PIN.
- Courses et stock partagés, scan de produits (note sur 100, alertes de profil, alternatives), accueil, menus de la semaine, coach IA, mode cuisine : voir `docs/avancement.md` pour l'état exact par rapport au cahier.
- Les phases suivantes sont décrites dans le cahier des charges.

## Compte et synchro
`js/core/firebase-config.js` contient la configuration web du projet Firebase (publique par conception). Les données sont sous `households/foyer/…` et les règles Firestore (à coller dans la console, elles contiennent les deux adresses et ne sont pas dans le dépôt) n'autorisent que les deux comptes. Mettre `FIREBASE_CONFIG` à `null` pour revenir au mode local.
Les données de santé (profils) ne vont que dans Firestore, jamais dans le dépôt.

## Arborescence
- `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `css/app.css`, `vendor/`
- `js/main.js` (routage), `js/core` (catalogue, favoris, stockage), `js/lib` (recherche, filtres, adaptation : fonctions pures testées), `js/data` (libellés, pictogrammes), `js/ui`, `js/views`
- `data/recettes.json` (lecture seule), `data/index.json` (index léger généré)
- `scripts/`, `tests/`

## Commandes (Node 20+)
```bash
node scripts/build-index.mjs          # régénère data/index.json (après tout changement du catalogue)
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
