// Accueil : le jour, « qu'est-ce qu'on mange ce soir ? », idées de saison, raccourcis.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { PROFILS, lib } from '../data/libelles.js';
import { REPAS, cleDate, lundiDe, nomJour, nomMois, saisonDe, proposer, graine } from '../lib/planning.js';
import { profilsARisque } from '../lib/profils.js';
import { Entete, Section, MiniRecette, Pictogramme } from '../ui/composants.js';

const risquesDe = (r, profil) => {
  const miens = profil && profil.appliquer !== false ? profilsARisque(profil) : [];
  return r.risques.filter((x) => miens.includes(x)).map((x) => lib(PROFILS, x).toLowerCase());
};

export function Accueil({ moi, profil, besoins, index, plan, contraintes, cibleKcal, changerJour, nuage, nbFavoris }) {
  const [nonce, setNonce] = useState(0);
  const [rapide, setRapide] = useState(false);
  const maintenant = new Date();
  const cle = cleDate(maintenant);
  const saison = saisonDe(maintenant);
  const aujourdhui = plan[cle] || {};
  const parId = useMemo(() => new Map((index || []).map((r) => [r.id, r])), [index]);

  const ceSoir = useMemo(() => (index ? proposer(index, contraintes, {
    jour: maintenant, repas: 'diner', saison, cibleKcal, graine: graine(`${cle}|soir|${nonce}`), n: 3,
    rapideMax: rapide ? 20 : null,
  }) : []), [index, contraintes, nonce, rapide, cle]);
  const idees = useMemo(() => (index ? proposer(index, contraintes, {
    jour: maintenant, repas: 'diner', saison, cibleKcal, graine: graine(cleDate(lundiDe(maintenant)) + '|idees'), n: 8,
    utilises: new Set(ceSoir.map((r) => r.id)),
  }) : []), [index, contraintes, ceSoir]);

  const choisirCeSoir = (r) => changerJour(cle, { ...aujourdhui, diner: r.id });
  const prenom = PERSONNES[moi].prenom;
  return html`<div>
    <${Entete} grand=${true} titre=${`Bonjour ${prenom} 👋`}
      sous=${`${nomJour(maintenant)} ${maintenant.getDate()} ${nomMois(maintenant)}`}>
      ${besoins && html`<p class="pastille-info">🎯 Objectif du jour : <strong>${besoins.cible} kcal</strong></p>`}
    <//>
    <div class="contenu">
      <${Section} titre="Aujourd'hui" lien=${{ href: '#/semaine', nom: 'Voir la semaine' }}>
        ${REPAS.map((rp) => {
          const r = parId.get(aujourdhui[rp.id]);
          return r ? html`<div class="repas-jour" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
              <${MiniRecette} r=${r} risques=${risquesDe(r, profil)} /></div>`
            : html`<div class="repas-jour vide" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
              <span class="sous">Rien de prévu</span></div>`;
        })}
        ${!aujourdhui.dejeuner && !aujourdhui.diner && html`<a class="bouton" href="#/semaine">✨ Préparer ma semaine</a>`}
      <//>

      <${Section} titre="Qu'est-ce qu'on mange ce soir ?">
        <div class="puces sans-marge">
          <button type="button" class="puce" aria-pressed=${rapide} onClick=${() => setRapide(!rapide)}>⚡ Rapide (20 min max)</button>
          <button type="button" class="puce" onClick=${() => setNonce(nonce + 1)}>🔄 Autres idées</button>
        </div>
        ${!index ? html`<p class="etat">Chargement…</p>` : ceSoir.length === 0
          ? html`<p class="etat">Aucune idée ne correspond. Essayez sans « rapide ».</p>`
          : ceSoir.map((r) => html`<${MiniRecette} key=${r.id} r=${r} risques=${risquesDe(r, profil)}>
              <button type="button" class=${'mini-action' + (aujourdhui.diner === r.id ? ' fait' : '')} onClick=${() => choisirCeSoir(r)}>
                ${aujourdhui.diner === r.id ? '✓ Ce soir' : 'Ce soir'}</button><//>`)}
      <//>

      <${Section} titre=${`Idées de saison`} lien=${{ href: '#/recettes', nom: 'Toutes les recettes' }}>
        <div class="defilement">
          ${idees.map((r) => html`<a class="idee" key=${r.id} href=${'#/recette/' + r.id}>
            <${Pictogramme} recette=${r} />
            <strong>${r.titre}</strong><span class="sous">⏱ ${r.temps} min</span></a>`)}
        </div>
      <//>

      <div class="raccourcis">
        <a class="raccourci" href="#/coach"><span>💬</span><strong>Coach IA</strong><span class="sous">Une question ? Une idée ?</span></a>
        <a class="raccourci" href="#/favoris"><span>♥</span><strong>Mes favoris</strong><span class="sous">${nbFavoris} recette${nbFavoris > 1 ? 's' : ''}</span></a>
        ${nuage ? html`<a class="raccourci" href="#/nous"><span>👫</span><strong>Nous deux</strong><span class="sous">Votre situation à tous les deux</span></a>`
          : html`<a class="raccourci" href="#/semaine"><span>📅</span><strong>Ma semaine</strong><span class="sous">Menus du déjeuner et du dîner</span></a>`}
        <a class="raccourci" href="#/recettes"><span>🍽️</span><strong>Recettes</strong><span class="sous">1 610 à découvrir</span></a>
      </div>
    </div>
  </div>`;
}

