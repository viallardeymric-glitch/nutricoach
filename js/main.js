// Point d'entrée : routage par ancre, état partagé (filtres, favoris), enregistrement du service worker.
import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { TAILLE_PAGE } from './core/config.js';
import { chargerIndex } from './core/catalogue.js';
import { chargerFavoris, basculerFavori } from './core/favoris.js';
import { FILTRES_VIDES } from './lib/recettes.js';
import { BarreOnglets } from './ui/composants.js';
import { Liste } from './views/liste.js';
import { Fiche } from './views/fiche.js';

// Onglets de la barre du bas. Les autres écrans (Accueil, Planning, Courses, Suivi, Scanner, Plus)
// s'ajouteront ici au fil des phases.
const ONGLETS = [
  { id: 'recettes', href: '#/', icone: '🍽️', nom: 'Recettes' },
  { id: 'favoris', href: '#/favoris', icone: '♥', nom: 'Favoris' },
];

/** Écran courant d'après l'ancre : { ecran: 'recettes' | 'favoris' | 'fiche', id? }. */
function lireRoute(hash) {
  const m = hash.match(/^#\/recette\/(REC-\d+)$/);
  if (m) return { ecran: 'fiche', id: m[1] };
  if (hash === '#/favoris') return { ecran: 'favoris' };
  return { ecran: 'recettes' };
}

function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return lireRoute(hash);
}

let defilSauvegarde = 0; // position de la liste, retrouvée au retour d'une fiche

function App() {
  const route = useRoute();
  const [index, setIndex] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [favoris, setFavoris] = useState(chargerFavoris);
  const [f, setF] = useState({ ...FILTRES_VIDES, ouvert: false, nb: TAILLE_PAGE });

  useEffect(() => { chargerIndex().then(setIndex).catch(() => setErreur(true)); }, []);
  useEffect(() => { window.scrollTo(0, route.ecran === 'fiche' ? 0 : defilSauvegarde); }, [route.ecran]);

  const onFavori = (id) => setFavoris((s) => basculerFavori(s, id));
  const surFiche = route.ecran === 'fiche';
  return html`
    <div hidden=${surFiche}>
      <${Liste} index=${index} erreur=${erreur} f=${f} setF=${setF} favoris=${favoris} onFavori=${onFavori}
        favorisSeulement=${route.ecran === 'favoris'} onOuvrir=${() => { defilSauvegarde = window.scrollY; }} />
    </div>
    ${surFiche && html`<${Fiche} id=${route.id} index=${index} favori=${favoris.has(route.id)}
      onFavori=${() => onFavori(route.id)} />`}
    ${!surFiche && html`<${BarreOnglets} onglets=${ONGLETS} actif=${route.ecran} />`}`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
