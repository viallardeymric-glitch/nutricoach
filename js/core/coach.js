// Coach IA (Gemini par défaut). La clé est saisie dans les réglages et reste sur ce téléphone :
// jamais dans le dépôt, jamais synchronisée. Fonctions de construction/lecture pures, testées.
import { lire, ecrire } from './stockage.js';

export const MODELE_PAR_DEFAUT = 'gemini-2.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_HISTORIQUE = 40;

export const chargerReglagesCoach = () => ({ cle: '', modele: MODELE_PAR_DEFAUT, partagerProfil: false, ...lire('coach.reglages', {}) });
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
Tu peux proposer des idées de repas, équilibrer la semaine, expliquer une recette ou conseiller des substitutions.`;

/** Texte de contexte (profil et menu) envoyé au coach, uniquement si la personne l'a accepté. */
export function construireContexte({ profil, besoins, prenom, repasSemaine = [], saison }) {
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
  return lignes.join('\n');
}

/** Corps de la requête Gemini : consignes + contexte + historique (rôles « user » / « model »). */
export function construireRequete({ historique, contexte }) {
  const systeme = contexte ? `${CONSIGNES}\n\nContexte de l'utilisateur :\n${contexte}` : CONSIGNES;
  return {
    systemInstruction: { parts: [{ text: systeme }] },
    contents: historique.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.texte }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 900 },
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

/** Appelle Gemini ; retourne le texte ou lève une Error au message lisible. `appeler` est injectable pour les tests. */
export async function demanderAuCoach({ cle, modele = MODELE_PAR_DEFAUT, historique, contexte }, appeler = fetch) {
  if (!cle) throw new Error('Ajoutez votre clé Gemini dans les réglages du coach.');
  let rep;
  try {
    rep = await appeler(`${URL_BASE}${encodeURIComponent(modele)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify(construireRequete({ historique, contexte })),
    });
  } catch { throw new Error(messageErreurCoach(0)); }
  if (!rep.ok) throw new Error(messageErreurCoach(rep.status));
  const texte = extraireTexte(await rep.json());
  if (!texte) throw new Error('Le coach n\'a pas pu répondre à cette question. Reformulez-la.');
  return texte;
}
