// Lecture de codes-barres avec la caméra : BarcodeDetector quand il existe (Chrome, Android), sinon ZXing en copie locale
// (Safari iPhone). La caméra n'est demandée que sur l'écran Scanner et est coupée en le quittant.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export const cameraDisponible = () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

/**
 * Démarre la lecture dans l'élément <video>. `surCode(code)` est appelé à chaque détection (une fois par code).
 * Retourne une fonction d'arrêt. Lève une Error au message lisible si la caméra est refusée ou absente.
 */
export async function demarrerScan(video, surCode, { detecteur = window.BarcodeDetector } = {}) {
  if (!cameraDisponible()) throw new Error('Ce navigateur ne permet pas d\'utiliser la caméra. Saisissez le numéro du code-barres.');
  let flux;
  try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
  catch (e) {
    throw new Error(e && e.name === 'NotAllowedError'
      ? 'L\'accès à la caméra est refusé. Autorisez-la dans les réglages du navigateur, ou saisissez le numéro.'
      : 'Aucune caméra disponible. Saisissez le numéro du code-barres.');
  }
  video.srcObject = flux;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => {});
  let actif = true;
  let dernier = '';
  const arreter = () => { actif = false; flux.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
  const signaler = (code) => { if (actif && code && code !== dernier) { dernier = code; surCode(code); } };

  if (detecteur) {
    const d = new detecteur({ formats: FORMATS });
    const boucle = async () => {
      while (actif) {
        try { const r = await d.detect(video); if (r.length) signaler(r[0].rawValue); } catch { /* image pas prête */ }
        await new Promise((ok) => setTimeout(ok, 180));
      }
    };
    boucle();
  } else {
    const { BrowserMultiFormatReader } = await import('../../vendor/zxing.js');
    const lecteur = new BrowserMultiFormatReader();
    lecteur.decodeFromStream(flux, video, (resultat) => { if (resultat) signaler(resultat.getText()); }).catch(() => {});
    return () => { arreter(); try { lecteur.reset(); } catch { /* déjà arrêté */ } };
  }
  return arreter;
}
