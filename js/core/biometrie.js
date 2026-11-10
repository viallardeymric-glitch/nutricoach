// Face ID / Touch ID (WebAuthn, authentificateur de la plateforme), en option et seulement en complément du code PIN.
// Le déverrouillage exige la vérification biométrique de l'appareil. Il n'y a pas de serveur : la signature n'est pas
// contrôlée côté serveur, c'est une porte d'entrée de l'appli (comme le PIN), pas un chiffrement des données.
import { lire, ecrire } from './stockage.js';

const enBase64Url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const depuisBase64Url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hasard = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function biometrieDisponible() {
  try { return Boolean(window.PublicKeyCredential && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { return false; }
}
export const biometrieActive = () => Boolean(lire('biometrie', null));

/** Enregistre une clé biométrique sur cet appareil (demande Face ID / Touch ID). Lève une Error lisible sinon. */
export async function activerBiometrie() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: hasard(32),
      rp: { name: 'NutriCoach', id: location.hostname },
      user: { id: hasard(16), name: 'nutricoach', displayName: 'NutriCoach' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none',
    } });
    ecrire('biometrie', { id: enBase64Url(cred.rawId) });
    return true;
  } catch (e) {
    throw new Error(e && e.name === 'NotAllowedError' ? 'Vérification annulée ou refusée.' : 'Face ID / Touch ID n\'est pas disponible sur cet appareil.');
  }
}

/** Demande la vérification biométrique ; true si l'utilisateur est reconnu. */
export async function verifierBiometrie() {
  const enreg = lire('biometrie', null);
  if (!enreg) return false;
  try {
    const rep = await navigator.credentials.get({ publicKey: {
      challenge: hasard(32), rpId: location.hostname, userVerification: 'required', timeout: 60000,
      allowCredentials: [{ type: 'public-key', id: depuisBase64Url(enreg.id) }],
    } });
    return Boolean(rep);
  } catch { return false; }
}
export function desactiverBiometrie() { try { localStorage.removeItem('nutricoach.biometrie'); } catch { /* ignoré */ } }
