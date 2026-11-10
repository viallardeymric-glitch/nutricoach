// Point d'entrée : routage par ancre, connexion, verrou PIN, et état partagé (profil, favoris, menus) avec synchro.
import { html, render, useState, useEffect, useMemo, useRef } from '../vendor/preact-htm.js';
import { TAILLE_PAGE, PERSONNES } from './core/config.js';
import { chargerIndex } from './core/catalogue.js';
import { chargerFavoris, basculerFavori } from './core/favoris.js';
import { lire, ecrire } from './core/stockage.js';
import { chargerMoi, enregistrerMoi, chargerProfil, enregistrerProfil } from './core/profil.js';
import { useSession } from './core/session.js';
import { ecrireDoc, supprimerDoc, deconnecter } from './core/nuage.js';
import { idFavori, donneesFavori, favorisParRecette, profilVersDoc, choisirVersion, jourVersDoc, articleVersDoc, listeVersDoc, docsVersCourses, idDocArticle, idDocStock, stockVersDoc, docsVersStock, scanVersDoc, docsVersScans, seanceVersDoc, docsVersSeances, journalVersDoc, docsVersJournal, poidsVersDoc, docsVersPoids, idDocPoids, visiblePour, enfantVersDoc, docsVersEnfants } from './core/synchro.js';
import { useCollection } from './core/collection.js';
import { chargerPin, enregistrerPin, retirerPin, creerPin, doitVerrouiller } from './core/pin.js';
import { FILTRES_VIDES } from './lib/recettes.js';
import { calculerBesoins } from './lib/besoins.js';
import { profilComplet, nombreConvives, kcalRepereEnfant } from './lib/profils.js';
import { contraintesCouple, semaineDe, nomJour, REPAS, saisonDe } from './lib/planning.js';
import { cleArticle, ajouterAuStock } from './lib/courses.js';
import { entreeDepuisRecette, entreeDepuisProduit, repasSelonHeure, bilanJour, objectifEau, serieDePoids } from './lib/suivi.js';
import { cleDate } from './lib/planning.js';
import { rayonDe } from './data/rayons.js';
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
import { Courses } from './views/courses.js';
import { Suivi } from './views/suivi.js';
import { Sport } from './views/sport.js';
import { planNutritionnel, FILTRES_SPORT } from './lib/sport.js';
import { Scanner, Produit, Historique } from './views/scanner.js';
import { Plus, appliquerTheme } from './views/plus.js';

/**
 * Écran courant d'après l'ancre. Retourne { ecran, id?, portions?, section? } avec ecran parmi
 * accueil, recettes, favoris, semaine, courses, suivi, sport, scan, produit, scans, plus, sources, coach, nous, profil, fiche, cuisine.
 */
