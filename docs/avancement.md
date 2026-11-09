# Avancement par rapport au cahier des charges

Légende : ✅ fait et testé · 🟡 partiel · ⬜ à faire. Mis à jour à chaque étape.

## Écarts et décisions à prendre
- **Recettes : 1 610 aujourd'hui, 10 000 demandés.** Le pipeline de génération et de validation (§5.4) n'est pas écrit. Les recettes doivent être générées par IA par lots : il faut une clé Gemini et du temps de validation.
- **Fille de 5 ans** : le cahier demande un profil enfant (portions, recettes enfant). Aucun profil enfant pour l'instant.
- **Icônes** : le cahier cite Font Awesome ; l'appli utilise des émojis (aucune bibliothèque à charger). À trancher.
- **Lien d'invitation** : la configuration Firebase est intégrée à l'appli ; « inviter Marie » = lui envoyer le lien du site + son compte (créé dans Firebase). Pas de lien magique.
- **Règles d'alerte** (grossesse, enfant…) : rédigées d'après les recommandations publiques, **à faire relire par un professionnel de santé**.

## 5.1 Comptes et couple
- ✅ Connexion email / mot de passe, choix « Je suis Eymric / Marie », code PIN (PBKDF2), reverrouillage après 1 min.
- ✅ Synchro < 2 s : favoris, profils, menus, courses, stock, scans. Cache hors ligne Firestore.
- 🟡 Vue « Nous deux » (situation et favoris ; pas de bilan combiné ni « qui a fait quoi »).
- ⬜ Face ID / Touch ID, notifications à l'autre, option « privé », journal / poids / notes synchronisés.

## 5.2 Profils, objectifs, régimes, alertes
- ✅ Profil adulte (date de naissance), grossesse (trimestre), allaitement, sportif, convalescence, santé ; besoins Mifflin-St Jeor avec plafonds de sécurité.
- 🟡 Objectifs : équilibre, maintien, perte, prise, sèche. ⬜ Objectif à date, énergie, digestion, sel/sucre/alcool, budget.
- 🟡 Régimes et exclusions : ceux du catalogue (végétarien, vegan, sans gluten, sans lactose, sans porc, halal, pescétarien…) + 14 allergènes + aliments évités. ⬜ Régimes populaires et médicaux avancés.
- 🟡 Profils adolescent, enfant, bébé, senior (seule l'alerte « senior » existe). Grossesse à la date prévue ⬜.
- ✅ Alertes avec raison et source : recettes, menus (exclusion), liste de courses, scan. ⬜ Journal. 🟡 Fiches explicatives (page « Sources et règles » ; pas de fiche par aliment).

## 5.3 Sport et compétition — ⬜
## 5.4 Bibliothèque de recettes
- 🟡 1 610 recettes validées, recherche (titre, ingrédients, tags), filtres cumulables, favoris, hors ligne. ⬜ Photos, 10 000 recettes, pipeline, import de recettes, « frigo magique ».
## 5.5 Mode Thermomix et cuisine pas à pas
- ✅ Cuisine pas à pas : plein écran, écran allumé, minuteur, balayage, pastilles de réglages. ⬜ Version Thermomix TM6/TM5/TM31, lecture vocale, pesée guidée, capacité du bol, autres méthodes de cuisson.
## 5.6 Adaptation
- ✅ 1 à 12 personnes, arrondis lisibles, conseils moule/temps. ⬜ Substitutions, variantes par personne.
## 5.7 Planning et décision du soir
- ✅ Menu déjeuner + dîner pour le couple (contraintes des deux profils, saison, temps, quotas poisson/végétarien), modifiable, synchronisé. ✅ « Qu'est-ce qu'on mange ce soir ? » (3 idées, mode rapide 20 min).
- ⬜ Petit-déjeuner et collations, séances de sport, budget, glisser-déposer, frigo magique, anti-gaspi.
## 5.8 Batch cooking — ⬜
## 5.9 Courses et stock
- ✅ Génération depuis le menu (quantités pour 2), fusion et conversion d'unités, déduction du stock, rayons (ordre personnalisable), ajout libre avec fusion, cochage en direct avec pastilles E/M, plusieurs listes + archivage, partage / impression, stock mis à jour à la fin des courses, alertes de profil sur les articles, hors ligne, aucun article perdu en cas d'ajouts simultanés.
- ⬜ Articles récurrents, budget estimé, notifications, liste de batch cooking, péremption et « à manger en premier ».
## 5.10 Scan de produits
- ✅ Caméra (BarcodeDetector, sinon ZXing local pour Safari), saisie du numéro avec contrôle de la clé, Open Food Facts, note sur 100 avec le « pourquoi », additifs classés (table versionnée), alertes selon le profil, alternatives, actions (courses, stock, favori, à éviter), cocher dans la liste, historique partagé, hors ligne pour les produits déjà vus, saisie d'un produit inconnu.
- ⬜ Envoi vers Open Food Facts, action « journal », photo du tableau nutritionnel par IA, score santé des recettes et des menus.
## 5.11 Suivi et coach
- 🟡 Coach IA (Gemini, clé personnelle, profil partagé seulement si accepté). ⬜ Journal, hydratation, poids/mensurations, bilans, coach relié au journal et aux séances.
## 5.12 Réglages
- ✅ Thème (4), mode sombre auto, code PIN, clé du coach, ordre des rayons, sauvegarde des données. ⬜ Appareils de cuisine, unités.
## §6–§9
- 🟡 Firestore : profiles, planning, shoppingLists, pantry, scans, favorites. ⬜ journal, weights, workouts, batchSessions, notes.
- ✅ Tests unitaires : adaptation, courses, conversions, besoins, règles de profil, note produit, planning, synchro. ⬜ Guide pas à pas dans docs/, 15 recettes d'exemple (Thermomix, apéro, dessert, batch, sport).

## Ordre proposé pour la suite
1. Suivi : journal + poids + hydratation (le scan et les courses y alimentent le journal).
2. Mode sportif et préparation de compétition.
3. Batch cooking.
4. Régimes avancés et profils enfant / bébé.
5. Thermomix et autres méthodes de cuisson.
6. Pipeline de recettes (10 000) et photos.
