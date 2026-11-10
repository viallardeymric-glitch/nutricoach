// « Plus » : le reste de l'appli, les réglages (thème, ordre des rayons, sauvegarde) et les sources.
import { html, useState } from '../../vendor/preact-htm.js';
import { lire, ecrire } from '../core/stockage.js';
import { RAYONS } from '../data/rayons.js';
import { SOURCES, VERSION_REGLES, MENTION_GENERALE } from '../data/sources.js';
import { REGLES_ALERTE } from '../data/deconseilles.js';
import { VERSION_ADDITIFS } from '../data/additifs.js';
import { PROFILS, lib } from '../data/libelles.js';
import { Entete, Rang, Puce, Bandeau } from '../ui/composants.js';
import { construireSauvegarde, lireSauvegarde } from '../lib/sauvegarde.js';
import { PERSONNES } from '../core/config.js';
import { ageDepuis } from '../lib/profils.js';
import { chargerAppareils, enregistrerAppareils, MODELES_THERMOMIX } from '../core/appareils.js';

export const THEMES = { lagon: 'Lagon', rose: 'Rose', soleil: 'Soleil', marine: 'Marine' };
/** Thème d'une personne tant qu'elle n'en a pas choisi un : rose pour Marie. */
export const themeParDefaut = (moi) => (moi === 'M' ? 'rose' : 'lagon');
export const appliquerTheme = (t) => { document.documentElement.dataset.theme = THEMES[t] ? t : 'lagon'; };

function OrdreRayons() {
  const [ordre, setOrdre] = useState(() => { const o = lire('rayons.ordre', null); return Array.isArray(o) && o.length === RAYONS.length ? o : RAYONS.map((r) => r.id); });
  const deplacer = (i, d) => { const o = [...ordre]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setOrdre(o); ecrire('rayons.ordre', o); };
  return html`<ol class="ordre-rayons">${ordre.map((id, i) => { const r = RAYONS.find((x) => x.id === id); return html`<li key=${id}>
    <span>${r.icone} ${r.nom}</span><span><button type="button" aria-label=${`Monter ${r.nom}`} onClick=${() => deplacer(i, -1)} disabled=${i === 0}>↑</button>
    <button type="button" aria-label=${`Descendre ${r.nom}`} onClick=${() => deplacer(i, 1)} disabled=${i === ordre.length - 1}>↓</button></span></li>`; })}</ol>`;
}

function Appareils() {
  const [a, setA] = useState(chargerAppareils);
  const maj = (c) => { const s = { ...a, ...c }; setA(s); enregistrerAppareils(s); };
  return html`<div>
    <div class="puces sans-marge">
      <${Puce} actif=${a.four} onClick=${() => maj({ four: !a.four })}>Four<//>
      <${Puce} actif=${a.thermomix} onClick=${() => maj({ thermomix: !a.thermomix })}>Thermomix<//>
      <${Puce} actif=${a.cookeo} onClick=${() => maj({ cookeo: !a.cookeo })}>Cookeo<//>
      <${Puce} actif=${a.airfryer} onClick=${() => maj({ airfryer: !a.airfryer })}>Airfryer<//>
      <${Puce} actif=${a.multicuiseur} onClick=${() => maj({ multicuiseur: !a.multicuiseur })}>Multicuiseur<//></div>
    ${a.thermomix && html`<div class="puces sans-marge">${MODELES_THERMOMIX.map((m) => html`<${Puce} key=${m} actif=${a.modele === m} onClick=${() => maj({ modele: m })}>${m}<//>`)}</div>`}
    <div class="puces sans-marge">${[1, 2, 3, 4].map((n) => html`<${Puce} key=${n} actif=${a.plaques === n} onClick=${() => maj({ plaques: n })}>${n} plaque${n > 1 ? 's' : ''}<//>`)}</div>
    <p class="note">Utilisés pour le batch cooking, la version Thermomix et les autres méthodes de cuisson.</p></div>`;
}

function sauvegarder() {
  const copie = construireSauvegarde(localStorage);
  const url = URL.createObjectURL(new Blob([JSON.stringify(copie, null, 1)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `nutricoach-sauvegarde-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(url);
}