export function lireRoute(hash) {
  const [chemin, requete = ''] = hash.split('?');
  let m = chemin.match(/^#\/recette\/(REC-\d+)$/);
  if (m) return { ecran: 'fiche', id: m[1] };
  m = chemin.match(/^#\/cuisine\/(REC-\d+)$/);
  if (m) return { ecran: 'cuisine', id: m[1], portions: Math.min(20, Math.max(1, Number(new URLSearchParams(requete).get('p')) || 2)) };
  m = chemin.match(/^#\/produit\/(\d{8,14})$/);
  if (m) return { ecran: 'produit', code: m[1] };
  m = chemin.match(/^#\/profil(?:\/([a-z]+))?$/);
  if (m) return { ecran: 'profil', section: m[1] || null };
  const simples = { '#/recettes': 'recettes', '#/favoris': 'favoris', '#/semaine': 'semaine', '#/courses': 'courses', '#/suivi': 'suivi', '#/sport': 'sport', '#/scan': 'scan', '#/scans': 'scans', '#/plus': 'plus', '#/sources': 'sources', '#/coach': 'coach', '#/nous': 'nous' };
  return { ecran: simples[chemin] || 'accueil' };
}
const ONGLET_DE = { accueil: 'accueil', recettes: 'recettes', favoris: 'recettes', semaine: 'semaine', courses: 'courses', suivi: 'suivi', sport: 'plus', scan: 'scan', produit: 'scan', scans: 'scan',
  plus: 'plus', sources: 'plus', coach: 'plus', nous: 'plus', profil: 'plus' };

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
  { id: 'semaine', href: '#/semaine', icone: '📅', nom: 'Planning' },
  { id: 'scan', href: '#/scan', icone: '📷', nom: 'Scanner', centre: true },
  { id: 'courses', href: '#/courses', icone: '🛒', nom: 'Courses' },
  { id: 'suivi', href: '#/suivi', icone: '📈', nom: 'Suivi' },
  { id: 'plus', href: '#/plus', icone: '☰', nom: 'Plus' },
];
const nouvelId = () => 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

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
  useEffect(() => { appliquerTheme(lire('theme', 'lagon')); }, []);
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
  // --- Courses, stock et scans : un document par article / produit, partagés dans le couple.
  const colCourses = useCollection('shoppingLists', session.docsCourses, connecte);
  const colStock = useCollection('pantry', session.docsStock, connecte);
  const colScans = useCollection('scans', session.docsScans, connecte);
  const donneesCourses = useMemo(() => docsVersCourses(colCourses.items), [colCourses.items]);
  const stock = useMemo(() => docsVersStock(colStock.items), [colStock.items]);
  const scans = useMemo(() => docsVersScans(colScans.items), [colScans.items]);
  const opsCourses = {
    ecrireArticle: (a) => colCourses.ecrire(idDocArticle(a.liste, a.id), articleVersDoc(a)),
    supprimerArticle: (a) => colCourses.supprimer(idDocArticle(a.liste, a.id)),
    ecrireListe: (l) => colCourses.ecrire(l.id, listeVersDoc(l)),
    ecrireStock: (s) => colStock.ecrire(idDocStock(s.cle), stockVersDoc(s)),
    supprimerStock: (s) => colStock.supprimer(idDocStock(s.cle)),
  };
  const colJournal = useCollection('journal', session.docsJournal, connecte);
  const colPoids = useCollection('weights', session.docsPoids, connecte);
  const journal = useMemo(() => visiblePour(docsVersJournal(colJournal.items), moi), [colJournal.items, moi]);
  const poids = useMemo(() => visiblePour(docsVersPoids(colPoids.items), moi), [colPoids.items, moi]);
  const colSeances = useCollection('workouts', session.docsSeances, connecte);
  const seances = useMemo(() => docsVersSeances(colSeances.items), [colSeances.items]);
  const opsSport = {
    ecrireSeance: (s) => colSeances.ecrire(`${s.date}-${s.par}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, seanceVersDoc(s)),
    supprimerSeance: (id) => colSeances.supprimer(id),
  };
  const opsSuivi = {
    ecrireJournal: (e) => colJournal.ecrire(e.id, journalVersDoc(e)),
    supprimerJournal: (id) => colJournal.supprimer(id),
    ecrirePoids: (p) => colPoids.ecrire(idDocPoids(p.date, p.par), poidsVersDoc(p)),
  };
  const mangerRecette = (id, repas, portions = 1) => {
    const r = recettes && recettes.find((x) => x.id === id);
    if (r) opsSuivi.ecrireJournal({ ...entreeDepuisRecette(r, portions, repas || repasSelonHeure(), moi, cleDate(new Date())), id: nouvelId() });
  };
  const opsScan = {
    ajouterAuJournal: (p, grammes) => opsSuivi.ecrireJournal({ ...entreeDepuisProduit(p, grammes, repasSelonHeure(), moi, cleDate(new Date())), id: nouvelId() }),
    ecrireScan: (s) => colScans.ecrire(s.code, scanVersDoc(s)),
    ajouterAuxCourses: (p) => opsCourses.ecrireArticle({ id: nouvelId(), liste: 'semaine', nom: p.nom, quantite: 1, unite: 'pièce', cle: cleArticle(p.nom, 'pièce'),
      rayon: rayonDe(`${p.nom} ${(p.categories || []).join(' ').replace(/-/g, ' ')}`), par: moi, source: 'scan', coche: false, cochePar: '', recettes: [] }),
    ajouterAuStock: (p) => { const [s] = ajouterAuStock(stock, [{ nom: p.nom, quantite: 1, unite: 'pièce', rayon: rayonDe(`${p.nom} ${(p.categories || []).join(' ').replace(/-/g, ' ')}`) }]); opsCourses.ecrireStock(s); },
    cocher: (a) => opsCourses.ecrireArticle({ ...a, coche: true, cochePar: moi }),
  };
  // Les menus respectent les contraintes des DEUX personnes quand le profil de l'autre est connu.
  const autre = moi === 'E' ? 'M' : 'E';
  const profilAutre = connecte && session.profils ? session.profils[autre] : null;
  const colProfils = useCollection('profiles', session.docsProfils, connecte);
  const enfantsListe = useMemo(() => docsVersEnfants(colProfils.items), [colProfils.items]);
  const enfantsOps = {
    liste: enfantsListe,
    ecrire: (e) => colProfils.ecrire(e.id, enfantVersDoc(e)),
    supprimer: (e) => colProfils.supprimer(e.id),
  };
  const enfantsMenus = useMemo(() => enfantsListe.filter((e) => e.dansMenus), [enfantsListe]);
  const convives = useMemo(() => nombreConvives(2, enfantsListe), [enfantsListe]);
  const contraintes = useMemo(() => contraintesCouple([profil, profilAutre, ...enfantsMenus]), [profil, profilAutre, enfantsMenus]);
  const besoins = profil && profilComplet(profil) ? calculerBesoins(profil) : null;
  const besoinsAutre = profilAutre && profilComplet(profilAutre) ? calculerBesoins(profilAutre) : null;
  const cibleKcal = besoins && besoinsAutre ? Math.round((besoins.cible + besoinsAutre.cible) / 2) : (besoins || besoinsAutre || { cible: 2000 }).cible;
  const recettes = index ? index.recettes : null;
  const sportActif = profil && profil.sport && profil.sport.date ? profil.sport : null;
  const planSport = useMemo(() => (sportActif && besoins ? planNutritionnel(profil, besoins, sportActif, cleDate(new Date()), seances.filter((s) => s.par === moi)) : []),
    [sportActif, besoins, profil, seances, moi]);
  const jourSport = planSport.find((p) => p.date === cleDate(new Date())) || null;
  // Les jours de sport, les objectifs du jour suivent la charge (calories, glucides, protéines).
  const besoinsDuJour = jourSport && besoins ? { ...besoins, cible: jourSport.besoins.kcal, glucides_g: jourSport.besoins.glucides_g, proteines_g: jourSport.besoins.proteines_g, lipides_g: jourSport.besoins.lipides_g } : besoins;
  const parJourSport = useMemo(() => Object.fromEntries(planSport.map((p) => [p.date, {
    cibleKcal: p.besoins.kcal,
    ...(p.laVeille ? { filtre: FILTRES_SPORT.veille.test } : p.enCharge ? { filtre: FILTRES_SPORT.riche_glucides.test } : {}),
  }])), [planSport]);
  const portionsChacun = useMemo(() => [
    ...(besoins ? [{ id: moi, label: PERSONNES[moi].prenom, cible: besoins.cible }] : []),
    ...(besoinsAutre ? [{ id: autre, label: PERSONNES[autre].prenom, cible: besoinsAutre.cible }] : []),
    ...enfantsMenus.map((e) => ({ id: e.id, label: e.prenom, cible: kcalRepereEnfant(e.naissance) })),
  ], [besoins, besoinsAutre, enfantsMenus, moi]);
  const repasSemaine = useMemo(() => {
    if (!recettes) return [];
    const parId = new Map(recettes.map((r) => [r.id, r.titre]));
    return semaineDe(new Date()).flatMap((j) => REPAS.filter((rp) => plan[j] && plan[j][rp.id])
      .map((rp) => `${nomJour(new Date(j + 'T12:00:00'))} ${rp.nom.toLowerCase()} : ${parId.get(plan[j][rp.id]) || '?'}`));
  }, [recettes, plan]);

  const lignesSuivi = useMemo(() => {
    const aujourdhui = cleDate(new Date());
    const b = bilanJour(journal, aujourdhui, moi);
    const l = [`Aujourd'hui : ${b.kcal} kcal consommées${besoins ? ` sur ${besoins.cible} (il reste ${Math.max(0, besoins.cible - b.kcal)})` : ''}, protéines ${b.p} g, glucides ${b.g} g, lipides ${b.l} g, eau ${b.eau} ml sur ${objectifEau(profil)}.`];
    const noms = Object.values(b.repas).flat().map((e) => e.nom);
    if (noms.length) l.push(`Mangé aujourd'hui : ${noms.join(', ')}.`);
    const s = serieDePoids(poids, moi);
    if (s.length) l.push(`Dernier poids : ${s[s.length - 1].kg} kg (${s[s.length - 1].date}).`);
    return l;
  }, [journal, poids, besoins, moi, profil]);
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
    ${route.ecran === 'accueil' && html`<${Accueil} moi=${moi} profil=${profil} besoins=${besoinsDuJour} index=${recettes} plan=${plan}
      contraintes=${contraintes} cibleKcal=${cibleKcal} sportJour=${jourSport} changerJour=${(d, r) => ecrireJours({ [d]: r })} nuage=${session.actif} nbFavoris=${favorisTous.size} onMange=${mangerRecette} />`}
    ${route.ecran === 'semaine' && html`<${Semaine} index=${recettes} plan=${plan} contraintes=${contraintes} cibleKcal=${cibleKcal}
      ecrireJours=${ecrireJours} profil=${profil} personnes=${personnes} enfants=${enfantsMenus} parJour=${parJourSport} />`}
    ${route.ecran === 'courses' && html`<${Courses} donnees=${donneesCourses} stock=${stock} ops=${opsCourses} moi=${moi}
      profils=${{ [moi]: profil, [autre]: profilAutre, ...Object.fromEntries(enfantsListe.map((e) => [e.id, e])) }} plan=${plan} catalogue=${index} convives=${convives} />`}
    ${route.ecran === 'suivi' && html`<${Suivi} moi=${moi} profil=${profil} besoins=${besoinsDuJour} journal=${journal} poids=${poids} ops=${opsSuivi}
      index=${recettes || []} plan=${plan} scans=${scans} />`}
    ${route.ecran === 'sport' && html`<${Sport} profil=${profil} besoins=${besoins} seances=${seances} ops=${opsSport} index=${recettes} moi=${moi} contraintes=${contraintes} onChangeProfil=${changerProfil} />`}
    ${route.ecran === 'scan' && html`<${Scanner} />`}
    ${route.ecran === 'produit' && html`<${Produit} key=${route.code} code=${route.code} scans=${scans} moi=${moi} profil=${profil} ops=${{ ...opsScan }}
      articlesListe=${donneesCourses.articles.filter((a) => a.liste === 'semaine')} />`}
    ${route.ecran === 'scans' && html`<${Historique} scans=${scans} moi=${moi} />`}
    ${(route.ecran === 'plus' || route.ecran === 'sources') && html`<${Plus} nuage=${session.actif} section=${route.ecran === 'sources' ? 'sources' : null} />`}
    ${route.ecran === 'coach' && html`<${Coach} profil=${profil} besoins=${besoins} prenom=${PERSONNES[moi].prenom}
      repasSemaine=${repasSemaine} saison=${saisonDe(new Date())} lignesSuivi=${lignesSuivi} />`}
    ${route.ecran === 'nous' && html`<${NousDeux} moi=${moi} profils=${session.profils} favorisNuage=${session.favorisNuage}
      erreurSynchro=${session.erreurSynchro} journal=${journal} poids=${poids} />`}
    ${route.ecran === 'profil' && html`<${Profil} moi=${moi} profil=${profil} onMoi=${changerMoi} onChange=${changerProfil} section=${route.section} enfants=${enfantsOps}
      compte=${{ actif: session.actif, email: session.email, onDeconnecter: () => deconnecter() }}
      pin=${{ defini: Boolean(pin), onDefinir: async (code) => { const e = await creerPin(code); enregistrerPin(e); setPin(e); },
        onRetirer: () => { retirerPin(); setPin(null); setVerrouille(false); } }} />`}
    ${route.ecran === 'fiche' && html`<${Fiche} id=${route.id} index=${index} favori=${favorisMiens.has(route.id)}
      onFavori=${() => onFavori(route.id)} moi=${moi} profil=${profil} onMange=${(portions) => mangerRecette(route.id, null, portions)} portionsChacun=${portionsChacun} />`}
    ${route.ecran === 'cuisine' && html`<${Cuisine} id=${route.id} index=${index} portions=${route.portions} />`}
    ${!plein && html`<${BarreOnglets} onglets=${ONGLETS} actif=${ONGLET_DE[route.ecran]} />`}`;
}

const racine = document.getElementById('app');
racine.textContent = ''; // retire le « Chargement… » de départ
render(html`<${App} />`, racine);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
