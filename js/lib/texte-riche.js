// Mise en forme minimale des réponses du coach (gras et listes), sans innerHTML.
// Retourne des blocs : { type: 'p' | 'ul', ... } ; le gras est repéré par **texte**.

/** « un **mot** » → [{ texte: 'un ' }, { texte: 'mot', gras: true }] */
export function segments(ligne) {
  const morceaux = [];
  const re = /\*\*(.+?)\*\*/g;
  let dernier = 0;
  let m;
  while ((m = re.exec(ligne))) {
    if (m.index > dernier) morceaux.push({ texte: ligne.slice(dernier, m.index) });
    morceaux.push({ texte: m[1], gras: true });
    dernier = m.index + m[0].length;
  }
  if (dernier < ligne.length) morceaux.push({ texte: ligne.slice(dernier) });
  return morceaux.length ? morceaux : [{ texte: '' }];
}

export function blocs(texte) {
  const res = [];
  for (const brut of String(texte).split('\n')) {
    const l = brut.trim();
    if (!l) continue;
    const puce = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if (puce) {
      const dernier = res[res.length - 1];
      if (dernier && dernier.type === 'ul') dernier.items.push(segments(puce[1]));
      else res.push({ type: 'ul', items: [segments(puce[1])] });
    } else res.push({ type: 'p', segments: segments(l.replace(/^#+\s*/, '')) });
  }
  return res;
}
