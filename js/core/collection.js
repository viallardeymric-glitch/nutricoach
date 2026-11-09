// Une collection de documents du foyer, avec la même interface en mode local (téléphone) et en mode nuage (Firestore).
import { useState, useMemo } from '../../vendor/preact-htm.js';
import { lire, ecrire as sauver } from './stockage.js';
import { ecrireDoc, supprimerDoc } from './nuage.js';

/**
 * `docsNuage` : documents reçus de Firestore (null tant que rien n'est reçu). Retourne { items, ecrire, supprimer }.
 * En mode nuage, les écritures partent tout de suite (même hors ligne : le cache les met en attente) et l'écran se met à jour
 * par l'écoute en direct ; en mode local, elles sont gardées sur le téléphone.
 */
export function useCollection(nom, docsNuage, connecte) {
  const [local, setLocal] = useState(() => lire(`col.${nom}`, {}));
  const nuage = connecte && docsNuage;
  const items = useMemo(() => (nuage ? docsNuage : Object.entries(local).map(([id, d]) => ({ ...d, id: d.id || id }))), [nuage, docsNuage, local]);
  const ecrire = (id, donnees) => {
    if (connecte) ecrireDoc(nom, id, donnees).catch(() => {});
    else setLocal((l) => { const s = { ...l, [id]: donnees }; sauver(`col.${nom}`, s); return s; });
  };
  const supprimer = (id) => {
    if (connecte) supprimerDoc(nom, id).catch(() => {});
    else setLocal((l) => { const { [id]: _, ...reste } = l; sauver(`col.${nom}`, reste); return reste; });
  };
  return { items, ecrire, supprimer };
}
