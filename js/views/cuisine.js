// Mode cuisine pas à pas : plein écran, une étape à la fois, écran allumé, minuteur, balayage.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { chargerFiche } from '../core/catalogue.js';
import { REGLAGES, lib } from '../data/libelles.js';
import { ligneIngredient } from '../lib/adaptation.js';
import { dureeEtape, formaterMinuteur } from '../lib/cuisine.js';
import { etapesThermomix, recetteThermomix } from '../lib/thermomix.js';
import { chargerReecriture } from '../core/reecriture.js';
import { lire, ecrire } from '../core/stockage.js';

function bip() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
      o.start(ctx.currentTime + i * 0.35); o.stop(ctx.currentTime + i * 0.35 + 0.2);
    }
  } catch { /* son indisponible : la vibration et l'affichage suffisent */ }
}

function Minuteur({ secondes, cle }) {
  const [fin, setFin] = useState(null);          // instant d'échéance quand le minuteur tourne
  const [reste, setReste] = useState(secondes);  // secondes restantes quand il est en pause
  const [, retick] = useState(0);
  const sonne = useRef(false);
  useEffect(() => { setFin(null); setReste(secondes); sonne.current = false; }, [cle]);
  useEffect(() => {
    if (!fin) return undefined;
    const t = setInterval(() => retick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [fin]);
  const restant = fin ? Math.max(0, Math.ceil((fin - Date.now()) / 1000)) : reste;
  useEffect(() => {
    if (fin && restant === 0 && !sonne.current) { sonne.current = true; setFin(null); setReste(0); bip(); }
  });
  const demarrer = () => { if (restant === 0) { setReste(secondes); sonne.current = false; setFin(Date.now() + secondes * 1000); } else setFin(Date.now() + restant * 1000); };
  const pause = () => { setReste(restant); setFin(null); };
  const raz = () => { setFin(null); setReste(secondes); sonne.current = false; };
  return html`<div class=${'minuteur' + (restant === 0 ? ' fini' : '')} role="timer" aria-live="off">
    <strong class="minuteur-temps">${restant === 0 ? '⏰ Terminé !' : formaterMinuteur(restant)}</strong>
    <div class="minuteur-boutons">
      ${fin ? html`<button type="button" onClick=${pause}>Pause</button>`
        : html`<button type="button" onClick=${demarrer}>${restant === 0 ? 'Relancer' : restant < secondes ? 'Reprendre' : 'Lancer le minuteur'}</button>`}
      ${(fin || restant < secondes) && html`<button type="button" class="discret" onClick=${raz}>Remettre à zéro</button>`}
    </div></div>`;
}

const vocalDisponible = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
function lireAVoixHaute(texte) {
  if (!vocalDisponible()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'fr-FR'; u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function Cuisine({ id, index, portions, methode = null, modele = 'TM6' }) {
  const [r, setR] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [i, setI] = useState(0);           // 0 : ingrédients, 1..n : étapes, n+1 : fin
  const [veille, setVeille] = useState(true);
  const [voixAuto, setVoixAuto] = useState(() => lire('cuisine.voix', false));
  const toucheX = useRef(null);

  useEffect(() => {
    let actif = true;
    if (!index) return undefined;
    chargerFiche(index, id).then((x) => { if (actif) { x ? setR(x) : setErreur(true); } }).catch(() => actif && setErreur(true));
    return () => { actif = false; };
  }, [id, index]);

  // Écran allumé pendant la cuisine (si le navigateur le permet).
  useEffect(() => {
    let verrou = null;
    let ferme = false;
    const demander = async () => {
      try { if (navigator.wakeLock && document.visibilityState === 'visible') { verrou = await navigator.wakeLock.request('screen'); if (ferme) verrou.release(); } else setVeille(false); }
      catch { setVeille(false); }
    };
    demander();
    document.addEventListener('visibilitychange', demander);
    return () => { ferme = true; document.removeEventListener('visibilitychange', demander); if (verrou) verrou.release().catch(() => {}); };
  }, []);

  const sortie = html`<a class="cuisine-fermer" href=${'#/recette/' + id} aria-label="Quitter le mode cuisine">✕</a>`;
  if (!r) {
    return html`<div class="cuisine">${sortie}<p class="etat">${erreur ? 'Recette introuvable hors ligne.' : 'Chargement…'}</p></div>`;
  }
  const thermo = methode === 'thermomix' && recetteThermomix(r);
  const reecrite = !thermo && methode && methode !== r.appareil_principal ? chargerReecriture(r.id, methode, modele) : null;
  const etapes = thermo ? etapesThermomix(r, modele) : reecrite ? reecrite.etapes.map((e) => ({ ...e, pastilles: [], avertissements: [] })) : r.etapes.map((e) => ({ ...e, pastilles: [], avertissements: [] }));
  const n = etapes.length;
  const aller = (k) => { const j = Math.min(n + 1, Math.max(0, k)); setI(j); if (voixAuto && j >= 1 && j <= n) lireAVoixHaute(etapes[j - 1].texte); };
  const etape = i >= 1 && i <= n ? etapes[i - 1] : null;
  const duree = etape ? dureeEtape(etape) : null;
  const facteur = portions / r.portions_base;
  return html`<div class="cuisine"
      onTouchStart=${(e) => { toucheX.current = e.changedTouches[0].clientX; }}
      onTouchEnd=${(e) => { if (toucheX.current == null) return; const dx = e.changedTouches[0].clientX - toucheX.current; toucheX.current = null; if (Math.abs(dx) > 70) aller(i + (dx < 0 ? 1 : -1)); }}>
    ${sortie}
    <div class="cuisine-progres" aria-hidden="true"><span style=${`width:${(i / (n + 1)) * 100}%`}></span></div>
    <p class="cuisine-titre">${r.titre}${thermo ? ` · Thermomix ${modele}` : reecrite ? ` · ${methode} (version IA, à vérifier)` : ''}</p>
    <div class="cuisine-corps">
      ${i === 0 && html`<h2>Ingrédients <small>pour ${portions} personne${portions > 1 ? 's' : ''}</small></h2>
        <ul class="ingredients">${r.ingredients.map((ing, k) => { const l = ligneIngredient(ing, facteur);
          return html`<li key=${k}><strong>${l.quantite}</strong> ${l.aliment}${l.precision && html` <span class="prec">(${l.precision})</span>`}</li>`; })}</ul>
        ${!veille && html`<p class="note">L'écran peut s'éteindre : ce navigateur ne permet pas de le garder allumé.</p>`}`}
      ${etape && html`<p class="cuisine-etape-num">Étape ${i} sur ${n}</p>
        <p class="cuisine-texte">${etape.texte}</p>
        ${etape.pastilles && etape.pastilles.length > 0 ? html`<div class="reglages grands thermo">${etape.pastilles.map((p) => html`<span key=${p.cle}>${p.icone} ${p.texte}</span>`)}</div>`
          : etape.reglages && Object.keys(etape.reglages).length > 0 && html`<div class="reglages grands">${Object.entries(etape.reglages).map(([k, v]) => html`<span key=${k}>${lib(REGLAGES, k)} : ${v}</span>`)}</div>`}
        ${etape.avertissements && etape.avertissements.map((a) => html`<p class="note" key=${a}>⚠ ${a}</p>`)}
        ${vocalDisponible() && html`<div class="puces sans-marge"><button type="button" class="puce" onClick=${() => lireAVoixHaute(etape.texte)}>🔊 Lire l'étape</button>
          <button type="button" class="puce" aria-pressed=${voixAuto} onClick=${() => { const v = !voixAuto; setVoixAuto(v); ecrire('cuisine.voix', v); if (v) lireAVoixHaute(etape.texte); else window.speechSynthesis.cancel(); }}>Lecture automatique</button></div>`}
        ${duree && html`<${Minuteur} secondes=${duree} cle=${`${id}-${i}`} />`}`}
      ${i === n + 1 && html`<h2>Bon appétit ! 🍽️</h2>
        ${r.astuces.length > 0 && html`<ul class="simple">${r.astuces.map((a) => html`<li>${a}</li>`)}</ul>`}
        ${r.conservation && html`<p class="note">Conservation : ${r.conservation.frigo_jours} jours au frigo. ${r.conservation.reechauffage || ''}</p>`}`}
    </div>
    <div class="cuisine-nav">
      <button type="button" class="bouton secondaire" onClick=${() => aller(i - 1)} disabled=${i === 0}>← Précédent</button>
      ${i <= n ? html`<button type="button" class="bouton" onClick=${() => aller(i + 1)}>${i === 0 ? 'Commencer →' : i === n ? 'Terminer ✓' : 'Suivant →'}</button>`
        : html`<a class="bouton" href=${'#/recette/' + id}>Retour à la fiche</a>`}
    </div>
  </div>`;
}
