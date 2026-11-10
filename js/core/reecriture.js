// Réécriture d'une recette pour une autre méthode de cuisson par l'IA : proposition à vérifier, gardée sur le téléphone.
import { lire, ecrire } from './stockage.js';
import { chargerReglagesCoach, demanderJSONRapide } from './coach.js';
import { CONSIGNE_REECRITURE, promptReecriture, lireReecriture } from '../lib/methodes.js';

const cle = (id, methode, modele) => `${id}|${methode}${methode === 'thermomix' ? '|' + modele : ''}`;
export const chargerReecriture = (id, methode, modele) => (lire('reecritures', {}) || {})[cle(id, methode, modele)] || null;
function enregistrer(id, methode, modele, valeur) {
  const tout = lire('reecritures', {}) || {};
  tout[cle(id, methode, modele)] = valeur;
  const cles = Object.keys(tout);
  if (cles.length > 40) delete tout[cles[0]];     // on garde les 40 plus récentes
  ecrire('reecritures', tout);
}

/** Demande la réécriture à l'IA (ou la retrouve hors ligne). Retourne { etapes, remarques, date }. */
export async function reecrire(recette, methode, modele = 'TM6', appeler = fetch) {
  const dejaFaite = chargerReecriture(recette.id, methode, modele);
  if (dejaFaite) return dejaFaite;
  const reg = chargerReglagesCoach();
  const texte = await demanderJSONRapide({ reg, systeme: CONSIGNE_REECRITURE, message: promptReecriture(recette, methode, modele) }, appeler);
  const res = lireReecriture(texte);
  if (!res) throw new Error('La réponse de l\'IA n\'est pas exploitable. Réessayez.');
  if (!res.etapes.length) throw new Error(res.remarques[0] || 'Cette recette ne s\'adapte pas à cette méthode.');
  const valeur = { ...res, date: new Date().toISOString().slice(0, 10) };
  enregistrer(recette.id, methode, modele, valeur);
  return valeur;
}
export function oublierReecriture(id, methode, modele) {
  const tout = lire('reecritures', {}) || {};
  delete tout[cle(id, methode, modele)];
  ecrire('reecritures', tout);
}
