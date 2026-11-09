# Cahier des charges — « NutriCoach »
Coach alimentaire, recettes, courses et scan de produits, pour un couple.

> Version corrigée (novembre 2026). Elle remplace la version initiale : le catalogue de recettes existe déjà (1 610 recettes validées), les fonctions sont découpées en phases, et ce qui n'est pas réaliste avec les données actuelles est signalé.

## 1. Rôle
Tu es développeur senior web, designer UI/UX mobile, expert en nutrition (dont nutrition sportive) et chef cuisinier. Tu écris le code source complet d'une web-app installable (PWA), modulaire, testée, commentée en français, publiée sur GitHub et hébergée par GitHub Pages. On l'ouvre depuis un lien (Safari ou Chrome), puis on l'ajoute à l'écran d'accueil : aucune application à installer, aucune compilation.

## 2. Contexte d'usage
- Utilisateurs : un couple, Eymric (marqueur bleu « E ») et Marie (marqueur rose « M »), et leur fille de 5 ans (portions et recettes enfant). Appareils : iPhone, iPad, Android/Samsung.
- But : mieux manger, suivre un régime ou un objectif (perte de poids, sport, compétition), planifier les repas, cuisiner, scanner les produits, faire les courses.
- Transparence dans le couple : par défaut tout est partagé et synchronisé (poids, journal, objectifs, planning, courses, stock, scans). Une option « privé » par donnée existe, désactivée par défaut.
- Modèle de style : mon « Carnet de Voyage », mon appli budget et mon appli de running RDD (GitHub Pages).
- Je n'écris aucun code : la configuration Firebase est intégrée et un lien d'invitation configure le téléphone de Marie.

## 3. Contraintes techniques
| Sujet | Choix imposé |
|---|---|
| Format | PWA : HTML, CSS, JavaScript en modules ES, Preact + htm, sans étape de compilation. Bibliothèques en copies locales dans `vendor/` (Preact, htm, Firebase, icônes, bibliothèque de scan de codes-barres) |
| Hébergement | GitHub Pages, fichier `.nojekyll`. Le dépôt ne contient que du code et le catalogue de recettes : aucune donnée personnelle ni de santé, aucune clé |
| Installation | Safari › Partager › « Sur l'écran d'accueil » ; Chrome › Installer ; icône dédiée, plein écran |
| Backend | Firebase Spark (gratuit) : Authentication email/mot de passe (un compte chacun, inscription publique désactivée) + Firestore avec cache hors-ligne. Sans Firebase, l'app fonctionne en mode local |
| Règles Firestore | Prêtes à coller, limitées à nos deux adresses email, collections listées, taille des documents contrôlée |
| Recettes | Fichier `data/recettes.json` (1 610 recettes, REC-000001 à REC-001610), en lecture seule, hors Firestore. Index léger `data/index.json` généré par `scripts/build-index.mjs`, chargé au démarrage ; la fiche complète est chargée à l'ouverture. Mise en cache par le service worker |
| Sécurité | Code PIN (PBKDF2) et reverrouillage après 1 minute en arrière-plan. Face ID / Touch ID (WebAuthn) en phase ultérieure. Clés API saisies dans les réglages, jamais en dur |
| Hors-ligne | Service worker : app, recettes consultées ou favorites, planning, courses, stock et produits déjà scannés utilisables sans réseau, resynchronisés au retour |
| Données gratuites sans clé | Open Food Facts (produits, codes-barres, Nutri-Score, NOVA, additifs), CIQUAL (valeurs nutritionnelles) |
| IA | Coach et génération via Gemini par défaut (clé facultative dans les réglages), fournisseur modifiable |
| Photos | Pictogramme par sous-catégorie par défaut. Photo Unsplash ou Pexels chargée à l'ouverture d'une recette, mise en cache, avec crédit du photographe affiché. Clé gratuite uniquement, jamais de clé payante dans le code |
| Langue | Français |

