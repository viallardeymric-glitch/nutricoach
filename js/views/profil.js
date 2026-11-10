// Profil : un accueil avec un résumé et des rubriques, chacune sur sa page courte.
import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { REGIMES, ALLERGENES } from '../data/libelles.js';
import { REGIMES_AVANCES, FAMILLES_REGIMES, RAPPEL_MEDICAL, nomRegime } from '../data/regimes.js';
import { ACTIVITES, OBJECTIFS, SECONDAIRES, calculerBesoins } from '../lib/besoins.js';
import { validerProfil, profilComplet, ageDe, LIMITES, AGE_MIN, groupeAge, GROUPES_AGE, ageEnMois, enfantVide, risquesEnfant } from '../lib/profils.js';
import { basculer } from '../lib/recettes.js';
import { pinValide } from '../core/pin.js';
import { biometrieDisponible, biometrieActive, activerBiometrie, desactiverBiometrie } from '../core/biometrie.js';
import { chargerReglagesCoach } from '../core/coach.js';
import { Puce, Pastille, Bandeau, Entete, Rang } from '../ui/composants.js';
import { ReglagesCoach } from './coach.js';
import { FOURNISSEURS, chargerReglagesPhotos, enregistrerReglagesPhotos } from '../core/photos.js';

const CONDITIONS = { diabete: 'Diabète', hypertension: 'Hypertension', immunodeprime: 'Système immunitaire affaibli' };
const TRIMESTRES = [[0, 'Non'], [1, '1er trimestre'], [2, '2e trimestre'], [3, '3e trimestre']];
// Ces régimes se déduisent de « Ma situation » (grossesse, sportif, diabète).
const REGIMES_DEJA_AILLEURS = ['omnivore', 'enceinte', 'sportif', 'diabetique'];
const RUBRIQUES = {
  infos: 'Mes informations', objectif: 'Objectif et activité', situation: 'Ma situation',
  regimes: 'Régimes et allergies', enfants: 'Enfants', photos: 'Photos des recettes', securite: 'Code PIN', coach: 'Coach IA', compte: 'Compte',
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
const Groupe = ({ titre, aide, children }) => html`<div class="groupe-profil"><h2 class="petit-titre">${titre}</h2>${aide && html`<p class="note">${aide}</p>`}${children}</div>`;
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

function Biometrie({ pin }) {
  const [dispo, setDispo] = useState(false);
  const [active, setActive] = useState(biometrieActive);
  const [msg, setMsg] = useState('');
  useEffect(() => { biometrieDisponible().then(setDispo); }, []);
  if (!pin.defini) return html`<p class="note">Définissez d'abord un code : Face ID / Touch ID s'y ajoute et le code reste le secours.</p>`;
  if (!dispo) return html`<p class="note">Face ID / Touch ID n'est pas disponible sur cet appareil ou ce navigateur.</p>`;
  const basculer = async () => {
    setMsg('');
    if (active) { desactiverBiometrie(); setActive(false); return; }
    try { await activerBiometrie(); setActive(true); } catch (e) { setMsg(e.message); }
  };
  return html`<div><div class="puces libres"><${Puce} actif=${active} onClick=${basculer}>${active ? '✓ Face ID / Touch ID activé' : 'Activer Face ID / Touch ID'}<//></div>
    ${msg && html`<p class="erreur-champ" role="alert">${msg}</p>`}
    <p class="note">Le code PIN reste disponible en secours. Face ID / Touch ID ouvre l'appli ; il ne chiffre pas les données.</p></div>`;
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
    <h2 class="petit-titre">Face ID / Touch ID</h2><${Biometrie} pin=${pin} />
  </div>`;
}

function SectionPhotos() {
  const [reg, setReg] = useState(chargerReglagesPhotos);
  const maj = (c) => { const s = { ...reg, ...c }; setReg(s); enregistrerReglagesPhotos(s); };
  const majCle = (k, v) => maj({ cles: { ...reg.cles, [k]: v.trim() } });
  const actifs = Object.keys(FOURNISSEURS).filter((k) => reg.cles[k]);
  return html`<div>
    <${Groupe} titre="Fournisseur principal" aide="Si le principal est indisponible (quota atteint, aucune photo), l'autre prend le relais quand sa clé est enregistrée.">
      <${Choix}>${Object.entries(FOURNISSEURS).map(([k, x]) => html`<${Puce} key=${k} actif=${reg.fournisseur === k} onClick=${() => maj({ fournisseur: k })}>${x.nom}<//>`)}<//><//>
    ${Object.entries(FOURNISSEURS).map(([k, x]) => html`<div key=${k}><${Champ} etiquette=${`Clé ${x.nom} (gratuite)`}><input type="password" autocomplete="off" spellcheck="false" placeholder="Collez votre clé ici" value=${reg.cles[k]}
      onInput=${(e) => majCle(k, e.target.value)} /><//>
      <p class="note">${k === 'pexels' ? 'Sur pexels.com/api : créez un compte gratuit puis demandez une clé (instantané).' : 'Sur unsplash.com/developers : créez un compte, puis une « application » en mode Demo pour obtenir une « Access Key ».'} Limite : ${x.delai}.</p></div>`)}
    <${Groupe} titre="Miniatures dans la liste des recettes" aide="Affiche une petite photo à la place du pictogramme pour les recettes que vous voyez à l'écran. Plafonné à 40 recherches par heure pour garder du quota pour les fiches."><${Choix}><${Puce} actif=${reg.miniatures} onClick=${() => maj({ miniatures: !reg.miniatures })}>${reg.miniatures ? '✓ Miniatures activées' : 'Miniatures désactivées'}<//><//><//>
    <p class="note">${actifs.length === 2 ? 'Les deux fournisseurs sont activés : 250 photos par heure en tout.' : actifs.length === 1 ? `${FOURNISSEURS[actifs[0]].nom} est activé.` : 'Aucune clé : les recettes gardent leur pictogramme.'} Chaque photo est cherchée une seule fois, puis son adresse et le nom du photographe sont gardés sur ce téléphone et partagés avec l'autre téléphone (base Firestore) : l'autre n'a plus besoin de la chercher. Les images elles-mêmes restent chez Pexels / Unsplash. Les clés restent sur ce téléphone : elles ne sont ni synchronisées ni enregistrées dans le dépôt.</p>
  </div>`;
}

function SectionEnfants({ enfants }) {
  const [edition, setEdition] = useState(null);   // enfant en cours de saisie
  const e = edition;
  const enregistrer = () => {
    if (!e.prenom.trim() || !e.naissance) return;
    enfants.ecrire({ ...e, prenom: e.prenom.trim() });
    setEdition(null);
  };
  return html`<div>
    ${enfants.liste.length === 0 && !e && html`<div class="etat"><p>👧 Aucun enfant enregistré.</p><p class="sous">Ajoutez un enfant : ses portions, ses allergies et les aliments déconseillés à son âge sont pris en compte dans les menus, les courses et le scan.</p></div>`}
    ${enfants.liste.map((x) => html`<div class="carte-nous" key=${x.id}><h2><${Pastille} qui=${x.id} label=${x.prenom} /> ${x.prenom}</h2>
      <p>${GROUPES_AGE[groupeAge(x.naissance)] || ''} · ${Math.floor((ageEnMois(x.naissance) || 0) / 12)} an${Math.floor((ageEnMois(x.naissance) || 0) / 12) > 1 ? 's' : ''}${(ageEnMois(x.naissance) || 0) < 36 ? ` (${ageEnMois(x.naissance)} mois)` : ''}</p>
      ${x.allergenes.length > 0 && html`<div class="etiquettes"><strong>Évite :</strong>${x.allergenes.map((a) => html`<span class="etiquette allergene" key=${a}>${ALLERGENES[a] || a}</span>`)}</div>`}
      <p class="sous">${x.dansMenus ? 'Compté dans les menus et les courses' : 'Non compté dans les menus'}</p>
      <div class="puces libres"><${Puce} actif=${false} onClick=${() => setEdition({ ...x })}>Modifier<//><${Puce} actif=${false} onClick=${() => { if (window.confirm(`Supprimer le profil de ${x.prenom} ?`)) enfants.supprimer(x); }}>Supprimer<//></div></div>`)}
    ${e ? html`<form class="carte-nous" onSubmit=${(ev) => { ev.preventDefault(); enregistrer(); }}>
      <${Champ} etiquette="Prénom"><input type="text" value=${e.prenom} onInput=${(ev) => setEdition({ ...e, prenom: ev.target.value })} required /><//>
      <${Champ} etiquette="Date de naissance"><input type="date" value=${e.naissance} min="2005-01-01" max=${new Date().toISOString().slice(0, 10)} onInput=${(ev) => setEdition({ ...e, naissance: ev.target.value })} required /><//>
      <${Groupe} titre="Allergies"><${Choix}>${Object.entries(ALLERGENES).map(([k, n]) => html`<${Puce} key=${k} exclu=${true} actif=${e.allergenes.includes(k)} onClick=${() => setEdition({ ...e, allergenes: basculer(e.allergenes, k) })}>${n}<//>`)}<//><//>
      <${Champ} etiquette="Aliments non aimés"><input type="text" value=${e.exclusions} onInput=${(ev) => setEdition({ ...e, exclusions: ev.target.value })} placeholder="ex. oignon, champignons" /><//>
      <label class="case"><input type="checkbox" checked=${e.dansMenus} onChange=${(ev) => setEdition({ ...e, dansMenus: ev.target.checked })} /><span>Compter cet enfant dans les menus et les courses</span></label>
      <div class="puces libres"><${Puce} actif=${true} onClick=${enregistrer}>Enregistrer<//><${Puce} actif=${false} onClick=${() => setEdition(null)}>Annuler<//></div></form>`
      : html`<button type="button" class="bouton secondaire large" onClick=${() => setEdition(enfantVide('enfant-' + Date.now().toString(36)))}>＋ Ajouter un enfant</button>`}
    <p class="note">Les menus évitent les recettes déconseillées aux enfants (alcool, cru à risque…) et les courses prévoient des portions adaptées à l'âge. Avant 1 an, suivez les conseils de votre pédiatre.</p>
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

export function Profil({ moi, profil, onMoi, onChange, compte, pin, section, enfants }) {
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
        ${femme && html`<p class="note">Grossesse, allaitement : rubrique « Ma situation » du profil.</p>`}
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
        ${p.objectif === 'date' && html`<div class="grille deux"><${Champ} etiquette="Poids visé (kg)"><input type="text" inputmode="decimal" value=${p.objectifDate ? p.objectifDate.kg : ''} placeholder="ex. 60"
            onInput=${(e) => maj({ objectifDate: { kg: Number(e.target.value.replace(',', '.')) || '', date: p.objectifDate ? p.objectifDate.date : '' } })} /><//>
          <${Champ} etiquette="Avant le"><input type="date" value=${p.objectifDate ? p.objectifDate.date : ''} min=${new Date().toISOString().slice(0, 10)}
            onInput=${(e) => maj({ objectifDate: { kg: p.objectifDate ? p.objectifDate.kg : '', date: e.target.value } })} /><//></div>
          <p class="note">Le rythme est plafonné (0,8 kg par semaine au plus) : si la date est trop proche, l'appli vous propose une date réaliste.</p>`}
        ${p.objectif === 'sport' && html`<${Bandeau} type="info"><p>Réglez votre objectif de course dans <a href="#/sport">Sport</a> : date, distance et plan nutritionnel par phases.</p><//>`}
        <${Groupe} titre="Objectifs complémentaires" aide="Cumulables avec votre objectif. Ils déclenchent des alertes sur les produits et les articles."><${Choix}>${Object.entries(SECONDAIRES).map(([k, n]) => html`<${Puce} key=${k}
          actif=${(p.secondaires || []).includes(k)} onClick=${() => maj({ secondaires: basculer(p.secondaires || [], k) })}>${n}<//>`)}<//><//>
        <${Groupe} titre="Activité physique" aide=${ACTIVITES[p.activite]?.aide}>
          <${Choix}>${Object.entries(ACTIVITES).map(([k, a]) => html`<${Puce} key=${k} actif=${p.activite === k}
            onClick=${() => maj({ activite: k })}>${a.nom}<//>`)}<//><//>
        <h2 class="petit-titre">Mes besoins</h2><${Besoins} b=${b} complet=${complet} />
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
        <${Groupe} titre="Régimes du catalogue" aide="Cumulables : les recettes affichées respectent tous vos choix."><${Choix}>${Object.keys(REGIMES).filter((k) => !REGIMES_DEJA_AILLEURS.includes(k)).map((k) => html`<${Puce} key=${k}
          actif=${p.regimes.includes(k)} onClick=${() => maj({ regimes: basculer(p.regimes, k) })}>${REGIMES[k]}<//>`)}<//><//>
        ${['mode', 'populaire', 'exclusion', 'medical', 'sport'].map((fam) => html`<${Groupe} key=${fam} titre=${FAMILLES_REGIMES[fam]} aide=${fam === 'medical' ? RAPPEL_MEDICAL : null}>
          <${Choix}>${Object.entries(REGIMES_AVANCES).filter(([, r]) => r.famille === fam).map(([k, r]) => html`<${Puce} key=${k} actif=${p.regimes.includes(k)}
            onClick=${() => maj({ regimes: basculer(p.regimes, k) })}>${r.nom}<//>`)}<//><//>`)}
        ${p.regimes.some((k) => REGIMES_AVANCES[k]) && html`<${Bandeau} type="info" titre="Vos régimes">
          <ul>${p.regimes.filter((k) => REGIMES_AVANCES[k]).map((k) => html`<li key=${k}><strong>${nomRegime(k)}</strong> : ${REGIMES_AVANCES[k].aide}</li>`)}</ul>
          ${p.regimes.some((k) => REGIMES_AVANCES[k] && REGIMES_AVANCES[k].medical) && html`<p class="note">${RAPPEL_MEDICAL}</p>`}<//>`}
        <${Groupe} titre="Allergies et intolérances" aide="Les recettes concernées sont masquées partout."><${Choix}>${Object.entries(ALLERGENES).map(([k, n]) => html`<${Puce} key=${k} exclu=${true}
          actif=${p.allergenes.includes(k)} onClick=${() => maj({ allergenes: basculer(p.allergenes, k) })}>${n}<//>`)}<//><//>
        <${Champ} etiquette="Aliments que je n'aime pas (séparés par des virgules)">
          <input type="text" value=${p.exclusions} placeholder="ex. coriandre, olives" onInput=${(e) => maj({ exclusions: e.target.value })} /><//>`}
      ${section === 'enfants' && html`<${SectionEnfants} enfants=${enfants} />`}
      ${section === 'photos' && html`<${SectionPhotos} />`}
      ${section === 'securite' && html`<${SectionPin} pin=${pin} />`}
      ${section === 'coach' && html`<${ReglagesCoach} />`}
      ${section === 'compte' && html`
        ${compte.actif ? html`<p>Connecté : <strong>${compte.email}</strong></p>
          <p class="note">Vos favoris, vos menus et votre profil sont synchronisés avec l'autre téléphone.</p>
          <button type="button" class="bouton secondaire" onClick=${compte.onDeconnecter}>Se déconnecter</button>`
          : html`<p>Mode local : vos données restent sur ce téléphone.</p>`}
        <h2 class="petit-titre">Ce téléphone</h2>
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
        <${Rang} icone="👧" titre=${RUBRIQUES.enfants} href="#/profil/enfants" sous=${enfants.liste.length ? enfants.liste.map((x) => x.prenom).join(', ') : 'Aucun enfant'} />
        <${Rang} icone="📷" titre=${RUBRIQUES.photos} href="#/profil/photos" sous=${(() => { const a = Object.keys(FOURNISSEURS).filter((k) => chargerReglagesPhotos().cles[k]).map((k) => FOURNISSEURS[k].nom); return a.length ? `${a.join(' + ')} activé${a.length > 1 ? 's' : ''}` : 'Pictogrammes seulement'; })()} />
        <${Rang} icone="💬" titre=${RUBRIQUES.coach} href="#/profil/coach" sous=${reglageCoach.cle ? 'Clé enregistrée' : 'À configurer'} />
        <${Rang} icone="🔒" titre=${RUBRIQUES.securite} href="#/profil/securite" sous=${pin.defini ? 'Code actif' : 'Non défini'} />
        <${Rang} icone="☁️" titre=${RUBRIQUES.compte} href="#/profil/compte" sous=${compte.actif ? compte.email : 'Mode local'} />
      </div>
      <p class="note">Ces informations sont générales et ne remplacent pas l'avis d'un médecin, d'une sage-femme ou d'un diététicien.</p>
    </div></div>`;
}
