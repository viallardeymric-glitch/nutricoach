// « J'ai cuisiné cette recette » : retirer ses ingrédients du stock (à la demande, ou automatiquement à la fin du mode cuisine).
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { lire, ecrire } from '../core/stockage.js';
import { retirerDuStock } from '../lib/courses.js';
import { Bandeau } from '../ui/composants.js';

export function RetraitStock({ recette, portions, stock = [], ops, auto = false }) {
  const [resultat, setResultat] = useState(null);
  const [automatique, setAutomatique] = useState(() => lire('stock.auto', false));
  const fait = useRef(false);
  const facteur = portions / recette.portions_base;
  const apercu = retirerDuStock(stock, recette.ingredients, facteur);
  const appliquer = () => {
    const r = retirerDuStock(stock, recette.ingredients, facteur);
    for (const x of r.maj) ops.ecrireStock(x);
    for (const x of r.supprimes) ops.supprimerStock(x);
    setResultat(r);
  };
  useEffect(() => { if (auto && automatique && !fait.current && stock.length) { fait.current = true; appliquer(); } }, [auto, automatique, stock.length]);
  const noms = (l) => l.slice(0, 8).join(', ') + (l.length > 8 ? '…' : '');
  if (resultat) return html`<${Bandeau} type="info" titre="Stock mis à jour"><p>${resultat.retires.length ? `Retiré du stock : ${noms(resultat.retires)}.` : 'Rien à retirer : aucun de ces ingrédients n\'était dans votre stock.'}${resultat.absents.length ? ` Pas en stock : ${noms(resultat.absents)}.` : ''}</p><//>`;
  if (!stock.length) return null;
  return html`<div class="retrait-stock">
    <p class="note">En stock pour cette recette (${portions} personne${portions > 1 ? 's' : ''}) : ${apercu.retires.length ? noms(apercu.retires) : 'aucun ingrédient'}.</p>
    <button type="button" class="bouton secondaire large" disabled=${!apercu.retires.length} onClick=${appliquer}>🧊 Retirer ces ingrédients de mon stock</button>
    <label class="case"><input type="checkbox" checked=${automatique} onChange=${(e) => { setAutomatique(e.target.checked); ecrire('stock.auto', e.target.checked); }} /><span>Le faire automatiquement quand je termine une recette en mode cuisine</span></label>
  </div>`;
}
