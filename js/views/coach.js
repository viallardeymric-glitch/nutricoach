// Coach IA : conversation avec Gemini (clé personnelle) ; réglages partagés avec la page Profil.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Entete, Bandeau } from '../ui/composants.js';
import { blocs } from '../lib/texte-riche.js';
import { chargerReglagesCoach, enregistrerReglagesCoach, chargerConversation, enregistrerConversation,
  demanderAuCoach, construireContexte, MODELE_PAR_DEFAUT } from '../core/coach.js';

const SUGGESTIONS = ['Que cuisiner ce soir ?', 'Comment équilibrer ma semaine ?', 'Idées de petits-déjeuners riches en protéines', 'Que faire avec des restes de poulet ?'];

export function ReglagesCoach({ onChange }) {
  const [reg, setReg] = useState(chargerReglagesCoach);
  const maj = (c) => { const s = { ...reg, ...c }; setReg(s); enregistrerReglagesCoach(s); onChange && onChange(s); };
  return html`<div>
    <label class="champ"><span>Clé Gemini (gratuite)</span>
      <input type="password" autocomplete="off" spellcheck="false" placeholder="Collez votre clé ici" value=${reg.cle}
        onInput=${(e) => maj({ cle: e.target.value.trim() })} /></label>
    <p class="note">Créez-la gratuitement sur <strong>aistudio.google.com/apikey</strong> (compte Google). Elle reste sur ce téléphone : elle n'est ni envoyée à l'autre téléphone, ni enregistrée dans le dépôt.</p>
    <label class="case"><input type="checkbox" checked=${reg.partagerProfil} onChange=${(e) => maj({ partagerProfil: e.target.checked })} />
      <span>Personnaliser les réponses avec mon profil et mon menu de la semaine</span></label>
    <p class="note">Si coché, votre profil (âge, objectifs, allergies, situation) et vos menus sont envoyés à Google (Gemini) avec chaque question. Décochez pour ne rien partager. Le coach s'adapte au profil de la personne connectée sur ce téléphone (grossesse, allaitement, allergies… : Profil → Ma situation). La clé ne se synchronise pas : saisissez la même sur chaque téléphone.</p>
    <label class="champ"><span>Modèle</span>
      <input type="text" value=${reg.modele} onInput=${(e) => maj({ modele: e.target.value.trim() || MODELE_PAR_DEFAUT })} /></label>
  </div>`;
}

function Message({ m }) {
  return html`<div class=${'bulle ' + (m.role === 'user' ? 'moi' : 'coach')}>
    ${blocs(m.texte).map((b) => b.type === 'ul'
      ? html`<ul>${b.items.map((it) => html`<li>${it.map((s) => (s.gras ? html`<strong>${s.texte}</strong>` : s.texte))}</li>`)}</ul>`
      : html`<p>${b.segments.map((s) => (s.gras ? html`<strong>${s.texte}</strong>` : s.texte))}</p>`)}
  </div>`;
}

export function Coach({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi }) {
  const [reg, setReg] = useState(chargerReglagesCoach);
  const [messages, setMessages] = useState(chargerConversation);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const fin = useRef(null);
  useEffect(() => { fin.current && fin.current.scrollIntoView({ block: 'end' }); }, [messages, enCours]);

  const envoyer = async (texte) => {
    const t = texte.trim();
    if (!t || enCours) return;
    const suite = [...messages, { role: 'user', texte: t }];
    setMessages(suite); setSaisie(''); setErreur(''); setEnCours(true);
    try {
      const contexte = reg.partagerProfil ? construireContexte({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi }) : construireContexte({ saison });
      const reponse = await demanderAuCoach({ cle: reg.cle, modele: reg.modele, historique: suite.slice(-20), contexte });
      const final = [...suite, { role: 'coach', texte: reponse }];
      setMessages(final); enregistrerConversation(final); setReg(chargerReglagesCoach());
    } catch (e) { setErreur(e.message); enregistrerConversation(suite); }
    setEnCours(false);
  };

  if (!reg.cle) {
    return html`<div><${Entete} titre="Coach IA" sous="Vos questions de cuisine et de nutrition" retour=${{ href: '#/plus', nom: 'Plus' }} />
      <div class="contenu">
        <${Bandeau} type="info" titre="Activez votre coach"><p>Le coach utilise Gemini. Il faut une clé personnelle, gratuite et sans carte bancaire.</p><//>
        <${ReglagesCoach} onChange=${setReg} />
        <p class="note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien.</p>
      </div></div>`;
  }
  return html`<div class="coach-page">
    <${Entete} titre="Coach IA" sous=${reg.partagerProfil ? 'Réponses personnalisées avec votre profil' : 'Réponses générales (profil non partagé)'} retour=${{ href: '#/plus', nom: 'Plus' }} />
    <div class="coach-fil">
      ${messages.length === 0 && html`<div class="coach-accueil"><p>Bonjour ${prenom} ! Que puis-je faire pour vous ?</p>
        <div class="puces sans-marge">${SUGGESTIONS.map((s) => html`<button type="button" class="puce" key=${s} onClick=${() => envoyer(s)}>${s}</button>`)}</div></div>`}
      ${messages.map((m, k) => html`<${Message} key=${k} m=${m} />`)}
      ${enCours && html`<div class="bulle coach attente" aria-live="polite">Le coach réfléchit…</div>`}
      ${erreur && html`<${Bandeau} type="alerte"><p>${erreur}</p><//>`}
      <div ref=${fin}></div>
    </div>
    <form class="coach-saisie" onSubmit=${(e) => { e.preventDefault(); envoyer(saisie); }}>
      <input type="text" placeholder="Posez votre question…" aria-label="Votre question" value=${saisie} onInput=${(e) => setSaisie(e.target.value)} />
      <button type="submit" class="bouton" disabled=${enCours || !saisie.trim()} aria-label="Envoyer">➤</button>
    </form>
    ${messages.length > 0 && html`<button type="button" class="lien coach-efface" onClick=${() => { setMessages([]); enregistrerConversation([]); }}>Effacer la conversation</button>`}
    <p class="note coach-note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien.</p>
  </div>`;
}
