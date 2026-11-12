// Coach IA : conversation avec Gemini (clé personnelle) ; réglages partagés avec la page Profil.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Entete, Bandeau } from '../ui/composants.js';
import { preparerPiece, texteAvecPieces, MAX_PIECES } from '../core/pieces.js';
import { genererRecetteIA } from '../core/coach.js';
import { veutUneRecette, lireRecetteIA, conflitsRecette } from '../lib/recette-ia.js';
import { prochainId } from '../lib/recette-perso.js';
import { libelleQuantite } from '../lib/courses.js';
import { blocs } from '../lib/texte-riche.js';
import { chargerReglagesCoach, enregistrerReglagesCoach, chargerConversation, enregistrerConversation,
  repondre, construireContexte, avertissementSante, MODELE_PAR_DEFAUT, MODELE_GROQ_PAR_DEFAUT } from '../core/coach.js';

const SUGGESTIONS_GROSSESSE = ['Crée-moi une recette pour ce midi', 'Puis-je manger du saumon fumé ?', 'Idées de repas pour le premier trimestre', 'Que faire contre les nausées ?', 'Quels aliments riches en fer ?'];
const SUGGESTIONS = ['Crée-moi une recette pour ce midi', 'Que cuisiner ce soir ?', 'Comment équilibrer ma semaine ?', 'Idées de petits-déjeuners riches en protéines', 'Que faire avec des restes de poulet ?'];

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
    <p class="note">Si coché, votre profil (âge, objectifs, allergies, situation) et vos menus sont envoyés à Google (Gemini) et/ou Groq avec chaque question, avec ce que l'appli sait de vous : conjoint(e) et enfants, grossesse, sport et phase d'entraînement, menu, courses, frigo, poids et journal du jour. Décochez pour ne rien partager. Le coach s'adapte au profil de la personne connectée sur ce téléphone (grossesse, allaitement, allergies… : Profil → Ma situation). La clé ne se synchronise pas : saisissez la même sur chaque téléphone.</p>
    <label class="champ"><span>Modèle Gemini</span>
      <input type="text" value=${reg.modele} onInput=${(e) => maj({ modele: e.target.value.trim() || MODELE_PAR_DEFAUT })} /></label>
    <h2 class="petit-titre">Deuxième IA : Groq (gratuite, très rapide)</h2>
    <label class="champ"><span>Clé Groq (facultative)</span>
      <input type="password" autocomplete="off" spellcheck="false" placeholder="Collez votre clé Groq ici" value=${reg.cleGroq || ''}
        onInput=${(e) => maj({ cleGroq: e.target.value.trim() })} /></label>
    <p class="note">Créez-la gratuitement sur <strong>console.groq.com/keys</strong>. Avec les deux clés, l'appli interroge Gemini et Groq <strong>en même temps</strong> et affiche la première réponse : beaucoup moins d'attente. Groq ne lit pas les photos ni les PDF (Gemini s'en charge). La clé reste sur ce téléphone.</p>
    <label class="champ"><span>Modèle Groq</span>
      <input type="text" value=${reg.modeleGroq || MODELE_GROQ_PAR_DEFAUT} onInput=${(e) => maj({ modeleGroq: e.target.value.trim() || MODELE_GROQ_PAR_DEFAUT })} /></label>
  </div>`;
}

/** Historique envoyé à l'IA : une recette proposée est résumée en texte (les messages sans texte sont retirés). */
const pourIA = (messages) => messages.map((m) => (m.texte ? m : m.recette ? { role: m.role, texte: `J'ai proposé la recette « ${m.recette.titre} » (${m.recette.ingredients.slice(0, 8).map((i) => i.aliment).join(', ')}).` } : null)).filter(Boolean);

function CarteRecetteIA({ m, onAjouter, onAutre, enCours }) {
  const r = m.recette;
  const bloquants = m.conflits.filter((c) => c.type === 'allergene');
  const nut = r.nutrition_par_portion;
  return html`<div class="bulle coach carte-recette-ia">
    <h3>🍳 ${r.titre}</h3>
    ${r.description && html`<p>${r.description}</p>`}
    <p class="sous">${r.portions_base} portion${r.portions_base > 1 ? 's' : ''} · ⏱ ${r.temps.total_min} min${nut.calories_kcal ? ` · ≈ ${nut.calories_kcal} kcal / portion` : ''}</p>
    ${m.conflits.length > 0 && html`<${Bandeau} type="alerte" titre=${bloquants.length ? 'Cette recette ne convient pas à votre foyer' : 'À vérifier avant de cuisiner'}><ul class="simple">${m.conflits.map((c, i) => html`<li key=${i}>${c.texte}</li>`)}</ul><//>`}
    <h4>Ingrédients</h4>
    <ul class="ingredients">${r.ingredients.map((i, k) => html`<li key=${k}><strong>${libelleQuantite(i)}</strong> ${i.aliment}${i.precision ? html` <span class="prec">(${i.precision})</span>` : ''}</li>`)}</ul>
    <h4>Étape par étape</h4>
    <ol class="etapes">${r.etapes.map((e) => html`<li key=${e.numero}>${e.texte}</li>`)}</ol>
    ${r.astuces.length > 0 && html`<p class="note">💡 ${r.astuces.join(' ')}</p>`}
    ${m.avertissements.length > 0 && html`<p class="note">${m.avertissements.join(' ')}</p>`}
    <div class="actions-recette-ia">
      ${m.idAjoute ? html`<a class="bouton" href=${'#/cuisine/' + m.idAjoute + '?p=' + r.portions_base}>👩‍🍳 Cuisiner pas à pas</a>
          <a class="bouton secondaire" href=${'#/recette/' + m.idAjoute}>Voir la fiche</a>
          <p class="note">✓ Ajoutée à « Mes recettes » (partagée avec l'autre téléphone).</p>`
        : bloquants.length ? '' : html`<button type="button" class="bouton" onClick=${onAjouter}>➕ Ajouter à mes recettes</button>`}
      <button type="button" class="bouton secondaire" disabled=${enCours} onClick=${onAutre}>🔄 Une autre idée</button>
    </div>
    <p class="note">Recette créée par l'IA : vérifiez les cuissons et les quantités. La nutrition est une estimation.</p>
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
    ${m.avertir && html`<p class="avertissement-sante">${m.avertir}</p>`}
    ${m.role !== 'user' && html`<div class="bulle-pied"><button type="button" class="lien copier" onClick=${copier}>${copie ? '✓ Copié' : '⧉ Copier'}</button>${m.via ? html`<span class="sous">· ${m.via}</span>` : ''}</div>`}
  </div>`;
}

export function Coach({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi, enceinte = false, extra = {}, contraintes = { allergenes: [], regimes: [], risques: [] }, foyer = 2, nomsFoyer = '', recettesPerso = [], opsRecettes = null }) {
  const [reg, setReg] = useState(chargerReglagesCoach);
  const [messages, setMessages] = useState(chargerConversation);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [pieces, setPieces] = useState([]);
  const fin = useRef(null);
  useEffect(() => { fin.current && fin.current.scrollIntoView({ block: 'end' }); }, [messages, enCours]);
  const zone = useRef(null);
  useEffect(() => { if (zone.current && !saisie) zone.current.style.height = ''; }, [saisie]);

  const ajouterFichiers = async (fichiers) => {
    setErreur('');
    for (const f of fichiers) {
      if (pieces.length >= MAX_PIECES) { setErreur(`${MAX_PIECES} pièces jointes au maximum par message.`); break; }
      try { const p = await preparerPiece(f); setPieces((l) => (l.length < MAX_PIECES ? [...l, p] : l)); } catch (e) { setErreur(e.message); }
    }
  };
  // Création d'une recette par l'IA : JSON → recette normalisée → contrôle avec les profils du foyer → carte à ajouter aux recettes
  const creerRecette = async (demande, suite, contexte) => {
    const historique = suite.slice(0, -1);
    const brut = await genererRecetteIA({ reg, demande, historique, contexte, portions: foyer, noms: nomsFoyer });
    const r = lireRecetteIA(brut, foyer);
    if (!r.recette) { setErreur(r.erreurs[0]); enregistrerConversation(suite.map(({ texte, role }) => ({ texte, role }))); return; }
    const conflits = conflitsRecette(r.recette, contraintes);
    const final = [...suite, { role: 'coach', recette: r.recette, conflits, avertissements: r.avertissements }];
    setMessages(final); enregistrerConversation(final);
  };
  const ajouterRecette = (k) => {
    const m = messages[k]; if (!m || !m.recette || !opsRecettes) return;
    if (m.conflits.some((c) => c.type === 'allergene')) return;
    if (m.conflits.length && !window.confirm('Cette recette est signalée pour votre foyer (voir l\'encadré rouge). L\'ajouter quand même ?')) return;
    const titre = recettesPerso.some((x) => x.titre.toLowerCase() === m.recette.titre.toLowerCase()) ? `${m.recette.titre} (coach)` : m.recette.titre;
    const id = prochainId(recettesPerso.map((x) => x.id));
    opsRecettes.ecrire({ ...m.recette, titre, id, perso: true });
    const final = messages.map((x, i) => (i === k ? { ...x, idAjoute: id } : x));
    setMessages(final); enregistrerConversation(final);
  };
  const autreIdee = () => {
    const derniere = [...messages].reverse().find((x) => x.role === 'user');
    envoyer(`${derniere ? derniere.texte : 'Crée-moi une recette'}\nPropose une recette DIFFÉRENTE de la précédente.`);
  };
  const envoyer = async (texte) => {
    const t = texte.trim();
    if ((!t && pieces.length === 0) || enCours) return;
    const question = texteAvecPieces(t || 'Peux-tu regarder ce document ?', pieces);
    const suite = [...messages, { role: 'user', texte: question, pieces: pieces.map((p) => p.nom) }];
    const jointes = pieces;
    setMessages(suite); setSaisie(''); setPieces([]); setErreur(''); setEnCours(true);
    try {
      const contexte = reg.partagerProfil ? construireContexte({ profil, besoins, prenom, repasSemaine, saison, lignesSuivi, ...extra }) : construireContexte({ saison });
      if (veutUneRecette(t) && jointes.length === 0) { await creerRecette(t, suite, contexte); setEnCours(false); return; }
      const reponse = await repondre({ reg, historique: pourIA(suite.slice(-20)), contexte, pieces: jointes });
      const final = [...suite, { role: 'coach', texte: reponse.texte, via: reponse.via, avertir: avertissementSante({ profil, question: t }) }];
      setMessages(final); enregistrerConversation(final.map(({ texte, role, pieces: ps, via, avertir, recette, conflits, avertissements, idAjoute }) => ({ texte, role, pieces: ps, via, avertir, recette, conflits, avertissements, idAjoute }))); setReg(chargerReglagesCoach());
    } catch (e) { setErreur(e.message); enregistrerConversation(suite); }
    setEnCours(false);
  };

  if (!reg.cle && !reg.cleGroq) {
    return html`<div><${Entete} titre="Coach IA" sous="Vos questions de cuisine et de nutrition" />
      <div class="contenu">
        <${Bandeau} type="info" titre="Activez votre coach"><p>Le coach utilise Gemini (Google) et/ou Groq. Il faut au moins une clé personnelle, gratuite et sans carte bancaire. Avec les deux, il répond plus vite.</p><//>
        <${ReglagesCoach} onChange=${setReg} />
        <p class="note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien.</p>
      </div></div>`;
  }
  return html`<div class="coach-page">
    <${Entete} titre="Coach IA" sous=${reg.partagerProfil ? 'Réponses personnalisées avec votre profil' : 'Réponses générales (profil non partagé)'} />
    <div class="coach-fil">
      ${messages.length === 0 && html`<div class="coach-accueil"><p>Bonjour ${prenom} ! Que puis-je faire pour vous ?</p>
        <div class="puces sans-marge">${(enceinte ? SUGGESTIONS_GROSSESSE : SUGGESTIONS).map((s) => html`<button type="button" class="puce" key=${s} onClick=${() => envoyer(s)}>${s}</button>`)}</div></div>`}
      ${messages.map((m, k) => (m.recette ? html`<${CarteRecetteIA} key=${k} m=${m} enCours=${enCours} onAjouter=${() => ajouterRecette(k)} onAutre=${autreIdee} />` : html`<${Message} key=${k} m=${m} />`))}
      ${enCours && html`<div class="bulle coach attente" aria-live="polite">Le coach réfléchit…</div>`}
      ${erreur && html`<${Bandeau} type="alerte"><p>${erreur}</p><//>`}
      ${messages.length > 0 && html`<button type="button" class="lien coach-efface" onClick=${() => { setMessages([]); enregistrerConversation([]); }}>Effacer la conversation</button>`}
      <p class="note coach-note">Le coach ne remplace pas un médecin, une sage-femme ou un diététicien. Les pièces jointes sont envoyées à Google (Gemini) avec la question, puis oubliées par l'appli. <a href="#/profil/coach">⚙️ Réglages</a></p>
      <div ref=${fin}></div>
    </div>
    ${pieces.length > 0 && html`<div class="coach-pieces">${pieces.map((p, i) => html`<span class="piece" key=${i}>📎 ${p.nom} <button type="button" aria-label=${`Retirer ${p.nom}`} onClick=${() => setPieces(pieces.filter((_, k) => k !== i))}>✕</button></span>`)}</div>`}
    <form class="coach-saisie" onSubmit=${(e) => { e.preventDefault(); envoyer(saisie); }}>
      <label class="bouton secondaire joindre" aria-label="Joindre une photo, un PDF ou un fichier">📎
        <input type="file" multiple accept="image/*,application/pdf,.pdf,.txt,.md,.csv,text/plain" aria-label="Joindre un document" hidden
          onChange=${(e) => { const f = [...e.target.files]; e.target.value = ''; ajouterFichiers(f); }} /></label>
      <textarea ref=${zone} rows="1" placeholder="Posez votre question…" aria-label="Votre question" value=${saisie}
        onInput=${(e) => { setSaisie(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
        onPaste=${(e) => { const f = [...(e.clipboardData && e.clipboardData.files || [])]; if (f.length) { e.preventDefault(); ajouterFichiers(f); } }}
        onKeyDown=${(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(saisie); } }}></textarea>
      <button type="submit" class="bouton" disabled=${enCours || (!saisie.trim() && pieces.length === 0)} aria-label="Envoyer">➤</button>
    </form>
  </div>`;
}
