// Coach IA (Gemini par défaut). La clé est saisie dans les réglages et reste sur ce téléphone :
// jamais dans le dépôt, jamais synchronisée. Fonctions de construction/lecture pures, testées.
import { lire, ecrire } from './stockage.js';

export const MODELE_PAR_DEFAUT = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_HISTORIQUE = 40;

export const MODELE_GROQ_PAR_DEFAUT = 'llama-3.3-70b-versatile';
const URL_GROQ = 'https://api.groq.com/openai/v1';
export const chargerReglagesCoach = () => ({ cle: '', modele: MODELE_PAR_DEFAUT, cleGroq: '', modeleGroq: MODELE_GROQ_PAR_DEFAUT, partagerProfil: false, ...lire('coach.reglages', {}) });
export const enregistrerReglagesCoach = (r) => ecrire('coach.reglages', r);
export const chargerConversation = () => { const c = lire('coach.conversation', []); return Array.isArray(c) ? c : []; };
export const enregistrerConversation = (c) => ecrire('coach.conversation', c.slice(-MAX_HISTORIQUE));

export const CONSIGNES = `Tu es le coach alimentaire de l'application NutriCoach, pour un couple (Eymric et Marie).
Réponds en français, avec un ton simple, chaleureux et concret, en quelques phrases courtes (listes si utile).
Règles de sécurité :
- Tu ne remplaces ni un médecin, ni une sage-femme, ni un diététicien : pour toute question médicale, renvoie vers un professionnel.
- Respecte STRICTEMENT les allergies, intolérances, régimes et aliments évités indiqués dans le contexte.
- Grossesse, allaitement, enfants, personnes âgées : prudence (pas de cru à risque, pas d'alcool, pas de régime restrictif).
- Ne propose jamais de régime extrême ni de perte de poids rapide ; pas de jeûne prolongé.
- Si tu n'es pas sûr, dis-le.
Tu peux proposer des idées de repas, équilibrer la semaine, expliquer une recette ou conseiller des substitutions.
Si une photo ou un document est joint (étiquette, menu, ordonnance, bilan, recette), explique-le simplement ; ne pose jamais de diagnostic et renvoie vers un professionnel pour toute interprétation médicale.`;

/** Texte de contexte (profil et menu) envoyé au coach, uniquement si la personne l'a accepté. */
export function construireContexte({ profil, besoins, prenom, repasSemaine = [], saison, lignesSuivi = [] }) {
  const lignes = [];
  if (saison) lignes.push(`Saison : ${saison}.`);
  if (profil) {
    const l = [`Personne : ${prenom || 'utilisateur'}`];
    if (profil.sexe) l.push(profil.sexe === 'femme' ? 'femme' : 'homme');
    if (profil.grossesse > 0) l.push(`enceinte (${profil.grossesse}e trimestre)`);
    if (profil.allaitement) l.push('allaitement');
    if (profil.sportif) l.push('sportif');
    if (profil.convalescence) l.push('en convalescence');
    lignes.push(l.join(', ') + '.');
    if (profil.objectif) lignes.push(`Objectif : ${profil.objectif}.`);
    if (besoins) lignes.push(`Besoins estimés : ${besoins.cible} kcal par jour (protéines ${besoins.proteines_g} g, glucides ${besoins.glucides_g} g, lipides ${besoins.lipides_g} g).`);
    if (profil.regimes && profil.regimes.length) lignes.push(`Régimes : ${profil.regimes.join(', ')}.`);
    if (profil.allergenes && profil.allergenes.length) lignes.push(`ALLERGIES / à exclure absolument : ${profil.allergenes.join(', ')}.`);
    if (profil.exclusions) lignes.push(`Aliments évités : ${profil.exclusions}.`);
    if (profil.conditions && profil.conditions.length) lignes.push(`Conditions : ${profil.conditions.join(', ')}.`);
  }
  if (repasSemaine.length) lignes.push('Menu de la semaine : ' + repasSemaine.join(' ; ') + '.');
  for (const l of lignesSuivi) lignes.push(l);
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
