// Écran « Profil » : qui je suis, mes données, mes régimes et exclusions, mes besoins.
import { html } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { REGIMES, ALLERGENES } from '../data/libelles.js';
import { ACTIVITES, OBJECTIFS, calculerBesoins } from '../lib/besoins.js';
import { validerProfil, profilComplet, LIMITES } from '../lib/profils.js';
import { basculer } from '../lib/recettes.js';
import { Puce, Pastille, Bandeau } from '../ui/composants.js';

const CONDITIONS = { diabete: 'Diabète', hypertension: 'Hypertension', immunodeprime: 'Système immunitaire affaibli' };
// Ces régimes se déduisent de la section « Ma situation » (grossesse, sportif, diabète).
const REGIMES_DEJA_AILLEURS = ['omnivore', 'enceinte', 'sportif', 'diabetique'];
const TRIMESTRES = [[0, 'Non'], [1, '1er trimestre'], [2, '2e trimestre'], [3, '3e trimestre']];

function ChoixPersonne({ onChoisir }) {
  return html`<div class="fiche-corps">
    <h1>Qui utilise ce téléphone ?</h1>
    <p class="desc">Ce choix reste sur cet appareil. Vous pourrez le changer plus tard.</p>
    ${Object.entries(PERSONNES).map(([id, p]) => html`<button type="button" class="bouton grand" key=${id}
      onClick=${() => onChoisir(id)}><${Pastille} qui=${id} /> Je suis ${p.prenom}</button>`)}
  </div>`;
}

function Champ({ etiquette, erreur, children }) {
  return html`<label class="champ"><span>${etiquette}</span>${children}${erreur && html`<small class="erreur-champ">${erreur}</small>`}</label>`;
}

function Nombre({ p, champ, unite, maj, erreurs }) {
  return html`<${Champ} etiquette=${`${{ age: 'Âge', poids_kg: 'Poids', taille_cm: 'Taille' }[champ]} (${unite})`}
    erreur=${p[champ] !== '' && erreurs[champ]}>
    <input type="number" inputmode="decimal" min=${LIMITES[champ][0]} max=${LIMITES[champ][1]} step=${champ === 'poids_kg' ? '0.1' : '1'}
      value=${p[champ]} onInput=${(e) => maj({ [champ]: e.target.value === '' ? '' : Number(e.target.value) })} /><//>`;
}

