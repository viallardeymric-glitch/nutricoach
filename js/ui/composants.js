// Petits composants réutilisables.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { photoEnCache, photoDeRecette, photoPartagee, chargerReglagesPhotos } from '../core/photos.js';
import { pictogramme } from '../data/pictogrammes.js';

export function Puce({ actif, onClick, exclu, children }) {
  return html`<button type="button" class=${'puce' + (exclu ? ' exclu' : '')}
    aria-pressed=${actif} onClick=${onClick}>${children}</button>`;
}

export function Pictogramme({ recette, grand }) {
  return html`<span class=${'picto' + (grand ? ' grand' : '')} aria-hidden="true">${pictogramme(recette.sous_categorie, recette.categorie)}</span>`;
}

/** Pictogramme, remplacé par la miniature de la recette quand elle existe ; elle est cherchée une fois la carte restée visible à l'écran. */
export function Vignette({ r }) {
  const [, majPhoto] = useState(0);
  const ref = useRef(null);
  const c = photoEnCache(r.id);
  const photo = c && c.url ? c : null;
  useEffect(() => {
    if (photo || !('IntersectionObserver' in window)) return undefined;
    let actif = true;
    let minuteur = null;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        minuteur = setTimeout(() => {
          const reg = chargerReglagesPhotos();         // lus à ce moment-là : une clé saisie après le démarrage compte
          if (!reg.miniatures || !(Object.values(reg.cles).some(Boolean) || photoPartagee(r.id))) return;
          obs.disconnect();
          photoDeRecette(r, fetch, { miniature: true }).then((p) => actif && p && majPhoto((n) => n + 1)).catch(() => {});
        }, 500);                                       // 0,5 s visible : on cherche
      } else clearTimeout(minuteur);
    });
    if (ref.current) obs.observe(ref.current);
    return () => { actif = false; clearTimeout(minuteur); obs.disconnect(); };
  }, [r.id, photo]);
  const montrer = photo && chargerReglagesPhotos().miniatures;     // miniatures désactivées : pictogramme tout de suite
  return html`<span class="vignette-zone" ref=${ref}>${montrer ? html`<img class="picto vignette-photo" src=${photo.mini || photo.url} alt="" loading="lazy" />` : html`<${Pictogramme} recette=${r} />`}</span>`;
}

export function Coeur({ actif, onClick }) {
  return html`<button type="button" class=${'coeur' + (actif ? ' actif' : '')} aria-pressed=${actif}
    aria-label=${actif ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick=${onClick}>${actif ? '♥' : '♡'}</button>`;
}

/** Bandeau d'information coloré : type = « alerte » | « info ». */
export function Bandeau({ type = 'info', titre, children }) {
  return html`<section class=${'bandeau ' + type} role=${type === 'alerte' ? 'note' : undefined}>
    ${titre && html`<h2>${titre}</h2>`}${children}</section>`;
}

export function BarreOnglets({ onglets, actif }) {
  return html`<nav class="onglets" aria-label="Navigation">
    ${onglets.map((o) => html`<a key=${o.id} href=${o.href} class=${(o.centre ? 'centre ' : '') + (o.id === actif ? 'actif' : '')}
      aria-current=${o.id === actif ? 'page' : undefined} aria-label=${o.nom}><span aria-hidden="true">${o.icone}</span>${o.centre ? '' : o.nom}</a>`)}
  </nav>`;
}

/** Pastille « E » (bleu) ou « M » (rose) : qui a fait quoi. */
export function Pastille({ qui, label }) {
  const enfant = String(qui).startsWith('enfant');
  return html`<span class=${'pastille ' + (enfant ? 'enfant' : qui)} aria-label=${enfant ? (label || 'Enfant') : (qui === 'E' ? 'Eymric' : 'Marie')}>${enfant ? String(label || '?').charAt(0).toUpperCase() : qui}</span>`;
}

/** En-tête coloré d'un écran. `retour` : { href, nom } pour un lien « ← … ». */
export function Entete({ titre, sous, retour, grand, children }) {
  return html`<header class=${'entete' + (grand ? ' grand' : '')}>
    ${retour && html`<a class="retour-entete" href=${retour.href}>← ${retour.nom}</a>`}
    <h1>${titre}</h1>${sous && html`<p class="entete-sous">${sous}</p>`}${children}</header>`;
}

export function Section({ titre, lien, children }) {
  return html`<section class="section">
    <div class="section-tete"><h2>${titre}</h2>${lien && html`<a href=${lien.href}>${lien.nom}</a>`}</div>${children}</section>`;
}

/** Ligne de menu (page Profil) : icône, titre, résumé, flèche. */
export function Rang({ icone, titre, sous, href }) {
  return html`<a class="rang" href=${href}><span class="rang-icone" aria-hidden="true">${icone}</span>
    <span class="rang-texte"><strong>${titre}</strong>${sous && html`<span class="sous">${sous}</span>`}</span>
    <span class="chevron" aria-hidden="true">›</span></a>`;
}

/** Recette compacte (entrée de l'index) : pictogramme, titre, temps et calories, alerte de profil éventuelle. */
export function MiniRecette({ r, risques = [], children, large }) {
  return html`<div class=${'mini' + (large ? ' large' : '')}>
    <a class="mini-lien" href=${'#/recette/' + r.id}>
      <${Vignette} r=${r} />
      <span class="mini-texte"><strong>${r.titre}</strong>
        <span class="sous">⏱ ${r.temps} min${r.kcal ? ` · ${r.kcal} kcal` : ''}</span>
        ${risques.length > 0 && html`<span class="alerte-carte">⚠ Déconseillé : ${risques.join(', ')}</span>`}</span>
    </a>${children}</div>`;
}
