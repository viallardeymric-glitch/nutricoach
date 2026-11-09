// Code PIN : dérivé avec PBKDF2 (WebCrypto), jamais stocké en clair. Il verrouille l'écran de l'appli ;
// il ne chiffre pas les données (elles sont protégées par la connexion et les règles Firestore).
import { lire, ecrire } from './stockage.js';

export const DELAI_VERROU_MS = 60_000; // reverrouillage après 1 minute en arrière-plan
const ITERATIONS = 150_000;
const enc = new TextEncoder();
const versB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const depuisB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const pinValide = (pin) => /^\d{4,8}$/.test(pin);

async function deriver(pin, sel, iterations) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, cle, 256);
}

/** Crée l'enregistrement à conserver : { sel, hash, iterations }. */
export async function creerPin(pin) {
  if (!pinValide(pin)) throw new Error('Le code doit comporter 4 à 8 chiffres.');
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return { sel: versB64(sel), hash: versB64(await deriver(pin, sel, ITERATIONS)), iterations: ITERATIONS };
}

export async function verifierPin(pin, enreg) {
  if (!enreg || !pinValide(pin)) return false;
  const calcule = new Uint8Array(await deriver(pin, depuisB64(enreg.sel), enreg.iterations));
  const attendu = depuisB64(enreg.hash);
  let diff = calcule.length ^ attendu.length;
  for (let i = 0; i < calcule.length; i++) diff |= calcule[i] ^ attendu[i];
  return diff === 0;
}

/** Faut-il reverrouiller au retour au premier plan ? */
export const doitVerrouiller = (masqueA, maintenant, delai = DELAI_VERROU_MS) => masqueA != null && maintenant - masqueA >= delai;

export const chargerPin = () => lire('pin', null);
export const enregistrerPin = (enreg) => ecrire('pin', enreg);
export const retirerPin = () => { try { localStorage.removeItem('nutricoach.pin'); } catch { /* ignoré */ } };