export function Profil({ moi, profil, onMoi, onChange }) {
  if (!moi) return html`<${ChoixPersonne} onChoisir=${onMoi} />`;
  const p = profil;
  const maj = (changes) => onChange({ ...p, ...changes });
  const erreurs = validerProfil(p);
  const complet = profilComplet(p);
  const b = complet ? calculerBesoins(p) : null;
  const femme = p.sexe === 'femme';
  return html`<div>
    <header class="entete"><h1><${Pastille} qui=${moi} /> Profil de ${PERSONNES[moi].prenom}</h1></header>
    <div class="fiche-corps">
      <button type="button" class="lien" onClick=${() => onMoi(moi === 'E' ? 'M' : 'E')}>Ce n'est pas moi : passer à ${PERSONNES[moi === 'E' ? 'M' : 'E'].prenom}</button>

      <h2 class="petit-titre">Moi</h2>
      <div class="puces sans-marge">
        ${[['femme', 'Femme'], ['homme', 'Homme']].map(([v, n]) => html`<${Puce} key=${v} actif=${p.sexe === v}
          onClick=${() => maj({ sexe: v, ...(v === 'homme' ? { grossesse: 0, allaitement: false } : {}) })}>${n}<//>`)}
      </div>
      <div class="grille">
        <${Nombre} p=${p} champ="age" unite="ans" maj=${maj} erreurs=${erreurs} />
        <${Nombre} p=${p} champ="poids_kg" unite="kg" maj=${maj} erreurs=${erreurs} />
        <${Nombre} p=${p} champ="taille_cm" unite="cm" maj=${maj} erreurs=${erreurs} />
      </div>

      <h2 class="petit-titre">Activité physique</h2>
      <div class="puces sans-marge">${Object.entries(ACTIVITES).map(([k, a]) => html`<${Puce} key=${k} actif=${p.activite === k}
        onClick=${() => maj({ activite: k })}>${a.nom}<//>`)}</div>
      <p class="note">${ACTIVITES[p.activite]?.aide}</p>

      <h2 class="petit-titre">Objectif</h2>
      <div class="puces sans-marge">${Object.entries(OBJECTIFS).map(([k, n]) => html`<${Puce} key=${k} actif=${p.objectif === k}
        onClick=${() => maj({ objectif: k })}>${n}<//>`)}</div>

      <h2 class="petit-titre">Ma situation</h2>
      ${femme && html`<p class="note">Grossesse</p>
        <div class="puces sans-marge">${TRIMESTRES.map(([v, n]) => html`<${Puce} key=${v} actif=${p.grossesse === v}
          onClick=${() => maj({ grossesse: v })}>${n}<//>`)}</div>`}
      <div class="puces sans-marge">
        ${femme && html`<${Puce} actif=${p.allaitement} onClick=${() => maj({ allaitement: !p.allaitement })}>Allaitement<//>`}
        <${Puce} actif=${p.sportif} onClick=${() => maj({ sportif: !p.sportif })}>Sportif<//>
        <${Puce} actif=${p.convalescence} onClick=${() => maj({ convalescence: !p.convalescence })}>Convalescence<//>
        ${Object.entries(CONDITIONS).map(([k, n]) => html`<${Puce} key=${k} actif=${p.conditions.includes(k)}
          onClick=${() => maj({ conditions: basculer(p.conditions, k) })}>${n}<//>`)}
      </div>

      <h2 class="petit-titre">Mes régimes</h2>
      <div class="puces sans-marge">${Object.keys(REGIMES).filter((k) => !REGIMES_DEJA_AILLEURS.includes(k)).map((k) => html`<${Puce} key=${k}
        actif=${p.regimes.includes(k)} onClick=${() => maj({ regimes: basculer(p.regimes, k) })}>${REGIMES[k]}<//>`)}</div>

      <h2 class="petit-titre">Allergies et intolérances</h2>
      <div class="puces sans-marge">${Object.entries(ALLERGENES).map(([k, n]) => html`<${Puce} key=${k} exclu=${true}
        actif=${p.allergenes.includes(k)} onClick=${() => maj({ allergenes: basculer(p.allergenes, k) })}>${n}<//>`)}</div>

      <${Champ} etiquette="Aliments que je n'aime pas (séparés par des virgules)">
        <input type="text" value=${p.exclusions} placeholder="ex. coriandre, olives"
          onInput=${(e) => maj({ exclusions: e.target.value })} /><//>

      <h2 class="petit-titre">Mes besoins</h2>
      ${!complet
        ? html`<${Bandeau} type="info"><p>Renseignez votre sexe, âge, poids et taille pour calculer vos besoins.</p><//>`
        : html`<div class="besoins">
            <div class="grosse-valeur"><strong>${b.cible}</strong> kcal par jour</div>
            <table class="nutrition"><tbody>
              <tr><th scope="row">Protéines</th><td>${b.proteines_g} g</td></tr>
              <tr><th scope="row">Glucides</th><td>${b.glucides_g} g</td></tr>
              <tr><th scope="row">Lipides</th><td>${b.lipides_g} g</td></tr>
              <tr><th scope="row">Fibres (au moins)</th><td>${b.fibres_g} g</td></tr>
              <tr><th scope="row">Sel (au plus)</th><td>${b.sel_max_g} g</td></tr>
            </tbody></table>
            <p class="note">Métabolisme de base ${b.bmr} kcal, dépense estimée ${b.tdee} kcal, IMC ${String(b.imc).replace('.', ',')}.</p>
            ${b.messages.map((m) => html`<${Bandeau} type="alerte"><p>${m}</p><//>`)}
            ${(p.grossesse > 0 || p.allaitement) && html`<${Bandeau} type="info" titre="À savoir"><p>Pendant la grossesse et l'allaitement, ces repères sont généraux : votre sage-femme ou votre médecin les ajuste pour vous.</p><//>`}
          </div>`}
      <p class="note">Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien. Vos données restent sur ce téléphone.</p>
    </div></div>`;
}
