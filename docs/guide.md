# Guide pas à pas

## 1. Ouvrir l'appli et l'ajouter à l'écran d'accueil
1. Ouvrez le lien de l'appli (`https://<compte>.github.io/nutricoach/`) dans **Safari** (iPhone, iPad) ou **Chrome** (Android, Samsung).
2. **iPhone / iPad** : bouton Partager › « Sur l'écran d'accueil ». **Android** : menu ⋮ › « Installer l'application ».
3. Ouvrez NutriCoach depuis son icône : l'appli s'affiche en plein écran. La première ouverture demande du réseau ; ensuite recettes consultées, menus, courses et stock fonctionnent hors ligne.

## 2. Créer le projet Firebase (gratuit, une seule fois)
1. https://console.firebase.google.com › Créer un projet « nutricoach » (sans Google Analytics).
2. **Authentication** › Sign-in method › E-mail/Mot de passe › activer. Onglet Users › ajouter **deux comptes** (un chacun, mot de passe de 8 caractères au moins). Il n'y a pas d'inscription publique dans l'appli.
3. **Firestore Database** › créer en mode production, région Europe.
4. Onglet Règles : collez `docs/firestore.rules.exemple` avec **vos deux adresses**, puis Publier.
5. Paramètres du projet › Vos applications › Web `</>` › copiez le bloc `firebaseConfig` dans `js/core/firebase-config.js` (ces valeurs sont publiques par conception).
6. Authentication › Settings › Domaines autorisés › ajoutez `<compte>.github.io`.

## 3. Inviter Marie
Envoyez-lui le lien de l'appli, son adresse et son mot de passe (par un autre canal). Sur son téléphone : ajouter à l'écran d'accueil, se connecter, choisir « Je suis Marie ». Vos favoris, menus, courses, stock, scans, journal et poids se synchronisent en moins de 2 secondes.

## 4. Premiers pas
- **Profil** : date de naissance, poids, taille, objectif, régimes, allergies. Les enfants s'ajoutent dans Profil › Enfants.
- **Planning** : « Générer ma semaine » ; **Courses** : « Depuis le menu de la semaine » ; **Scanner** : bouton central.
- **Coach IA** (facultatif) : créez une clé gratuite sur aistudio.google.com/apikey et collez-la dans Profil › Coach IA. Votre profil n'est envoyé à Google que si vous le cochez.
- **Photos des recettes** (facultatif) : Profil › Photos des recettes. Créez une clé gratuite sur pexels.com/api (instantané) et/ou unsplash.com/developers et collez-les (les deux clés peuvent être enregistrées : si le principal est en panne, l'autre prend le relais) : la photo apparaît à l'ouverture d'une recette, avec le nom du photographe, et en miniature dans la liste des recettes (réglable, plafonné à 40 recherches par heure).
- **Code PIN** et **Face ID / Touch ID** : Profil › Code PIN.

## 5. Mettre à jour l'appli
Les mises à jour s'installent toutes seules à la prochaine ouverture avec du réseau. Pour publier une nouvelle version du code : changer `VERSION` dans `sw.js` **et** les `?v=N` de `index.html`, puis `node scripts/verifier.mjs` avant de pousser.

## 6. Sauvegarder
Plus › « Sauvegarder les données de ce téléphone » (fichier JSON, sans code PIN ni clé du coach). Gardez-le en lieu sûr : il contient votre profil.

## 7. Limites à connaître
- Pas de notification quand l'appli est fermée (il faudrait un serveur d'envoi) : un fil « Depuis votre dernière visite » apparaît sur l'accueil.
- Les alertes de santé sont générales et à faire relire par un professionnel (`docs/sources.md`).
- Il n’y a plus de saisie de séances : le plan suit une semaine type adaptée à la phase de préparation.
- Le catalogue compte 1 610 recettes originales. Les photos nécessitent une clé gratuite (Pexels ou Unsplash) et sont limitées par heure.

## Produit inconnu : photo du tableau nutritionnel
Dans la fiche d'un produit inconnu, touchez « 📷 Photographier le tableau nutritionnel ». L'IA (Gemini, avec votre clé gratuite du coach) remplit le formulaire. **Vérifiez chaque chiffre** avant d'enregistrer. La photo n'est pas gardée.

## Partager un produit avec Open Food Facts
Un produit saisi à la main (ou lu par photo) peut être envoyé à Open Food Facts : dans sa fiche, « Partager ce produit avec Open Food Facts ». Il faut un compte gratuit sur openfoodfacts.org. Vos identifiants restent sur le téléphone et ne sont pas synchronisés.

## Déplacer un repas au doigt
Dans « Ma semaine », posez le doigt sur la poignée ⠿ d'un repas, glissez-le sur un autre repas et lâchez : les deux se remplacent. La page défile toute seule près des bords. Lâcher ailleurs ne change rien.

## Score santé des recettes et des menus
Chaque fiche affiche un score santé sur 100 (sel, sucres, fibres, protéines, graisses : 20 points chacun). « Ma semaine » affiche le score du menu et celui de chaque jour. C'est une estimation par portion, pas un avis médical.

