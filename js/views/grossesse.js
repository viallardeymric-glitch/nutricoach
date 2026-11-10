// Guide grossesse : « ai-je le droit de manger… ? » Aliments autorisés, à limiter, déconseillés ou interdits, avec recherche.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { ALIMENTS_GROSSESSE, STATUTS, CATEGORIES_GROSSESSE, chercherGrossesse } from '../data/grossesse.js';
import { MENTION_GENERALE } from '../data/sources.js';
import { Entete, Bandeau, Puce } from '../ui/composants.js';

function Carte({ a }) {
  const s = STATUTS[a.statut];
  return html`<article class=${'carte-grossesse ' + a.statut}>
    <h3><span class="statut-grossesse" aria-hidden="true">${s.icone}</span> <span class="sr-seul">${s.nom} : </span>${a.nom}</h3>
    <p class=${'etiquette-statut ' + a.statut}>${s.nom}</p>
    <p><strong>Pourquoi :</strong> ${a.pourquoi}</p>
    <p><strong>Conseil :</strong> ${a.conseil}</p>
  </article>`;
}

export function Grossesse({ profil }) {
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const enceinte = Boolean(profil && (profil.grossesse > 0 || profil.allaitement));
  const resultats = useMemo(() => {
    const base = q.trim() ? chercherGrossesse(q) : ALIMENTS_GROSSESSE;
    return filtre === 'tous' ? base : base.filter((a) => a.statut === filtre);
  }, [q, filtre]);
  const parCategorie = useMemo(() => {
    if (q.trim()) return [['resultats', resultats]];
    return Object.keys(CATEGORIES_GROSSESSE).map((k) => [k, resultats.filter((a) => a.cat === k).sort((x, y) => STATUTS[x.statut].ordre - STATUTS[y.statut].ordre)]).filter(([, l]) => l.length);
  }, [q, resultats]);

  return html`<div>
    <${Entete} titre="Grossesse : puis-je manger ?" sous="Autorisé, à limiter, déconseillé, interdit" />
    <div class="contenu">
      ${!enceinte && html`<${Bandeau} type="info" titre="Pour vous"><p>Ce guide est pensé pour la grossesse. Indiquez-la dans <a href="#/profil/situation">Profil → Ma situation</a> : l'appli adaptera aussi les recettes, les produits scannés et le coach.</p><//>`}
      <${Bandeau} type="alerte" titre="À retenir"><p>⛔ <strong>Zéro alcool.</strong> Évitez la viande, le poisson et les œufs crus, la charcuterie crue, le poisson fumé, les fromages au lait cru et les graines germées. Cuisez bien, lavez fruits et légumes.</p><//>
      <label class="champ"><span>J'ai un doute sur un aliment</span>
        <input type="search" placeholder="ex. saumon fumé, camembert, sushi, café…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Chercher un aliment" /></label>
      <div class="puces">${[['tous', 'Tous'], ['interdit', '⛔ Interdit'], ['eviter', '🚫 À éviter'], ['limiter', '⚠️ À limiter'], ['ok', '✅ Autorisé']].map(([k, n]) => html`<${Puce} key=${k} actif=${filtre === k} onClick=${() => setFiltre(k)}>${n}<//>`)}</div>
      ${q.trim() && resultats.length === 0 && html`<${Bandeau} type="info"><p>Aucun résultat pour « ${q} ». Dans le doute, <strong>ne le mangez pas</strong> et demandez à votre sage-femme, votre médecin ou votre pharmacien, ou posez la question au <a href="#/coach">coach</a>.</p><//>`}
      ${parCategorie.map(([k, liste]) => html`<section key=${k}>
        ${k !== 'resultats' && html`<h2 class="petit-titre">${CATEGORIES_GROSSESSE[k]}</h2>`}
        ${liste.map((a) => html`<${Carte} key=${a.id} a=${a} />`)}</section>`)}
      <p class="note">${MENTION_GENERALE} Repères généraux d'après les recommandations françaises (Santé publique France / Manger Bouger, ANSES, HAS, Assurance maladie), à faire relire par un professionnel de santé. En cas de doute ou de symptômes (fièvre, frissons, courbatures), appelez votre médecin ou le 15.</p>
      <a class="bouton secondaire large" href="#/coach">💬 Poser la question au coach</a>
    </div></div>`;
}
