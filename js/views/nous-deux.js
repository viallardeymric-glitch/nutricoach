// Vue « Nous deux » : la situation de chacun et les favoris du couple (tout est partagé par défaut).
import { html } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { REGIMES, ALLERGENES } from '../data/libelles.js';
import { OBJECTIFS, calculerBesoins } from '../lib/besoins.js';
import { profilComplet } from '../lib/profils.js';
import { Pastille, Bandeau, Entete } from '../ui/composants.js';

function situation(p) {
  const s = [];
  if (p.grossesse > 0) s.push(`Enceinte (${p.grossesse === 1 ? '1er' : p.grossesse + 'e'} trimestre)`);
  if (p.allaitement) s.push('Allaitement');
  if (p.sportif) s.push('Sportif');
  if (p.convalescence) s.push('Convalescence');
  return s;
}

function Carte({ id, profil, nbFavoris, moi }) {
  const prenom = PERSONNES[id].prenom;
  if (!profil) {
    return html`<section class="carte-nous"><h2><${Pastille} qui=${id} /> ${prenom}${id === moi ? ' (moi)' : ''}</h2>
      <p class="note">Pas encore de profil enregistré.</p></section>`;
  }
  const b = profilComplet(profil) ? calculerBesoins(profil) : null;
  const etiquettes = [...situation(profil), ...profil.regimes.map((g) => REGIMES[g] || g)];
  return html`<section class="carte-nous">
    <h2><${Pastille} qui=${id} /> ${prenom}${id === moi ? ' (moi)' : ''}</h2>
    <p>${OBJECTIFS[profil.objectif] || OBJECTIFS.equilibre}</p>
    ${b ? html`<p class="grosse-valeur"><strong>${b.cible}</strong> kcal par jour
      <span class="sous"> · P ${b.proteines_g} g · G ${b.glucides_g} g · L ${b.lipides_g} g</span></p>`
      : html`<p class="note">Profil incomplet : besoins non calculés.</p>`}
    ${etiquettes.length > 0 && html`<div class="etiquettes">${etiquettes.map((t) => html`<span class="etiquette">${t}</span>`)}</div>`}
    ${profil.allergenes.length > 0 && html`<div class="etiquettes"><strong>Évite :</strong>
      ${profil.allergenes.map((a) => html`<span class="etiquette allergene">${ALLERGENES[a] || a}</span>`)}</div>`}
    <p class="sous">♥ ${nbFavoris} favori${nbFavoris > 1 ? 's' : ''}</p>
  </section>`;
}

export function NousDeux({ moi, profils, favorisNuage, erreurSynchro }) {
  const nb = (q) => (favorisNuage || []).filter((f) => f.par === q).length;
  return html`<div>
    <${Entete} titre="Nous deux" sous="Votre situation à tous les deux" retour=${{ href: '#/', nom: 'Accueil' }} />
    <div class="contenu">
      ${erreurSynchro && html`<${Bandeau} type="alerte"><p>La synchronisation est interrompue. Vos modifications sont gardées sur ce téléphone et partiront dès que possible.</p><//>`}
      ${!profils ? html`<p class="etat">Chargement…</p>` : ['E', 'M'].map((id) => html`<${Carte} key=${id} id=${id}
        profil=${profils[id]} nbFavoris=${nb(id)} moi=${moi} />`)}
      <p class="note">Tout est partagé entre vous deux par défaut. Une option « privé » pour certaines données viendra plus tard.</p>
    </div></div>`;
}
