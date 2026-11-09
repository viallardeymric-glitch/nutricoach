// Écran de connexion (un compte par personne, créé dans la console Firebase : pas d'inscription publique).
import { html, useState } from '../../vendor/preact-htm.js';
import { connecter, motDePasseOublie, messageErreur } from '../core/nuage.js';
import { Bandeau } from '../ui/composants.js';

export function Connexion({ statut, onReessayer }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [message, setMessage] = useState(null);   // { type, texte }
  const [attente, setAttente] = useState(false);

  const valider = async (e) => {
    e.preventDefault();
    setAttente(true); setMessage(null);
    try { await connecter(email, mdp); } catch (err) { setMessage({ type: 'alerte', texte: messageErreur(err) }); }
    setAttente(false);
  };
  const oublie = async () => {
    if (!email.trim()) { setMessage({ type: 'alerte', texte: 'Saisissez d\'abord votre adresse email.' }); return; }
    try { await motDePasseOublie(email); } catch { /* même réponse dans tous les cas */ }
    setMessage({ type: 'info', texte: 'Si ce compte existe, un email pour choisir un nouveau mot de passe vient d\'être envoyé.' });
  };

  if (statut === 'erreur') {
    return html`<div class="connexion"><h1>NutriCoach</h1>
      <p class="etat">Impossible de joindre le service de connexion. Vérifiez votre réseau.</p>
      <button type="button" class="bouton centre" onClick=${onReessayer}>Réessayer</button></div>`;
  }
  return html`<form class="connexion" onSubmit=${valider}>
    <h1>NutriCoach</h1>
    <p class="desc">Connectez-vous avec votre compte pour retrouver vos données sur tous vos appareils.</p>
    <label class="champ"><span>Adresse email</span>
      <input type="email" autocomplete="username" inputmode="email" required value=${email}
        onInput=${(e) => setEmail(e.target.value)} /></label>
    <label class="champ"><span>Mot de passe</span>
      <input type="password" autocomplete="current-password" required value=${mdp}
        onInput=${(e) => setMdp(e.target.value)} /></label>
    ${message && html`<${Bandeau} type=${message.type}><p>${message.texte}</p><//>`}
    <button type="submit" class="bouton grand" disabled=${attente}>${attente ? 'Connexion…' : 'Se connecter'}</button>
    <button type="button" class="lien" onClick=${oublie}>Mot de passe oublié ?</button>
  </form>`;
}
