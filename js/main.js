// Point d'entrée : routage par ancre, connexion, verrou PIN, état partagé (filtres, favoris, profil) et synchro.
import { html, render, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { TAILLE_PAGE } from './core/config.js';
import { chargerIndex } from './core/catalogue.js';
import { chargerFavoris, basculerFavori } from './core/favoris.js';
import { lire, ecrire } from './core/stockage.js';
import { chargerMoi, enregistrerMoi, chargerProfil, enregistrerProfil } from './core/profil.js';
import { useSession } from './core/session.js';
import { ecrireDoc, supprimerDoc, deconnecter } from './core/nuage.js';
import { idFavori, donneesFavori, favorisParRecette, profilVersDoc, choisirVersion } from './core/synchro.js';
import { chargerPin, enregistrerPin, retirerPin, creerPin, doitVerrouiller } from './core/pin.js';
import { FILTRES_VIDES } from './lib/recettes.js';
import { BarreOnglets } from './ui/composants.js';
import { Liste } from './views/liste.js';
import { Fiche } from './views/fiche.js';
import { Profil, ChoixPersonne } from './views/profil.js';
import { Connexion } from './views/connexion.js';
import { Verrou } from './views/verrou.js';
import { NousDeux } from './views/nous-deux.js';

/** Écran courant d'après l'ancre : { ecran: 'recettes' | 'favoris' | 'nous' | 'profil' | 'fiche', id? }. */
function lireRoute(hash) {
  const m = hash.match(/^#\/recette\/(REC-\d+)$/);
  if (m) return { ecran: 'fiche', id: m[1] };
  if (hash === '#/favoris') return { ecran: 'favoris' };
  if (hash === '#/nous') return { ecran: 'nous' };
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
  const session = useSession();
  const connecte = session.statut === 'connecte';

  const [index, setIndex] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [f, setF] = useState({ ...FILTRES_VIDES, ouvert: false, nb: TAILLE_PAGE });
  const [moi, setMoi] = useState(chargerMoi);
  const [profil, setProfil] = useState(() => (chargerMoi() ? chargerProfil(chargerMoi()) : null));
  const [favorisLocaux, setFavorisLocaux] = useState(chargerFavoris);
  const [pin, setPin] = useState(chargerPin);
  const [verrouille, setVerrouille] = useState(() => chargerPin() !== null);
  const profilRef = useRef(profil);
  profilRef.current = profil;
  const minuterie = useRef(null);
  const masqueA = useRef(null);

  useEffect(() => { chargerIndex().then(setIndex).catch(() => setErreur(true)); }, []);
  const surListe = route.ecran === 'recettes' || route.ecran === 'favoris';
  useEffect(() => { window.scrollTo(0, surListe ? defilSauvegarde : 0); }, [route.ecran]);

  // Reverrouillage après 1 minute en arrière-plan.
  useEffect(() => {
    const f2 = () => {
      if (document.visibilityState === 'hidden') masqueA.current = Date.now();
      else if (pin && doitVerrouiller(masqueA.current, Date.now())) setVerrouille(true);
    };
    document.addEventListener('visibilitychange', f2);
    return () => document.removeEventListener('visibilitychange', f2);
  }, [pin]);

  // --- Profil : local d'abord, puis synchronisé ; en cas de désaccord la modification la plus récente gagne.
  const changerMoi = (id) => { enregistrerMoi(id); setMoi(id); setProfil(chargerProfil(id)); };
  const changerProfil = (p) => {
    const suivant = { ...p, modifie: Date.now() };
    enregistrerProfil(suivant); setProfil(suivant);
    if (connecte && moi) {
      clearTimeout(minuterie.current);
      minuterie.current = setTimeout(() => ecrireDoc('profiles', moi, profilVersDoc(suivant)).catch(() => {}), 700);
    }
  };
  useEffect(() => {
    if (!connecte || !moi || !session.profils) return;
    const local = profilRef.current;
    const v = choisirVersion(local, session.profils[moi]);
    if (v === 'nuage') { enregistrerProfil(session.profils[moi]); setProfil(session.profils[moi]); }
    else if (v === 'local' && local.modifie > 0) ecrireDoc('profiles', moi, profilVersDoc(local)).catch(() => {});
  }, [session.profils, moi, connecte]);

  // --- Favoris : ceux du couple viennent du nuage ; hors compte, ils restent sur le téléphone.
  const nuageFavoris = connecte && moi && session.favorisNuage;
  const favorisMiens = nuageFavoris
    ? new Set(session.favorisNuage.filter((x) => x.par === moi).map((x) => x.recette)) : favorisLocaux;
  const favorisPar = nuageFavoris
    ? favorisParRecette(session.favorisNuage) : new Map([...favorisLocaux].map((id) => [id, moi ? [moi] : []]));
  const favorisTous = new Set(favorisPar.keys());
  const onFavori = (id) => {
    if (connecte && moi) {
      const op = favorisMiens.has(id) ? supprimerDoc('favorites', idFavori(id, moi)) : ecrireDoc('favorites', idFavori(id, moi), donneesFavori(id, moi));
      op.catch(() => {});
    } else setFavorisLocaux((s) => basculerFavori(s, id));
  };
  // Première connexion : les favoris déjà gardés sur ce téléphone rejoignent le nuage.
  useEffect(() => {
    if (!nuageFavoris || lire('favoris.migres', false)) return;
    for (const id of favorisLocaux) if (!favorisMiens.has(id)) ecrireDoc('favorites', idFavori(id, moi), donneesFavori(id, moi)).catch(() => {});
    ecrire('favoris.migres', true);
  }, [nuageFavoris]);

  // --- Écrans qui remplacent l'appli : verrou, chargement, connexion, choix de la personne.
  if (verrouille && pin) return html`<${Verrou} enreg=${pin} onDeverrouiller=${() => setVerrouille(false)} />`;
  if (session.statut === 'chargement') return html`<p class="etat">Chargement…</p>`;
  if (session.statut === 'deconnecte' || session.statut === 'erreur') {
    return html`<${Connexion} statut=${session.statut} onReessayer=${() => location.reload()} />`;
  }
  if (!moi) return html`<${ChoixPersonne} onChoisir=${changerMoi} />`;

  const onglets = [
    { id: 'recettes', href: '#/', icone: '🍽️', nom: 'Recettes' },
    { id: 'favoris', href: '#/favoris', icone: '♥', nom: 'Favoris' },
    ...(session.actif ? [{ id: 'nous', href: '#/nous', icone: '👫', nom: 'Nous deux' }] : []),
    { id: 'profil', href: '#/profil', icone: '👤', nom: 'Profil' },
  ];
  const surFiche = route.ecran === 'fiche';
  return html`
    <div hidden=${!surListe}>
      <${Liste} index=${index} erreur=${erreur} f=${f} setF=${setF} favoris=${favorisMiens} favorisTous=${favorisTous} favorisPar=${favorisPar}
        onFavori=${onFavori} favorisSeulement=${route.ecran === 'favoris'} onOuvrir=${() => { defilSauvegarde = window.scrollY; }}
        moi=${moi} profil=${profil} onAppliquerProfil=${() => changerProfil({ ...profil, appliquer: profil.appliquer === false })} />
    </div>
    ${route.ecran === 'nous' && html`<${NousDeux} moi=${moi} profils=${session.profils} favorisNuage=${session.favorisNuage}
      erreurSynchro=${session.erreurSynchro} />`}
    ${route.ecran === 'profil' && html`<${Profil} moi=${moi} profil=${profil} onMoi=${changerMoi} onChange=${changerProfil}
      compte=${{ actif: session.actif, email: session.email, onDeconnecter: () => deconnecter() }}
      pin=${{ defini: Boolean(pin), onDefinir: async (code) => { const e = await creerPin(code); enregistrerPin(e); setPin(e); },
        onRetirer: () => { retirerPin(); setPin(null); setVerrouille(false); } }} />`}
    ${surFiche && html`<${Fiche} id=${route.id} index=${index} favori=${favorisMiens.has(route.id)}
      onFavori=${() => onFavori(route.id)} moi=${moi} profil=${profil} />`}
    ${!surFiche && html`<${BarreOnglets} onglets=${onglets} actif=${route.ecran} />`}`;
}

const racine = document.getElementById('app');
racine.textContent = ''; // retire le « Chargement… » de départ
render(html`<${App} />`, racine);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
