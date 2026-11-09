// Profil de la personne qui utilise ce téléphone. Mode local : tout reste sur l'appareil
// (les données de santé ne vont jamais dans le dépôt).
import { lire, ecrire } from './stockage.js';
import { profilVide } from '../lib/profils.js';

export const chargerMoi = () => { const v = lire('moi', null); return v === 'E' || v === 'M' ? v : null; };
export const enregistrerMoi = (id) => ecrire('moi', id);

/** Profil enregistré, complété par les valeurs par défaut pour les champs ajoutés depuis. */
export function chargerProfil(id) {
  return { ...profilVide(id), ...lire(`profil.${id}`, {}) };
}
export const enregistrerProfil = (p) => ecrire(`profil.${p.id}`, p);
