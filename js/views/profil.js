// Profil : un accueil avec un résumé et des rubriques, chacune sur sa page courte.
import { html, useState } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { REGIMES, ALLERGENES } from '../data/libelles.js';
import { ACTIVITES, OBJECTIFS, calculerBesoins } from '../lib/besoins.js';
import { validerProfil, profilComplet, ageDe, LIMITES, AGE_MIN } from '../lib/profils.js';
import { basculer } from '../lib/recettes.js';
import { pinValide } from '../core/pin.js';
import { chargerReglagesCoach } from '../core/coach.js';
import { Puce, Pastille, Bandeau, Entete, Rang } from '../ui/composants.js';
import { ReglagesCoach } from './coach.js';

const CONDITIONS = { diabete: 'Diabète', hypertension: 'Hypertension', immunodeprime: 'Système immunitaire affaibli' };
const TRIMESTRES = [[0, 'Non'], [1, '1er trimestre'], [2, '2e trimestre'], [3, '3e trimestre']];
// Ces régimes se déduisent de « Ma situation » (grossesse, sportif, diabète).
const REGIMES_DEJA_AILLEURS = ['omnivore', 'enceinte', 'sportif', 'diabetique'];
const RUBRIQUES = {
  infos: 'Mes informations', objectif: 'Objectif et activité', situation: 'Ma situation',
  regimes: 'Régimes et allergies', securite: 'Code PIN', coach: 'Coach IA', compte: 'Compte',
};

export function ChoixPersonne({ onChoisir }) {
  return html`<div>
    <${Entete} grand=${true} titre="Bienvenue 👋" sous="Qui utilise ce téléphone ?" />
    <div class="contenu">
      <p class="desc">Ce choix reste sur cet appareil. Vous pourrez le changer plus tard.</p>
      ${Object.entries(PERSONNES).map(([id, p]) => html`<button type="button" class="bouton grand" key=${id}
        onClick=${() => onChoisir(id)}><${Pastille} qui=${id} /> Je suis ${p.prenom}</button>`)}
    </div></div>`;
}

function Champ({ etiquette, erreur, children }) {
  return html`<label class="champ"><span>${etiquette}</span>${children}${erreur && html`<small class="erreur-champ">${erreur}</small>`}</label>`;
}
const Groupe = ({ titre, aide, children }) => html`<div class="groupe-profil"><h3 class="petit-titre">${titre}</h3>${aide && html`<p class="note">${aide}</p>`}${children}</div>`;
const Choix = ({ children }) => html`<div class="puces libres">${children}</div>`;

function Nombre({ p, champ, unite, titre, maj, erreurs }) {
  return html`<${Champ} etiquette=${`${titre} (${unite})`} erreur=${p[champ] !== '' && erreurs[champ]}>
    <input type="number" inputmode="decimal" min=${LIMITES[champ][0]} max=${LIMITES[champ][1]} step=${champ === 'poids_kg' ? '0.1' : '1'}
      value=${p[champ]} onInput=${(e) => maj({ [champ]: e.target.value === '' ? '' : Number(e.target.value) })} /><//>`;
}

function Besoins({ b, complet }) {
  if (!complet) return html`<${Bandeau} type="info"><p>Renseignez votre sexe, votre date de naissance, votre poids et votre taille pour calculer vos besoins.</p><//>`;
  return html`<div class="besoins">
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
  </div>`;
}

function SectionPin({ pin }) {
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const enregistrer = async () => {
    if (!pinValide(code)) { setMessage('Le code doit comporter 4 à 8 chiffres.'); return; }
    if (code !== confirmation) { setMessage('Les deux codes ne sont pas identiques.'); return; }
    await pin.onDefinir(code);
    setOuvert(false); setCode(''); setConfirmation(''); setMessage('');
  };
  return html`<div>
    <p>${pin.defini ? '🔒 Un code est défini : l\'appli se verrouille après 1 minute en arrière-plan.' : 'Aucun code défini.'}</p>
    ${!ouvert && html`<div class="puces libres">
      <${Puce} actif=${false} onClick=${() => setOuvert(true)}>${pin.defini ? 'Changer le code' : 'Définir un code'}<//>
      ${pin.defini && html`<${Puce} actif=${false} onClick=${pin.onRetirer}>Retirer le code<//>`}</div>`}
    ${ouvert && html`<div>
      <${Champ} etiquette="Nouveau code (4 à 8 chiffres)"><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"
        autocomplete="off" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} /><//>
      <${Champ} etiquette="Confirmer le code"><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"
        autocomplete="off" value=${confirmation} onInput=${(e) => setConfirmation(e.target.value.replace(/\D/g, ''))} /><//>
      ${message && html`<p class="erreur-champ" role="alert">${message}</p>`}
      <div class="puces libres"><${Puce} actif=${true} onClick=${enregistrer}>Enregistrer<//>
        <${Puce} actif=${false} onClick=${() => { setOuvert(false); setMessage(''); }}>Annuler<//></div>
    </div>`}
    <p class="note">Le code verrouille l'écran de l'appli. Il ne remplace pas le verrouillage de votre téléphone.</p>
  </div>`;
}

