# NutriCoach

PWA de coach alimentaire partagée entre deux utilisateurs (Eymric et Marie). Sur GitHub Pages.

## Stack
- Preact + htm en copies locales dans vendor/ (jamais de CDN), aucun build, aucun npm pour l'appli.
- Cahier des charges de référence : docs/cahier-des-charges.md. Suivi : docs/avancement.md. Règles : tests unitaires (node --test tests/*.test.mjs) et node scripts/verifier.mjs avant chaque commit.
- Firebase Spark (gratuit) pour la synchro entre appareils.
- Installable sur téléphone (manifest + service worker).
- Français uniquement, ton simple.

## Données
- data/recettes.json : 1610 recettes (REC-000001 à REC-001610), à lire sans le modifier.
- Champs : id, titre, categorie, sous_categorie, description, portions_base, temps{preparation_min, cuisson_min, repos_min, total_min}, difficulte, cout, appareil_principal, appareils_possibles, ingredients[{section, quantite, unite, aliment, precision}], ustensiles, etapes[{numero, texte, reglages}], astuces, conservation, nutrition_par_portion, regimes_compatibles, allergenes, deconseille_a[{profil, raison}], saisons, occasions, tags, origine.
- Régimes : omnivore, sans_gluten, sans_lactose, sans_porc, halal, pescetarien, vegetarien, vegan, hypocalorique, riche_en_proteines, sportif, diabetique, sans_sel_ajoute, enceinte.
- Allergènes : gluten, lait, oeuf, poisson, crustaces, mollusques, arachides, fruits_a_coque, soja, celeri, moutarde, sesame, sulfites, lupin.
- Profils à risque : femme_enceinte, allaitante, enfant_moins_de_3_ans, enfant, senior, diabetique, hypertendu, immunodeprime.
- Les valeurs nutritionnelles sont des estimations.

## Règles
- Les avertissements (deconseille_a) doivent toujours être visibles sur la fiche.
- Un filtre d'allergène doit exclure toute recette qui contient cet allergène.
- Les quantités se recalculent selon le nombre de portions.
- Charger d'abord un index léger (id, titre, catégorie, régimes, allergènes, temps), puis la fiche complète à l'ouverture.

## Images
- Un pictogramme par sous-catégorie par défaut.
- Photo Unsplash ou Pexels chargée seulement à l'ouverture d'une recette, mise en cache, avec crédit du photographe affiché.
- Aucune clé d'API payante dans le code.

## Méthode
- Une fonction à la fois, testable sur téléphone, un commit par fonction.
