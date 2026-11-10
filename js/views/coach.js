// Coach IA : conversation avec Gemini (clé personnelle) ; réglages partagés avec la page Profil.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Entete, Bandeau } from '../ui/composants.js';
import { preparerPiece, texteAvecPieces, MAX_PIECES } from '../core/pieces.js';
import { blocs } from '../lib/texte-riche.js';
import { chargerReglagesCoach, enregistrerReglagesCoach, chargerConversation, enregistrerConversation,
  demanderAuCoach, construireContexte, MODELE_PAR_DEFAUT } from '../core/coach.js';

const SUGGESTIONS_GROSSESSE = ['Puis-je manger du saumon fumé ?', 'Idées de repas pour le premier trimestre', 'Que faire contre les nausées ?', 'Quels aliments riches en fer ?'];
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
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try { await navigator.clipboard.writeText(m.texte); } catch { const t = document.createElement('textarea'); t.value = m.texte; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* tant pis */ } t.remove(); }
    setCopie(true); setTimeout(() => setCopie(false), 1500);
  };
  return html`<div class=${'bulle ' + (m.role === 'user' ? 'moi' : 'coach')}>
    ${(m.pieces || []).length > 0 && html`<p class="pieces-jointes">${m.pieces.map((n) => `📎 ${n}`).join('  ')}</p>`}
    ${blocs(m.texte).map((b) => b.type === 'ul'
      ? html`<ul>${b.items.map((it) => html`<li>${it.map((s) => (s.gras ? html`<strong>${s.texte}</strong>` : s.texte))}</li>`)}</ul>`
      : html`<p>${b.segments.map((s) => (s.gras ? html`<strong>${s.texte}</strong>` : s.texte))}</p>`)}
    ${m.role !== 'user' && html`<button type="button" class="lien copier" onClick=${copier}>${copie ? '✓ Copié' : '⧉ Copier'}</button>`}
  </div>`;
}

export function Coach({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi, enceinte = false }) {
  const [reg, setReg] = useState(chargerReglagesCoach);
  const [messages, setMessages] = useState(chargerConversation);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [pieces, setPieces] = useState([]);
  const fin = useRef(null);
  useEffect(() => { fin.current && fin.current.scrollIntoView({ block: 'end' }); }, [messages, enCours]);

  const ajouterFichiers = async (fichiers) => {
    setErreur('');
    for (const f of fichiers) {
      if (pieces.length >= MAX_PIECES) { setErreur(`${MAX_PIECES} pièces jointes au maximum par message.`); break; }
      try { const p = await preparerPiece(f); setPieces((l) => (l.length < MAX_PIECES ? [...l, p] : l)); } catch (e) { setErreur(e.message); }
    }
  };
  const envoyer = async (texte) => {
    const t = texte.trim();
    if ((!t && pieces.length === 0) || enCours) return;
    const question = texteAvecPieces(t || 'Peux-tu regarder ce document ?', pieces);
    const suite = [...messages, { role: 'user', texte: question, pieces: pieces.map((p) => p.nom) }];
    const jointes = pieces;
    setMessages(suite); setSaisie(''); setPieces([]); setErreur(''); setEnCours(true);
    try {
      const contexte = reg.partagerProfil ? construireContexte({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi }) : construireContexte({ saison });
      const reponse = await demanderAuCoach({ cle: reg.cle, modele: reg.modele, historique: suite.slice(-20), contexte, pieces: jointes });
      const final = [...suite, { role: 'coach', texte: reponse }];
      setMessages(final); enregistrerConversation(final.map(({ texte, role, pieces: ps }) => ({ texte, role, pieces: ps }))); setReg(chargerReglagesCoach());
    } catch (e) { setErreur(e.message); enregistrerConversation(suite); }
    setEnCours(false);
  };

  if (!reg.cle) {
    return html`<div><${Entete} titre="Coach IA" sous="Vos questions de cuisine et de nutrition" />
      <div class="contenu">
        <${Bandeau} type="info" titre="Activez votre coach"><p>Le coach utilise Gemini. Il faut une clé personnelle, gratuite et sans carte bancaire.</p><//>
        <${ReglagesCoach} onChange=${setReg} />
        <p class="note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien.</p>
      </div></div>`;
  }
  return html`<div class="coach-page">
    <${Entete} titre="Coach IA" sous=${reg.partagerProfil ? 'Réponses personnalisées avec votre profil' : 'Réponses générales (profil non partagé)'} />
    <div class="coach-fil">
      ${messages.length === 0 && html`<div class="coach-accueil"><p>Bonjour ${prenom} ! Que puis-je faire pour vous ?</p>
        <div class="puces sans-marge">${(enceinte ? SUGGESTIONS_GROSSESSE : SUGGESTIONS).map((s) => html`<button type="button" class="puce" key=${s} onClick=${() => envoyer(s)}>${s}</button>`)}</div></div>`}
      ${messages.map((m, k) => html`<${Message} key=${k} m=${m} />`)}
      ${enCours && html`<div class="bulle coach attente" aria-live="polite">Le coach réfléchit…</div>`}
      ${erreur && html`<${Bandeau} type="alerte"><p>${erreur}</p><//>`}
      <div ref=${fin}></div>
    </div>
    ${pieces.length > 0 && html`<div class="coach-pieces">${pieces.map((p, i) => html`<span class="piece" key=${i}>📎 ${p.nom} <button type="button" aria-label=${`Retirer ${p.nom}`} onClick=${() => setPieces(pieces.filter((_, k) => k !== i))}>✕</button></span>`)}</div>`}
    <form class="coach-saisie" onSubmit=${(e) => { e.preventDefault(); envoyer(saisie); }}>
      <label class="bouton secondaire joindre" aria-label="Joindre une photo, un PDF ou un fichier">📎
        <input type="file" multiple accept="image/*,application/pdf,.pdf,.txt,.md,.csv,text/plain" aria-label="Joindre un document" hidden
          onChange=${(e) => { const f = [...e.target.files]; e.target.value = ''; ajouterFichiers(f); }} /></label>
      <textarea rows="1" placeholder="Posez votre question… (collez du texte ou une image)" aria-label="Votre question" value=${saisie}
        onInput=${(e) => { setSaisie(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
        onPaste=${(e) => { const f = [...(e.clipboardData && e.clipboardData.files || [])]; if (f.length) { e.preventDefault(); ajouterFichiers(f); } }}
        onKeyDown=${(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(saisie); } }}></textarea>
      <button type="submit" class="bouton" disabled=${enCours || (!saisie.trim() && pieces.length === 0)} aria-label="Envoyer">➤</button>
    </form>
    ${messages.length > 0 && html`<button type="button" class="lien coach-efface" onClick=${() => { setMessages([]); enregistrerConversation([]); }}>Effacer la conversation</button>`}
    <p class="note coach-note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien. Les pièces jointes sont envoyées à Google (Gemini) avec la question, puis oubliées par l'appli. <a href="#/profil/coach">⚙️ Réglages</a></p>
  </div>`;
}
