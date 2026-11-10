// Semaine : menus du déjeuner et du dîner pour le couple, générés puis modifiables repas par repas.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { PROFILS, ALLERGENES, lib } from '../data/libelles.js';
import { nomRegime } from '../data/regimes.js';
import { REPAS, ajouterJours, cleDate, dateDepuisCle, lundiDe, nomJour, nomMois, saisonDe, semaineDe, proposer, genererSemaine, graine } from '../lib/planning.js';
import { profilsARisque } from '../lib/profils.js';
import { Entete, MiniRecette, Bandeau } from '../ui/composants.js';

function resumeContraintes(c) {
  const t = [...c.allergenes.map((a) => 'sans ' + lib(ALLERGENES, a).toLowerCase()), ...c.regimes.map((g) => nomRegime(g).toLowerCase()),
    ...c.exclusions.map((x) => 'sans ' + x)];
  return t.length ? t.join(', ') : 'aucune contrainte particulière';
}

export function Semaine({ index, plan, contraintes, cibleKcal, ecrireJours, profil, personnes }) {
  const [decalage, setDecalage] = useState(0);
  const maintenant = new Date();
  const lundi = ajouterJours(lundiDe(maintenant), decalage * 7);
  const jours = semaineDe(lundi);
  const saison = saisonDe(ajouterJours(lundi, 3));
  const parId = useMemo(() => new Map((index || []).map((r) => [r.id, r])), [index]);
  const aujourdhui = cleDate(maintenant);
  const miens = profil && profil.appliquer !== false ? profilsARisque(profil) : [];
  const risques = (r) => r.risques.filter((x) => miens.includes(x)).map((x) => lib(PROFILS, x).toLowerCase());
  const nbRepas = jours.reduce((n, j) => n + Object.keys(plan[j] || {}).length, 0);

  const completer = (base) => {
    const { plan: suivant, manquants } = genererSemaine(index, jours, base, { contraintes, saison, cibleKcal, graine: graine(jours[0] + '|' + Date.now()) });
    const changes = {};
    for (const j of jours) if (JSON.stringify(suivant[j]) !== JSON.stringify(base[j] || {})) changes[j] = suivant[j];
    ecrireJours(changes);
    return manquants;
  };
  const toutRefaire = () => {
    if (nbRepas && !window.confirm('Remplacer tous les repas de cette semaine par un nouveau menu ?')) return;
    completer({});
  };
  const autreRepas = (j, repas) => {
    const utilises = new Set(jours.flatMap((x) => Object.values(plan[x] || {})));
    const [r] = proposer(index, contraintes, { jour: dateDepuisCle(j), repas, saison, cibleKcal, utilises, graine: graine(`${j}|${repas}|${Date.now()}`), n: 1 });
    if (r) ecrireJours({ [j]: { ...(plan[j] || {}), [repas]: r.id } });
  };
  const retirer = (j, repas) => {
    const { [repas]: _, ...reste } = plan[j] || {};
    ecrireJours({ [j]: reste });
  };
  const fin = ajouterJours(lundi, 6);
  const titre = lundi.getMonth() === fin.getMonth()
    ? `${lundi.getDate()} – ${fin.getDate()} ${nomMois(fin)}` : `${lundi.getDate()} ${nomMois(lundi)} – ${fin.getDate()} ${nomMois(fin)}`;

  return html`<div>
    <${Entete} titre="Ma semaine" sous=${titre}>
      <div class="nav-semaine">
        <button type="button" aria-label="Semaine précédente" onClick=${() => setDecalage(decalage - 1)}>‹</button>
        <button type="button" class="lien-blanc" onClick=${() => setDecalage(0)} disabled=${decalage === 0}>Cette semaine</button>
        <button type="button" aria-label="Semaine suivante" onClick=${() => setDecalage(decalage + 1)}>›</button>
      </div>
    <//>
    <div class="contenu">
      <p class="note">Menus pensés pour ${personnes.map((id) => PERSONNES[id].prenom).join(' et ')} : ${resumeContraintes(contraintes)}.</p>
      <div class="actions-semaine">
        <button type="button" class="bouton" disabled=${!index} onClick=${() => completer(plan)}>✨ ${nbRepas ? 'Compléter la semaine' : 'Générer ma semaine'}</button>
        ${nbRepas > 0 && html`<button type="button" class="bouton secondaire" onClick=${toutRefaire}>Tout refaire</button>`}
      </div>
      ${!index ? html`<p class="etat">Chargement…</p>` : jours.map((j) => {
        const d = dateDepuisCle(j);
        const repas = plan[j] || {};
        const kcal = Object.values(repas).reduce((s, id) => s + ((parId.get(id) || {}).kcal || 0), 0);
        return html`<section class=${'jour' + (j === aujourdhui ? ' aujourdhui' : '')} key=${j}>
          <div class="jour-tete"><strong>${nomJour(d)} ${d.getDate()}</strong>
            ${j === aujourdhui && html`<span class="badge">Aujourd'hui</span>`}
            ${kcal > 0 && html`<span class="sous">≈ ${kcal} kcal</span>`}</div>
          ${REPAS.map((rp) => {
            const r = parId.get(repas[rp.id]);
            return r ? html`<div class="repas-jour" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
                <${MiniRecette} r=${r} risques=${risques(r)}>
                  <button type="button" class="mini-action" aria-label=${`Changer le ${rp.nom.toLowerCase()} du ${nomJour(d)}`} onClick=${() => autreRepas(j, rp.id)}>🔄</button>
                  <button type="button" class="mini-action" aria-label=${`Retirer le ${rp.nom.toLowerCase()} du ${nomJour(d)}`} onClick=${() => retirer(j, rp.id)}>✕</button><//></div>`
              : html`<div class="repas-jour" key=${rp.id}><span class="repas-nom">${rp.icone} ${rp.nom}</span>
                <button type="button" class="ajout" onClick=${() => autreRepas(j, rp.id)}>＋ Proposer un repas</button></div>`;
          })}
        </section>`;
      })}
      <p class="note">Les calories sont celles d'une portion par repas, hors petit-déjeuner et collations. Les menus évitent poisson et plats déconseillés selon vos profils, et visent au moins 2 repas de poisson et 2 végétariens par semaine.</p>
    </div></div>`;
}
