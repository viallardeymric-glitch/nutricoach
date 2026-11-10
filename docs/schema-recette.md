# Schéma d'une recette

Fichiers : `data/recettes.json` (et tout `data/recettes-*.json`), lus **sans modification**. `node scripts/build-index.mjs` génère `data/index.json` (index léger chargé au démarrage). L'appli lit la liste des fichiers dans l'index : ajouter un fichier de recettes ne demande aucun changement de code.

```json
{
  "id": "REC-000001",
  "titre": "Poulet rôti au thym et aux gousses d'ail",
  "categorie": "Plats",
  "sous_categorie": "poulet rôti et grillé",
  "description": "…",
  "portions_base": 4,
  "temps": { "preparation_min": 15, "cuisson_min": 75, "repos_min": 10, "total_min": 100 },
  "difficulte": "facile | moyen | difficile",
  "cout": "economique | moyen | eleve",
  "appareil_principal": "thermomix | cookeo | classique | four | airfryer | multicuiseur",
  "appareils_possibles": ["classique"],
  "ingredients": [{ "section": "Pour le plat", "quantite": 30, "unite": "g", "aliment": "beurre doux", "precision": "fondu" }],
  "ustensiles": ["plat à rôtir"],
  "etapes": [{ "numero": 1, "texte": "Préchauffez le four à 180 °C.", "reglages": { "duree": "15 min", "temperature": "180°C", "mode": "chaleur tournante" } }],
  "astuces": ["…"],
  "conservation": { "frigo_jours": 3, "congelation_mois": 3, "reechauffage": "…" },
  "nutrition_par_portion": { "calories_kcal": 550, "proteines_g": 45, "glucides_g": 1, "lipides_g": 39, "fibres_g": 0, "sucres_g": 0, "sel_g": 1.2 },
  "regimes_compatibles": ["omnivore", "sans_gluten"],
  "allergenes": ["lait"],
  "deconseille_a": [{ "profil": "femme_enceinte", "raison": "…" }],
  "saisons": ["toute_annee"], "occasions": ["repas_famille"], "tags": ["poulet"], "origine": "originale"
}
```

## Valeurs autorisées
- **Unités** : g, kg, ml, cl, l, c. à café, c. à soupe, pincée, gousse, tranche, branche, feuille, pièce, sachet, noix.
- **Régimes** : omnivore, sans_gluten, sans_lactose, sans_porc, halal, pescetarien, vegetarien, vegan, hypocalorique, riche_en_proteines, sportif, diabetique, sans_sel_ajoute, enceinte. D'autres régimes (méditerranéen, cétogène, FODMAP…) sont calculés par l'appli d'après les macros et les ingrédients (`js/data/regimes.js`).
- **Allergènes** : gluten, lait, oeuf, poisson, crustaces, mollusques, arachides, fruits_a_coque, soja, celeri, moutarde, sesame, sulfites, lupin.
- **Profils à risque** (`deconseille_a`) : femme_enceinte, allaitante, enfant_moins_de_3_ans, enfant, senior, diabetique, hypertendu, immunodeprime.
- **Réglages d'étape** : feu, duree, temperature, mode, vitesse, sens, accessoire, pression, position_grille. Un objet vide signifie « aucun réglage ». Une étape Thermomix a au moins une `vitesse`.

## Validation automatique
`node scripts/verifier.mjs` contrôle les 1 610 recettes (champs, valeurs autorisées, quantités strictement positives, allergènes et régimes connus, nutrition complète, étapes non vides), la fraîcheur de l'index, et fait passer toutes les fonctions de calcul (adaptation, courses, alertes) sur chaque recette.

## Index léger (`data/index.json`)
`id, titre, categorie, sous_categorie, regimes, allergenes, temps, cuisson, kcal, nut{p,g,l,f,s,sel}, difficulte, cout, saisons, appareils, occasions, tags, risques, ingredients (noms), f` (numéro du fichier). Un exemple de chaque cas est dans `docs/recettes-exemples.md`.

## Ce qui n'existe pas encore
Le pipeline de génération IA par lots (10 000 recettes) n'est pas écrit : le catalogue compte 1 610 recettes originales. Les photos ne sont pas fournies (un pictogramme par sous-catégorie).
