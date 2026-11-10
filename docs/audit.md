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

## Vérification du batch cooking (novembre 2026)
600 sessions simulées au hasard sur le catalogue (1 à 6 recettes, 4 configurations d'appareils) : étapes jamais perdues, ordre respecté, jamais deux tâches manuelles en même temps, capacité des appareils respectée, aucune valeur invalide, dates et étiquettes cohérentes. Une version allégée (300 sessions) fait partie des tests automatiques.
Défauts trouvés et corrigés : (1) le bouton « congeler » apparaissait pour des plats non congelables ; (2) le Thermomix ne tenait pas compte de la capacité du bol (plusieurs fournées) ; (3) aucun avertissement quand un appareil nécessaire (four, Thermomix, Cookeo) n'était pas coché ; (4) aucun message si les recettes choisies ne pouvaient plus être chargées.

## Audit complet, 2e passe (novembre 2026)
**Méthode** : analyse statique du code (ESLint : aucune variable indéfinie, aucune clé en double) ; 14 tests « propriétés » sur le catalogue complet (plus de 9 000 cas tirés au hasard : sécurité des menus, besoins, quantités, courses, substitutions, Thermomix, score santé, dates, Open Food Facts, recettes importées) ; test « singe » (clics et saisies au hasard sur 31 écrans, 10 graines) ; parcours depuis un profil vide ; contrôle des textes anormaux (NaN, undefined) et des débordements en 360 px ; accessibilité (axe-core) ; mesures de vitesse avec processeur ralenti ×4 ; répétition des suites de tests (3 fois chacune) pour détecter les tests instables.

**Corrigé**
| Constat | Gravité | Correction |
|---|---|---|
| Aucune politique de sécurité de contenu | Sécurité | CSP dans `index.html` : scripts de l'appli uniquement, pas de script injecté ; testée (script injecté bloqué, titre de recette piégé = simple texte) |
| Besoins : un petit gabarit pouvait descendre à 1 100–1 400 kcal, y compris enceinte (2e/3e trimestre) ou allaitante | Santé | Plancher de 1 800 kcal en 2e/3e trimestre et allaitement, de 1 200 kcal dans tous les cas, avec message |
| Open Food Facts : une réponse avec un champ de type inattendu faisait planter la fiche produit | Robustesse | Lecture tolérante ; seules les images https sont gardées |
| Substitutions : la nutrition estimée pouvait être négative (protéines −0,5 g) | Exactitude | Jamais sous zéro |
| Détection des allergènes (recettes perso, courses) : faux amis (« lait de coco », « noix de muscade », « pâte de curry », « pâte » prise pour « pâté ») et mots manquants (« sauce soja » = gluten, « daurade », « pignons », « pesto »…) | Sécurité / exactitude | Lexique élargi et faux amis écartés, « sans gluten / sans lactose » respectés : rappel de 94 % sur les 1 610 recettes avec seulement 11 faux positifs (avant : 73 recettes marquées « lait » à tort, 36 « fruits à coque », 24 « gluten ») |
| Formulaire « Nouvelle recette » : débordement horizontal | Affichage | Champs de grille réductibles |
| Test du glisser-déposer instable (défilement animé) | Qualité des tests | Défilement instantané, 3 passages consécutifs sans échec |
| 27 imports et variables inutilisés | Maintenance | Supprimés |

**Mesures** (processeur ×4 plus lent, 4G lente, première visite sans cache) : premier écran 4,2 s, puis liste des recettes 63 ms, recherche 45 ms, génération de la semaine 0,6 s, autre repas 0,16 s ; 1,6 Mo téléchargés la première fois (l'index de 1 Mo est compressé à 128 Ko sur GitHub Pages).

**Limites connues**
- La détection d'allergènes d'une recette ajoutée à la main repose sur les mots des ingrédients : environ 6 % des allergènes du catalogue ne seraient pas trouvés (additifs, lécithine de soja, sulfites des préparations…). Il faut les cocher soi-même (c'est écrit dans le formulaire).
- Le zoom reste bloqué (demande d'Eymric) : signalé par axe-core, compromis assumé.
- Toujours non testables ici : Firebase réel, caméra, Face ID, Gemini / Groq / Open Food Facts réels, iPhone réel.
