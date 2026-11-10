# Sources et règles d'alerte

Les règles d'alerte (grossesse, allaitement, jeunes enfants, régimes médicaux, objectifs) sont dans `js/data/deconseilles.js`, la table d'additifs dans `js/data/additifs.js`, les régimes dans `js/data/regimes.js`, les substitutions dans `js/data/substitutions.js`. Chacune cite sa source et se lit aussi dans l'appli : Plus › Sources et règles.

Sources : Santé publique France (listériose, alcool et grossesse), ANSES (mercure dans les poissons, caféine, additifs, alimentation du jeune enfant), Haute Autorité de santé, PNNS / Manger Bouger (repères nutritionnels), EFSA et CIRC pour les additifs, IOC / ACSM pour la nutrition du sport.

**À faire relire par un professionnel de santé** (médecin, sage-femme, diététicien) avant de s'y fier, en particulier : grossesse et allaitement, bébés et jeunes enfants, régimes médicaux (rénal, bariatrique, FODMAP…), apports du sport. Les valeurs sont des repères généraux, versionnées (`VERSION_REGLES`, `VERSION_ADDITIFS`).

Les estimations nutritionnelles des recettes et des substitutions sont des ordres de grandeur ; le recalcul exact par CIQUAL n'est pas implémenté.
