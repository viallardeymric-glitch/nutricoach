// Frigo magique : que cuisiner avec ce qu'on a ? Anti-gaspi : d'abord ce qui périme bientôt.
import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { articlesDuFrigo, frigoMagique, aConsommerBientot } from '../lib/frigo.js';
import { convient } from '../lib/planning.js';
import { cleArticle, analyserSaisie, ajouterAuStock } from '../lib/courses.js';
import { rayonDe } from '../data/rayons.js';
import { Entete, Section, Bandeau, Puce, MiniRecette } from '../ui/composants.js';

const fr = (d) => d.split('-').reverse().join('/');
const nouvelId = () => 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function Frigo({ index, stock, contraintes, ops, moi }) {
  const [exclus, setExclus] = useState(new Set());      // articles du stock non utilisés pour la recherche
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState(null);
  const urgents = useMemo(() => aConsommerBientot(stock), [stock]);
  const utilises = useMemo(() => stock.filter((s) => !exclus.has(s.cle)), [stock, exclus]);
  const articles = useMemo(() => articlesDuFrigo(utilises), [utilises]);
  const prioritaires = urgents.map((u) => u.nom);
  const resultats = useMemo(() => (index && articles.length ? frigoMagique(index, articles, { convient: (r) => convient(r, contraintes), prioritaires }) : []), [index, articles, contraintes, prioritaires.join('|')]);

  const ajouter = (e) => {
    e.preventDefault();
    const s = analyserSaisie(saisie);
    if (!s.nom) return;
    const [a] = ajouterAuStock([], [{ nom: s.nom, quantite: s.quantite, unite: s.unite, rayon: rayonDe(s.nom) }]);
    const ex = stock.find((x) => x.cle === a.cle);
    ops.ecrireStock(ex ? { ...ex, quantite: ex.quantite + a.quantite } : a);
    setSaisie('');
  };
  const ajouterManquants = (res) => {
    for (const nom of res.manquants) ops.ecrireArticle({ id: nouvelId(), liste: 'semaine', nom: nom.charAt(0).toUpperCase() + nom.slice(1), quantite: 1, unite: 'pièce', cle: cleArticle(nom, 'pièce'), rayon: rayonDe(nom), par: moi, source: 'manuel', coche: false, cochePar: '', recettes: [] });
    setMessage({ type: 'info', texte: `${res.manquants.length} ingrédient${res.manquants.length > 1 ? 's' : ''} ajouté${res.manquants.length > 1 ? 's' : ''} à la liste de courses.` });
  };
  return html`<div>
    <${Entete} titre="Frigo magique" sous="Cuisinez ce que vous avez" retour=${{ href: '#/plus', nom: 'Plus' }} />
    <div class="contenu">
      ${message && html`<${Bandeau} type=${message.type}><p>${message.texte}</p><//>`}
      ${urgents.length > 0 && html`<${Bandeau} type="avertissement" titre="♻ Anti-gaspi : à consommer bientôt">
        <ul>${urgents.map((u) => html`<li key=${u.cle}><strong>${u.nom}</strong> : ${u.perime ? html`<strong>date dépassée</strong> (${fr(u.peremption)})` : u.joursRestants === 0 ? 'aujourd\'hui' : `dans ${u.joursRestants} jour${u.joursRestants > 1 ? 's' : ''} (${fr(u.peremption)})`}</li>`)}</ul>
        <p class="note">Les recettes qui utilisent ces produits passent en premier. Un produit dont la date est dépassée est à vérifier avant de le cuisiner.</p><//>`}
      <${Section} titre="Mon frigo et mes placards">
        <form class="ligne-saisie" onSubmit=${ajouter}><input type="text" placeholder="Ajouter : 3 courgettes, poulet…" value=${saisie} onInput=${(e) => setSaisie(e.target.value)} aria-label="Ajouter un ingrédient" />
          <button type="submit" class="bouton" disabled=${!saisie.trim()} aria-label="Ajouter">＋</button></form>
        ${stock.length === 0 ? html`<p class="note">Le stock est vide. Ajoutez ce que vous avez, ou terminez vos courses : il se remplit tout seul.</p>`
          : html`<div class="puces sans-marge">${stock.map((s) => html`<${Puce} key=${s.cle} actif=${!exclus.has(s.cle)} onClick=${() => { const n = new Set(exclus); if (n.has(s.cle)) n.delete(s.cle); else n.add(s.cle); setExclus(n); }}>${s.nom}<//>`)}</div>
            <p class="note">Touchez un produit pour l'écarter de la recherche. Le sel, l'huile, la farine et les épices sont toujours supposés disponibles.</p>`}
      <//>
      <${Section} titre=${`Recettes possibles${resultats.length ? ` (${resultats.length})` : ''}`}>
        ${!articles.length ? html`<p class="note">Ajoutez au moins deux ingrédients.</p>` : resultats.length === 0
          ? html`<div class="etat"><p>Aucune recette ne correspond assez à votre stock.</p><p class="sous">Essayez d'ajouter un ingrédient de plus (légume, viande, féculent).</p></div>`
          : resultats.map((x) => html`<div class="resultat-frigo" key=${x.r.id}>
              <${MiniRecette} r=${x.r} />
              <p class="sous">✔ ${x.couverts.length} sur ${x.couverts.length + x.manquants.length} ingrédients${x.gaspi ? ' · ♻ utilise ce qui périme' : ''}</p>
              ${x.manquants.length > 0 && html`<p class="sous">Il manque : ${x.manquants.join(', ')} <button type="button" class="lien" onClick=${() => ajouterManquants(x)}>Ajouter aux courses</button></p>`}</div>`)}
      <//>
    </div></div>`;
}
