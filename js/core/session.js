// État du compte et des données partagées : connexion, profils des deux personnes, favoris du couple.
import { useState, useEffect } from '../../vendor/preact-htm.js';
import * as nuage from './nuage.js';
import { docsVersFavoris, docVersProfil, docsVersPlan } from './synchro.js';

export function useSession() {
  const actif = nuage.nuageActif();
  const [statut, setStatut] = useState(actif ? 'chargement' : 'local'); // chargement | deconnecte | connecte | erreur | local
  const [email, setEmail] = useState(null);
  const [profils, setProfils] = useState(null);           // null tant que rien n'est reçu, puis { E, M }
  const [favorisNuage, setFavorisNuage] = useState(null); // null tant que rien n'est reçu, puis [{ recette, par }]
  const [planningNuage, setPlanningNuage] = useState(null);   // null tant que rien n'est reçu, puis { date: { dejeuner, diner } }
  const [docsCourses, setDocsCourses] = useState(null);       // documents bruts, null tant que rien n'est reçu
  const [docsStock, setDocsStock] = useState(null);
  const [docsScans, setDocsScans] = useState(null);
  const [erreurSynchro, setErreurSynchro] = useState(false);

  useEffect(() => {
    if (!actif) return undefined;
    let ferme = false;
    let arret = () => {};
    nuage.ecouterConnexion((u) => { setEmail(u ? u.email : null); setStatut(u ? 'connecte' : 'deconnecte'); }, () => setStatut('erreur'))
      .then((a) => { if (ferme) a(); else arret = a; })
      .catch(() => setStatut('erreur'));
    return () => { ferme = true; arret(); };
  }, []);

  useEffect(() => {
    if (statut !== 'connecte') { setProfils(null); setFavorisNuage(null); setPlanningNuage(null); setDocsCourses(null); setDocsStock(null); setDocsScans(null); return undefined; }
    const erreur = () => setErreurSynchro(true);
    const a1 = nuage.ecouterCollection('profiles', (docs) => {
      setErreurSynchro(false);
      const m = { E: null, M: null };
      for (const d of docs) if (d.id === 'E' || d.id === 'M') m[d.id] = docVersProfil(d.id, d);
      setProfils(m);
    }, erreur);
    const a2 = nuage.ecouterCollection('favorites', (docs) => setFavorisNuage(docsVersFavoris(docs)), erreur);
    const a3 = nuage.ecouterCollection('planning', (docs) => setPlanningNuage(docsVersPlan(docs)), erreur);
    const a4 = nuage.ecouterCollection('shoppingLists', setDocsCourses, erreur);
    const a5 = nuage.ecouterCollection('pantry', setDocsStock, erreur);
    const a6 = nuage.ecouterCollection('scans', setDocsScans, erreur);
    return () => { a1(); a2(); a3(); a4(); a5(); a6(); };
  }, [statut]);

  return { actif, statut, email, profils, favorisNuage, planningNuage, docsCourses, docsStock, docsScans, erreurSynchro };
}
