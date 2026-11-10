// Suivi : journal alimentaire et hydratation du jour, poids et mensurations (courbes), bilan de la semaine.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { REPAS as REPAS_PLANNING, cleDate, dateDepuisCle, ajouterJours, nomJour, nomMois, semaineDe, lundiDe } from '../lib/planning.js';
import { REPAS_JOURNAL, VERRE_ML, MESURES, entreeDepuisRecette, entreeDepuisProduit, bilanJour, objectifEau, serieDePoids, tendancePoids, variationPoids, cheminCourbe, bilanSemaine, serieDeSuivi, repasSelonHeure } from '../lib/suivi.js';
import { filtrerRecettes, FILTRES_VIDES } from '../lib/recettes.js';
import { budgetPoints, pointsMaison } from '../data/regimes.js';
import { Entete, Section, Pastille, Bandeau, Puce } from '../ui/composants.js';

const COULEUR = { E: '#2f6fdb', M: '#e0489a' };
const nouvelId = () => 'j-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const nf = (x) => String(x).replace('.', ',');

function Barre({ titre, valeur, cible, unite, couleur }) {
  const pct = cible ? Math.min(100, (valeur / cible) * 100) : 0;
  return html`<div class="barre-macro"><div class="barre-tete"><span>${titre}</span><span>${nf(Math.round(valeur))}${cible ? ` / ${Math.round(cible)}` : ''} ${unite}</span></div>
    <div class="progression"><span style=${`width:${pct}%;${couleur ? `background:${couleur}` : ''}`}></span></div></div>`;
}

