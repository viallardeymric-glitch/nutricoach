# Données du couple (Firestore)

Tout est sous `households/foyer/…` (un seul foyer). Les recettes ne sont **pas** dans Firestore. Les données de santé (profils, poids, journal) ne vont **jamais** dans le dépôt.

| Collection | Document | Contenu |
|---|---|---|
| `profiles` | `E`, `M` | Profil de chacun : sexe, naissance, poids, taille, activité, objectif, objectifDate, secondaires, grossesse, allaitement, sportif, conditions, régimes, allergènes, exclusions, `sport`, `appliquer`, `modifie` |
| `profiles` | `enfant-xxx` | Enfant du foyer : prénom, naissance, allergènes, régimes, exclusions, `dansMenus` |
| `planning` | `AAAA-MM-JJ` | `petit_dejeuner`, `dejeuner`, `diner`, `collation` (identifiants de recettes), `par`, `modifie` |
| `shoppingLists` | `semaine`, `l-xxx`, `batch-AAAA-MM-JJ` | `kind: liste` (nom, archivee) |
| `shoppingLists` | `{liste}__{article}` | `kind: article` : nom, quantité, unité, rayon, `cle`, `coche`, `par`, `cochePar`, `source`, `recettes`. **Un document par article** : deux personnes qui cochent ou ajoutent en même temps ne s'écrasent jamais |
| `shoppingLists` | `rec-…` | `kind: recurrent` : article récurrent |
| `pantry` | clé encodée | Stock : nom, quantité, unité, rayon, `peremption` |
| `scans` | code-barres | Produit compact (≤ 3 ko), `par`, `favoriPar`, `eviterPar`, `saisie` |
| `favorites` | `REC-xxxxxx_E` / `_M` | Favori d'une personne |
| `journal` | identifiant | `type: repas` (date, repas, nom, kcal, macros, source) ou `type: eau` (ml) |
| `weights` | `AAAA-MM-JJ_E` | Poids et mensurations |
| `workouts` | identifiant | Séance : date, type, durée, distance, dénivelé, source |
| `batchSessions` | identifiant | Plats préparés : titre, portions, restant, dates limites, `congele` |
| `notes` | `photo-REC-xxxxxx`, `recette-REC-9xxxxx` | Adresse et crédit d’une photo ; recettes de la famille (ajoutées à la main ou importées) ; jamais de clé |

Tout est partagé entre les deux comptes (pas de mode privé).

## Règles de sécurité
Modèle dans `docs/firestore.rules.exemple` : remplacez `EMAIL_1` et `EMAIL_2` par vos deux adresses, puis collez le tout dans Firebase › Firestore › Règles › Publier. Ne versionnez jamais le fichier rempli (il contient vos adresses).
