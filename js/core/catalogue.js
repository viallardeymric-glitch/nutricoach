// Chargement du catalogue : index léger au démarrage, fiches complètes à l'ouverture.
// Les fichiers de recettes sont ceux que l'index déclare (« fichiers ») : en ajouter ne demande aucun changement de code.
import { preparerRecettes } from '../lib/recettes.js';

let promesseIndex = null;
const promessesFichiers = new Map();

/** Charge l'index léger et prépare le texte de recherche de chaque recette. */
export function chargerIndex() {
  if (!promesseIndex) {
    promesseIndex = fetch('data/index.json')
      .then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.json(); })
      .then((index) => ({
        fichiers: index.fichiers,
        recettes: preparerRecettes(index.recettes),
      }))
      .catch((e) => { promesseIndex = null; throw e; });
  }
  return promesseIndex;
}

function chargerFichier(nom) {
  if (!promessesFichiers.has(nom)) {
    promessesFichiers.set(nom, fetch(`data/${nom}`)
      .then((r) => { if (!r.ok) throw new Error(`${nom} ${r.status}`); return r.json(); })
      .then((liste) => new Map(liste.map((x) => [x.id, x])))
      .catch((e) => { promessesFichiers.delete(nom); throw e; }));
  }
  return promessesFichiers.get(nom);
}

/** Fiche complète d'une recette de l'index (null si introuvable). */
export async function chargerFiche(index, id) {
  const entree = index.recettes.find((r) => r.id === id);
  if (!entree) return null;
  const fichier = await chargerFichier(index.fichiers[entree.f]);
  return fichier.get(id) || null;
}