## 4. Le catalogue de recettes (données existantes)
- 1 610 recettes originales, déjà validées (schéma, unités, allergènes, régimes, temps). Les ids sont contigus.
- Champs : `id`, `titre`, `categorie`, `sous_categorie`, `description`, `portions_base`, `temps{preparation_min, cuisson_min, repos_min, total_min}`, `difficulte` (facile, moyen, difficile), `cout` (economique, moyen, eleve), `appareil_principal`, `appareils_possibles`, `ingredients[{section, quantite, unite, aliment, precision}]`, `ustensiles`, `etapes[{numero, texte, reglages}]`, `astuces`, `conservation{frigo_jours, congelation_mois, reechauffage}`, `nutrition_par_portion{calories_kcal, proteines_g, glucides_g, lipides_g, fibres_g, sucres_g, sel_g}`, `regimes_compatibles`, `allergenes`, `deconseille_a[{profil, raison}]`, `saisons`, `occasions`, `tags`, `origine`.
- Valeurs autorisées :
  - unités : g, kg, ml, cl, l, c. à café, c. à soupe, pincée, gousse, tranche, branche, feuille, pièce, sachet, noix ;
  - appareils : thermomix, cookeo, classique, four, airfryer, multicuiseur ;
  - régimes : omnivore, sans_gluten, sans_lactose, sans_porc, halal, pescetarien, vegetarien, vegan, hypocalorique, riche_en_proteines, sportif, diabetique, sans_sel_ajoute, enceinte ;
  - allergènes : gluten, lait, oeuf, poisson, crustaces, mollusques, arachides, fruits_a_coque, soja, celeri, moutarde, sesame, sulfites, lupin ;
  - profils à risque : femme_enceinte, allaitante, enfant_moins_de_3_ans, enfant, senior, diabetique, hypertendu, immunodeprime ;
  - saisons : printemps, ete, automne, hiver, toute_annee ;
  - occasions : repas_rapide, repas_famille, repas_fete, repas_dominical, batch_cooking, enfants, invites, aperitif, gouter, petit_dejeuner.
- Réglages d'étape (`reglages`) : `feu` (doux, moyen, vif), `duree` (« 20 min », « 30 sec »), `temperature` (« 180°C », « Varoma »), `mode`, `vitesse`, `sens`, `accessoire`, `pression`, `position_grille`. Un objet vide signifie « aucun réglage ».
- Les étapes sont rédigées à l'impératif, à la 2e personne du pluriel (« Ajoutez… »).
- Limites connues, à afficher et à respecter :
  - la nutrition est une **estimation** (à recalculer plus tard par le code à partir des ingrédients et de CIQUAL) : afficher « valeurs estimées » ;
  - les avertissements grossesse/enfant (`deconseille_a`) couvrent les cas courants mais ne sont pas exhaustifs ;
  - seules certaines recettes ont de vraies étapes Thermomix ; `appareils_possibles` peut contenir « thermomix » sans étapes dédiées ;
  - il n'y a pas de photo ni de score santé dans les données.
- Le catalogue grandira plus tard avec une « usine à recettes » (génération IA par lots + validation par code) : l'appli doit accepter de nouveaux fichiers sans modification du code.