function AjoutRepas({ repas, jour, moi, index, plan, scans, ajouter, onFermer }) {
  const [onglet, setOnglet] = useState('planning');
  const [q, setQ] = useState('');
  const [portions, setPortions] = useState(1);
  const [grammes, setGrammes] = useState(100);
  const [libre, setLibre] = useState({ nom: '', kcal: '', p: '', g: '', l: '' });
  const planifies = [...(plan[jour] ? Object.values(plan[jour]) : [])].map((id) => index.find((r) => r.id === id)).filter(Boolean);
  const trouves = useMemo(() => (q.trim().length >= 2 ? filtrerRecettes(index, { ...FILTRES_VIDES, q }).slice(0, 8) : []), [q, index]);
  const ajRecette = (r) => { ajouter(entreeDepuisRecette(r, portions, repas, moi, jour)); onFermer(); };
  const num = (v) => (v === '' ? 0 : Number(String(v).replace(',', '.')) || 0);
  return html`<div class="ajout-repas">
    <div class="puces sans-marge">${[['planning', 'Mon menu'], ['recette', 'Recette'], ['scan', 'Produit scanné'], ['libre', 'Libre']].map(([k, n]) => html`<${Puce} key=${k} actif=${onglet === k} onClick=${() => setOnglet(k)}>${n}<//>`)}</div>
    ${(onglet === 'planning' || onglet === 'recette') && html`<div class="portions petit"><button type="button" aria-label="Moins" onClick=${() => setPortions((p) => Math.max(0.5, p - 0.5))}>−</button>
      <output>${nf(portions)} portion${portions > 1 ? 's' : ''}</output><button type="button" aria-label="Plus" onClick=${() => setPortions((p) => p + 0.5)}>+</button></div>`}
    ${onglet === 'planning' && (planifies.length ? planifies.map((r) => html`<button type="button" class="ligne-choix" key=${r.id} onClick=${() => ajRecette(r)}><strong>${r.titre}</strong><span class="sous">${r.kcal} kcal / portion</span></button>`)
      : html`<p class="note">Rien de prévu ce jour-là dans le menu. Utilisez « Recette » ou « Libre ».</p>`)}
    ${onglet === 'recette' && html`<input type="search" class="champ-recherche" placeholder="Chercher une recette…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Chercher une recette" />
      ${trouves.map((r) => html`<button type="button" class="ligne-choix" key=${r.id} onClick=${() => ajRecette(r)}><strong>${r.titre}</strong><span class="sous">${r.kcal} kcal / portion</span></button>`)}`}
    ${onglet === 'scan' && html`<div class="portions petit"><button type="button" aria-label="Moins" onClick=${() => setGrammes((g) => Math.max(10, g - 10))}>−</button><output>${grammes} g</output>
      <button type="button" aria-label="Plus" onClick=${() => setGrammes((g) => g + 10)}>+</button></div>
      ${scans.length === 0 ? html`<p class="note">Aucun produit scanné pour l'instant.</p>` : scans.slice(0, 10).map((s) => html`<button type="button" class="ligne-choix" key=${s.code}
        onClick=${() => { ajouter(entreeDepuisProduit(s.produit, grammes, repas, moi, jour)); onFermer(); }}><strong>${s.produit.nom}</strong><span class="sous">${s.produit.nutrition && s.produit.nutrition.kcal != null ? Math.round(s.produit.nutrition.kcal * grammes / 100) + ' kcal pour ' + grammes + ' g' : 'Calories inconnues'}</span></button>`)}`}
    ${onglet === 'libre' && html`<form onSubmit=${(e) => { e.preventDefault(); if (libre.nom.trim()) { ajouter({ type: 'repas', date: jour, repas, par: moi, nom: libre.nom.trim(), kcal: Math.round(num(libre.kcal)), p: num(libre.p), g: num(libre.g), l: num(libre.l), source: 'manuel', ref: '', portion: '' }); onFermer(); } }}>
      <label class="champ"><span>Qu'avez-vous mangé ?</span><input type="text" value=${libre.nom} onInput=${(e) => setLibre({ ...libre, nom: e.target.value })} required /></label>
      <div class="grille">${[['kcal', 'kcal'], ['p', 'Protéines g'], ['g', 'Glucides g'], ['l', 'Lipides g']].slice(0, 3).map(([k, t]) => html`<label class="champ" key=${k}><span>${t}</span><input type="text" inputmode="decimal" value=${libre[k]} onInput=${(e) => setLibre({ ...libre, [k]: e.target.value })} /></label>`)}</div>
      <button type="submit" class="bouton" disabled=${!libre.nom.trim()}>Ajouter</button></form>`}
    <button type="button" class="lien" onClick=${onFermer}>Fermer</button></div>`;
}

function Aujourdhui({ jour, setJour, moi, besoins, profil, journal, ajouter, supprimer, index, plan, scans, hydratation }) {
  const [ouvert, setOuvert] = useState(null);
  const b = bilanJour(journal, jour, moi);
  const cible = besoins ? besoins.cible : 0;
  const eauCible = objectifEau(profil);
  const d = dateDepuisCle(jour);
  const aujourdhui = cleDate(new Date());
  const points = (profil.regimes || []).includes('points');
  const ptsJour = points ? b.repas && Object.values(b.repas).flat().reduce((s, e) => s + (e.source === 'recette' ? pointsMaison({ kcal: e.kcal, nut: { p: e.p, g: e.g, l: e.l, f: 0, s: 0 } }) : Math.round(e.kcal / 55)), 0) : 0;
  return html`<div>
    <div class="nav-jour"><button type="button" aria-label="Jour précédent" onClick=${() => setJour(cleDate(ajouterJours(d, -1)))}>‹</button>
      <strong>${jour === aujourdhui ? 'Aujourd\'hui' : `${nomJour(d)} ${d.getDate()} ${nomMois(d)}`}</strong>
      <button type="button" aria-label="Jour suivant" onClick=${() => setJour(cleDate(ajouterJours(d, 1)))} disabled=${jour >= aujourdhui}>›</button></div>
    <div class="bilan-jour">
      <div class="grosse-valeur"><strong>${b.kcal}</strong> kcal${cible ? html` <span class="sous">sur ${cible} · ${cible - b.kcal >= 0 ? `reste ${cible - b.kcal}` : `${b.kcal - cible} de plus`}</span>` : ''}</div>
      ${cible ? html`<${Barre} titre="Calories" valeur=${b.kcal} cible=${cible} unite="kcal" />` : html`<p class="note">Complétez votre profil pour voir votre objectif.</p>`}
      ${besoins && html`<${Barre} titre="Protéines" valeur=${b.p} cible=${besoins.proteines_g} unite="g" /><${Barre} titre="Glucides" valeur=${b.g} cible=${besoins.glucides_g} unite="g" /><${Barre} titre="Lipides" valeur=${b.l} cible=${besoins.lipides_g} unite="g" />`}
      ${points && besoins && html`<p class="note">Points du jour : <strong>${ptsJour}</strong> sur ${budgetPoints(besoins.cible)}.</p>`}
    </div>
    <${Section} titre="Hydratation">
      <div class="hydratation"><div class="verres" aria-label=${`${b.eau} ml sur ${eauCible} ml`}>${Array.from({ length: Math.ceil(eauCible / VERRE_ML) }, (_, i) => html`<span key=${i} class=${(i + 1) * VERRE_ML <= b.eau ? 'plein' : ''}>💧</span>`)}</div>
        <p class="sous">${b.eau} ml sur ${eauCible} ml</p>
        <div class="puces sans-marge"><${Puce} actif=${false} onClick=${() => hydratation(jour, VERRE_ML)}>＋ Un verre (${VERRE_ML} ml)<//>
          <${Puce} actif=${false} onClick=${() => hydratation(jour, -VERRE_ML)}>− Retirer<//></div></div>
    <//>
    ${REPAS_JOURNAL.map((rp) => html`<${Section} titre=${`${rp.icone} ${rp.nom}`} key=${rp.id}>
      ${b.repas[rp.id].map((e) => html`<div class="entree-journal" key=${e.id}><span><strong>${e.nom}</strong> <span class="sous">${e.portion}</span></span><span class="sous">${e.kcal} kcal</span><button type="button" class="supprimer" aria-label=${`Retirer ${e.nom}`} onClick=${() => supprimer(e.id)}>✕</button></div>`)}
      ${ouvert === rp.id ? html`<${AjoutRepas} repas=${rp.id} jour=${jour} moi=${moi} index=${index} plan=${plan} scans=${scans} ajouter=${ajouter} onFermer=${() => setOuvert(null)} />`
        : html`<button type="button" class="ajout" onClick=${() => setOuvert(rp.id)}>＋ Ajouter</button>`}
    <//>`)}
  </div>`;
}

function CourbePoids({ poids, moi }) {
  const W = 320; const H = 140;
  const series = ['E', 'M'].map((q) => ({ q, brut: serieDePoids(poids, q) })).filter((s) => s.brut.length);
  if (!series.length) return html`<p class="note">Pas encore de pesée. Ajoutez la première ci-dessus.</p>`;
  const tous = series.flatMap((s) => s.brut);
  const debut = Math.min(...tous.map((p) => dateDepuisCle(p.date).getTime()));
  const fin = Math.max(Math.max(...tous.map((p) => dateDepuisCle(p.date).getTime())), debut + 86400000);
  const min = Math.floor(Math.min(...tous.map((p) => p.kg)) - 1); const max = Math.ceil(Math.max(...tous.map((p) => p.kg)) + 1);
  return html`<svg viewBox=${`-4 -8 ${W + 8} ${H + 16}`} class="courbe" role="img" aria-label="Courbe de poids">
    ${[0, 0.5, 1].map((t) => html`<line key=${t} x1="0" x2=${W} y1=${H * t} y2=${H * t} class="grille-svg" />`)}
    ${series.map((s) => html`<g key=${s.q}>
      <path d=${cheminCourbe(tendancePoids(s.brut), { w: W, h: H, min, max, debut, fin })} fill="none" stroke=${COULEUR[s.q]} stroke-width="3" stroke-linecap="round" />
      ${s.brut.map((p) => html`<circle key=${p.date} cx=${((dateDepuisCle(p.date).getTime() - debut) / Math.max(1, fin - debut)) * W} cy=${H - ((p.kg - min) / (max - min)) * H} r="2.5" fill=${COULEUR[s.q]} opacity=".55" />`)}</g>`)}
    <text x="0" y=${H + 12} class="axe">${min} kg</text><text x=${W} y="-1" class="axe" text-anchor="end">${max} kg</text></svg>`;
}

function Poids({ poids, moi, ecrirePoids, besoins }) {
  const [kg, setKg] = useState('');
  const [mes, setMes] = useState({});
  const [prive, setPrive] = useState(false);
  const mien = serieDePoids(poids, moi);
  const dernier = mien[mien.length - 1];
  const v30 = variationPoids(mien, 30);
  const enregistrer = (e) => {
    e.preventDefault();
    const v = Number(String(kg).replace(',', '.'));
    if (!(v > 20 && v < 400)) return;
    const mesures = Object.fromEntries(Object.entries(mes).map(([k, x]) => [k, Number(String(x).replace(',', '.'))]));
    ecrirePoids({ date: cleDate(new Date()), par: moi, kg: Math.round(v * 10) / 10, mesures, prive });
    setKg(''); setMes({});
  };
  return html`<div>
    <${Section} titre="Courbe de poids (tendance sur 7 jours)"><${CourbePoids} poids=${poids} moi=${moi} />
      <div class="legende"><span><${Pastille} qui="E" /> Eymric</span><span><${Pastille} qui="M" /> Marie</span></div>
      ${dernier && html`<p>Dernière pesée : <strong>${nf(dernier.kg)} kg</strong> (${dernier.date})${v30 !== null ? ` · ${v30 > 0 ? '+' : ''}${nf(v30)} kg sur 30 jours` : ''}</p>`}
      <p class="note">La tendance lisse les variations de la journée : regardez la direction, pas le chiffre du matin.</p><//>
    <${Section} titre="Ajouter une pesée">
      <form onSubmit=${enregistrer}>
        <label class="champ"><span>Poids (kg)</span><input type="text" inputmode="decimal" value=${kg} onInput=${(e) => setKg(e.target.value)} placeholder="ex. 62,4" /></label>
        <details class="repli"><summary>Mensurations (facultatif)</summary><div class="grille deux">${Object.entries(MESURES).map(([k, n]) => html`<label class="champ" key=${k}><span>${n} (cm)</span>
          <input type="text" inputmode="decimal" value=${mes[k] || ''} onInput=${(e) => setMes({ ...mes, [k]: e.target.value })} /></label>`)}</div></details>
        <label class="case"><input type="checkbox" checked=${prive} onChange=${(e) => setPrive(e.target.checked)} /><span>Garder cette pesée privée (l'autre ne la voit pas dans l'appli)</span></label>
        <button type="submit" class="bouton grand" disabled=${!kg.trim()}>Enregistrer</button></form>
      <p class="note">Partagé par défaut dans le couple. « Privé » masque la donnée dans l'appli de l'autre ; ce n'est pas un chiffrement.</p><//>
    ${mien.length > 0 && html`<${Section} titre="Historique"><ul class="articles">${[...mien].reverse().slice(0, 12).map((p) => html`<li class="article" key=${p.date}><span class="article-texte plein"><strong>${nf(p.kg)} kg</strong>
      <span class="sous">${p.date}${p.prive ? ' · 🔒 privé' : ''}${Object.entries(p.mesures || {}).map(([k, v]) => ` · ${MESURES[k] || k} ${nf(v)} cm`).join('')}</span></span></li>`)}</ul><//>`}
  </div>`;
}

function Semaine({ journal, poids, moi, besoins, profil }) {
  const jours = semaineDe(new Date());
  const b = bilanSemaine(journal, poids, moi, besoins ? besoins.cible : 2000, objectifEau(profil), jours, profil.objectif);
  const serie = serieDeSuivi(journal, moi);
  return html`<div>
    <${Section} titre="Votre semaine">
      ${serie > 1 && html`<${Bandeau} type="info"><p>🔥 ${serie} jours de suivi d'affilée. Continuez à votre rythme !</p><//>`}
      <div class="stats">
        <div><strong>${b.suivis}/7</strong><span class="sous">jours suivis</span></div>
        <div><strong>${b.kcal || '—'}</strong><span class="sous">kcal / jour</span></div>
        <div><strong>${b.proteines || '—'}</strong><span class="sous">g protéines</span></div>
        <div><strong>${b.eau ? nf(Math.round(b.eau / 100) / 10) : '—'}</strong><span class="sous">L d'eau</span></div></div>
      <div class="barres-semaine" aria-label="Calories par jour">${b.jours.map((j, i) => html`<div key=${i}><span style=${`height:${besoins ? Math.min(100, (j.kcal / (besoins.cible * 1.3)) * 100) : 0}%`}></span><small>${'LMMJVSD'[i]}</small></div>`)}</div>
      ${b.messages.map((m) => html`<p key=${m}>${m}</p>`)}
      ${b.suggestions.length > 0 && html`<${Bandeau} type="info" titre="Pour la semaine prochaine"><ul>${b.suggestions.map((s) => html`<li key=${s}>${s}</li>`)}</ul><//>`}
      ${b.variation !== null && html`<p>Poids : ${b.variation > 0 ? '+' : ''}${nf(b.variation)} kg cette semaine.</p>`}
      <p class="note">Bilan automatique, pensé pour encourager : aucun jour n'est un échec.</p>
    <//></div>`;
}

