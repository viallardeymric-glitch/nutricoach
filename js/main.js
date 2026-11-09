// Point d'entrée : routage par ancre, connexion, verrou PIN, et état partagé (profil, favoris, menus) avec synchro.
import { html, render, useState, useEffect, useMemo, useRef } from '../vendor/preact-htm.js';
import { TAILLE_PAGE, PERSONNES } from './core/config.js';
import { chargerIndex } from './core/catalogue.js';
import { chargerFavoris, basculerFavori } from './core/favoris.js';
import { lire, ecrire } from './core/stockage.js';
import { chargerMoi, enregistrerMoi, chargerProfil, enregistrerProfil } from './core/profil.js';
import { useSession } from './core/session.js';
import { ecrireDoc, supprimerDoc, deconnecter } from './core/nuage.js';
import { idFavori, donneesFavori, favorisParRecette, profilVersDoc, choisirVersion, jourVersDoc } from './core/synchro.js';
import { chargerPin, enregistrerPin, retirerPin, creerPin, doitVerrouiller } from './core/pin.js';
import { FILTRES_VIDES } from './lib/recettes.js';
import { calculerBesoins } from './lib/besoins.js';
import { profilComplet } from './lib/profils.js';
import { contraintesCouple, semaineDe, nomJour, REPAS, saisonDe } from './lib/planning.js';
import { BarreOnglets } from './ui/composants.js';
import { Accueil } from './views/accueil.js';
import { Liste } from './views/liste.js';
import { Semaine } from './views/semaine.js';
import { Coach } from './views/coach.js';
import { Fiche } from './views/fiche.js';
import { Cuisine } from './views/cuisine.js';
import { Profil, ChoixPersonne } from './views/profil.js';
import { Connexion } from './views/connexion.js';
import { Verrou } from './views/verrou.js';
import { NousDeux } from './views/nous-deux.js';

/**
 * Écran courant d'après l'ancre. Retourne { ecran, id?, portions?, section? } avec ecran parmi
 * accueil, recettes, favoris, semaine, coach, nous, profil, fiche, cuisine.
 */
