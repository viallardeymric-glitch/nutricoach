// Coach IA (Gemini par défaut). La clé est saisie dans les réglages et reste sur ce téléphone :
// jamais dans le dépôt, jamais synchronisée. Fonctions de construction/lecture pures, testées.
import { lire, ecrire } from './stockage.js';
import { ALIMENTS_GROSSESSE } from '../data/grossesse.js';

export const MODELE_PAR_DEFAUT = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_HISTORIQUE = 40;

export const MODELE_GROQ_PAR_DEFAUT = 'llama-3.3-70b-versatile';
const URL_GROQ = 'https://api.groq.com/openai/v1';
export const chargerReglagesCoach = () => ({ cle: '', modele: MODELE_PAR_DEFAUT, cleGroq: '', modeleGroq: MODELE_GROQ_PAR_DEFAUT, partagerProfil: false, ...lire('coach.reglages', {}) });
export const enregistrerReglagesCoach = (r) => ecrire('coach.reglages', r);
export const chargerConversation = () => { const c = lire('coach.conversation', []); return Array.isArray(c) ? c : []; };
export const enregistrerConversation = (c) => ecrire('coach.conversation', c.slice(-MAX_HISTORIQUE));

export const CONSIGNES = `Tu es le coach de l'application NutriCoach, pour un couple (Eymric et Marie) : nutrition, cuisine, sport, bien-être et santé au quotidien.
Réponds en français, avec un ton simple, chaleureux et concret, en quelques phrases courtes (listes si utile). Appuie-toi sur le contexte fourni : profil, situation (grossesse, allaitement, enfants), objectif sportif et phase d'entraînement, menu de la semaine, courses, frigo, poids et journal du jour. Cite ces éléments quand ils aident (« d'après votre menu de mardi… »).

Base médicale (tu connais les repères de santé publique français : Santé publique France / Manger Bouger, ANSES, HAS, Assurance maladie) :
- Tu peux expliquer, informer et rassurer : alimentation selon l'âge et la situation, équilibre, hydratation, sommeil, activité physique, hygiène alimentaire, interactions simples aliments/situations, signes à surveiller.
- Tu ne poses JAMAIS de diagnostic, tu ne prescris ni ne modifies de médicament, de dose ou de traitement, et tu n'interprètes pas un résultat d'analyse comme un médecin : tu l'expliques en termes généraux puis tu renvoies vers un professionnel.
- Rappelle clairement, avec tes mots, que tu n'es pas un médecin chaque fois que la question touche à la santé, à un symptôme, à un médicament, à la grossesse ou à l'allaitement. C'est IMPORTANT pour la grossesse et l'allaitement : termine alors toujours par une phrase du type « Je ne suis pas médecin : validez avec votre sage-femme ou votre médecin ».
- Urgence : fièvre, saignements, douleurs fortes ou inhabituelles, contractions, baisse des mouvements du bébé, malaise, difficulté à respirer, réaction allergique, symptômes graves chez un enfant → dis d'appeler immédiatement le 15 (ou le 112), sans attendre.
- Grossesse : alcool zéro ; pas de viande, poisson ou œuf crus ou peu cuits ; pas de charcuterie crue, poisson fumé, fromage au lait cru, graines germées crues ; limiter la caféine (200 mg/jour) ; limiter les gros poissons prédateurs ; laver fruits et légumes ; pas de compléments ni de plantes sans avis médical. Les folates (B9) et la vitamine D se discutent avec le médecin ou la sage-femme.
- Allaitement : zéro alcool (ou attendre plusieurs heures), caféine modérée, bien s'hydrater, manger varié et suffisamment ; pas de régime restrictif ; attention aux plantes et compléments (avis du professionnel). Les besoins en énergie sont plus élevés.
- Enfants : repères d'âge (pas de miel avant 1 an, pas de cru à risque, textures adaptées, allergies : avis du pédiatre). Seniors, diabète, hypertension, insuffisance rénale, etc. : donne des repères généraux et renvoie vers l'équipe soignante.
- Sport : appuie-toi sur la phase d'entraînement indiquée (glucides, protéines, hydratation, récupération) ; pas de programme d'entraînement médical ; douleur thoracique, malaise ou blessure → avis médical.

Règles de sécurité :
- Respecte STRICTEMENT les allergies, intolérances, régimes et aliments évités indiqués dans le contexte.
- Ne propose jamais de régime extrême ni de perte de poids rapide ; pas de jeûne prolongé, surtout pendant la grossesse, l'allaitement, chez l'enfant ou avec un diabète.
- Si tu n'es pas sûr, dis-le et renvoie vers un professionnel.
Tu peux proposer des idées de repas, équilibrer la semaine, expliquer une recette, conseiller des substitutions, adapter les repas à l'entraînement.
Si une photo ou un document est joint (étiquette, menu, ordonnance, bilan, recette), explique-le simplement ; ne pose jamais de diagnostic.`;

