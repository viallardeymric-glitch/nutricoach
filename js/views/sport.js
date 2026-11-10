// Mode sportif : objectif de course, plan nutritionnel par phases, stratégie de course, séances (saisie à la main).
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { EPREUVES, PHASES, TYPES_JOUR, MENTION_SPORT, RAPPEL_JOUR_J, planNutritionnel, ravitaillement, repasPreCourse, recuperation, FILTRES_SPORT } from '../lib/sport.js';
import { cleDate, dateDepuisCle, nomJour, nomMois, saisonDe, proposer, graine } from '../lib/planning.js';
import { Entete, Section, Bandeau, Puce, MiniRecette } from '../ui/composants.js';

const nf = (x) => String(x).replace('.', ',');
const hm = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

function FormulaireObjectif({ sport, onEnregistrer, onAnnuler }) {
  const [v, setV] = useState(sport || { type: 'marathon', date: '', distance_km: EPREUVES.marathon.km, temps_min: 240, charge_jours: 3 });
  const ep = EPREUVES[v.type];
  const choisir = (type) => setV({ ...v, type, distance_km: EPREUVES[type].km || v.distance_km, temps_min: Math.round(EPREUVES[type].dureeH * 60) });
  const heures = Math.floor((v.temps_min || 0) / 60); const minutes = (v.temps_min || 0) % 60;
  return html`<form onSubmit=${(e) => { e.preventDefault(); if (v.date) onEnregistrer({ ...v, distance_km: Number(v.distance_km) || 0, temps_min: Number(v.temps_min) || 0 }); }}>
    <h3 class="petit-titre">Épreuve</h3>
    <div class="puces libres">${Object.entries(EPREUVES).map(([k, e]) => html`<${Puce} key=${k} actif=${v.type === k} onClick=${() => choisir(k)}>${e.nom}<//>`)}</div>
    <label class="champ"><span>Date de l'épreuve</span><input type="date" value=${v.date} min=${cleDate(new Date())} onInput=${(e) => setV({ ...v, date: e.target.value })} required /></label>
    <div class="grille deux">
      <label class="champ"><span>Distance (km)</span><input type="text" inputmode="decimal" value=${v.distance_km} onInput=${(e) => setV({ ...v, distance_km: e.target.value.replace(',', '.') })} /></label>
      <div class="champ"><span>Temps visé</span><div class="ligne-saisie sans-marge-h"><input type="number" inputmode="numeric" min="0" aria-label="Heures" value=${heures}
        onInput=${(e) => setV({ ...v, temps_min: Number(e.target.value) * 60 + minutes })} /><input type="number" inputmode="numeric" min="0" max="59" aria-label="Minutes" value=${minutes}
        onInput=${(e) => setV({ ...v, temps_min: heures * 60 + Math.min(59, Number(e.target.value)) })} /></div></div></div>
    ${ep.charge && html`<h3 class="petit-titre">Charge en glucides avant l'épreuve</h3>
      <div class="puces libres">${[2, 3].map((n) => html`<${Puce} key=${n} actif=${v.charge_jours === n} onClick=${() => setV({ ...v, charge_jours: n })}>${n} jours avant<//>`)}</div>`}
    <button type="submit" class="bouton grand" disabled=${!v.date}>Générer mon plan nutritionnel</button>
    ${onAnnuler && html`<button type="button" class="lien" onClick=${onAnnuler}>Annuler</button>`}
  </form>`;
}

function AjoutSeance({ moi, ops }) {
  const [form, setForm] = useState({ date: cleDate(new Date()), type: 'courte', duree_min: '', distance_km: '' });
  const ajouter = (liste) => {
    let n = 0;
    for (const s of liste) { if (s.duree_min > 0) { ops.ecrireSeance({ ...s, par: moi }); n++; } }
    return n;
  };
  return html`<div>
    <details class="repli"><summary>Ajouter une séance à la main</summary>
      <form onSubmit=${(e) => { e.preventDefault(); if (ajouter([{ date: form.date, type: form.type, duree_min: Number(form.duree_min), distance_km: Number(String(form.distance_km).replace(',', '.')) || 0, source: 'manuel' }])) setForm({ ...form, duree_min: '', distance_km: '' }); }}>
        <label class="champ"><span>Date</span><input type="date" value=${form.date} onInput=${(e) => setForm({ ...form, date: e.target.value })} /></label>
        <div class="puces libres">${[['courte', 'Sortie courte'], ['longue', 'Sortie longue'], ['fractionne', 'Fractionné']].map(([k, n]) => html`<${Puce} key=${k} actif=${form.type === k} onClick=${() => setForm({ ...form, type: k })}>${n}<//>`)}</div>
        <div class="grille deux"><label class="champ"><span>Durée (min)</span><input type="text" inputmode="numeric" value=${form.duree_min} onInput=${(e) => setForm({ ...form, duree_min: e.target.value })} /></label>
          <label class="champ"><span>Distance (km)</span><input type="text" inputmode="decimal" value=${form.distance_km} onInput=${(e) => setForm({ ...form, distance_km: e.target.value })} /></label></div>
        <button type="submit" class="bouton" disabled=${!Number(form.duree_min)}>Ajouter la séance</button></form></details>
  </div>`;
}

export function Sport({ profil, besoins, seances, ops, index, moi, contraintes, onChangeProfil }) {
  const [edition, setEdition] = useState(false);
  const sport = profil.sport && profil.sport.date ? profil.sport : null;
  const aujourdhui = cleDate(new Date());
  const mes = useMemo(() => seances.filter((s) => s.par === moi), [seances, moi]);
  const plan = useMemo(() => (sport && besoins ? planNutritionnel(profil, besoins, sport, aujourdhui, mes) : []), [sport, besoins, profil, mes, aujourdhui]);
  const retour = { href: '#/plus', nom: 'Plus' };
  const enregistrer = (s) => { onChangeProfil({ ...profil, sport: s, sportif: true, objectif: 'sport' }); setEdition(false); };
  if (!besoins) return html`<div><${Entete} titre="Sport" retour=${retour} /><div class="contenu"><${Bandeau} type="info"><p>Complétez d'abord votre profil (<a href="#/profil/infos">informations</a>) pour calculer vos besoins.</p><//></div></div>`;
  if (!sport || edition) {
    return html`<div><${Entete} titre="Objectif sportif" sous="Course, triathlon, vélo, musculation…" retour=${retour} />
      <div class="contenu"><${FormulaireObjectif} sport=${sport} onEnregistrer=${enregistrer} onAnnuler=${sport ? () => setEdition(false) : null} />
        <p class="note">${MENTION_SPORT}</p></div></div>`;
  }
  const ep = EPREUVES[sport.type];
  const auj = plan.find((p) => p.date === aujourdhui) || plan[0];
  const reste = auj ? auj.reste : 0;
  const rav = ravitaillement(sport.temps_min || ep.dureeH * 60);
  const pre = repasPreCourse(profil, 3);
  const rec = recuperation(profil);
  const dateCourse = dateDepuisCle(sport.date);
  const suggestions = useMemo(() => {
    if (!auj || !index) return [];
    const f = auj.laVeille ? FILTRES_SPORT.veille.test : auj.enCharge ? FILTRES_SPORT.riche_glucides.test : auj.phase === 'recuperation' ? FILTRES_SPORT.recuperation.test : auj.charge.type === 'repos' ? () => true : FILTRES_SPORT.recuperation.test;
    return proposer(index, contraintes, { jour: new Date(), repas: 'dejeuner', saison: saisonDe(new Date()), cibleKcal: auj.besoins.kcal, graine: graine(aujourdhui + 'sport'), n: 3, filtre: f });
  }, [auj, index, contraintes]);
  return html`<div>
    <${Entete} grand=${true} titre=${`${ep.nom}${sport.distance_km && ep.km !== sport.distance_km ? ` · ${nf(sport.distance_km)} km` : ''}`}
      sous=${`${nomJour(dateCourse)} ${dateCourse.getDate()} ${nomMois(dateCourse)} ${dateCourse.getFullYear()}${sport.temps_min ? ` · objectif ${hm(sport.temps_min)}` : ''}`} retour=${retour}>
      <p class="pastille-info">${reste > 0 ? `J-${reste}` : reste === 0 ? 'Jour J !' : `J+${-reste}`} · ${PHASES[auj ? auj.phase : 'base']}</p>
    <//>
    <div class="contenu">
      <${Bandeau} type="info" titre="Rappel"><p>${RAPPEL_JOUR_J}</p><//>
      ${auj && html`<${Section} titre="Aujourd'hui">
        <div class="bilan-jour"><p><strong>${TYPES_JOUR[auj.charge.type]}</strong>${auj.charge.duree_min ? ` · ${auj.charge.duree_min} min` : ''}${auj.charge.source === 'seance' ? ' (séance saisie)' : ''}</p>
          <div class="stats"><div><strong>${auj.besoins.kcal}</strong><span class="sous">kcal</span></div><div><strong>${auj.besoins.glucides_g}</strong><span class="sous">g glucides</span></div>
            <div><strong>${auj.besoins.proteines_g}</strong><span class="sous">g protéines</span></div><div><strong>${nf(Math.round(auj.besoins.eau_ml / 100) / 10)}</strong><span class="sous">L d'eau</span></div></div>
          ${auj.notes.map((n) => html`<p key=${n} class="note">${n}</p>`)}</div>
        ${suggestions.length > 0 && html`<h3 class="petit-titre">Idées de repas pour aujourd'hui</h3>${suggestions.map((r) => html`<${MiniRecette} key=${r.id} r=${r} />`)}`}
      <//>`}
      <${Section} titre="Les 14 prochains jours">
        ${plan.slice(0, 14).map((p) => { const d = dateDepuisCle(p.date); return html`<div class=${'jour-sport' + (p.enCharge || p.laVeille || p.phase === 'jour_j' ? ' special' : '')} key=${p.date}>
          <span class="js-date"><strong>${nomJour(d).slice(0, 3)} ${d.getDate()}</strong><small>${p.reste >= 0 ? `J-${p.reste}` : `J+${-p.reste}`}</small></span>
          <span class="js-texte">${TYPES_JOUR[p.charge.type]}${p.enCharge ? ' · charge glucides' : ''}${p.laVeille ? ' · veille : repas pauvres en fibres' : ''}<small>${PHASES[p.phase]}</small></span>
          <span class="js-kcal">${p.besoins.kcal} kcal<small>${p.besoins.glucides_g} g glucides</small></span></div>`; })}
      <//>
      <${Section} titre="Stratégie de course">
        <ul class="simple">
          <li><strong>Glucides :</strong> ${rav.glucides_h ? `${rav.glucides_h} g par heure, soit environ ${rav.total_glucides} g sur ${hm(sport.temps_min)}` : 'pas nécessaire sur un effort court'}. ${rav.conseil}</li>
          <li><strong>Eau :</strong> environ ${rav.eau_ml_h} ml par heure (${rav.total_eau_ml} ml au total) ; plus s'il fait chaud.</li>
          <li><strong>Sodium :</strong> environ ${rav.sodium_mg_h} mg par heure (boisson d'effort ou pastilles).</li>
          <li><strong>Avant :</strong> repas 3 à 4 heures avant, environ ${pre.glucides_g} g de glucides, peu de graisses et de fibres.</li>
          <li><strong>Après :</strong> dans l'heure, environ ${rec.glucides_g} g de glucides et ${rec.proteines_g} g de protéines. Idées : ${rec.idees.join(' ; ')}.</li></ul>
        <p class="note">${RAPPEL_JOUR_J}</p>
      <//>
      <${Section} titre="Mes séances">
        <${AjoutSeance} moi=${moi} ops=${ops} />
        ${mes.length > 0 && html`<ul class="articles">${mes.slice(0, 15).map((s) => html`<li class="article" key=${s.id}><span class="article-texte plein"><strong>${s.date}</strong>
          <span class="sous">${TYPES_JOUR[s.type] || s.type} · ${s.duree_min} min${s.distance_km ? ` · ${nf(s.distance_km)} km` : ''}${s.denivele_m ? ` · D+ ${s.denivele_m} m` : ''} · ${s.source}</span></span>
          <button type="button" class="supprimer" aria-label=${`Supprimer la séance du ${s.date}`} onClick=${() => ops.supprimerSeance(s.id)}>✕</button></li>`)}</ul>`}
        <p class="note">Le plan s'ajuste automatiquement aux séances saisies.</p>
      <//>
      <button type="button" class="bouton secondaire large" onClick=${() => setEdition(true)}>Modifier mon objectif</button>
      <button type="button" class="lien" onClick=${() => { if (window.confirm('Supprimer cet objectif sportif ?')) onChangeProfil({ ...profil, sport: null, objectif: profil.objectif === 'sport' ? 'equilibre' : profil.objectif }); }}>Supprimer l'objectif</button>
      <p class="note">${MENTION_SPORT}</p>
    </div></div>`;
}