export function lireRoute(hash) {
  const [chemin, requete = ''] = hash.split('?');
  let m = chemin.match(/^#\/recette\/(REC-\d+)$/);
  if (m) return { ecran: 'fiche', id: m[1] };
  m = chemin.match(/^#\/cuisine\/(REC-\d+)$/);
  if (m) return { ecran: 'cuisine', id: m[1], portions: Math.min(20, Math.max(1, Number(new URLSearchParams(requete).get('p')) || 2)) };
  m = chemin.match(/^#\/profil(?:\/([a-z]+))?$/);
  if (m) return { ecran: 'profil', section: m[1] || null };
  const simples = { '#/recettes': 'recettes', '#/favoris': 'favoris', '#/semaine': 'semaine', '#/coach': 'coach', '#/nous': 'nous' };
  return { ecran: simples[chemin] || 'accueil' };
}
const ONGLET_DE = { accueil: 'accueil', nous: 'accueil', recettes: 'recettes', favoris: 'recettes', semaine: 'semaine', coach: 'coach', profil: 'profil' };

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
const ONGLETS = [
  { id: 'accueil', href: '#/', icone: '🏠', nom: 'Accueil' },
  { id: 'recettes', href: '#/recettes', icone: '🍽️', nom: 'Recettes' },
  { id: 'semaine', href: '#/semaine', icone: '📅', nom: 'Semaine' },
  { id: 'coach', href: '#/coach', icone: '💬', nom: 'Coach' },
  { id: 'profil', href: '#/profil', icone: '👤', nom: 'Profil' },
];

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
  const [planLocal, setPlanLocal] = useState(() => lire('planning', {}));
  const [pin, setPin] = useState(chargerPin);
  const [verrouille, setVerrouille] = useState(() => chargerPin() !== null);
  const profilRef = useRef(profil);
  profilRef.current = profil;
  const minuterie = useRef(null);
  const masqueA = useRef(null);

  useEffect(() => { chargerIndex().then(setIndex).catch(() => setErreur(true)); }, []);
  const surListe = route.ecran === 'recettes' || route.ecran === 'favoris';
  useEffect(() => { window.scrollTo(0, surListe ? defilSauvegarde : 0); }, [route.ecran, route.section]);

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

  // --- Menus : partagés dans le couple (un document par jour) ; hors compte, gardés sur le téléphone.
  const plan = connecte && session.planningNuage ? session.planningNuage : planLocal;
  const ecrireJours = (changes) => {
    if (connecte) {
      for (const [date, repas] of Object.entries(changes)) {
        (Object.keys(repas).length ? ecrireDoc('planning', date, jourVersDoc(date, repas)) : supprimerDoc('planning', date)).catch(() => {});
      }
    } else {
      setPlanLocal((p) => {
        const s = { ...p };
        for (const [date, repas] of Object.entries(changes)) { if (Object.keys(repas).length) s[date] = repas; else delete s[date]; }
        ecrire('planning', s);
        return s;
      });
    }
  };
  // Les menus respectent les contraintes des DEUX personnes quand le profil de l'autre est connu.
  const autre = moi === 'E' ? 'M' : 'E';
  const profilAutre = connecte && session.profils ? session.profils[autre] : null;
  const contraintes = useMemo(() => contraintesCouple([profil, profilAutre]), [profil, profilAutre]);
  const besoins = profil && profilComplet(profil) ? calculerBesoins(profil) : null;
  const besoinsAutre = profilAutre && profilComplet(profilAutre) ? calculerBesoins(profilAutre) : null;
  const cibleKcal = besoins && besoinsAutre ? Math.round((besoins.cible + besoinsAutre.cible) / 2) : (besoins || besoinsAutre || { cible: 2000 }).cible;
  const recettes = index ? index.recettes : null;
  const repasSemaine = useMemo(() => {
    if (!recettes) return [];
    const parId = new Map(recettes.map((r) => [r.id, r.titre]));
    return semaineDe(new Date()).flatMap((j) => REPAS.filter((rp) => plan[j] && plan[j][rp.id])
      .map((rp) => `${nomJour(new Date(j + 'T12:00:00'))} ${rp.nom.toLowerCase()} : ${parId.get(plan[j][rp.id]) || '?'}`));
  }, [recettes, plan]);

  // --- Écrans qui remplacent l'appli : verrou, chargement, connexion, choix de la personne.
  if (verrouille && pin) return html`<${Verrou} enreg=${pin} onDeverrouiller=${() => setVerrouille(false)} />`;
  if (session.statut === 'chargement') return html`<p class="etat">Chargement…</p>`;
  if (session.statut === 'deconnecte' || session.statut === 'erreur') {
    return html`<${Connexion} statut=${session.statut} onReessayer=${() => location.reload()} />`;
  }
  if (!moi) return html`<${ChoixPersonne} onChoisir=${changerMoi} />`;

  const plein = route.ecran === 'fiche' || route.ecran === 'cuisine';
  const personnes = profilAutre ? ['E', 'M'] : [moi];
  return html`
    <div hidden=${!surListe}>
      <${Liste} index=${index} erreur=${erreur} f=${f} setF=${setF} favoris=${favorisMiens} favorisTous=${favorisTous} favorisPar=${favorisPar}
        onFavori=${onFavori} favorisSeulement=${route.ecran === 'favoris'} onOuvrir=${() => { defilSauvegarde = window.scrollY; }}
        moi=${moi} profil=${profil} onAppliquerProfil=${() => changerProfil({ ...profil, appliquer: profil.appliquer === false })} />
    </div>
    ${route.ecran === 'accueil' && html`<${Accueil} moi=${moi} profil=${profil} besoins=${besoins} index=${recettes} plan=${plan}
      contraintes=${contraintes} cibleKcal=${cibleKcal} changerJour=${(d, r) => ecrireJours({ [d]: r })} nuage=${session.actif} nbFavoris=${favorisTous.size} />`}
    ${route.ecran === 'semaine' && html`<${Semaine} index=${recettes} plan=${plan} contraintes=${contraintes} cibleKcal=${cibleKcal}
      ecrireJours=${ecrireJours} profil=${profil} personnes=${personnes} />`}
    ${route.ecran === 'coach' && html`<${Coach} profil=${profil} besoins=${besoins} prenom=${PERSONNES[moi].prenom}
      repasSemaine=${repasSemaine} saison=${saisonDe(new Date())} />`}
    ${route.ecran === 'nous' && html`<${NousDeux} moi=${moi} profils=${session.profils} favorisNuage=${session.favorisNuage}
      erreurSynchro=${session.erreurSynchro} />`}
    ${route.ecran === 'profil' && html`<${Profil} moi=${moi} profil=${profil} onMoi=${changerMoi} onChange=${changerProfil} section=${route.section}
      compte=${{ actif: session.actif, email: session.email, onDeconnecter: () => deconnecter() }}
      pin=${{ defini: Boolean(pin), onDefinir: async (code) => { const e = await creerPin(code); enregistrerPin(e); setPin(e); },
        onRetirer: () => { retirerPin(); setPin(null); setVerrouille(false); } }} />`}
    ${route.ecran === 'fiche' && html`<${Fiche} id=${route.id} index=${index} favori=${favorisMiens.has(route.id)}
      onFavori=${() => onFavori(route.id)} moi=${moi} profil=${profil} />`}
    ${route.ecran === 'cuisine' && html`<${Cuisine} id=${route.id} index=${index} portions=${route.portions} />`}
    ${!plein && html`<${BarreOnglets} onglets=${ONGLETS} actif=${ONGLET_DE[route.ecran]} />`}`;
}

const racine = document.getElementById('app');
racine.textContent = ''; // retire le « Chargement… » de départ
render(html`<${App} />`, racine);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