/** Texte de contexte (profil et menu) envoyé au coach, uniquement si la personne l'a accepté. */
const ageEn = (naissance) => { const d = new Date(naissance); if (Number.isNaN(d.getTime())) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

/** Une personne en une phrase : sexe, situation, objectif, besoins, régimes, allergies, conditions. */
export function decrireProfil({ profil, besoins, prenom }, role = 'Personne') {
  const l = [`${role} : ${prenom || 'utilisateur'}`];
  if (profil.sexe) l.push(profil.sexe === 'femme' ? 'femme' : 'homme');
  if (profil.grossesse > 0) l.push(`enceinte (${profil.grossesse}e trimestre)`);
  if (profil.allaitement) l.push('allaitement');
  if (profil.sportif) l.push('sportif');
  if (profil.convalescence) l.push('en convalescence');
  const lignes = [l.join(', ') + '.'];
  if (profil.objectif) lignes.push(`Objectif : ${profil.objectif}.`);
  if (besoins) lignes.push(`Besoins estimés : ${besoins.cible} kcal par jour (protéines ${besoins.proteines_g} g, glucides ${besoins.glucides_g} g, lipides ${besoins.lipides_g} g).`);
  if (profil.regimes && profil.regimes.length) lignes.push(`Régimes : ${profil.regimes.join(', ')}.`);
  if (profil.allergenes && profil.allergenes.length) lignes.push(`ALLERGIES / à exclure absolument : ${profil.allergenes.join(', ')}.`);
  if (profil.exclusions) lignes.push(`Aliments évités : ${profil.exclusions}.`);
  if (profil.conditions && profil.conditions.length) lignes.push(`Conditions : ${profil.conditions.join(', ')}.`);
  return lignes;
}

/** Repères « grossesse / allaitement » de l'appli (les mêmes que le guide), en une ligne par niveau. */
export function reperesGrossesse() {
  const par = (st) => ALIMENTS_GROSSESSE.filter((a) => a.statut === st).map((a) => a.nom.replace(/\s*\(.*$/, '')).join(' ; ');
  return [`Repères de l'appli pour la grossesse. INTERDIT : ${par('interdit')}. À ÉVITER : ${par('eviter')}. À LIMITER : ${par('limiter')}.`];
}

/** Texte de contexte envoyé au coach, uniquement si la personne l'a accepté : tout ce que l'appli sait, de façon concise. */
export function construireContexte({ profil, besoins, prenom, repasSemaine = [], saison, lignesSuivi = [], sport = null, partenaire = null, enfants = [], stock = [], aConsommer = [], courses = [], poids = [] }) {
  const lignes = [];
  if (saison) lignes.push(`Saison : ${saison}.`);
  if (profil) lignes.push(...decrireProfil({ profil, besoins, prenom }));
  if (partenaire && partenaire.profil) lignes.push(...decrireProfil(partenaire, 'Conjoint(e)'));
  if (enfants.length) lignes.push('Enfants : ' + enfants.map((e) => { const a = ageEn(e.naissance); return `${e.prenom}${a != null ? ` (${a} an${a > 1 ? 's' : ''}` : ' ('}${e.allergenes && e.allergenes.length ? `, allergies : ${e.allergenes.join(', ')}` : ''}${e.exclusions ? `, évite : ${e.exclusions}` : ''})`; }).join(' ; ') + '.');
  if ((profil && (profil.grossesse > 0 || profil.allaitement)) || (partenaire && partenaire.profil && (partenaire.profil.grossesse > 0 || partenaire.profil.allaitement))) lignes.push(...reperesGrossesse());
  if (sport) lignes.push(`Sport : ${sport.epreuve}${sport.date ? ` le ${sport.date}` : ''}${sport.reste != null ? ` (${sport.reste > 0 ? `J-${sport.reste}` : sport.reste === 0 ? 'jour J' : `J+${-sport.reste}`})` : ''}, phase « ${sport.phase} »${sport.charge ? `, aujourd'hui : ${sport.charge}` : ''}${sport.kcal ? `, besoins du jour ${sport.kcal} kcal dont glucides ${sport.glucides_g} g` : ''}.`);
  if (repasSemaine.length) lignes.push('Menu de la semaine : ' + repasSemaine.join(' ; ') + '.');
  for (const l of lignesSuivi) lignes.push(l);
  if (poids.length > 1) lignes.push(`Évolution du poids : ${poids.slice(-6).map((x) => `${x.kg} kg (${x.date})`).join(', ')}.`);
  if (stock.length) lignes.push(`Dans le frigo et le placard : ${stock.slice(0, 40).join(', ')}.`);
  if (aConsommer.length) lignes.push(`À consommer vite : ${aConsommer.slice(0, 10).join(', ')}.`);
  if (courses.length) lignes.push(`Liste de courses en cours : ${courses.slice(0, 30).join(', ')}.`);
  return lignes.join('\n');
}

/** Corps de la requête Gemini : consignes + contexte + historique (rôles « user » / « model »). */
export function construireRequete({ historique, contexte, pieces = [] }) {
  const systeme = contexte ? `${CONSIGNES}\n\nContexte de l'utilisateur :\n${contexte}` : CONSIGNES;
  return {
    systemInstruction: { parts: [{ text: systeme }] },
    contents: historique.map((m, i) => {
      const parts = [{ text: m.texte }];
      if (i === historique.length - 1 && m.role === 'user') for (const p of pieces) if (p.data) parts.push({ inlineData: { mimeType: p.mime, data: p.data } });
      return { role: m.role === 'user' ? 'user' : 'model', parts };
    }),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
  };
}

/** Texte de la réponse (null si la réponse est vide ou bloquée). */
export function extraireTexte(json) {
  const parties = json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
  const texte = (parties || []).map((p) => p.text || '').join('').trim();
  return texte || null;
}

export function messageErreurCoach(statut) {
  if (statut === 400 || statut === 403) return 'La clé Gemini est refusée. Vérifiez-la dans les réglages du coach.';
  if (statut === 429) return 'Trop de demandes pour le moment (quota gratuit atteint). Réessayez dans un moment.';
  if (statut === 404) return 'Ce modèle n\'existe pas. Changez le modèle dans les réglages du coach.';
  if (statut === 0) return 'Pas de réseau. Le coach a besoin d\'internet.';
  return 'Le coach est indisponible pour le moment. Réessayez.';
}


/** Choisit le meilleur modèle « flash » texte dans la liste renvoyée par Gemini ([{ name, supportedGenerationMethods }]). */
export function choisirModeleFlash(modeles) {
  const ok = (modeles || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /^models\/gemini-[\d.]+-flash$/.test(m.name || ''));
  const version = (m) => Number((/gemini-([\d.]+)-flash/.exec(m.name) || [])[1]) || 0;
  ok.sort((a, b) => version(b) - version(a));
  return ok.length ? ok[0].name.replace(/^models\//, '') : null;
}

/** Demande à Gemini la liste des modèles disponibles pour cette clé et retourne le meilleur modèle flash (ou null). */
export async function detecterModele(cle, appeler = fetch) {
  try {
    const rep = await appeler(`${URL_BASE.replace(/\/$/, "")}?pageSize=200`, { headers: { 'x-goog-api-key': cle } });
    if (!rep.ok) return null;
    return choisirModeleFlash((await rep.json()).models);
  } catch { return null; }
}

/** POST generateContent ; si le modèle n'existe plus (404), détecte un modèle disponible, le mémorise et réessaie une fois. */
async function posterGemini({ cle, modele, corps }, appeler) {
  const poster = (m) => appeler(`${URL_BASE}${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle }, body: JSON.stringify(corps) });
  let rep;
  try { rep = await poster(modele); } catch { throw new Error(messageErreurCoach(0)); }
  if (rep.status === 404) {
    const autre = await detecterModele(cle, appeler);
    if (autre && autre !== modele) {
      try { rep = await poster(autre); } catch { throw new Error(messageErreurCoach(0)); }
      if (rep.ok) enregistrerReglagesCoach({ ...chargerReglagesCoach(), modele: autre });
    }
  }
  if (!rep.ok) throw new Error(messageErreurCoach(rep.status));
  return rep.json();
}

/** Gemini 2.5 flash « réfléchit » avant de répondre (plusieurs secondes) : on coupe ce mode pour les conversations. */
function rapide(modele, corps) {
  if (/gemini-2\.5-flash/.test(modele) && !/lite/.test(modele)) corps.generationConfig = { ...corps.generationConfig, thinkingConfig: { thinkingBudget: 0 } };
  return corps;
}

// ---------- Groq (second fournisseur, gratuit, très rapide) ----------
export function messagesGroq({ historique, contexte }) {
  const systeme = contexte ? `${CONSIGNES}\n\nContexte de l'utilisateur :\n${contexte}` : CONSIGNES;
  return [{ role: 'system', content: systeme }, ...historique.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.texte }))];
}
export function messageErreurGroq(statut) {
  if (statut === 401 || statut === 403) return 'La clé Groq est refusée. Vérifiez-la dans les réglages du coach.';
  if (statut === 429) return 'Quota Groq atteint pour le moment. Réessayez dans un moment.';
  if (statut === 404 || statut === 400) return 'Ce modèle Groq n\'existe pas. Changez le modèle dans les réglages du coach.';
  if (statut === 0) return 'Pas de réseau. Le coach a besoin d\'internet.';
  return 'Groq est indisponible pour le moment.';
}
/** Meilleur modèle de discussion dans la liste Groq ([{ id }]) : Llama 3.3 70B, sinon un autre Llama, sinon le premier modèle texte. */
export function choisirModeleGroq(modeles) {
  const ids = (modeles || []).map((m) => m.id).filter((id) => id && !/whisper|guard|tts|orpheus|playai|safeguard|distil|embed/i.test(id));
  for (const re of [/llama-3\.3-70b/, /llama-3\.1-70b/, /llama-?[34].*(versatile|maverick|scout)/, /llama.*instant/, /llama/]) { const t = ids.find((id) => re.test(id)); if (t) return t; }
  return ids[0] || null;
}
export async function demanderAGroq({ cle, modele = MODELE_GROQ_PAR_DEFAUT, historique, contexte }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Groq dans les réglages du coach.');
  const poster = (m) => appeler(`${URL_GROQ}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
    body: JSON.stringify({ model: m, messages: messagesGroq({ historique, contexte }), temperature: 0.7, max_tokens: 900 }) });
  let rep;
  try { rep = await poster(modele); } catch { throw new Error(messageErreurGroq(0)); }
  if (rep.status === 404 || rep.status === 400) {
    try {
      const l = await appeler(`${URL_GROQ}/models`, { headers: { Authorization: `Bearer ${cle}` } });
      const autre = l.ok ? choisirModeleGroq((await l.json()).data) : null;
      if (autre && autre !== modele) { rep = await poster(autre); if (rep.ok) enregistrerReglagesCoach({ ...chargerReglagesCoach(), modeleGroq: autre }); }
    } catch { /* on garde l'erreur d'origine */ }
  }
  if (!rep.ok) throw new Error(messageErreurGroq(rep.status));
  const json = await rep.json();
  const texte = String((json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '').trim();
  if (!texte) throw new Error('Groq n\'a pas pu répondre. Reformulez la question.');
  return texte;
}

/**
 * Interroge les fournisseurs configurés EN MÊME TEMPS et garde la première réponse réussie (moins d'attente).
 * Groq ne lit pas les photos ni les PDF : s'il y en a, seul Gemini répond. Retourne { texte, via: 'Gemini' | 'Groq' }.
 */
export async function repondre({ reg, historique, contexte, pieces = [] }, appelerBrut = fetch) {
  const appeler = (url, o = {}) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 40000); return Promise.resolve(appelerBrut(url, { ...o, signal: c.signal })).finally(() => clearTimeout(t)); };
  const binaires = pieces.some((p) => p.data);
  const courses = [];
  if (reg.cle) courses.push(demanderAuCoach({ cle: reg.cle, modele: reg.modele, historique, contexte, pieces }, appeler).then((texte) => ({ texte, via: 'Gemini' })));
  if (reg.cleGroq && !binaires) courses.push(demanderAGroq({ cle: reg.cleGroq, modele: reg.modeleGroq, historique, contexte }, appeler).then((texte) => ({ texte, via: 'Groq' })));
  if (!courses.length) throw new Error(binaires && reg.cleGroq && !reg.cle ? 'Groq ne lit pas les photos ni les PDF : ajoutez une clé Gemini pour les joindre.' : 'Ajoutez une clé Gemini ou Groq dans les réglages du coach.');
  return new Promise((resolve, reject) => {
    const erreurs = []; let restants = courses.length;
    for (const c of courses) c.then(resolve, (e) => { erreurs.push(e); if (--restants === 0) reject(erreurs[0]); });
  });
}

/** Appelle Gemini ; retourne le texte ou lève une Error au message lisible. `appeler` est injectable pour les tests. */
export async function demanderAuCoach({ cle, modele = MODELE_PAR_DEFAUT, historique, contexte, pieces = [] }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Gemini dans les réglages du coach.');
  const texte = extraireTexte(await posterGemini({ cle, modele, corps: rapide(modele, construireRequete({ historique, contexte, pieces })) }, appeler));
  if (!texte) throw new Error('Le coach n\'a pas pu répondre à cette question. Reformulez-la.');
  return texte;
}

/** Appel Gemini avec une consigne propre (réécriture de recette…) : retourne le texte de la réponse (JSON demandé). */
export async function demanderJSON({ cle, modele = MODELE_PAR_DEFAUT, systeme, message }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Gemini dans les réglages du coach.');
  const texte = extraireTexte(await posterGemini({ cle, modele, corps: { systemInstruction: { parts: [{ text: systeme }] }, contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2000, responseMimeType: 'application/json' } } }, appeler));
  if (!texte) throw new Error('L\'IA n\'a pas pu répondre. Réessayez.');
  return texte;
}

/** Envoie une photo (base64) à Gemini avec une consigne ; retourne le texte (JSON). */
export async function demanderSurImage({ cle, modele = MODELE_PAR_DEFAUT, systeme, imageBase64, mime = 'image/jpeg' }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Gemini dans les réglages du coach.');
  const texte = extraireTexte(await posterGemini({ cle, modele, corps: { systemInstruction: { parts: [{ text: systeme }] },
        contents: [{ role: 'user', parts: [{ text: 'Lis cette photo.' }, { inlineData: { mimeType: mime, data: imageBase64 } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: 'application/json' } } }, appeler));
  if (!texte) throw new Error('L\'IA n\'a rien pu lire sur cette photo. Reprenez-la de plus près, bien nette.');
  return texte;
}

/** Faut-il rappeler « je ne suis pas médecin » sous la réponse ? Toujours pour la grossesse et l'allaitement, et pour toute question de santé. */
export function avertissementSante({ profil, question = '', partenaire = null }) {
  const enceinte = Boolean(profil && (profil.grossesse > 0 || profil.allaitement));
  const sante = /(sant[ée]|m[ée]dica|m[ée]decin|douleur|sympt[oô]m|fi[eè]vre|saign|diab[eè]t|tension|enceinte|grossesse|allait|b[ée]b[ée]|nourrisson|malad|infection|vitamine|compl[eé]ment|carence|an[eé]mie|allerg|naus[ée]e|vomi|r[eé]gime|maigr|grossir|poids|b[ée]b[eé]|ordonnance|analyse|prise de sang)/i.test(question);
  if (enceinte) return 'ℹ️ Je ne suis pas médecin. Pour la grossesse et l\'allaitement, validez toujours avec votre sage-femme ou votre médecin. En cas de saignements, fièvre, douleurs fortes ou baisse des mouvements du bébé : appelez le 15.';
  if (sante) return 'ℹ️ Je ne suis pas médecin : ces informations sont générales. Pour un symptôme, un traitement ou un doute, demandez l\'avis d\'un professionnel de santé (urgence : 15).';
  return null;
}

/** Réponse JSON de Groq (mode « json_object »), avec la même détection de modèle retiré que le coach. */
export async function demanderJSONGroq({ cle, modele = MODELE_GROQ_PAR_DEFAUT, systeme, message }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Groq dans les réglages du coach.');
  const poster = (m) => appeler(`${URL_GROQ}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
    body: JSON.stringify({ model: m, messages: [{ role: 'system', content: systeme }, { role: 'user', content: message }], temperature: 0.3, max_tokens: 2000, response_format: { type: 'json_object' } }) });
  let rep;
  try { rep = await poster(modele); } catch { throw new Error(messageErreurGroq(0)); }
  if (rep.status === 404) {
    try {
      const l = await appeler(`${URL_GROQ}/models`, { headers: { Authorization: `Bearer ${cle}` } });
      const autre = l.ok ? choisirModeleGroq((await l.json()).data) : null;
      if (autre && autre !== modele) { rep = await poster(autre); if (rep.ok) enregistrerReglagesCoach({ ...chargerReglagesCoach(), modeleGroq: autre }); }
    } catch { /* erreur d'origine conservée */ }
  }
  if (!rep.ok) throw new Error(messageErreurGroq(rep.status));
  const json = await rep.json();
  const texte = String((json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '').trim();
  if (!texte) throw new Error('Groq n\'a pas pu répondre. Réessayez.');
  return texte;
}

/** Réponse JSON : Gemini et Groq interrogés en même temps, la première réponse réussie l'emporte (pour les réécritures de recettes, etc.). */
export async function demanderJSONRapide({ reg, systeme, message }, appelerBrut = fetch) {
  const appeler = (url, o = {}) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 45000); return Promise.resolve(appelerBrut(url, { ...o, signal: c.signal })).finally(() => clearTimeout(t)); };
  const courses = [];
  if (reg.cle) courses.push(demanderJSON({ cle: reg.cle, modele: reg.modele, systeme, message }, appeler));
  if (reg.cleGroq) courses.push(demanderJSONGroq({ cle: reg.cleGroq, modele: reg.modeleGroq, systeme, message }, appeler));
  if (!courses.length) throw new Error('Ajoutez une clé Gemini ou Groq dans les réglages du coach.');
  return new Promise((resolve, reject) => {
    const erreurs = []; let restants = courses.length;
    for (const c of courses) c.then(resolve, (e) => { erreurs.push(e); if (--restants === 0) reject(erreurs[0]); });
  });
}
