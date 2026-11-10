// Glisser-déposer au doigt (et à la souris) avec les « pointer events » : une poignée est saisie, un fantôme suit le doigt,
// la zone survolée est repérée par ses attributs data-glisser-j / data-glisser-repas. Défilement automatique près des bords.
const SEUIL = 6;            // px avant de considérer que c'est un glissement
const BORD = 70;            // px du bord de l'écran où la page défile
const VITESSE = 14;         // px par image

/** Zone de dépôt sous un point de l'écran : { j, repas, element } ou null. */
export function cibleSousPoint(x, y, doc = document) {
  const el = doc.elementFromPoint(x, y);
  const zone = el && el.closest ? el.closest('[data-glisser-j]') : null;
  return zone ? { j: zone.getAttribute('data-glisser-j'), repas: zone.getAttribute('data-glisser-repas'), element: zone } : null;
}

/**
 * À appeler dans onPointerDown de la poignée. `source` = { j, repas } ; `fantome` = texte du fantôme.
 * onSurvol(cible|null) à chaque changement de zone survolée ; onDepot(source, cible) au relâchement sur une zone ; onFin() toujours.
 */
export function demarrerGlisser(evt, { source, fantome, onSurvol, onDepot, onFin }) {
  if (evt.button != null && evt.button > 0) return;
  const x0 = evt.clientX; const y0 = evt.clientY;
  let actif = false; let ghost = null; let derniere = null; let x = x0; let y = y0; let raf = 0;
  const poignee = evt.currentTarget;
  try { poignee.setPointerCapture(evt.pointerId); } catch { /* pas critique */ }

  const survol = () => {
    const c = cibleSousPoint(x, y);
    const cle = c ? `${c.j}|${c.repas}` : '';
    if (cle !== derniere) { derniere = cle; onSurvol && onSurvol(c ? { j: c.j, repas: c.repas } : null); }
    return c;
  };
  const defiler = () => {
    if (!actif) return;
    if (y < BORD) window.scrollBy(0, -VITESSE); else if (y > window.innerHeight - BORD) window.scrollBy(0, VITESSE);
    if (ghost) { ghost.style.left = `${x}px`; ghost.style.top = `${y}px`; }
    survol();
    raf = requestAnimationFrame(defiler);
  };
  const bouger = (e) => {
    x = e.clientX; y = e.clientY;
    if (!actif && Math.hypot(x - x0, y - y0) > SEUIL) {
      actif = true;
      ghost = document.createElement('div');
      ghost.className = 'glisser-fantome';
      ghost.textContent = fantome || '';
      document.body.appendChild(ghost);
      document.body.classList.add('glisse');
      raf = requestAnimationFrame(defiler);
    }
    if (actif) e.preventDefault();
  };
  const nettoyer = () => {
    document.removeEventListener('pointermove', bouger);
    document.removeEventListener('pointerup', relacher);
    document.removeEventListener('pointercancel', annuler);
    cancelAnimationFrame(raf);
    if (ghost) ghost.remove();
    document.body.classList.remove('glisse');
    try { poignee.releasePointerCapture(evt.pointerId); } catch { /* déjà relâché */ }
    onSurvol && onSurvol(null);
    onFin && onFin();
  };
  const relacher = (e) => {
    x = e.clientX; y = e.clientY;
    const c = actif ? cibleSousPoint(x, y) : null;
    nettoyer();
    if (c && onDepot) onDepot(source, { j: c.j, repas: c.repas });
  };
  const annuler = () => nettoyer();
  document.addEventListener('pointermove', bouger, { passive: false });
  document.addEventListener('pointerup', relacher);
  document.addEventListener('pointercancel', annuler);
}