## 5. Style et construction
**Construction**
- Arborescence : `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `css/app.css`, `vendor/`, `docs/`, `data/`, `scripts/`, `js/main.js`, `js/core` (config, stockage local/Firestore, verrouillage, synchro), `js/lib` (recettes, adaptation, nutrition, courses, scan, sport, batch, règles de profil), `js/data` (catégories, tables d'additifs, de rayons, d'aliments déconseillés), `js/ui` (composants), `js/views` (un fichier par écran).
- Version dans les URLs de cache (`?v=N`) : les mises à jour s'installent à la prochaine ouverture avec du réseau.
- Deux modes : sans configuration, tout est enregistré sur le téléphone ; avec la configuration Firebase, synchronisation en direct.

**Design et ergonomie**
- Mobile-first, plein écran, barre d'onglets en bas : Accueil, Recettes, Planning, Courses, Suivi, avec un bouton central « Scanner » et un onglet « Plus ».
- Cartes blanches arrondies (14 px), fond chaud #F7F5F2, en-tête coloré, gros boutons pleins (arrondi 12 px), pastilles-filtres horizontales, sous-titres en petites capitales colorées.
- Thèmes de couleur (par défaut « lagon » vert/turquoise, puis rose, soleil, marine) et mode sombre automatique, via variables CSS.
- Pastilles « E » (bleu) et « M » (rose) partout où l'on montre qui a fait quoi.
- Zones de sécurité iPhone respectées, police système, champs à 16 px, retours visuels au toucher, états vides soignés, bandeaux d'information colorés (allergènes, sécurité alimentaire).
- Accessibilité : contrastes, zones tactiles d'au moins 44 px, lisible en cuisine.
- Aucune géolocalisation. Seule la caméra est demandée, uniquement pour le scan de codes-barres.

## 6. Fonctionnalités, par phases

### Phase 1 — Noyau (à faire en premier)
- Chargement de l'index, liste des recettes, recherche tolérante aux accents et aux majuscules (titre, ingrédients, tags).
- Filtres cumulables : catégorie, régime, allergènes à exclure, temps maximum, difficulté, saison, appareil.
- **Règle de sécurité** : un filtre d'allergène exclut toute recette qui contient cet allergène, sans exception.
- Fiche recette : ingrédients groupés par section, étapes numérotées avec réglages, astuces, conservation, nutrition par portion (« valeurs estimées »), pictogramme ou photo.
- Les avertissements (`deconseille_a`) s'affichent en haut de la fiche, bien visibles.
- Choix du nombre de personnes (1 à 12) : quantités recalculées avec arrondis lisibles (pas de 0,333), temps et moule adaptés si pertinent.
- Favoris. PWA installable, utilisable hors ligne. Script de vérification qui contrôle que les 1 610 recettes s'affichent sans erreur, lancé avant chaque commit.

### Phase 2 — Comptes, couple et profils
- Connexion Firebase (un compte chacun), choix du profil sur chaque téléphone (« Je suis Eymric » / « Je suis Marie »), foyer partagé, lien d'invitation, verrouillage par PIN.
- Synchronisation en moins de 2 secondes : favoris, notes, journal, poids, avec notification à l'autre. Vue « Nous deux ».
- Profil de chaque personne : adulte, adolescent, enfant (par tranche d'âge), bébé, senior ; grossesse (trimestre ou date prévue), allaitement, sportif, sédentaire, convalescence. Poids, taille, âge, sexe, activité : besoins (Mifflin-St Jeor), calories et macros, plafonds de sécurité (aucun régime extrême, surtout pour grossesse, enfant, adolescent).
- Objectifs : perte de poids, maintien, prise de masse, sèche, équilibre sans régime, objectif à date, préparation sportive, moins de sel / sucre / alcool, budget serré.
- Régimes et exclusions : ceux des listes du §4 (cumul possible : les recettes affichées respectent tous les critères, sinon elles sont masquées). Régimes plus avancés (méditerranéen, DASH, cétogène, FODMAP, jeûne intermittent, etc.) ou médicaux : ajoutés progressivement, avec rappel « à suivre sur avis médical ».
- Alertes de profil : encadré « À savoir » et marquage des recettes selon `deconseille_a` et le profil de la personne, avec la raison en une phrase. Sources officielles (HAS, ANSES, Santé publique France, PNNS) listées dans l'app et versionnées. Mention : « Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien. »
- Allergies, intolérances et aliments détestés : exclusion stricte partout.

### Phase 3 — Planning, courses et stock (fonction prioritaire)
- Planning hebdomadaire (petit-déjeuner, déjeuner, dîner, collations) généré selon objectifs et profils des deux, budget, temps et saison ; modifiable par glisser-déposer ; synchronisé.
- « Frigo magique » (recettes avec ce qu'on a), mode anti-gaspi, bouton « Qu'est-ce qu'on mange ce soir ? » (3 propositions), repas de dépannage en moins de 15 minutes.
- Liste de courses commune générée depuis le planning, avec fusion des doublons et conversion d'unités (2 × 100 g + 250 g = 450 g), déduction du stock, groupement par rayon (ordre personnalisable), articles récurrents, estimation du budget.
- Cochage en magasin synchronisé en direct (moins de 2 secondes), utilisable hors ligne, sans perte en cas de conflit. Pastille E / M sur chaque article. Plusieurs listes partagées (semaine, marché, fête, batch cooking), archivage, export, impression.
- Stock mis à jour après les courses. Les alertes de profil s'affichent aussi sur la liste.
- Notifications à l'autre quand des articles sont ajoutés ou quand une liste est terminée.

### Phase 4 — Scan de produits « façon Yuka »
- Scan du code-barres par la caméra (bouton central), saisie manuelle en secours. `BarcodeDetector` si disponible, sinon bibliothèque locale compatible Safari iPhone.
- Données Open Food Facts : nom, marque, photo, ingrédients, additifs, allergènes, nutrition pour 100 g, Nutri-Score, NOVA, Eco-Score, bio. Produit absent : formulaire de saisie.
- Note personnelle sur 100 avec couleur, calculée par nos règles transparentes (qualité nutritionnelle, additifs classés par niveau de risque dans une table publique et versionnée, degré de transformation, bonus bio/labels), avec le détail du « pourquoi ».
- Alertes personnalisées selon le profil de la personne qui scanne (mêmes règles que la phase 2). Alternatives meilleures de la même catégorie.
- Actions rapides : ajouter aux courses, au stock, au journal, favori ou « à éviter ». Historique partagé dans le couple, consultable hors ligne.
- Mention : « Note indicative qui ne remplace pas un avis médical ou diététique. »

### Phase 5 — Suivi et coach
- Journal alimentaire, bilan calories et macros du jour, hydratation. Poids et mensurations en courbes, partagés par défaut.
- Bilan hebdomadaire automatique par personne.
- Chat de coach IA (Gemini) qui connaît profils, planning, journal et séances. Rappels non intrusifs, défis et séries sans culpabilisation.

### Phase 6 — Mode sportif
- Objectif sportif (course, trail, triathlon, vélo, musculation) avec date, distance, temps visé. Plan nutritionnel par phases (base, développement, affûtage, semaine de course, jour J, récupération), calories et glucides modulés selon la charge du jour, charge en glucides avant la course, repas pré-course, ravitaillement (g de glucides/h, hydratation, sodium), récupération. Rappel : ne rien tester le jour J.
- Séances : saisie manuelle, import GPX/CSV et export JSON de l'appli RDD. Strava et Apple Santé : plus tard.
- Recettes taguées sport (riches en glucides, hyperprotéinées, récupération, boissons et barres maison).

### Phase 7 — Batch cooking
- Session générée depuis le planning : nombre de repas, durée disponible, appareils. Quantités multipliées et fusionnées, planning de session chronométré avec tâches en parallèle.
- Conditionnement : nombre de boîtes, étiquettes (date de préparation et limite), conservation frigo/congélateur, réchauffage (champ `conservation`). Stock de plats préparés avec alerte « à manger en premier ». Liste de courses dédiée.

### Phase 8 — Mode cuisine et Thermomix
- Mode « cuisine pas à pas » : plein écran, une étape à la fois, écran allumé, minuteur par étape (`duree`), navigation au balayage, lecture vocale en option.
- Les réglages d'étape sont affichés en pastilles (durée, température, vitesse, sens, accessoire) pour les recettes qui en ont.
- Version Thermomix (modèle TM6 / TM5 / TM31) : disponible pour les recettes qui ont de vraies étapes Thermomix ; pour les autres, réécriture à la demande par l'IA, clairement indiquée comme proposition à vérifier. Contrôle de capacité du bol (2,2 L).
- Autres méthodes (four, plaque, cocotte, Cookeo, airfryer, multicuiseur) : réécriture des étapes à la demande par l'IA.

### Phase 9 — Adaptation avancée
- Substitutions automatiques selon régime, profil et allergies, avec nutrition recalculée. Adaptation aux calories cibles de chacun et variantes par personne pour un même repas.
- Recalcul de la nutrition par le code à partir des ingrédients (CIQUAL), en remplacement des estimations.

## 7. Données Firestore
`households/{id}` : membres (E, M), emails autorisés. Sous-collections : `profiles/{E|M}`, `planning/{date}`, `shoppingLists/{id}` (avec articles), `pantry/{id}`, `journal/{id}`, `weights/{id}`, `workouts/{id}`, `scans/{barcode}`, `favorites/{id}`, `batchSessions/{id}`, `notes/{id}`. Les recettes ne sont pas dans Firestore. Documents petits, règles limitées à nos deux emails. Les données de santé vivent uniquement dans Firestore (protégé), jamais dans le dépôt.

## 8. Qualité attendue
- Tests unitaires : adaptation des quantités, fusion des courses, conversions d'unités, calcul des besoins, règles de profil, note produit.
- Gestion claire des erreurs réseau, de l'hors-ligne et des conflits de synchronisation (dernière modification gagnante, sans perte pour la liste de courses).
- Aucune donnée de santé dans le dépôt, aucune clé en dur.

## 9. Méthode de travail
Avance une phase à la fois, un commit par fonction, et valide chaque étape avec moi avant la suivante. Signale tes hypothèses et propose des alternatives quand un choix est discutable. Ne modifie jamais `data/recettes.json` sans me le dire.

## 10. Critères de réussite
- L'app s'ouvre depuis l'écran d'accueil avec son icône ; les deux téléphones voient les mêmes données en moins de 2 secondes.
- La liste de courses se coche en direct à deux et reste utilisable sans réseau.
- N'importe laquelle des 1 610 recettes s'affiche sans erreur et s'adapte au nombre de personnes.
- Un filtre d'allergène n'affiche jamais une recette qui contient cet allergène.
- Un profil « grossesse » ou « enfant » voit les avertissements et leur explication sur les recettes, le planning, les courses et le scan.
- Un produit scanné affiche sa note et son détail en moins de 3 secondes et s'ajoute en un geste aux courses ou au journal.
- Le plan nutritionnel d'une compétition se génère à partir de la date et de la distance.
