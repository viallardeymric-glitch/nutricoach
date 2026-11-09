// Réglages généraux de l'appli.
export const TAILLE_PAGE = 40;          // recettes affichées à la fois dans la liste
export const PORTIONS_MIN = 1;
export const PORTIONS_MAX = 12;

// Les deux personnes de l'appli (marqueurs « E » bleu et « M » rose).
export const PERSONNES = {
  E: { prenom: 'Eymric', couleur: '#2f6fdb' },
  M: { prenom: 'Marie', couleur: '#e0489a' },
};

// Nombre de convives pour les courses (le couple). Les quantités des recettes sont recalculées pour ce nombre.
export const NB_CONVIVES = 2;
