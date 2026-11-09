// Courses et stock : liste commune au foyer, cochage en direct, rayons, génération depuis le menu, alertes de profil.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES, NB_CONVIVES } from '../core/config.js';
import { chargerFiche } from '../core/catalogue.js';
import { RAYONS } from '../data/rayons.js';
import { lire } from '../core/stockage.js';
import { semaineDe } from '../lib/planning.js';
import { alertesTexte } from '../lib/alertes.js';
import { analyserSaisie, articlesDepuisPlan, deduireStock, ajouterAuStock, planifierMiseAJour, versBase, cleArticle, libelleQuantite, arrondirCourses, idArticle } from '../lib/courses.js';
import { rayonDe } from '../data/rayons.js';
import { Entete, Pastille, Bandeau, Puce } from '../ui/composants.js';

const nouvelId = () => 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ordreRayons = () => { const o = lire('rayons.ordre', null); return Array.isArray(o) ? o : RAYONS.map((r) => r.id); };

function groupesParRayon(articles) {
  const ordre = ordreRayons();
  const par = new Map();
  for (const a of articles) { const r = a.rayon || 'autre'; if (!par.has(r)) par.set(r, []); par.get(r).push(a); }
  return [...par.entries()].sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0]))
    .map(([id, items]) => ({ rayon: RAYONS.find((r) => r.id === id) || RAYONS[RAYONS.length - 1], items: items.sort((x, y) => x.nom.localeCompare(y.nom, 'fr')) }));
}

function Article({ a, profils, onCoche, onSuppr }) {
  const alertes = useMemo(() => Object.entries(profils).filter(([, p]) => p).flatMap(([qui, p]) => alertesTexte(a.nom, p).map((x) => ({ ...x, qui }))), [a.nom, profils]);
  return html`<li class=${'article' + (a.coche ? ' coche' : '')}>
    <button type="button" class="case-article" role="checkbox" aria-checked=${a.coche} aria-label=${`${a.coche ? 'Décocher' : 'Cocher'} ${a.nom}`} onClick=${onCoche}>
      <span class="boite">${a.coche ? '✓' : ''}</span>
      <span class="article-texte"><strong>${a.nom}</strong> <span class="qte">${libelleQuantite(a)}</span>
        ${alertes.map((x) => html`<span class=${'alerte-article ' + x.niveau} key=${x.id + x.qui}><${Pastille} qui=${x.qui} /> ${x.niveau === 'rouge' ? '⛔' : '⚠'} ${x.raison}</span>`)}</span>
    </button>
    <span class="article-qui" title=${a.coche && a.cochePar ? 'Coché par' : 'Ajouté par'}>${(a.coche && a.cochePar) || a.par ? html`<${Pastille} qui=${(a.coche && a.cochePar) || a.par} />` : ''}</span>
    <button type="button" class="supprimer" aria-label=${`Retirer ${a.nom}`} onClick=${onSuppr}>✕</button>
  </li>`;
}

function texteListe(nom, articles) {
  const lignes = [`🛒 ${nom}`, ''];
  for (const g of groupesParRayon(articles.filter((a) => !a.coche))) {
    lignes.push(g.rayon.nom.toUpperCase());
    for (const a of g.items) lignes.push(`☐ ${a.nom} — ${libelleQuantite(a)}`);
    lignes.push('');
  }
  return lignes.join('\n');
}

