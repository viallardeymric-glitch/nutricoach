// Alertes de profil sur un aliment (courses, journal, scan) : allergies, aliments évités, aliments déconseillés.
import { normaliser } from './texte.js';
import { REGLES_ALERTE, MOTS_ALLERGENES, allergenesDansTexte } from '../data/deconseilles.js';
import { risquesPour, listeExclusions } from './profils.js';
import { ALLERGENES, lib } from '../data/libelles.js';

/**
 * Alertes pour un texte (nom d'article, ingrédients, catégories d'un produit) et un profil.
 * Retourne [{ id, niveau: 'rouge' | 'orange', raison, source }] : les rouges d'abord. Tableau vide si profil absent.
 */
export function alertesTexte(texte, profil) {
  if (!profil || profil.appliquer === false) return [];
  const t = ` ${normaliser(texte)} `;
  const risques = risquesPour(profil);
  const res = [];
  const detectes = allergenesDansTexte(t);
  for (const a of profil.allergenes || []) {
    if (MOTS_ALLERGENES[a] && detectes.includes(a)) {
      res.push({ id: `allergie-${a}`, niveau: 'rouge', source: 'profil', raison: `Contient probablement du ${lib(ALLERGENES, a).toLowerCase()}, que vous évitez.` });
    }
  }
  for (const x of listeExclusions(profil.exclusions)) {
    if (t.includes(x)) res.push({ id: `exclusion-${x}`, niveau: 'orange', source: 'profil', raison: `Contient « ${x} », un aliment que vous évitez.` });
  }
  for (const r of REGLES_ALERTE) {
    if (!r.profils.some((p) => risques.includes(p))) continue;
    if (r.exclure && r.exclure.test(t)) continue;
    if (r.motif.test(t)) res.push({ id: r.id, niveau: r.niveau, source: r.source, raison: r.raison });
  }
  const alcool = REGLES_ALERTE.find((r) => r.id === 'alcool');
  if ((profil.secondaires || []).includes('alcool') && !res.some((x) => x.id === 'alcool') && alcool.motif.test(t) && !alcool.exclure.test(t)) {
    res.push({ id: 'obj-alcool', niveau: 'orange', source: 'profil', raison: 'Alcool : vous avez choisi d\'en réduire la consommation.' });
  }
  return res.sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === 'rouge' ? -1 : 1));
}

export const pireNiveau = (alertes) => (alertes.some((a) => a.niveau === 'rouge') ? 'rouge' : alertes.length ? 'orange' : null);
