// Filet de sécurité : si un écran plante, on affiche un message avec de quoi réparer au lieu d'une page blanche.
import { html, Component } from '../../vendor/preact-htm.js';

export class Garde extends Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  componentDidCatch(erreur) { this.setState({ erreur }); }
  render({ children }, { erreur }) {
    if (!erreur) return children;
    const reparer = () => {
      if (!window.confirm('Effacer les données enregistrées sur CE téléphone (profil, favoris, menus locaux, réglages) ? Si vous êtes connecté, vos données partagées restent dans le nuage.')) return;
      try { for (const k of Object.keys(localStorage)) if (k.startsWith('nutricoach.')) localStorage.removeItem(k); } catch { /* ignoré */ }
      location.hash = '#/'; location.reload();
    };
    return html`<main class="contenu garde">
      <h1>Oups, un problème est survenu</h1>
      <p>L'appli n'a pas pu afficher cet écran. Vos données ne sont pas perdues.</p>
      <button type="button" class="bouton grand" onClick=${() => { location.hash = '#/'; location.reload(); }}>Recharger l'appli</button>
      <button type="button" class="bouton secondaire large" onClick=${reparer}>Réparer : effacer les données locales de ce téléphone</button>
      <p class="note">Détail technique : ${String(erreur && erreur.message || erreur).slice(0, 160)}</p>
    </main>`;
  }
}
