# Cahier des charges — « NutriCoach » : coach alimentaire, recettes, courses et scan produits, pour un couple

> Version finale (novembre 2026), remplace la précédente (conservée dans `docs/ancien-cahier-v2.md`). Référence de travail.

## 1. Rôle
Tu es un développeur senior web, un designer UI/UX mobile, un expert en nutrition (dont nutrition sportive) et un chef cuisinier. Tu écris le CODE SOURCE COMPLET d'une web-app installable (PWA), modulaire, robuste, testée et commentée en français, publiée sur GitHub et hébergée gratuitement par GitHub Pages. On l'ouvre depuis un lien dans Safari ou Chrome, puis on l'ajoute à l'écran d'accueil (icône dédiée, plein écran) : aucune application à installer, ni App Store, ni Mac, ni compilation.

## 2. Contexte d'usage
- Utilisateurs : un couple, Eymric (marqueur bleu « E ») et Marie (marqueur rose « M »), avec une fille de 5 ans (portions et recettes enfant). Appareils : iPhone, iPad, Android/Samsung.
- L'app sert à manger mieux, suivre un régime ou un objectif (perte de poids, sport, compétition), planifier les repas, cuisiner (Thermomix ou autre), scanner les produits et faire les courses.
- Transparence totale dans le couple : par défaut TOUT est partagé et synchronisé (poids, mensurations, journal, objectifs, séances, planning, courses, stock, scans). Une option « privé » facultative par donnée existe, désactivée par défaut.
- Code livré sur un dépôt GitHub public publié par GitHub Pages, sur le modèle de mon « Carnet de Voyage », de mon appli budget et de mon appli de running RDD.
- Installation guidée : je n'écris aucun code ; la configuration Firebase est intégrée à l'app et un lien d'invitation configure le téléphone de Marie.

## 3. Contraintes techniques
| Sujet | Choix imposé |
|---|---|
| Format | PWA : HTML, CSS, JavaScript en modules ES, Preact + htm, SANS étape de compilation. Bibliothèques en copies locales dans vendor/ (Preact, htm, Firebase, Font Awesome, bibliothèque de scan de codes-barres) |
| Hébergement | GitHub Pages (gratuit), dépôt public, fichier .nojekyll. Aucune donnée personnelle ni secret dans le dépôt |
| Installation | Safari › Partager › « Sur l'écran d'accueil » (iPhone/iPad) ; Chrome › Installer (Android/Samsung) ; icône, plein écran |
| Backend | Firebase gratuit (plan Spark) : Authentication email/mot de passe (un compte chacun, inscription publique désactivée) + Firestore avec cache hors-ligne IndexedDB. Sans Firebase, l'app fonctionne en mode local sur le téléphone |
| Règles Firestore | Prêtes à coller, limitées à nos deux adresses email, collections listées explicitement, taille des documents contrôlée |
| Recettes | 10 000+ recettes dans des fichiers JSON statiques du dépôt (découpés par catégorie, chargés à la demande, index de recherche local, mise en cache par le service worker). Elles ne sont PAS dans Firestore. Firestore ne contient que les données du couple |
| Sécurité | Code PIN (PBKDF2) et Face ID / Touch ID via WebAuthn en option, reverrouillage après 1 minute en arrière-plan ; clés API saisies dans les réglages, jamais en dur |
| Hors-ligne | Service worker : app, recettes consultées ou favorites, planning, courses, stock et produits déjà scannés consultables et modifiables sans réseau, resynchronisés au retour du réseau |
| Données gratuites sans clé | Open Food Facts (produits, codes-barres, Nutri-Score, NOVA, additifs), CIQUAL (valeurs nutritionnelles) |
| IA | Coach et génération via Gemini par défaut (clé facultative dans les réglages), fournisseur modifiable |
| Langue | Français |

## 4. Style et construction (à reproduire, sans copier l'app voyage)
**Construction**
- Arborescence : index.html, manifest.webmanifest, sw.js, icons/, css/app.css, vendor/, docs/, js/main.js, js/core (config, store local/Firestore, verrouillage, synchro), js/lib (recettes, adaptation, nutrition, courses, scan, sport, batch, règles de profil), js/data (catégories, modèles, tables d'additifs, de rayons et d'aliments déconseillés), js/ui (composants communs), js/views (un fichier par écran).
- Versions dans les URLs de cache (?v=N) pour que les mises à jour s'installent toutes seules à la prochaine ouverture avec du réseau.
- Deux modes : sans configuration, tout est enregistré sur le téléphone ; avec la configuration Firebase intégrée, synchronisation en direct entre nos appareils.

