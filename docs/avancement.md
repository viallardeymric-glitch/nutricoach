# Avancement par rapport au cahier des charges

Légende : ✅ fait et testé · 🟡 partiel · ⬜ à faire. Dernière mise à jour : novembre 2026.
La suite de contrôles : 135 tests unitaires, vérification des 1 610 recettes et de la syntaxe de tous les modules, affichage des 1 610 fiches, deux parcours complets dans Chromium au format téléphone (mode local, puis synchro à deux téléphones simulés). La connexion réelle à Firebase, la vraie API Open Food Facts, la vraie API Gemini et un vrai iPhone/Android n'ont **pas** pu être testés depuis l'environnement de développement.

## Décisions confirmées
- **Recettes : 1 610** (confirmé : le catalogue n'est pas porté à 10 000 pour le moment). Le pipeline de génération IA par lots (§5.4) n'est donc pas écrit.

## Écarts et points à relire
- **Icônes** : émojis, pas de Font Awesome.
- **Notifications** : pas de push quand l'appli est fermée (serveur d'envoi indisponible sur l'offre gratuite) ; fil « Depuis votre dernière visite » sur l'accueil.
- **Règles d'alerte, régimes médicaux, apports du sport, substitutions** : repères généraux **à faire relire par un professionnel de santé** (`docs/sources.md`).
- **Tout est partagé** entre Eymric et Marie, y compris les pesées (le mode « privé » a été retiré à la demande d’Eymric).
- **Face ID / Touch ID** : porte d'entrée de l'appli (WebAuthn local), pas un chiffrement des données.
- **Séances** : plus de saisie ni d’import de séances (retirés à la demande d’Eymric) ; le plan sportif suit la semaine type de la phase.

## 5.1 Comptes et couple — ✅
Connexion email, choix E/M, PIN (PBKDF2) + Face ID / Touch ID, synchro < 2 s de tout (favoris, profils, enfants, menus, courses, stock, scans, journal, poids, séances, batch), cache hors ligne, vue « Nous deux » (situation, journal du jour, poids, favoris), fil d'activité, option « privé ». 🟡 Pas de lien d'invitation « magique » (on envoie le lien du site + le compte).
## 5.2 Profils, objectifs, régimes, alertes — ✅
Adulte (date de naissance), enfants du foyer (portions, alertes bébé / petit / enfant), grossesse, allaitement, sportif, convalescence, santé ; besoins Mifflin-St Jeor avec plafonds ; objectifs : équilibre, maintien, perte, **à date (rythme plafonné)**, prise, sèche, énergie, digestion, sport + sel / sucre / alcool / petit budget ; **34 règles de régimes** (modes, populaires, exclusions, 10 médicaux avec rappel, sport) cumulables ; alertes expliquées et sourcées sur recettes, menus, courses, scan. 🟡 Ado et senior : alertes limitées ; grossesse par trimestre (pas par date prévue) ; pas de « fiche explicative » par aliment (page Sources et règles).
## 5.3 Sport — ✅
Épreuves (5 km à ultra, triathlon, vélo, musculation), phases, charge en glucides 2 ou 3 jours, veille pauvre en fibres, ravitaillement, repas pré-course, récupération, rappel « rien de nouveau le jour J », import GPX / CSV / JSON, menus et cibles du jour adaptés, recettes pour l'effort. 🟡 Chaque personne a son propre objectif ; pas d'import Strava ni Apple Santé.
## 5.4 Recettes — 🟡
1 610 recettes, recherche (titre, ingrédients, tags), filtres cumulables, favoris, hors ligne, schéma et exemples (`docs/schema-recette.md`), **photos Pexels ou Unsplash** (clé gratuite saisie dans Profil › Photos, cache, crédit du photographe). ⬜ 10 000 recettes, pipeline de génération, import de ses propres recettes (saisie, URL, photo).
## 5.5 Thermomix et cuisine pas à pas — ✅
Version Thermomix TM6 / TM5 / TM31 (pastilles, 100 °C max sur TM31), capacité du bol 2,2 L avec cuisson en deux fois, pesée guidée, mode pas à pas (écran allumé, minuteur, balayage, lecture vocale), autres méthodes (four, plaques, cocotte, Cookeo, airfryer, multicuiseur, sans cuisson) par réécriture IA (proposition à vérifier, gardée hors ligne).
## 5.6 Adaptation — ✅
1 à 12 personnes avec arrondis, conseils moule et temps, substitutions selon allergies, régimes et situation avec nutrition recalculée (estimation), variantes pour chaque personne du foyer. 🟡 Recalcul par CIQUAL non implémenté.
## 5.7 Planning — ✅
Petit-déjeuner, déjeuner, dîner, collations ; menus du couple et des enfants (contraintes de tous), séances et charge de sport, budget, stock et anti-gaspi ; échange / déplacement de repas (poignée ⠿ glissée au doigt ou à la souris, ou touche ⇅) ; « ce soir » (3 idées, rapide ≤ 20 min) ; frigo magique et anti-gaspi. ✅ Glisser-déposer au doigt ou à la souris avec la poignée ⠿ (ou ⇅ puis « Ici »).
## 5.8 Batch cooking — ✅
Session depuis le menu, quantités fusionnées, planning chronométré avec tâches en parallèle (plaques, four, Thermomix), boîtes, étiquettes imprimables, conservation, stock de plats « à manger en premier », liste de courses dédiée.
## 5.9 Courses et stock — ✅
Génération depuis le menu et le batch, fusion et conversions, déduction du stock, rayons (ordre personnalisable), ajout libre, **récurrents**, **budget estimé**, cochage en direct avec pastilles E/M, listes multiples + archivage, partage / impression, stock mis à jour, péremption, alertes de profil, hors ligne, aucun article perdu en cas d'ajouts simultanés.
## 5.10 Scan de produits — ✅
Caméra (BarcodeDetector, ZXing local pour Safari), saisie du numéro, Open Food Facts, note sur 100 avec le « pourquoi », additifs classés, alertes selon le profil, alternatives, actions (courses, stock, **journal**, favori, à éviter), cocher en rayon, historique partagé hors ligne, produit inconnu saisi à la main. ✅ Photo du tableau nutritionnel lue par l’IA (Gemini, clé perso, à vérifier avant d’enregistrer). ✅ Envoi d’un produit saisi à la main vers Open Food Facts (compte gratuit de la personne, identifiants gardés sur le téléphone ; non testé contre le vrai serveur). ✅ Score santé des recettes (fiche) et des menus (semaine, par jour) : 5 rubriques de 20 points d’après la nutrition par portion, estimation à relire par un professionnel.
## 5.11 Suivi et coach — ✅
Journal (menu, recette, produit scanné, libre), hydratation, poids et mensurations en courbes (tendance), bilan hebdomadaire bienveillant, séries, coach IA (Gemini) relié au profil, au menu, au journal du jour. 🟡 Le coach ne connaît pas encore les séances.
## 5.12 Réglages — ✅
Thème (4) et mode sombre, PIN, Face ID, clé du coach, appareils de cuisine (Thermomix modèle, Cookeo, airfryer…), rayons, sauvegarde. 🟡 Pas de réglage d'unités.
## §6–§9
✅ Firestore : profiles, planning, shoppingLists, pantry, scans, favorites, journal, weights, workouts, batchSessions (`docs/schema-firestore.md`, règles dans `docs/firestore.rules.exemple`). ✅ Tests unitaires de l'adaptation, des courses, des conversions, des besoins, des règles de profil, de la note produit, du planning, du sport, du batch, des substitutions. ✅ Guide pas à pas (`docs/guide.md`), 15 recettes d'exemple. ⬜ Pipeline de 10 000 recettes.

## Photos partout, tout le temps
- Quotas gratuits suivis séparément par fournisseur (Pexels ~200/h, Unsplash 50/h) ; bascule automatique sur l'autre si l'un est épuisé.
- Une photo trouvée sur un téléphone est partagée avec l'autre (collection `notes`, `photo-REC-xxxxxx`), même sans clé.
- Préchargement lent des favoris et du menu de la semaine.
- Les 1610 photos se remplissent progressivement (plusieurs heures à quelques jours selon les quotas).