function resumeSituation(p) {
  const s = [];
  if (p.grossesse > 0) s.push(`Enceinte (${p.grossesse === 1 ? '1er' : p.grossesse + 'e'} trim.)`);
  if (p.allaitement) s.push('Allaitement');
  if (p.sportif) s.push('Sportif');
  if (p.convalescence) s.push('Convalescence');
  for (const c of p.conditions) s.push(CONDITIONS[c]);
  return s.length ? s.join(', ') : 'Aucune particularité';
}

export function Profil({ moi, profil, onMoi, onChange, compte, pin, section }) {
  const p = profil;
  const maj = (changes) => onChange({ ...p, ...changes });
  const erreurs = validerProfil(p);
  const complet = profilComplet(p);
  const b = complet ? calculerBesoins(p) : null;
  const femme = p.sexe === 'femme';
  const age = ageDe(p);
  const retour = { href: '#/profil', nom: 'Profil' };

  if (section && RUBRIQUES[section]) {
    const enTete = html`<${Entete} titre=${RUBRIQUES[section]} retour=${retour} />`;
    return html`<div>${enTete}<div class="contenu">
      ${section === 'infos' && html`
        <${Groupe} titre="Sexe">
          <${Choix}>${[['femme', 'Femme'], ['homme', 'Homme']].map(([v, n]) => html`<${Puce} key=${v} actif=${p.sexe === v}
            onClick=${() => maj({ sexe: v, ...(v === 'homme' ? { grossesse: 0, allaitement: false } : {}) })}>${n}<//>`)}<//>
        <//>
        <${Champ} etiquette="Date de naissance" erreur=${p.naissance && erreurs.naissance}>
          <input type="date" value=${p.naissance} min="1900-01-01" max=${new Date().toISOString().slice(0, 10)}
            onInput=${(e) => maj({ naissance: e.target.value, age: null })} /><//>
        ${age !== null && age >= AGE_MIN && html`<p class="note">Vous avez ${age} ans.</p>`}
        ${!p.naissance && age !== null && html`<p class="note">Ajoutez votre date de naissance pour remplacer l'âge saisi précédemment (${age} ans).</p>`}
        <div class="grille deux">
          <${Nombre} p=${p} champ="poids_kg" unite="kg" titre="Poids" maj=${maj} erreurs=${erreurs} />
          <${Nombre} p=${p} champ="taille_cm" unite="cm" titre="Taille" maj=${maj} erreurs=${erreurs} />
        </div>`}
      ${section === 'objectif' && html`
        <${Groupe} titre="Mon objectif"><${Choix}>${Object.entries(OBJECTIFS).map(([k, n]) => html`<${Puce} key=${k} actif=${p.objectif === k}
          onClick=${() => maj({ objectif: k })}>${n}<//>`)}<//><//>
        <${Groupe} titre="Activité physique" aide=${ACTIVITES[p.activite]?.aide}>
          <${Choix}>${Object.entries(ACTIVITES).map(([k, a]) => html`<${Puce} key=${k} actif=${p.activite === k}
            onClick=${() => maj({ activite: k })}>${a.nom}<//>`)}<//><//>
        <h3 class="petit-titre">Mes besoins</h3><${Besoins} b=${b} complet=${complet} />
        <p class="note">Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien.</p>`}
      ${section === 'situation' && html`
        ${femme && html`<${Groupe} titre="Grossesse"><${Choix}>${TRIMESTRES.map(([v, n]) => html`<${Puce} key=${v} actif=${p.grossesse === v}
          onClick=${() => maj({ grossesse: v })}>${n}<//>`)}<//><//>`}
        <${Groupe} titre="Situation"><${Choix}>
          ${femme && html`<${Puce} actif=${p.allaitement} onClick=${() => maj({ allaitement: !p.allaitement })}>Allaitement<//>`}
          <${Puce} actif=${p.sportif} onClick=${() => maj({ sportif: !p.sportif })}>Sportif<//>
          <${Puce} actif=${p.convalescence} onClick=${() => maj({ convalescence: !p.convalescence })}>Convalescence<//><//><//>
        <${Groupe} titre="Santé" aide="Pour adapter les alertes sur les recettes."><${Choix}>${Object.entries(CONDITIONS).map(([k, n]) => html`<${Puce} key=${k}
          actif=${p.conditions.includes(k)} onClick=${() => maj({ conditions: basculer(p.conditions, k) })}>${n}<//>`)}<//><//>
        ${(p.grossesse > 0 || p.allaitement) && html`<${Bandeau} type="info" titre="À savoir"><p>Pendant la grossesse et l'allaitement, les repères de l'appli sont généraux : votre sage-femme ou votre médecin les ajuste pour vous.</p><//>`}`}
      ${section === 'regimes' && html`
        <${Groupe} titre="Mes régimes"><${Choix}>${Object.keys(REGIMES).filter((k) => !REGIMES_DEJA_AILLEURS.includes(k)).map((k) => html`<${Puce} key=${k}
          actif=${p.regimes.includes(k)} onClick=${() => maj({ regimes: basculer(p.regimes, k) })}>${REGIMES[k]}<//>`)}<//><//>
        <${Groupe} titre="Allergies et intolérances" aide="Les recettes concernées sont masquées partout."><${Choix}>${Object.entries(ALLERGENES).map(([k, n]) => html`<${Puce} key=${k} exclu=${true}
          actif=${p.allergenes.includes(k)} onClick=${() => maj({ allergenes: basculer(p.allergenes, k) })}>${n}<//>`)}<//><//>
        <${Champ} etiquette="Aliments que je n'aime pas (séparés par des virgules)">
          <input type="text" value=${p.exclusions} placeholder="ex. coriandre, olives" onInput=${(e) => maj({ exclusions: e.target.value })} /><//>`}
      ${section === 'securite' && html`<${SectionPin} pin=${pin} />`}
      ${section === 'coach' && html`<${ReglagesCoach} />`}
      ${section === 'compte' && html`
        ${compte.actif ? html`<p>Connecté : <strong>${compte.email}</strong></p>
          <p class="note">Vos favoris, vos menus et votre profil sont synchronisés avec l'autre téléphone.</p>
          <button type="button" class="bouton secondaire" onClick=${compte.onDeconnecter}>Se déconnecter</button>`
          : html`<p>Mode local : vos données restent sur ce téléphone.</p>`}
        <h3 class="petit-titre">Ce téléphone</h3>
        <p>Utilisé par <strong>${PERSONNES[moi].prenom}</strong>.</p>
        <button type="button" class="lien" onClick=${() => onMoi(moi === 'E' ? 'M' : 'E')}>Ce n'est pas moi : passer à ${PERSONNES[moi === 'E' ? 'M' : 'E'].prenom}</button>`}
    </div></div>`;
  }

  const reglageCoach = chargerReglagesCoach();
  return html`<div>
    <${Entete} grand=${true} retour=${{ href: '#/plus', nom: 'Plus' }} titre=${html`<${Pastille} qui=${moi} /> ${PERSONNES[moi].prenom}`}
      sous=${b ? `${OBJECTIFS[b.objectif]} · ${b.cible} kcal par jour` : 'Complétez votre profil pour calculer vos besoins'} />
    <div class="contenu">
      <button type="button" class=${'interrupteur' + (p.appliquer !== false ? ' actif' : '')} aria-pressed=${p.appliquer !== false}
        onClick=${() => maj({ appliquer: p.appliquer === false })}>
        <span><strong>Appliquer mon profil aux recettes</strong>
          <span class="sous">${p.appliquer !== false ? 'Les recettes qui ne me conviennent pas sont masquées, les alertes s\'affichent.' : 'Toutes les recettes sont affichées, sans alerte.'}</span></span>
        <span class="curseur" aria-hidden="true"></span></button>
      <div class="rangs">
        <${Rang} icone="🧍" titre=${RUBRIQUES.infos} href="#/profil/infos"
          sous=${complet ? `${age} ans · ${p.poids_kg} kg · ${p.taille_cm} cm` : 'À compléter'} />
        <${Rang} icone="🎯" titre=${RUBRIQUES.objectif} href="#/profil/objectif" sous=${`${OBJECTIFS[p.objectif] || OBJECTIFS.equilibre} · ${ACTIVITES[p.activite]?.nom}`} />
        <${Rang} icone="🩺" titre=${RUBRIQUES.situation} href="#/profil/situation" sous=${resumeSituation(p)} />
        <${Rang} icone="🥗" titre=${RUBRIQUES.regimes} href="#/profil/regimes"
          sous=${p.regimes.length + p.allergenes.length + (p.exclusions ? 1 : 0) ? `${p.regimes.length} régime${p.regimes.length > 1 ? 's' : ''} · ${p.allergenes.length} allergie${p.allergenes.length > 1 ? 's' : ''}` : 'Aucune restriction'} />
      </div>
      <div class="rangs">
        <${Rang} icone="💬" titre=${RUBRIQUES.coach} href="#/profil/coach" sous=${reglageCoach.cle ? 'Clé enregistrée' : 'À configurer'} />
        <${Rang} icone="🔒" titre=${RUBRIQUES.securite} href="#/profil/securite" sous=${pin.defini ? 'Code actif' : 'Non défini'} />
        <${Rang} icone="☁️" titre=${RUBRIQUES.compte} href="#/profil/compte" sous=${compte.actif ? compte.email : 'Mode local'} />
      </div>
      <p class="note">Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien.</p>
    </div></div>`;
}