export function Suivi({ moi, profil, besoins, journal, poids, ops, index, plan, scans }) {
  const [vue, setVue] = useState('jour');
  const [jour, setJour] = useState(cleDate(new Date()));
  const entrees = journal;
  const hydratation = (date, ml) => {
    if (ml > 0) ops.ecrireJournal({ id: nouvelId(), type: 'eau', date, par: moi, ml });
    else { const derniere = entrees.filter((e) => e.type === 'eau' && e.date === date && e.par === moi).sort((a, b) => (b.t || 0) - (a.t || 0))[0]; if (derniere) ops.supprimerJournal(derniere.id); }
  };
  return html`<div>
    <${Entete} titre="Suivi" sous="Journal, hydratation et poids">
      <div class="onglets-internes" role="tablist">${[['jour', 'Journal'], ['poids', 'Poids'], ['semaine', 'Semaine']].map(([k, n]) => html`<button type="button" role="tab" key=${k} aria-selected=${vue === k} onClick=${() => setVue(k)}>${n}</button>`)}</div>
    <//>
    <div class="contenu">
      ${vue === 'jour' && html`<${Aujourdhui} jour=${jour} setJour=${setJour} moi=${moi} besoins=${besoins} profil=${profil} journal=${entrees}
        ajouter=${(e) => ops.ecrireJournal({ ...e, id: nouvelId() })} supprimer=${ops.supprimerJournal} index=${index} plan=${plan} scans=${scans} hydratation=${hydratation} />`}
      ${vue === 'poids' && html`<${Poids} poids=${poids} moi=${moi} ecrirePoids=${ops.ecrirePoids} besoins=${besoins} />`}
      ${vue === 'semaine' && html`<${Semaine} journal=${entrees} poids=${poids} moi=${moi} besoins=${besoins} profil=${profil} />`}
    </div></div>`;
}
