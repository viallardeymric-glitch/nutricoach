// Normalisation pour la recherche : sans accents, sans majuscules, œ → oe.
export function normaliser(s) {
  return String(s).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
