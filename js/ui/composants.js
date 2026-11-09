// Petits composants réutilisables.
import { html } from '../../vendor/preact-htm.js';
import { pictogramme } from '../data/pictogrammes.js';

export function Puce({ actif, onClick, exclu, children }) {
  return html`<button type="button" class=${'puce' + (exclu ? ' exclu' : '')}
    aria-pressed=${actif} onClick=${onClick}>${children}</button>`;
}

export function Pictogramme({ recette, grand }) {
  return html`<span class=${'picto' + (grand ? ' grand' : '')} aria-hidden="true">${pictogramme(recette.sous_categorie, recette.categorie)}</span>`;
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
    ${onglets.map((o) => html`<a key=${o.id} href=${o.href} class=${o.id === actif ? 'actif' : ''}
      aria-current=${o.id === actif ? 'page' : undefined}><span aria-hidden="true">${o.icone}</span>${o.nom}</a>`)}
  </nav>`;
}