function Restaurer() {
  const [msg, setMsg] = useState(null);
  const lireFichier = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = lireSauvegarde(await f.text());
    if (r.erreur) { setMsg({ type: 'alerte', texte: r.erreur }); return; }
    if (!window.confirm(`Restaurer ${r.entrees.length} élément${r.entrees.length > 1 ? 's' : ''} ? Cela remplace les données de ce téléphone (profil, favoris, menus, courses…).`)) return;
    for (const [k, v] of r.entrees) localStorage.setItem(k, v);
    setMsg({ type: 'info', texte: 'Données restaurées. L\'appli va redémarrer…' });
    setTimeout(() => location.reload(), 900);
  };
  return html`<div>
    ${msg && html`<${Bandeau} type=${msg.type}><p>${msg.texte}</p><//>`}
    <label class="bouton secondaire fichier">📂 Restaurer une sauvegarde<input type="file" accept=".json,application/json" aria-label="Restaurer une sauvegarde" onChange=${lireFichier} /></label></div>`;
}

export function Plus({ enceinte = false, nuage, section, moi, profil = null }) {
  const [theme, setTheme] = useState(() => lire('theme', themeParDefaut(moi)));
  if (section === 'sources') {
    const par = {};
    for (const r of REGLES_ALERTE) for (const p of r.profils) (par[p] = par[p] || []).push(r);
    return html`<div><${Entete} titre="Sources et règles" sous=${`Règles d'alerte version ${VERSION_REGLES}`} retour=${{ href: '#/plus', nom: 'Plus' }} />
      <div class="contenu">
        <p class="desc">${MENTION_GENERALE}</p>
        <h2 class="petit-titre">Sources officielles</h2>
        <ul class="simple">${SOURCES.map((s) => html`<li key=${s.id}><a href=${s.url} target="_blank" rel="noopener">${s.nom}</a> : ${s.sujet}</li>`)}</ul>
        <h2 class="petit-titre">Aliments déconseillés, par profil</h2>
        ${Object.entries(par).map(([p, regles]) => html`<div key=${p}><h3 class="sous-titre">${lib(PROFILS, p)}</h3>
          <ul class="simple">${regles.map((r) => html`<li key=${r.id}>${r.niveau === 'rouge' ? '⛔' : '⚠'} ${r.raison} <span class="sous">(${r.source})</span></li>`)}</ul></div>`)}
        <p class="note">Ces règles sont générales et simplifiées. Elles sont versionnées (${VERSION_REGLES}) et doivent être relues par un professionnel de santé. Table d'additifs : version ${VERSION_ADDITIFS}.</p>
      </div></div>`;
  }
  const prenom = PERSONNES[moi] ? PERSONNES[moi].prenom : '';
  const age = profil && profil.naissance ? ageDepuis(profil.naissance) : null;
  const situation = [];
  if (profil) {
    if (profil.sexe) situation.push(profil.sexe === 'femme' ? 'Femme' : 'Homme');
    if (age != null) situation.push(`${age} ans`);
    if (profil.grossesse > 0) situation.push(`enceinte (${profil.grossesse === 1 ? '1er' : profil.grossesse + 'e'} trim.)`);
    if (profil.allaitement) situation.push('allaitement');
    if (profil.sportif) situation.push('sportif');
  }
  return html`<div><${Entete} grand=${true} titre="Plus" sous="Tout le reste de NutriCoach" />
    <div class="contenu">
      <a class="carte-profil" href="#/profil"><span class="avatar" aria-hidden="true">${prenom ? prenom[0] : '👤'}</span>
        <span class="rang-texte"><strong>Mon profil${prenom ? ` : ${prenom}` : ''}</strong>
          <span class="sous">${situation.length ? situation.join(' · ') : 'À compléter : date de naissance, objectif, régimes, allergies'}</span></span><span class="chevron" aria-hidden="true">›</span></a>
      <h2 class="petit-titre">Au quotidien</h2>
      <div class="rangs">
        <${Rang} icone="🍽️" titre="Recettes" sous="1 610 recettes à chercher" href="#/recettes" />
        ${enceinte && html`<${Rang} icone="📅" titre="Ma semaine" sous="Menus et planning" href="#/semaine" />`}
        <${Rang} icone="🛒" titre="Courses" sous="Liste commune et stock" href="#/courses" />
        <${Rang} icone="📝" titre="Mes recettes" sous="Ajouter, importer ou exporter des recettes" href="#/mes-recettes" />
        <${Rang} icone="🧊" titre="Frigo magique" sous="Recettes avec ce que j'ai, anti-gaspi" href="#/frigo" />
        <${Rang} icone="🍱" titre="Batch cooking" sous="Une session, toute la semaine" href="#/batch" />
        <${Rang} icone="♥" titre="Mes favoris" sous="Recettes préférées" href="#/favoris" />
      </div>
      <h2 class="petit-titre">Santé et sport</h2>
      <div class="rangs">
        <${Rang} icone="📈" titre="Suivi" sous="Poids, journal, eau" href="#/suivi" />
        ${enceinte && html`<${Rang} icone="🤰" titre="Grossesse : que puis-je manger ?" sous="Autorisé, déconseillé, interdit" href="#/grossesse" />`}
        <${Rang} icone="🏃" titre="Sport et compétition" sous="Plan nutritionnel, ravitaillement" href="#/sport" />
        <${Rang} icone="🕘" titre="Historique des scans" sous="Produits scannés, partagés" href="#/scans" />
      </div>
      ${nuage && html`<h2 class="petit-titre">À deux</h2>
      <div class="rangs"><${Rang} icone="👫" titre="Nous deux" sous="Votre situation à tous les deux" href="#/nous" />
        <${Rang} icone="🧒" titre="Enfants" sous="Profils, allergies, portions" href="#/profil/enfants" /></div>`}
      <h2 class="petit-titre">Réglages</h2>
      <div class="rangs">
        <${Rang} icone="💬" titre="Coach IA : clés Gemini et Groq" sous="Réponses rapides avec les deux IA" href="#/profil/coach" />
        <${Rang} icone="📷" titre="Photos des recettes" sous="Clés Pexels et Unsplash, miniatures" href="#/profil/photos" />
        <${Rang} icone="🔒" titre="Code PIN et Face ID" sous="Protéger l'appli" href="#/profil/securite" />
        <${Rang} icone="📚" titre="Sources et règles d'alerte" sous="HAS, ANSES, Santé publique France, PNNS" href="#/sources" />
      </div>
      <h2 class="petit-titre">Thème de couleur</h2>
      <div class="puces sans-marge">${Object.entries(THEMES).map(([k, n]) => html`<${Puce} key=${k} actif=${theme === k} onClick=${() => { setTheme(k); ecrire('theme', k); appliquerTheme(k); }}>${n}<//>`)}</div>
      <p class="note">Le mode sombre suit automatiquement celui de votre téléphone.</p>
      <h2 class="petit-titre">Appareils de cuisine</h2>
      <${Appareils} />
      <h2 class="petit-titre">Ordre des rayons (courses)</h2>
      <details class="repli"><summary>Adapter à votre supermarché</summary><${OrdreRayons} /></details>
      <h2 class="petit-titre">Mes données</h2>
      <button type="button" class="bouton secondaire" onClick=${sauvegarder}>💾 Sauvegarder les données de ce téléphone</button>
      <${Restaurer} />
      <p class="note">Le fichier ne contient ni code PIN, ni Face ID, ni aucune clé (coach, photos), ni identifiants Open Food Facts : à ressaisir après une restauration. Gardez-le en lieu sûr, il contient votre profil et votre santé. Si vous êtes connectés, vos données restent aussi dans la base partagée.</p>
      <p class="note">NutriCoach — ${MENTION_GENERALE}</p>
    </div></div>`;
}
