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
- Les séances se saisissent à la main (date, type, durée, distance) ; il n’y a pas d’import de fichiers.
- Le catalogue compte 1 610 recettes originales. Les photos nécessitent une clé gratuite (Pexels ou Unsplash) et sont limitées par heure.

## Produit inconnu : photo du tableau nutritionnel
Dans la fiche d'un produit inconnu, touchez « 📷 Photographier le tableau nutritionnel ». L'IA (Gemini, avec votre clé gratuite du coach) remplit le formulaire. **Vérifiez chaque chiffre** avant d'enregistrer. La photo n'est pas gardée.
