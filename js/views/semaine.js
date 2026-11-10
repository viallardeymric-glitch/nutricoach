// Semaine : menus du couple (et des enfants), générés puis modifiables repas par repas, échangeables, avec budget estimé.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { PROFILS, ALLERGENES, lib } from '../data/libelles.js';
import { nomRegime } from '../data/regimes.js';
import { REPAS_COMPLETS, repasActifs, ajouterJours, cleDate, dateDepuisCle, lundiDe, nomJour, nomMois, saisonDe, semaineDe, proposer, genererSemaine, graine } from '../lib/planning.js';
import { risquesPour } from '../lib/profils.js';
import { budgetMenu } from '../lib/budget.js';
import { lire, ecrire } from '../core/stockage.js';
import { demarrerGlisser } from '../core/glisser.js';
import { Entete, MiniRecette, Bandeau, Puce } from '../ui/composants.js';

function resumeContraintes(c) {
  const t = [...c.allergenes.map((a) => 'sans ' + lib(ALLERGENES, a).toLowerCase()), ...c.regimes.map((g) => nomRegime(g).toLowerCase()), ...c.exclusions.map((x) => 'sans ' + x)];
  return t.length ? t.join(', ') : 'aucune contrainte particulière';
}

export function Semaine({ index, plan, contraintes, cibleKcal, ecrireJours, profil, personnes, enfants = [], parJour = {}, bonus = null, budgetSerre = false, convives = 2 }) {
  const [decalage, setDecalage] = useState(0);
  const [petitDej, setPetitDej] = useState(() => lire('planning.petitdej', false));
  const [budget, setBudget] = useState(() => lire('budget.semaine', ''));
  const [selection, setSelection] = useState(null);     // repas choisi pour être déplacé : { j, repas }
  const maintenant = new Date();
  const lundi = ajouterJours(lundiDe(maintenant), decalage * 7);
  const jours = semaineDe(lundi);
  const saison = saisonDe(ajouterJours(lundi, 3));
  const slots = repasActifs(petitDej);
  const parId = useMemo(() => new Map((index || []).map((r) => [r.id, r])), [index]);
  const aujourdhui = cleDate(maintenant);
  const miens = profil && profil.appliquer !== false ? risquesPour(profil) : [];
  const risques = (r) => r.risques.filter((x) => miens.includes(x)).map((x) => lib(PROFILS, x).toLowerCase());
  const nbRepas = jours.reduce((n, j) => n + Object.keys(plan[j] || {}).length, 0);
  const cout = useMemo(() => budgetMenu(plan, jours, parId, convives), [plan, jours.join('|'), parId, convives]);
  const cibleBudget = Number(String(budget).replace(',', '.')) || 0;

  const completer = (base) => {
    const { plan: suivant, manquants } = genererSemaine(index, jours, base, { contraintes, saison, cibleKcal, parJour, repas: slots, bonus, budgetSerre, graine: graine(jours[0] + '|' + Date.now()) });
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
    const [r] = proposer(index, contraintes, { jour: dateDepuisCle(j), repas, saison, cibleKcal: (parJour[j] && parJour[j].cibleKcal) || cibleKcal, utilises, graine: graine(`${j}|${repas}|${Date.now()}`), n: 1, bonus, budgetSerre, filtre: (parJour[j] && parJour[j].filtre) || undefined });
    if (r) ecrireJours({ [j]: { ...(plan[j] || {}), [repas]: r.id } });
  };
  const retirer = (j, repas) => { const { [repas]: _, ...reste } = plan[j] || {}; ecrireJours({ [j]: reste }); };
  // Déplacer ou échanger deux repas (touche ⇅ puis « ici », ou glisser-déposer sur ordinateur).
  const [survol, setSurvol] = useState(null);
  const deplacer = (src, dst) => {
    if (!src || (src.j === dst.j && src.repas === dst.repas)) { setSelection(null); return; }
    const a = (plan[src.j] || {})[src.repas]; const b = (plan[dst.j] || {})[dst.repas];
    const jours2 = { [src.j]: { ...(plan[src.j] || {}) } };
    if (dst.j !== src.j) jours2[dst.j] = { ...(plan[dst.j] || {}) };
    if (b) jours2[src.j][src.repas] = b; else delete jours2[src.j][src.repas];
    jours2[dst.j][dst.repas] = a;
    ecrireJours(jours2);
    setSelection(null);
  };
  const fin = ajouterJours(lundi, 6);
  const titre = lundi.getMonth() === fin.getMonth() ? `${lundi.getDate()} – ${fin.getDate()} ${nomMois(fin)}` : `${lundi.getDate()} ${nomMois(lundi)} – ${fin.getDate()} ${nomMois(fin)}`;
  const noms = [...personnes.map((id) => PERSONNES[id].prenom), ...enfants.map((e) => e.prenom)].join(', ').replace(/, ([^,]*)$/, ' et $1');

  return html`<div>
    <${Entete} titre="Ma semaine" sous=${titre}>
      <div class="nav-semaine">
        <button type="button" aria-label="Semaine précédente" onClick=${() => setDecalage(decalage - 1)}>‹</button>
        <button type="button" class="lien-blanc" onClick=${() => setDecalage(0)} disabled=${decalage === 0}>Cette semaine</button>
        <button type="button" aria-label="Semaine suivante" onClick=${() => setDecalage(decalage + 1)}>›</button>
      </div>
    <//>
    <div class="contenu">
      <p class="note">Menus pensés pour ${noms} : ${resumeContraintes(contraintes)}.</p>
      ${Object.keys(parJour).some((j) => jours.includes(j)) && html`<p class="note">🏃 Menus adaptés à votre préparation sportive : calories et glucides selon la charge, repas riches en glucides les jours de charge, pauvres en fibres la veille.</p>`}
      <div class="puces sans-marge"><${Puce} actif=${petitDej} onClick=${() => { setPetitDej(!petitDej); ecrire('planning.petitdej', !petitDej); }}>🥐 Petit-déjeuners et collations<//>
        ${budgetSerre && html`<span class="etiquette">💶 Petit budget activé</span>`}</div>
      <div class="actions-semaine">
        <button type="button" class="bouton" disabled=${!index} onClick=${() => completer(plan)}>✨ ${nbRepas ? 'Compléter la semaine' : 'Générer ma semaine'}</button>
        ${nbRepas > 0 && html`<button type="button" class="bouton secondaire" onClick=${toutRefaire}>Tout refaire</button>`}
      </div>
      ${nbRepas > 0 && html`<div class="budget-semaine">
        <p class="budget-ligne">💶 Budget estimé de la semaine : <strong>${cout.total} €</strong> pour ${String(convives).replace('.', ',')} portions adultes (≈ ${String(cout.parPersonneParJour).replace('.', ',')} € par personne et par jour).</p>
        <label class="champ ligne"><span>Mon budget (€)</span><input type="text" inputmode="decimal" value=${budget} placeholder="facultatif" onInput=${(e) => { setBudget(e.target.value); ecrire('budget.semaine', e.target.value); }} aria-label="Budget de la semaine" /></label>
        ${cibleBudget > 0 && cout.total > cibleBudget && html`<${Bandeau} type="avertissement"><p>Le menu dépasse votre budget de ${cout.total - cibleBudget} €. Activez « Petit budget » dans Profil › Objectif, ou remplacez les repas les plus chers (🔄).</p><//>`}</div>`}
      ${selection && html`<${Bandeau} type="info"><p>Choisissez où placer ce repas (« ⇄ Ici »). <button type="button" class="lien" onClick=${() => setSelection(null)}>Annuler</button></p><//>`}
      ${!index ? html`<p class="etat">Chargement…</p>` : jours.map((j) => {
        const d = dateDepuisCle(j);
        const repas = plan[j] || {};
        const kcal = Object.values(repas).reduce((s, id) => s + ((parId.get(id) || {}).kcal || 0), 0);
        return html`<section class=${'jour' + (j === aujourdhui ? ' aujourdhui' : '')} key=${j}>
          <div class="jour-tete"><strong>${nomJour(d)} ${d.getDate()}</strong>
            ${j === aujourdhui && html`<span class="badge">Aujourd'hui</span>`}
            ${kcal > 0 && html`<span class="sous">≈ ${kcal} kcal</span>`}</div>
          ${slots.map((rp) => {
            const r = parId.get(repas[rp.id]);
            const cible = selection && !(selection.j === j && selection.repas === rp.id);
            const survole = survol && survol.j === j && survol.repas === rp.id;
            return html`<div class=${'repas-jour' + (cible ? ' depl' : '') + (survole ? ' depot' : '')} key=${rp.id} data-glisser-j=${j} data-glisser-repas=${rp.id}>
              <span class="repas-nom">${rp.icone} ${rp.nom}</span>
              ${r ? html`<${MiniRecette} r=${r} risques=${risques(r)}>
                  ${cible ? html`<button type="button" class="mini-action" onClick=${() => deplacer(selection, { j, repas: rp.id })}>⇄ Ici</button>` : html`
                    <button type="button" class="mini-action poignee" aria-label=${`Glisser le ${rp.nom.toLowerCase()} du ${nomJour(d)} pour le déplacer`} onPointerDown=${(e) => demarrerGlisser(e, { source: { j, repas: rp.id }, fantome: `${rp.icone} ${r.titre}`, onSurvol: setSurvol, onDepot: deplacer })}>⠿</button>
                    <button type="button" class="mini-action" aria-label=${`Déplacer le ${rp.nom.toLowerCase()} du ${nomJour(d)}`} onClick=${() => setSelection({ j, repas: rp.id })}>⇅</button>
                    <button type="button" class="mini-action" aria-label=${`Changer le ${rp.nom.toLowerCase()} du ${nomJour(d)}`} onClick=${() => autreRepas(j, rp.id)}>🔄</button>
                    <button type="button" class="mini-action" aria-label=${`Retirer le ${rp.nom.toLowerCase()} du ${nomJour(d)}`} onClick=${() => retirer(j, rp.id)}>✕</button>`}<//>`
                : cible ? html`<button type="button" class="ajout" onClick=${() => deplacer(selection, { j, repas: rp.id })}>⇄ Déplacer ici</button>`
                : html`<button type="button" class="ajout" onClick=${() => autreRepas(j, rp.id)}>＋ Proposer un repas</button>`}
            </div>`;
          })}
        </section>`;
      })}
      <p class="note">Les calories sont celles d'une portion par repas. Les menus évitent poisson et plats déconseillés selon vos profils, et visent au moins 2 repas de poisson et 2 végétariens par semaine. Vous pouvez aussi glisser un repas avec la poignée ⠿ (au doigt ou à la souris) sur un autre. Le budget est une estimation.</p>
    </div></div>`;
}