**Design et ergonomie**
- Mobile-first, plein écran, barre d'onglets en bas : Accueil, Recettes, Planning, Courses, Suivi, avec un bouton central « Scanner » et un onglet « Plus ».
- Cartes blanches arrondies (14 px), fond chaud #F7F5F2, en-tête coloré, gros boutons pleine largeur (arrondi 12 px), pastilles-filtres horizontales (« chips »), icônes Font Awesome, sous-titres en petites capitales colorées.
- Thèmes de couleur au choix (par défaut « lagon » vert/turquoise, puis rose, soleil, marine) et mode sombre automatique, via variables CSS.
- Pastilles « E » (bleu) et « M » (rose) partout où l'on montre qui a fait quoi.
- Zones de sécurité iPhone respectées, police système, champs à 16 px (pas de zoom iOS), retours visuels au toucher, états vides soignés, bandeaux d'information colorés (allergènes, sécurité alimentaire, conseils).
- Aucune géolocalisation : l'app ne demande jamais l'accès à la position, ne partage aucune position entre nous deux et n'utilise ni carte ni recherche de magasins à proximité. Seule la caméra est demandée, uniquement pour le scan de codes-barres.

## 5. Fonctionnalités

### 5.1 Comptes, profils et mode couple
- Connexion Firebase email / mot de passe, un compte chacun. Choix du profil sur chaque téléphone : « Je suis Eymric (E, bleu) » ou « Je suis Marie (M, rose) ». Verrouillage Face ID / PIN en option.
- Un « foyer » partagé : lien d'invitation pour configurer le second téléphone en un clic.
- Synchronisation instantanée (moins de 2 secondes) : planning, courses, stock, journal, poids, favoris, scans, notes, avec notifications pour l'autre (« Marie a ajouté 3 articles »).
- Vue « Nous deux » : bilan combiné, repas communs, courses communes, qui a fait quoi (ajouté, coché, cuisiné, scanné).
- Chacun a son profil propre (objectif, régime, calories cibles, allergies, goûts), visible par l'autre. Un même plat a des portions et variantes différentes pour chacun, et pour l'enfant.

