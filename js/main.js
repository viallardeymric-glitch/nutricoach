// Point d'entrée : routage par ancre, état partagé (filtres, favoris), enregistrement du service worker.
import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { TAILLE_PAGE } from './core/config.js';
import { chargerIndex } from './core/catalogue.js';
import { chargerFavoris, basculerFavori } from './core/favoris.js';
import { chargerMoi, enregistrerMoi, chargerProfil, enregistrerProfil } from './core/profil.js';
import { FILTRES_VIDES } from './lib/recettes.js';
import { BarreOnglets } from './ui/composants.js';
import { Liste } from './views/liste.js';
import { Fiche } from './views/fiche.js';
import { Profil } from './views/profil.js';

// Onglets de la barre du bas. Les autres écrans (Accueil, Planning, Courses, Suivi, Scanner, Plus)
// s'ajouteront ici au fil des phases.
const ONGLETS = [
  { id: 'recettes', href: '#/', icone: '🍽️', nom: 'Recettes' },
  { id: 'favoris', href: '#/favoris', icone: '♥', nom: 'Favoris' },
  { id: 'profil', href: '#/profil', icone: '👤', nom: 'Profil' },
];

/** Écran courant d'après l'ancre : { ecran: 'recettes' | 'favoris' | 'profil' | 'fiche', id? }. */
function lireRoute(hash) {
  const m = hash.match(/^#\/recette\/(REC-\d+)$/);
  if (m) return { ecran: 'fiche', id: m[1] };
  if (hash === '#/favoris') return { ecran: 'favoris' };
  if (hash === '#/profil') return { ecran: 'profil' };
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
  const [moi, setMoi] = useState(chargerMoi);
  const [profil, setProfil] = useState(() => (chargerMoi() ? chargerProfil(chargerMoi()) : null));

  useEffect(() => { chargerIndex().then(setIndex).catch(() => setErreur(true)); }, []);
  const surListe = route.ecran === 'recettes' || route.ecran === 'favoris';
  useEffect(() => { window.scrollTo(0, surListe ? defilSauvegarde : 0); }, [route.ecran]);

  const changerMoi = (id) => { enregistrerMoi(id); setMoi(id); setProfil(chargerProfil(id)); };
  const changerProfil = (p) => { enregistrerProfil(p); setProfil(p); };

  const onFavori = (id) => setFavoris((s) => basculerFavori(s, id));
  const surFiche = route.ecran === 'fiche';
  return html`
    <div hidden=${!surListe}>
      <${Liste} index=${index} erreur=${erreur} f=${f} setF=${setF} favoris=${favoris} onFavori=${onFavori}
        favorisSeulement=${route.ecran === 'favoris'} onOuvrir=${() => { defilSauvegarde = window.scrollY; }}
        moi=${moi} profil=${profil} onAppliquerProfil=${() => changerProfil({ ...profil, appliquer: profil.appliquer === false })} />
    </div>
    ${route.ecran === 'profil' && html`<${Profil} moi=${moi} profil=${profil} onMoi=${changerMoi} onChange=${changerProfil} />`}
    ${surFiche && html`<${Fiche} id=${route.id} index=${index} favori=${favoris.has(route.id)}
      onFavori=${() => onFavori(route.id)} moi=${moi} profil=${profil} />`}
    ${!surFiche && html`<${BarreOnglets} onglets=${ONGLETS} actif=${route.ecran} />`}`;
}

const racine = document.getElementById('app');
racine.textContent = ''; // retire le « Chargement… » de départ
render(html`<${App} />`, racine);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
