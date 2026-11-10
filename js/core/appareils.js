// Appareils de cuisine du foyer (utilisés par le batch cooking et la version Thermomix).
import { lire, ecrire } from './stockage.js';

export const MODELES_THERMOMIX = ['TM6', 'TM5', 'TM31'];
export const APPAREILS_DEFAUT = { plaques: 3, four: true, thermomix: false, modele: 'TM6', cookeo: false, airfryer: false, multicuiseur: false };
export const chargerAppareils = () => ({ ...APPAREILS_DEFAUT, ...lire('appareils', {}) });
export const enregistrerAppareils = (a) => ecrire('appareils', a);
