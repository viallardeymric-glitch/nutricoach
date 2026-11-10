// Batch cooking : choisir les recettes du menu, courses de la session, planning chronométré, boîtes et étiquettes, stock de plats.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { chargerFiche } from '../core/catalogue.js';
import { cleDate, semaineDe, ajouterJours, dateDepuisCle, nomJour } from '../lib/planning.js';
import { recettesDuMenu, comptesDuMenu, portionsPourRepas, articlesBatch, planningSession, heureDe, conditionnement, texteEtiquette, platsEnStock, platsDeSession } from '../lib/batch.js';
import { deduireStock } from '../lib/courses.js';
import { filtrerRecettes, FILTRES_VIDES } from '../lib/recettes.js';
import { libelleQuantite } from '../lib/courses.js';
import { RAYONS } from '../data/rayons.js';
import { Entete, Section, Bandeau, Puce, Pastille } from '../ui/composants.js';

const nf = (x) => String(x).replace('.', ',');
const fr = (d) => d.split('-').reverse().join('/');
const nouvelId = () => 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function Batch({ plan, catalogue, index, sessions, ops, stock, moi, personnes = 2, noms = '', appareils }) {
  const [horizon, setHorizon] = useState(7);               // nombre de jours à couvrir (1 à 14)
  const [portionsRepas, setPortionsRepas] = useState(personnes);   // portions par repas : une par personne de la famille
  const jours = useMemo(() => { const j = []; for (let i = 0; i < horizon; i++) j.push(cleDate(ajouterJours(new Date(), i))); return j; }, [horizon]);
  const [repas, setRepas] = useState({});          // id -> nombre de repas à préparer ; absent = non choisi
  const [dureeDispo, setDureeDispo] = useState(180);
  const [debut, setDebut] = useState('09:00');
  const [parBoite, setParBoite] = useState(2);
  const [q, setQ] = useState('');
  const [resultat, setResultat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const parId = useMemo(() => new Map((index || []).map((r) => [r.id, r])), [index]);
  const menu = useMemo(() => recettesDuMenu(plan, jours, 6), [plan, jours]);
  const proposes = useMemo(() => [...new Set([...menu, ...Object.keys(repas)])], [menu, repas]);
  const trouves = useMemo(() => (q.trim().length >= 2 && index ? filtrerRecettes(index, { ...FILTRES_VIDES, q }).slice(0, 6) : []), [q, index]);
  const choisies = proposes.filter((id) => repas[id] > 0);
  const totalRepas = choisies.reduce((n, id) => n + repas[id], 0);
  const repasCouverts = horizon * 2;                       // déjeuner + dîner
  const remplirDepuisMenu = () => setRepas(comptesDuMenu(plan, jours));
  const aujourdhui = cleDate(new Date());
  const enStock = useMemo(() => platsEnStock(sessions), [sessions]);

  const generer = async () => {
    setEnCours(true); setMessage(null);
    try {
      const selection = [];
      for (const id of choisies) {
        const recette = await chargerFiche(catalogue, id);
        if (recette) selection.push({ recette, portions: portionsPourRepas(repas[id], portionsRepas) });
      }
      const planning = planningSession(selection, { dureeDispo, appareils });
      const cond = conditionnement(selection, aujourdhui, parBoite);
      const { articles, enStock: couverts } = deduireStock(articlesBatch(selection), stock);
      setResultat({ selection, planning, cond, articles, couverts });
    } catch { setMessage({ type: 'alerte', texte: 'Impossible de charger les recettes. Réessayez avec du réseau (elles seront ensuite disponibles hors ligne).' }); }
    setEnCours(false);
  };

  const creerCourses = () => {
    const id = 'batch-' + aujourdhui;
    ops.ecrireListe({ id, nom: `Batch cooking du ${fr(aujourdhui)}`, archivee: false, cree: Date.now(), par: moi });
    for (const a of resultat.articles) ops.ecrireArticle({ ...a, liste: id, par: moi, source: 'batch', coche: false, cochePar: '' });
    setMessage({ type: 'info', texte: `Liste « Batch cooking du ${fr(aujourdhui)} » créée : ${resultat.articles.length} articles${resultat.couverts.length ? ` (${resultat.couverts.length} déjà en stock)` : ''}. Ouvrez l'onglet Courses.` });
  };
  const terminer = () => {
    ops.ecrireSession({ id: 'b-' + aujourdhui + '-' + Date.now().toString(36), date: aujourdhui, par: moi, plats: platsDeSession(resultat.cond) });
    setResultat(null); setRepas({});
    setMessage({ type: 'info', texte: 'Session terminée : les plats sont dans votre stock de plats préparés, à manger dans l\'ordre.' });
  };
  const imprimer = () => { document.body.dataset.impression = 'etiquettes'; const fin = () => { delete document.body.dataset.impression; removeEventListener('afterprint', fin); }; addEventListener('afterprint', fin); window.print(); };
  const manger = (plat) => { const s = sessions.find((x) => x.id === plat.session); ops.ecrireSession({ ...s, plats: s.plats.map((p) => (p.recette === plat.recette ? { ...p, restant: Math.max(0, p.restant - 1) } : p)) }); };
  const congeler = (plat) => { const s = sessions.find((x) => x.id === plat.session); ops.ecrireSession({ ...s, plats: s.plats.map((p) => (p.recette === plat.recette ? { ...p, congele: !p.congele } : p)) }); };

  return html`<div class="page-batch">
    <${Entete} titre="Batch cooking" sous="Cuisinez une fois, mangez toute la semaine" retour=${{ href: '#/plus', nom: 'Plus' }} />
    <div class="contenu">
      ${message && html`<${Bandeau} type=${message.type}><p>${message.texte}</p><//>`}
      ${enStock.length > 0 && html`<${Section} titre="Plats préparés en stock">
        ${enStock.map((p) => html`<div class=${'plat-stock' + (p.perime ? ' perime' : p.urgent ? ' urgent' : '')} key=${p.session + p.recette}>
          <div><strong>${p.titre}</strong><span class="sous">${p.restant} portion${p.restant > 1 ? 's' : ''} · ${p.congele ? '🧊 congelé' : 'frigo'} · avant le ${fr(p.limite)}</span>
            ${p.perime ? html`<span class="alerte-carte">⛔ Date dépassée : ne pas consommer</span>` : p.urgent ? html`<span class="alerte-carte">⚠ À manger en premier</span>` : ''}</div>
          <div class="puces sans-marge"><button type="button" class="mini-action" aria-label=${`Manger une portion de ${p.titre}`} onClick=${() => manger(p)}>Mangé 1</button>
            ${p.congelationMois !== 0 && html`<button type="button" class="mini-action" aria-label=${`Congeler ${p.titre}`} onClick=${() => congeler(p)}>${p.congele ? 'Sorti' : '🧊'}</button>`}</div></div>`)}
        <p class="note">Les plats sont classés par date limite. Décongelez toujours au réfrigérateur et réchauffez à cœur.</p><//>`}
      ${!resultat ? html`
        <${Section} titre="1. Que prépare-t-on ?">
          <div class="reglage-batch"><span>Nombre de jours à couvrir</span>
            <span class="stepper"><button type="button" aria-label="Un jour de moins" disabled=${horizon <= 1} onClick=${() => setHorizon(horizon - 1)}>−</button>
              <output>${horizon} jour${horizon > 1 ? 's' : ''}</output><button type="button" aria-label="Un jour de plus" disabled=${horizon >= 14} onClick=${() => setHorizon(horizon + 1)}>+</button></span></div>
          <div class="reglage-batch"><span>Portions par repas<span class="sous">${noms ? `une par personne : ${noms}` : 'une par personne'}</span></span>
            <span class="stepper"><button type="button" aria-label="Une portion de moins" disabled=${portionsRepas <= 1} onClick=${() => setPortionsRepas(portionsRepas - 1)}>−</button>
              <output>${portionsRepas} portion${portionsRepas > 1 ? 's' : ''}</output><button type="button" aria-label="Une portion de plus" disabled=${portionsRepas >= 12} onClick=${() => setPortionsRepas(portionsRepas + 1)}>+</button></span></div>
          <p class="note" data-bilan-repas>${totalRepas} repas choisi${totalRepas > 1 ? 's' : ''} pour ${repasCouverts} à couvrir (${horizon} jour${horizon > 1 ? 's' : ''} × 2 repas) : ${totalRepas * portionsRepas} portions au total.
            ${menu.length > 0 && html` <button type="button" class="lien" onClick=${remplirDepuisMenu}>Remplir d'après mon menu</button>`}</p>
          ${proposes.length === 0 ? html`<p class="note">Le menu est vide : générez-le dans l'onglet Planning, ou cherchez une recette ci-dessous.</p>` : proposes.map((id) => { const r = parId.get(id); if (!r) return null; return html`<div class="ligne-batch" key=${id}>
            <span><strong>${r.titre}</strong><span class="sous">⏱ ${r.temps} min</span></span>
            <span class="stepper"><button type="button" aria-label=${`Moins de repas : ${r.titre}`} onClick=${() => setRepas({ ...repas, [id]: Math.max(0, (repas[id] || 0) - 1) })}>−</button>
              <output>${repas[id] || 0} repas · ${(repas[id] || 0) * portionsRepas} portions</output><button type="button" aria-label=${`Plus de repas : ${r.titre}`} onClick=${() => setRepas({ ...repas, [id]: (repas[id] || 0) + 1 })}>+</button></span></div>`; })}
          <input type="search" class="champ-recherche" placeholder="Ajouter une autre recette…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Ajouter une recette" />
          ${trouves.map((r) => html`<button type="button" class="ligne-choix" key=${r.id} onClick=${() => { setRepas({ ...repas, [r.id]: 2 }); setQ(''); }}><strong>${r.titre}</strong><span class="sous">⏱ ${r.temps} min</span></button>`)}
        <//>
        <${Section} titre="2. Votre temps et vos boîtes">
          <div class="puces sans-marge">${[120, 180, 240, 300].map((m) => html`<${Puce} key=${m} actif=${dureeDispo === m} onClick=${() => setDureeDispo(m)}>${m / 60} h<//>`)}</div>
          <label class="champ"><span>Début de la session</span><input type="time" value=${debut} onInput=${(e) => setDebut(e.target.value)} /></label>
          <div class="puces sans-marge">${[1, 2, 3, 4].map((n) => html`<${Puce} key=${n} actif=${parBoite === n} onClick=${() => setParBoite(n)}>${n} portion${n > 1 ? 's' : ''} par boîte<//>`)}</div>
          <p class="note">Appareils pris en compte : ${appareils.plaques} plaques${appareils.four ? ', four' : ''}${appareils.thermomix ? `, Thermomix ${appareils.modele}` : ''}${appareils.cookeo ? ', Cookeo' : ''}. Modifiables dans « Plus ».</p><//>
        <button type="button" class="bouton grand" disabled=${!choisies.length || enCours || !catalogue} onClick=${generer}>${enCours ? 'Calcul…' : '✨ Préparer la session'}</button>`
      : html`
        <${Section} titre=${`Session : ${resultat.selection.length} recette${resultat.selection.length > 1 ? 's' : ''}`}>
          <ul class="simple">${resultat.selection.map((s) => html`<li key=${s.recette.id}>${s.recette.titre} : <strong>${nf(s.portions)} portions</strong></li>`)}</ul><//>
        <${Section} titre="Courses de la session">
          <p>${resultat.articles.length} article${resultat.articles.length > 1 ? 's' : ''} à acheter${resultat.couverts.length ? `, ${resultat.couverts.length} déjà en stock` : ''}.</p>
          <ul class="articles">${resultat.articles.slice(0, 8).map((a) => html`<li class="article" key=${a.id}><span class="article-texte plein"><strong>${a.nom}</strong> <span class="qte">${libelleQuantite(a)}</span></span></li>`)}</ul>
          ${resultat.articles.length > 8 && html`<p class="note">… et ${resultat.articles.length - 8} autres dans la liste.</p>`}
          <button type="button" class="bouton secondaire large" onClick=${creerCourses}>🛒 Créer la liste de courses de la session</button><//>
        <${Section} titre="Planning de la session">
          <div class="stats"><div><strong>${Math.floor(resultat.planning.duree / 60)} h ${String(resultat.planning.duree % 60).padStart(2, '0')}</strong><span class="sous">durée</span></div>
            <div><strong>${resultat.planning.gain} min</strong><span class="sous">gagnées en parallèle</span></div>
            <div><strong>${resultat.planning.lavages}</strong><span class="sous">ustensiles à laver</span></div><div><strong>${heureDe(debut, resultat.planning.duree)}</strong><span class="sous">fin prévue</span></div></div>
          ${resultat.planning.avertissements.map((a) => html`<${Bandeau} type="avertissement" key=${a}><p>${a}</p><//>`)}
          <ol class="chrono">${resultat.planning.taches.map((t, i) => html`<li key=${i} class=${t.actif ? 'actif' : 'passif'}>
            <span class="heure">${heureDe(debut, t.debut)}</span><span class="tache"><strong>${t.titre.length > 34 ? t.titre.slice(0, 32) + '…' : t.titre}</strong> · étape ${t.etape}
              <span class="sous">${t.actif ? '✋ à faire vous-même' : `⏲ en cours (${t.ressource || 'repos'}) jusqu'à ${heureDe(debut, t.fin)}`} · ${t.fin - t.debut} min</span>${t.texte}</span></li>`)}</ol><//>
        <${Section} titre="Boîtes et étiquettes">
          ${resultat.cond.map((c) => html`<div class="etiquette-carte" key=${c.recette}><strong>${c.titre}</strong><span>${c.boites} boîte${c.boites > 1 ? 's' : ''} de ${c.portionsParBoite} portion${c.portionsParBoite > 1 ? 's' : ''}</span>
            <span class="sous">Frigo ${c.frigoJours} jours (avant le ${fr(c.limiteFrigo)})${c.congelationMois ? ` · congélateur ${c.congelationMois} mois` : ''}</span>
            <span class="sous">♨ ${c.reechauffage}</span><span class="sous">❄ ${c.decongelation}</span></div>`)}
          <button type="button" class="bouton secondaire large" onClick=${imprimer}>🏷 Imprimer les étiquettes</button><//>
        <button type="button" class="bouton grand" onClick=${terminer}>✓ Session terminée : ajouter les plats au stock</button>
        <button type="button" class="lien" onClick=${() => setResultat(null)}>← Modifier la sélection</button>`}
      <div class="zone-etiquettes" aria-hidden="true">${(resultat ? resultat.cond : []).flatMap((c) => Array.from({ length: c.boites }, (_, i) => html`<pre class="etiquette-imprimee" key=${c.recette + i}>${texteEtiquette(c)}</pre>`))}</div>
    </div></div>`;
}
