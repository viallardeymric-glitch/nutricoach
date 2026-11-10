// Écran de verrouillage par code PIN.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { verifierPin } from '../core/pin.js';
import { verifierBiometrie } from '../core/biometrie.js';

const ESSAIS_MAX = 5;
const PAUSE_S = 30;

export function Verrou({ enreg, onDeverrouiller, biometrie = false }) {
  const [pin, setPin] = useState('');
  const [erreur, setErreur] = useState('');
  const [echecs, setEchecs] = useState(0);
  const [pause, setPause] = useState(0);
  const champ = useRef(null);
  const bio = async () => { if (await verifierBiometrie()) onDeverrouiller(); else setErreur('Face ID / Touch ID n\'a pas reconnu l\'appareil : saisissez votre code.'); };
  useEffect(() => { if (biometrie) bio(); else champ.current && champ.current.focus(); }, []);
  useEffect(() => {
    if (pause <= 0) return undefined;
    const t = setTimeout(() => setPause((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [pause]);

  const valider = async (e) => {
    e.preventDefault();
    if (pause > 0) return;
    if (await verifierPin(pin, enreg)) { onDeverrouiller(); return; }
    const n = echecs + 1;
    setPin('');
    if (n % ESSAIS_MAX === 0) { setPause(PAUSE_S); setErreur(`Trop d'essais. Patientez ${PAUSE_S} secondes.`); } else setErreur('Code incorrect.');
    setEchecs(n);
  };
  return html`<form class="connexion verrou" onSubmit=${valider}>
    <h1>🔒 NutriCoach</h1>
    <p class="desc">Saisissez votre code pour continuer.</p>
    <input ref=${champ} type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8"
      class="pin" aria-label="Code PIN" value=${pin} onInput=${(e) => setPin(e.target.value.replace(/\D/g, ''))} />
    <p class="erreur-champ" role="alert">${pause > 0 ? `Trop d'essais. Patientez ${pause} s.` : erreur}</p>
    <button type="submit" class="bouton grand" disabled=${pause > 0 || pin.length < 4}>Déverrouiller</button>
    ${biometrie && html`<button type="button" class="bouton secondaire" onClick=${bio}>🔓 Face ID / Touch ID</button>`}
  </form>`;
}