### 5.2 Profils, objectifs et régimes (complets)
**Profil de chaque personne (choix à l'onboarding, modifiable à tout moment)**
- Adulte, adolescent, enfant (par tranche d'âge, ex. 5 ans), bébé (diversification alimentaire), senior.
- Situations particulières : grossesse (avec trimestre ou date prévue d'accouchement), allaitement, sportif / compétition, sédentaire, post-opératoire ou convalescence, sur avis médical.
- Poids, taille, âge, sexe, activité : calcul des besoins (Mifflin-St Jeor), calories et macros, rythme paramétrable avec plafonds de sécurité (aucun régime extrême ni restriction dangereuse, surtout pour la grossesse, l'enfant et l'adolescent).

**Objectifs**
- Perte de poids, maintien, prise de masse, sèche, manger équilibré sans régime, objectif à date (ex. perdre X kg avant une date), préparation sportive (voir 5.3), énergie / moins de fatigue, meilleure digestion, réduction du sel / du sucre / de l'alcool, budget serré.

**Régimes proposés (tous ceux qui sont réalisables, avec recettes dédiées)**
- Modes d'alimentation : omnivore équilibré, flexitarien, végétarien, ovo-lacto-végétarien, pescétarien, végétalien (vegan), crudivore léger.
- Régimes populaires : méditerranéen, DASH, nordique, anti-inflammatoire, hyperprotéiné, low carb, cétogène, jeûne intermittent (fenêtres 16/8, 14/10…), paléo, suivi de points maison façon Weight-Watchers, hypocalorique, hypercalorique.
- Exclusions : sans gluten, sans lactose, sans œuf, sans arachide, sans fruits à coque, sans soja, sans poisson / fruits de mer, sans sucre ajouté, sans porc, halal, casher, sans alcool.
- Médicaux (uniquement avec rappel « à suivre sur avis médical ») : diabétique / index glycémique bas, hypertension / pauvre en sel, cholestérol, goutte / pauvre en purines, reflux gastrique, FODMAP (intestin irritable), maladie cœliaque, insuffisance rénale (potassium / phosphore / protéines), post-bariatrique, hypothyroïdie.
- Cumul possible de plusieurs régimes et exclusions (ex. végétarien + sans gluten + low carb) : les recettes affichées respectent TOUS les critères, sinon elles sont adaptées par substitution ou masquées.

**Mode « profil » : conseils, aliments déconseillés et explications**
- Selon le profil, l'app affiche un encadré « À savoir » et marque les aliments et recettes concernés :
  - Grossesse : alerte sur les aliments déconseillés avec l'explication du risque (listériose, toxoplasmose, salmonelle, mercure, vitamine A, alcool, caféine…), par exemple fromages au lait cru, charcuterie crue, poissons et viandes crus ou fumés, œufs et viandes pas assez cuits, certains poissons gras prédateurs, pousses crues, produits à base de foie, alcool. Conseils de conservation et de lavage, apports à privilégier (fer, calcium, acide folique, oméga-3).
  - Allaitement, enfant, bébé, senior : aliments à éviter ou à adapter à l'âge (risques d'étouffement, sel, sucre, miel avant 1 an, allergènes introduits progressivement), besoins spécifiques.
  - Régimes médicaux : aliments à limiter ou à privilégier, avec une explication courte et claire du « pourquoi ».
- Chaque alerte indique la raison en une phrase simple et renvoie vers une fiche explicative ; les règles viennent de sources officielles (ex. HAS, ANSES, Santé publique France, PNNS) listées dans l'app et versionnées.
- Les alertes s'appliquent partout : recettes, planning, liste de courses, journal et scan produits (le scan d'un fromage au lait cru par un profil « grossesse » affiche un avertissement rouge avec l'explication).
- Chaque personne a son propre profil et ses propres alertes, visibles par l'autre ; dans un repas commun, la recette propose la variante adaptée à chacun.
- Mention affichée : « Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien. »
- Allergies, intolérances et aliments détestés : exclusion stricte partout.

### 5.3 Mode sportif et préparation de compétition
- Objectif sportif : course officielle (5 km, 10 km, semi, marathon, trail, ultra), triathlon, vélo, musculation, autre, avec date, distance, objectif de temps.
- Plan nutritionnel par phases (base, développement, affûtage, semaine de course, jour J, récupération) : calories et glucides modulés selon la charge du jour (repos, sortie courte, sortie longue, fractionné) ; charge en glucides sur les 2 à 3 jours avant (au choix) avec menus dédiés et pauvres en fibres la veille ; repas pré-course ; stratégie de ravitaillement (g de glucides/h, hydratation, sodium) ; repas et boisson de récupération ; rappel de ne rien tester le jour J.
- Séances : saisie manuelle (l’import de fichiers a été abandonné).
- Recettes taguées sport (pré-effort, pendant, récupération, riches en glucides, hyperprotéinées, boissons et barres maison). Chacun peut avoir un objectif sportif différent avec des repas communs adaptés.
- Rappel : l'app ne remplace pas un avis médical ou diététique.

### 5.4 Bibliothèque de 10 000 recettes minimum
- Catégories : apéro et finger food, boissons et cocktails (avec et sans alcool), entrées, soupes, salades, plats (viandes, volailles, poissons, fruits de mer, végétarien, végétalien, pâtes, riz, légumes, gratins, mijotés, tartes salées), accompagnements, sauces, pains et pâtes à pizza, brioches, desserts, gâteaux, glaces, entremets, petit-déjeuner et brunch, goûters, repas enfant et bébé, repas de fêtes, plats du monde, saisonniers, petit budget, rapides (< 20 min), batch cooking, sport, recettes par régime et par profil (grossesse, diabète, sans gluten, etc.).
- Chaque recette : titre, description, photo, catégorie, temps, difficulté, coût par portion, ingrédients structurés (aliment, quantité, unité), étapes, nutrition par portion (calories, protéines, glucides, lipides, fibres, sucres, sel), tags (régime, profil compatible, saison, allergènes, appareils, occasion, sport), conservation, score santé.
- Toutes les recettes sont ORIGINALES (aucune copie de Cookidoo, Cookomix, Marmiton ou autres). Pipeline de production : génération IA par lots avec quotas par catégorie pour atteindre 10 000 sans doublons ; validation automatique (quantités et temps cohérents, ingrédients reconnus CIQUAL / Open Food Facts, nutrition recalculée par le code et non par l'IA, détection de quasi-doublons, contrôle des allergènes et des aliments déconseillés par profil) ; statut « à vérifier » pour les recettes douteuses ; import de mes propres recettes (saisie, URL, photo).
- Recherche et filtres : ingrédients dans le frigo, temps, calories max, régime, profil, appareil, saison, budget, sport.

### 5.5 Mode Thermomix « façon Cookidoo / Cookomix »
- Version Thermomix par recette, modèle au choix (TM6 / TM5 / TM31).
- Chaque étape affiche, comme sur l'écran de la machine, des pastilles : durée, température (37 à 120 °C, Varoma), vitesse (0,5 à 10, Turbo), sens inverse, mode pétrin, mode doux, avec les ingrédients à ajouter.
- Mode « cuisine pas à pas » : plein écran, une étape à la fois, écran toujours allumé, minuteur par étape, navigation au balayage, lecture vocale optionnelle. Pesée guidée et ordre de pesée optimisé ; contrôle de capacité du bol (2,2 L) avec proposition de cuisson en deux fois.
- Même recette, autres méthodes au choix : four, plaque, cocotte, Cookeo, airfryer, multicuiseur, sans cuisson ; les étapes se réécrivent.

### 5.6 Adaptation intelligente
- Nombre de personnes (1 à 12) : quantités recalculées avec arrondis réalistes, temps de cuisson et moule adaptés, alerte de capacité.
- Substitutions automatiques selon régime, profil et allergies, nutrition recalculée. Adaptation aux calories cibles de chacun, variantes par personne pour un même repas.

### 5.7 Planning, frigo magique et décision du soir
- Planning hebdomadaire (petit-déj, déjeuner, dîner, collations) généré selon objectifs et profils des deux, séances de sport, budget, temps et saison, modifiable par glisser-déposer, synchronisé.
- « Frigo magique » (recettes avec ce qu'on a) et mode anti-gaspi (produits qui périment).
- Bouton « Qu'est-ce qu'on mange ce soir ? » : 3 propositions immédiates selon stock, temps et objectifs de chacun. Mode dépannage : repas de secours en moins de 15 minutes.

### 5.8 Mode batch cooking
- Session générée depuis le planning de la semaine (ou 2 semaines) : nombre de repas, durée disponible, appareils.
- Quantités multipliées et fusionnées, planning de session chronométré avec tâches en parallèle et ordre optimisé pour limiter lavages et attentes.
- Conditionnement : nombre de boîtes, étiquettes (date de préparation et limite), durée de conservation frigo et congélateur, décongélation et réchauffage.
- Stock de plats préparés avec alertes « à manger en premier » ; liste de courses dédiée à la session.

### 5.9 Liste de courses et stock (fonction prioritaire)
- Générée depuis le planning et les sessions de batch cooking, avec les quantités du nombre de personnes réel ; fusion des doublons et conversion d'unités (2 × 100 g + 250 g de farine = 450 g) ; déduction du stock.
- Groupée par rayon de supermarché (ordre personnalisable) ; ajout manuel, articles récurrents, estimation du budget.
- Cochage en magasin synchronisé en direct entre Marie et moi, utilisable hors ligne ; partage/export/impression ; mise à jour automatique du stock après les courses.
- Une seule liste commune au foyer, visible et modifiable par Marie et moi, avec une pastille E / M sur chaque article pour savoir qui l'a ajouté et qui l'a coché.
- Mises à jour en direct : si l'un coche ou ajoute un article, l'autre le voit en moins de 2 secondes, même en rayon, avec gestion des conflits sans perte.
- Possibilité de créer plusieurs listes partagées (courses de la semaine, marché, fête, batch cooking) et de les archiver une fois terminées.
- Le scan d'un produit peut l'ajouter à la liste commune en un geste.
- Notification à l'autre quand une liste est terminée ou que des articles sont ajoutés.
- Les alertes de profil (grossesse, régime, allergie) s'affichent aussi sur la liste : un article déconseillé à l'un de nous est signalé avec la raison.

### 5.10 Mode scan produits « façon Yuka »
- Scan du code-barres avec la caméra (bouton central toujours accessible), saisie manuelle du numéro en secours. API BarcodeDetector quand elle existe, sinon bibliothèque de scan locale compatible Safari iPhone.
- Données via Open Food Facts : nom, marque, photo, ingrédients, additifs, allergènes, nutrition pour 100 g, Nutri-Score, NOVA, Eco-Score, bio. Produit absent : formulaire de saisie, avec envoi possible vers Open Food Facts.
- Note personnelle sur 100 avec couleur (excellent, bon, médiocre, mauvais), calculée par NOS règles transparentes (pas l'algorithme de Yuka) : qualité nutritionnelle, additifs classés par niveau de risque (table de référence publique et versionnée), degré de transformation, bonus bio / labels. Détail du « pourquoi » avec points positifs et négatifs.
- Alertes personnalisées selon le profil de la personne qui scanne : allergies, régime, grossesse/allaitement, enfant, objectif (sel, sucre, calories) (mêmes règles et mêmes explications que la section 5.2).
- « Alternatives meilleures » de la même catégorie. Actions rapides : ajouter aux courses, au stock, au journal (portion modifiable), favori ou « à éviter ».
- Historique et favoris partagés dans le couple (pastille E / M), consultables hors ligne pour les produits déjà vus. Scan en rayon : scanner un produit de la liste le coche et affiche sa note.
- Option IA : photo du tableau nutritionnel pour un produit hors base. Score santé appliqué aussi aux recettes et aux menus de la semaine.
- Mention affichée : « Note indicative qui ne remplace pas un avis médical ou diététique. »

### 5.11 Suivi et coach
- Journal alimentaire, bilan calories et macros du jour, hydratation. Poids et mensurations en courbes, partagés par défaut dans le couple.
- Bilan hebdomadaire automatique par personne, ajustement des objectifs.
- Chat de coach IA qui connaît profils, planning, journal et séances : « il me reste 400 kcal, que manger ? », « que manger la veille de mon marathon ? ». Rappels non intrusifs, défis et séries sans culpabilisation.

### 5.12 Réglages
- Profil E/M, thème de couleur, mode sombre, verrouillage, appareils de cuisine (modèle de Thermomix, Cookeo, airfryer, etc.), unités, clé IA, rayons du supermarché, export/sauvegarde des données, envoi des données créées avant la synchro.

## 6. Données Firestore (schéma à fournir, avec règles de sécurité)
households/{id} : membres (E, M), emails autorisés. Sous-collections : profiles/{E|M} (profil, objectifs, régimes, allergies, besoins), planning/{date}, shoppingLists/{id} (avec articles), pantry/{id}, journal/{id}, weights/{id}, workouts/{id}, scans/{barcode}, favorites/{id}, batchSessions/{id}, notes/{id}. Les recettes ne sont pas dans Firestore. Documents petits, photos compressées, règles limitées à nos deux emails.

## 7. Qualité attendue
- Tests unitaires pour le moteur d'adaptation, la fusion des courses, les conversions d'unités, le calcul des besoins, les règles de profil (aliments déconseillés) et la note produit.
- Gestion claire des erreurs réseau, de l'hors-ligne et des conflits de synchronisation (dernière modification gagnante, sans perte pour la liste de courses).
- Accessibilité : contrastes, tailles de texte, zones tactiles d'au moins 44 px.
- Aucune donnée de santé dans le dépôt public ; aucune clé en dur.

## 8. Méthode de travail
Avance par étapes, valide chacune avec moi avant la suivante, signale tes hypothèses et propose des alternatives quand un choix est discutable.

## 9. Livrables attendus
1. Architecture (arborescence, rôle de chaque module), icône de l'application.
2. Schéma JSON d'une recette + 15 recettes d'exemple (dont 5 Thermomix, 2 apéros, 2 desserts, 2 batch cooking, 2 sport).
3. Schéma Firestore et règles de sécurité prêtes à coller.
4. Authentification, foyer, invitation de Marie, synchronisation temps réel.
5. Profils, régimes et règles d'alertes (avec sources officielles).
6. Moteur d'adaptation et liste de courses partagée/stock, avec tests.
7. Mode scan produits (scan, fiche, note, alertes, alternatives).
8. Modes sportif et batch cooking.
9. Écrans : onboarding, accueil, recherche, détail recette, mode cuisine/Thermomix, planning, courses, stock, scan, suivi, coach, vue « Nous deux », réglages.
10. Pipeline de génération et validation des 10 000 recettes (quotas, rapport qualité).
11. Code source complet et modulaire publié sur GitHub.
12. docs/ : cahier des charges et guide pas à pas (ouvrir le lien, ajouter à l'écran d'accueil, créer le projet Firebase, inviter Marie, mettre à jour l'app).

## 10. Critères de réussite
- L'app s'ouvre depuis l'écran d'accueil avec son icône, et les deux téléphones voient les mêmes données en moins de 2 secondes.
- La liste de courses se coche en direct à deux et reste utilisable sans réseau en magasin.
- Un produit scanné affiche sa note et son détail en moins de 3 secondes, et s'ajoute en un geste aux courses ou au journal.
- Un profil « grossesse » signale et explique les aliments déconseillés dans les recettes, le planning, la liste de courses et le scan.
- N'importe quelle recette s'adapte en un geste au nombre de personnes, au régime et à la méthode de cuisson (Thermomix compris).
- Le plan nutritionnel d'une compétition se génère à partir de la date et de la distance, et s'ajuste aux séances importées.
