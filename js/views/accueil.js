// Accueil : le jour, « qu'est-ce qu'on mange ce soir ? », idées de saison, raccourcis.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { PROFILS, lib } from '../data/libelles.js';
import { repasActifs, cleDate, lundiDe, nomJour, nomMois, saisonDe, proposer, graine } from '../lib/planning.js';
import { lire } from '../core/stockage.js';
import { profilsARisque } from '../lib/profils.js';
import { Entete, Section, MiniRecette, Pictogramme } from '../ui/composants.js';
import { PHASES } from '../lib/sport.js';

const risquesDe = (r, profil) => {
  const miens = profil && profil.appliquer !== false ? profilsARisque(profil) : [];
  return r.risques.filter((x) => miens.includes(x)).map((x) => lib(PROFILS, x).toLowerCase());
};

export function Accueil({ moi, profil, besoins, index, plan, contraintes, cibleKcal, changerJour, nuage, nbFavoris, onMange, sportJour, bonus = null, urgents = [], budgetSerre = false }) {
  const [nonce, setNonce] = useState(0);
  const [rapide, setRapide] = useState(false);
  const maintenant = new Date();
  const cle = cleDate(maintenant);
  const saison = saisonDe(maintenant);
  const aujourdhui = plan[cle] || {};
  const parId = useMemo(() => new Map((index || []).map((r) => [r.id, r])), [index]);

  const ceSoir = useMemo(() => (index ? proposer(index, contraintes, {
    jour: maintenant, repas: 'diner', saison, cibleKcal, graine: graine(`${cle}|soir|${nonce}`), n: 3,
    rapideMax: rapide ? 20 : null, bonus, budgetSerre,
  }) : []), [index, contraintes, nonce, rapide, cle, bonus]);
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
      ${sportJour && html`<a class="carte-sport" href="#/sport"><span>🏃</span><span><strong>${sportJour.reste > 0 ? `J-${sportJour.reste}` : sportJour.reste === 0 ? 'Jour J' : `J+${-sportJour.reste}`} · ${PHASES[sportJour.phase]}</strong><span class="sous">${sportJour.besoins.kcal} kcal · ${sportJour.besoins.glucides_g} g de glucides aujourd'hui</span></span></a>`}
      <${Section} titre="Aujourd'hui" lien=${{ href: '#/semaine', nom: 'Voir la semaine' }}>
        ${repasActifs(lire('planning.petitdej', false)).map((rp) => {
          const r = parId.get(aujourdhui[rp.id]);
          return r ? html`<div class="repas-jour" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
              <${MiniRecette} r=${r} risques=${risquesDe(r, profil)}>${onMange && html`<button type="button" class="mini-action" aria-label=${`J'ai mangé : ${r.titre}`} onClick=${() => onMange(r.id, rp.id)}>✓ Mangé</button>`}<//></div>`
            : html`<div class="repas-jour vide" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
              <span class="sous">Rien de prévu</span></div>`;
        })}
        ${!aujourdhui.dejeuner && !aujourdhui.diner && html`<a class="bouton" href="#/semaine">✨ Préparer ma semaine</a>`}
      <//>

      ${urgents.length > 0 && html`<a class="carte-sport gaspi" href="#/frigo"><span>♻</span><span><strong>À consommer bientôt</strong><span class="sous">${urgents.slice(0, 3).map((u) => u.nom).join(', ')}${urgents.length > 3 ? '…' : ''} · voir les recettes anti-gaspi</span></span></a>`}
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
        <a class="raccourci" href="#/frigo"><span>🧊</span><strong>Frigo magique</strong><span class="sous">Cuisiner ce que j'ai</span></a>
        <a class="raccourci" href="#/scan"><span>📷</span><strong>Scanner</strong><span class="sous">Noter un produit</span></a>
        <a class="raccourci" href="#/courses"><span>🛒</span><strong>Courses</strong><span class="sous">Liste commune et stock</span></a>
        <a class="raccourci" href="#/coach"><span>💬</span><strong>Coach IA</strong><span class="sous">Une question ? Une idée ?</span></a>
        ${nuage ? html`<a class="raccourci" href="#/nous"><span>👫</span><strong>Nous deux</strong><span class="sous">Votre situation à tous les deux</span></a>`
          : html`<a class="raccourci" href="#/favoris"><span>♥</span><strong>Mes favoris</strong><span class="sous">${nbFavoris} recette${nbFavoris > 1 ? 's' : ''}</span></a>`}
      </div>
    </div>
  </div>`;
}

