# Audit de l'application (novembre 2026)

Méthode : `scripts/audit.mjs` parcourt 23 écrans en 390 × 844 (clair) et 360 × 740 (sombre) et relève débordements, erreurs console, cibles tactiles, accessibilité (axe-core, WCAG 2 A/AA) et lenteurs ; relecture des captures ; revue du code et des données sensibles.

## Corrigé
| Constat | Gravité | Correction |
|---|---|---|
| Sauvegarde : le fichier contenait les clés Pexels/Unsplash et le mot de passe Open Food Facts | Sécurité (haute) | Liste d'exclusion unique (`js/lib/sauvegarde.js`) : PIN, Face ID, clés d'API, compte OFF, conversation ; testée |
| Sauvegarde sans restauration | Fonctionnel | Bouton « Restaurer une sauvegarde » (valide le fichier, ignore les secrets, demande confirmation) |
| Page « Plus » éparpillée | Ergonomie | Profil en premier, puis regroupement : Au quotidien · Santé et sport · À deux · Réglages · Thème et appareils · Données |
| Contrastes insuffisants (27 pages) | Accessibilité | Gris et accent assombris, texte foncé sur accent clair en mode sombre, étiquettes d'état plus contrastées |
| Pas de zone `main` | Accessibilité | Contenu dans `<main>` |
| Titres sautant un niveau (profil, coach) | Accessibilité | h3 → h2 |
| Cibles tactiles < 40 px (liens d'en-tête, de section, sources) | Ergonomie | Hauteur minimale 40 px |
| Barre du bas à 8 entrées | Ergonomie | 5 entrées (voir guide) |
| Batch cooking : portions ≠ famille, jours non réglables | Fonctionnel | Jours 1 à 14, portions = personnes de la famille |
| Schéma Firestore : « notes réservée » | Documentation | Mis à jour (photos partagées) |

## Constaté, non modifié
- **Zoom bloqué** (demande d'Eymric) : axe le signale (`meta-viewport`). Compromis d'accessibilité assumé ; les textes restent à 16 px ou plus dans les champs.
- Liens dans des phrases (« Profil → Ma situation », sources) : moins de 40 px de haut, acceptable pour des liens en ligne.

## Non vérifiable depuis l'environnement de développement
Firebase réel, Open Food Facts réel (lecture et envoi), Gemini et Groq réels, caméra, Face ID / Touch ID, iPhone / Android réels, vitesse réelle sur 4G.

## À faire relire par un professionnel de santé
Règles d'alerte, régimes médicaux, guide grossesse, score santé, consignes médicales du coach, apports du sport.

## Chiffres
Aucun débordement horizontal, aucune erreur console sur les 23 écrans, aucune page de plus de 2,5 s au chargement dans l'environnement de test. Index des recettes : 128 Ko compressé.