## Coach : onglet dédié, documents, copier-coller
Le coach a son propre onglet 💬 dans la barre du bas. Touchez 📎 pour joindre une photo (étiquette, menu, ordonnance), un PDF (8 Mo max) ou un fichier texte, jusqu'à 4 par message. Vous pouvez aussi coller une image ou du texte dans la zone de saisie. Les réponses se sélectionnent et se copient (bouton « ⧉ Copier »). Les pièces jointes sont envoyées à Google (Gemini) avec votre question puis oubliées par l'appli. Le coach ne pose pas de diagnostic.

## Grossesse : puis-je manger… ?
Quand vous indiquez une grossesse ou un allaitement (Profil → Infos : Femme, puis Ma situation), une carte apparaît sur l'Accueil et une entrée dans « Plus ». Le guide classe une quarantaine d'aliments en Interdit / À éviter / À limiter / Autorisé, avec la raison et un conseil, et une recherche (« saumon fumé », « camembert », « sushi »…). Repères généraux issus des recommandations françaises, à faire relire par un professionnel de santé.

## Comme une vraie appli
Le zoom (pincement, double toucher) est bloqué. Quand une grossesse ou un allaitement est indiqué, un onglet 🤰 Grossesse apparaît dans la barre du bas. Les enfants ajoutés sur un téléphone apparaissent sur l'autre (profils partagés).

## Deux IA en même temps (Gemini + Groq)
Dans Profil → Coach IA, ajoutez aussi une clé Groq (gratuite, console.groq.com/keys). L'appli interroge alors Gemini et Groq en même temps et affiche la première réponse (le nom de l'IA est indiqué sous la réponse). Groq ne lit pas les photos ni les PDF : dans ce cas, seul Gemini répond. Les clés restent sur le téléphone.

## Barre du bas simplifiée
5 entrées : Accueil, Planning, 📷 Scanner, Coach, Plus (quand une grossesse est déclarée, l'onglet Grossesse s'ajoute : Accueil, Planning, Scanner, Grossesse, Coach, Plus). Recettes, Planning, Courses et Suivi sont aussi sur l'Accueil et dans « Plus ». Marie a le thème rose par défaut (changeable dans Plus).

## Un coach qui connaît toute l'appli
Si « Personnaliser les réponses » est coché, le coach reçoit : votre profil et celui de votre conjoint(e) (grossesse, allaitement, allergies, régimes), vos enfants, votre objectif sportif et la phase du jour, votre menu, vos courses, votre frigo (et ce qu'il faut consommer vite), votre poids et votre journal du jour. Il a des bases de santé publique (grossesse, allaitement, enfants, sport) mais **n'est pas un médecin** : il ne fait pas de diagnostic, ne touche à aucun traitement, renvoie vers un professionnel et vers le 15 en cas d'urgence. En grossesse et allaitement, chaque réponse est suivie d'un rappel « je ne suis pas médecin ».

## Batch cooking : jours et portions
Choisissez le nombre de jours à couvrir (1 à 14) et les portions par repas : par défaut une par personne de la famille (Eymric, Marie et chaque enfant compté dans les menus, soit 3 aujourd'hui). « Remplir d'après mon menu » reprend les recettes de votre planning.

## « Plus » : mieux rangé
En haut, votre profil. Puis : Au quotidien (recettes, courses, frigo, batch, favoris), Santé et sport (suivi, grossesse, sport, scans), À deux (Nous deux, enfants), Réglages (coach, photos, code PIN, sources), thème, appareils, rayons, et vos données (sauvegarder et **restaurer**). La sauvegarde ne contient jamais de code PIN ni de clé.

## Mes recettes : ajouter, importer, exporter
Plus → Mes recettes (ou « ＋ Recette » dans l'onglet Recettes).
- **À la main** : titre, ingrédients (un par ligne : « 200 g de farine, tamisée »), étapes (une par ligne), et le reste en option (temps, régimes, allergènes, nutrition…).
- **Par fichier** : « Télécharger le modèle de fichier » donne un fichier JSON d'exemple avec les valeurs autorisées. Remplissez-le (vous pouvez demander au coach de le faire), puis « Importer un fichier de recettes » : un aperçu montre ce qui sera importé et ce qu'il faut corriger. Plusieurs recettes d'un coup sont possibles.
- **Exporter** : « Exporter mes recettes » donne un fichier que vous pouvez réimporter ou partager.
- Vos recettes sont **partagées entre vos deux téléphones**, apparaissent dans la recherche, les menus, les courses et le batch, et se modifient ou se suppriment depuis « Mes recettes ». Elles ne touchent jamais au catalogue de 1 610 recettes.
- **Sécurité** : les allergènes sont complétés automatiquement d'après les ingrédients, et les avertissements (femme enceinte, enfants…) aussi, pour que vos filtres restent sûrs. Sans nutrition renseignée, pas de calories ni de score santé.