export function Courses({ donnees, stock, ops, moi, profils, plan, catalogue }) {
  const { listes, articles } = donnees;
  const [vue, setVue] = useState('liste');
  const [courant, setCourant] = useState('semaine');
  const [saisie, setSaisie] = useState('');
  const [nouvelle, setNouvelle] = useState(null);   // nom en cours de saisie d'une nouvelle liste
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const actives = listes.filter((l) => !l.archivee);
  const liste = actives.find((l) => l.id === courant) || actives[0];
  const deLaListe = articles.filter((a) => a.liste === liste.id);
  const restants = deLaListe.filter((a) => !a.coche);
  const pris = deLaListe.filter((a) => a.coche);

  const ajouter = (texte) => {
    const s = analyserSaisie(texte);
    if (!s.nom) return;
    const cle = cleArticle(s.nom, s.unite);
    const base = versBase(s.quantite, s.unite);
    const existant = deLaListe.find((a) => a.cle === cle && !a.coche);
    if (existant) {
      const total = versBase(existant.quantite, existant.unite).quantite + base.quantite;
      ops.ecrireArticle({ ...existant, ...arrondirCourses({ quantite: total, unite: base.unite }) });
    } else {
      ops.ecrireArticle({ id: nouvelId(), liste: liste.id, nom: s.nom, quantite: s.quantite, unite: s.unite, rayon: rayonDe(s.nom), cle, par: moi, source: 'manuel', coche: false, cochePar: '', recettes: [] });
    }
    setSaisie('');
  };

  const generer = async () => {
    const jours = semaineDe(new Date());
    const ids = [...new Set(jours.flatMap((j) => Object.values(plan[j] || {})))];
    if (!ids.length) { setMessage({ type: 'info', texte: 'Le menu de la semaine est vide. Générez-le dans l\'onglet Semaine, puis revenez ici.' }); return; }
    setEnCours(true); setMessage(null);
    try {
      const recettes = new Map();
      for (const id of ids) { const f = await chargerFiche(catalogue, id); if (f) recettes.set(id, f); }
      const { articles: reste, enStock } = deduireStock(articlesDepuisPlan(plan, jours, recettes, NB_CONVIVES), stock);
      const { ecrire, supprimer } = planifierMiseAJour(deLaListe, reste);
      for (const g of ecrire) ops.ecrireArticle({ ...g, liste: liste.id, par: g.par || moi });
      for (const id of supprimer) ops.supprimerArticle(deLaListe.find((a) => a.id === id));
      setMessage({ type: 'info', texte: `${ids.length} recette${ids.length > 1 ? 's' : ''} du menu, ${reste.length} article${reste.length > 1 ? 's' : ''} pour ${NB_CONVIVES} personnes.${enStock.length ? ` Déjà en stock : ${enStock.slice(0, 6).join(', ')}${enStock.length > 6 ? '…' : ''}.` : ''}` });
    } catch { setMessage({ type: 'alerte', texte: 'Impossible de charger les recettes du menu. Réessayez avec du réseau (elles seront ensuite disponibles hors ligne).' }); }
    setEnCours(false);
  };

  const terminer = () => {
    if (!window.confirm(`Terminer les courses ? ${pris.length} article${pris.length > 1 ? 's' : ''} coché${pris.length > 1 ? 's' : ''} ${pris.length > 1 ? 'iront' : 'ira'} dans le stock.`)) return;
    const avant = new Map(stock.map((s) => [s.cle, s.quantite]));
    for (const s of ajouterAuStock(stock, pris)) if (avant.get(s.cle) !== s.quantite) ops.ecrireStock(s);
    for (const a of pris) ops.supprimerArticle(a);
    if (restants.length === 0 && liste.id !== 'semaine') ops.ecrireListe({ ...liste, archivee: true });
    setMessage({ type: 'info', texte: `Courses terminées : ${pris.length} article${pris.length > 1 ? 's' : ''} ajouté${pris.length > 1 ? 's' : ''} au stock.` });
  };

  const partager = async () => {
    const texte = texteListe(liste.nom, deLaListe);
    try { if (navigator.share) { await navigator.share({ title: liste.nom, text: texte }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(texte); setMessage({ type: 'info', texte: 'Liste copiée : collez-la dans un message.' }); } catch { setMessage({ type: 'alerte', texte: 'Impossible de copier la liste.' }); }
  };

  const creerListe = () => {
    const nom = (nouvelle || '').trim();
    if (nom) { const id = 'l-' + Date.now().toString(36); ops.ecrireListe({ id, nom, archivee: false, cree: Date.now(), par: moi }); setCourant(id); }
    setNouvelle(null);
  };

  return html`<div class="page-courses">
    <${Entete} titre="Courses" sous=${vue === 'liste' ? `${liste.nom} · ${restants.length} à acheter` : `${stock.length} produit${stock.length > 1 ? 's' : ''} en stock`}>
      <div class="onglets-internes" role="tablist">
        <button type="button" role="tab" aria-selected=${vue === 'liste'} onClick=${() => setVue('liste')}>🛒 Liste</button>
        <button type="button" role="tab" aria-selected=${vue === 'stock'} onClick=${() => setVue('stock')}>📦 Stock</button>
      </div>
    <//>
    <div class="contenu">
      ${message && html`<${Bandeau} type=${message.type}><p>${message.texte}</p><//>`}
      ${vue === 'liste' ? html`
        <div class="puces sans-marge selecteur-listes">
          ${actives.map((l) => html`<${Puce} key=${l.id} actif=${l.id === liste.id} onClick=${() => setCourant(l.id)}>${l.nom}<//>`)}
          ${nouvelle === null ? html`<${Puce} actif=${false} onClick=${() => setNouvelle('')}>＋ Nouvelle liste<//>` : ''}
        </div>
        ${nouvelle !== null && html`<form class="ligne-saisie" onSubmit=${(e) => { e.preventDefault(); creerListe(); }}>
          <input type="text" placeholder="Nom (marché, fête, batch cooking…)" value=${nouvelle} autofocus onInput=${(e) => setNouvelle(e.target.value)} aria-label="Nom de la nouvelle liste" />
          <button type="submit" class="bouton">Créer</button></form>`}
        <form class="ligne-saisie" onSubmit=${(e) => { e.preventDefault(); ajouter(saisie); }}>
          <input type="text" placeholder="Ajouter : 2 kg de pommes, lait…" value=${saisie} onInput=${(e) => setSaisie(e.target.value)} aria-label="Ajouter un article" />
          <button type="submit" class="bouton" aria-label="Ajouter" disabled=${!saisie.trim()}>＋</button></form>
        <div class="actions-courses">
          <button type="button" class="bouton secondaire" disabled=${enCours || !catalogue} onClick=${generer}>${enCours ? 'Calcul…' : '✨ Depuis le menu de la semaine'}</button>
          ${pris.length > 0 && html`<button type="button" class="bouton" onClick=${terminer}>✓ Terminer les courses (${pris.length})</button>`}
        </div>
        ${deLaListe.length === 0 ? html`<div class="etat"><p>🛒 La liste est vide.</p><p class="sous">Ajoutez des articles, générez-la depuis votre menu, ou scannez un produit.</p></div>` : html`
          <div class="progression" aria-label=${`${pris.length} sur ${deLaListe.length} dans le panier`}><span style=${`width:${(pris.length / deLaListe.length) * 100}%`}></span></div>
          ${groupesParRayon(restants).map((g) => html`<section class="rayon" key=${g.rayon.id}><h3 class="petit-titre">${g.rayon.icone} ${g.rayon.nom}</h3>
            <ul class="articles">${g.items.map((a) => html`<${Article} key=${a.id} a=${a} profils=${profils}
              onCoche=${() => ops.ecrireArticle({ ...a, coche: true, cochePar: moi })} onSuppr=${() => ops.supprimerArticle(a)} />`)}</ul></section>`)}
          ${pris.length > 0 && html`<section class="rayon"><h3 class="petit-titre">🧺 Dans le panier (${pris.length})</h3>
            <ul class="articles">${pris.map((a) => html`<${Article} key=${a.id} a=${a} profils=${profils}
              onCoche=${() => ops.ecrireArticle({ ...a, coche: false, cochePar: '' })} onSuppr=${() => ops.supprimerArticle(a)} />`)}</ul></section>`}`}
        <div class="actions-courses bas">
          <button type="button" class="lien" onClick=${partager}>📤 Partager</button>
          <button type="button" class="lien" onClick=${() => window.print()}>🖨 Imprimer</button>
          ${liste.id !== 'semaine' && html`<button type="button" class="lien" onClick=${() => { ops.ecrireListe({ ...liste, archivee: true }); setCourant('semaine'); }}>🗄 Archiver la liste</button>`}
        </div>
        <p class="note">Les articles déconseillés à l'un de vous deux sont signalés avec la raison. Ces informations sont générales et ne remplacent pas l'avis d'un professionnel de santé.</p>`
      : html`<${Stock} stock=${stock} ops=${ops} />`}
    </div></div>`;
}

const PAS = { g: 50, ml: 50, 'c. à soupe': 1, 'c. à café': 1 };
function Stock({ stock, ops }) {
  const [saisie, setSaisie] = useState('');
  const ajouter = (e) => {
    e.preventDefault();
    const s = analyserSaisie(saisie);
    if (!s.nom) return;
    const [ajout] = ajouterAuStock([], [{ nom: s.nom, quantite: s.quantite, unite: s.unite, rayon: rayonDe(s.nom) }]);
    const existant = stock.find((x) => x.cle === ajout.cle);
    ops.ecrireStock(existant ? { ...existant, quantite: existant.quantite + ajout.quantite } : ajout);
    setSaisie('');
  };
  const changer = (s, delta) => { const q = s.quantite + delta * (PAS[s.unite] || 1); if (q <= 0) ops.supprimerStock(s); else ops.ecrireStock({ ...s, quantite: q }); };
  return html`<div>
    <form class="ligne-saisie" onSubmit=${ajouter}><input type="text" placeholder="Ajouter au stock : 1 kg de riz…" value=${saisie}
      onInput=${(e) => setSaisie(e.target.value)} aria-label="Ajouter au stock" /><button type="submit" class="bouton" disabled=${!saisie.trim()}>＋</button></form>
    ${stock.length === 0 ? html`<div class="etat"><p>📦 Le stock est vide.</p><p class="sous">Il se remplit tout seul quand vous terminez vos courses, et se déduit des prochaines listes.</p></div>`
      : groupesParRayon(stock.map((s) => ({ ...s, id: s.cle }))).map((g) => html`<section class="rayon" key=${g.rayon.id}><h3 class="petit-titre">${g.rayon.icone} ${g.rayon.nom}</h3>
        <ul class="articles">${g.items.map((s) => html`<li class="article" key=${s.cle}>
          <span class="article-texte plein"><strong>${s.nom}</strong> <span class="qte">${libelleQuantite(arrondirCourses(s))}</span></span>
          <button type="button" class="mini-action" aria-label=${`Moins de ${s.nom}`} onClick=${() => changer(s, -1)}>−</button>
          <button type="button" class="mini-action" aria-label=${`Plus de ${s.nom}`} onClick=${() => changer(s, 1)}>＋</button>
          <button type="button" class="supprimer" aria-label=${`Retirer ${s.nom} du stock`} onClick=${() => ops.supprimerStock(s)}>✕</button></li>`)}</ul></section>`)}
  </div>`;
}
