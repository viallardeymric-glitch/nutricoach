// Fiche recette : avertissements, ingrédients adaptés au nombre de personnes, étapes, nutrition.
import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { PORTIONS_MIN, PORTIONS_MAX } from '../core/config.js';
import { chargerFiche } from '../core/catalogue.js';
import { REGIMES, ALLERGENES, PROFILS, NUTRITION, REGLAGES, DIFFICULTES, COUTS, lib, libSousCategorie } from '../data/libelles.js';
import { ligneIngredient, conseilsAdaptation } from '../lib/adaptation.js';
import { conflitsProfil } from '../lib/profils.js';
import { PERSONNES } from '../core/config.js';
import { Pictogramme, Coeur, Bandeau, Pastille } from '../ui/composants.js';

/** Avertissements : toujours affichés en haut de la fiche quand la recette en comporte. */
function Avertissements({ liste }) {
  if (!liste || !liste.length) return null;
  return html`<${Bandeau} type="alerte" titre="⚠ Déconseillé à">
    <ul>${liste.map((d) => html`<li><strong>${lib(PROFILS, d.profil)}</strong> : ${d.raison}</li>`)}</ul>
    <p class="note">Ces avertissements couvrent les cas courants mais ne sont pas exhaustifs.</p><//>`;
}

/** « À savoir pour Marie » : ce qui ne convient pas à CE profil (en plus des avertissements généraux). */
function AlerteProfil({ r, moi, profil }) {
  if (!moi || !profil || profil.appliquer === false) return null;
  const c = conflitsProfil(r, profil);
  if (!c.alertes.length && !c.allergenes.length && !c.regimes.length && !c.exclusions.length) return null;
  return html`<${Bandeau} type="alerte" titre=${html`<${Pastille} qui=${moi} /> À savoir pour ${PERSONNES[moi].prenom}`}>
    <ul>
      ${c.alertes.map((d) => html`<li><strong>${lib(PROFILS, d.profil)}</strong> : ${d.raison}</li>`)}
      ${c.allergenes.length > 0 && html`<li>Contient ${c.allergenes.map((a) => lib(ALLERGENES, a).toLowerCase()).join(', ')} : à éviter selon votre profil.</li>`}
      ${c.regimes.length > 0 && html`<li>Ne respecte pas votre régime : ${c.regimes.map((g) => lib(REGIMES, g).toLowerCase()).join(', ')}.</li>`}
      ${c.exclusions.length > 0 && html`<li>Contient un aliment que vous évitez (${c.exclusions.join(', ')}).</li>`}
    </ul><//>`;
}

function Ingredients({ liste, facteur }) {
  const sections = [];
  for (const ing of liste) {
    let s = sections.find((x) => x.nom === ing.section);
    if (!s) { s = { nom: ing.section, items: [] }; sections.push(s); }
    s.items.push(ing);
  }
  return sections.map((s) => html`<div key=${s.nom}>
    ${s.nom && html`<h3 class="petit-titre">${s.nom}</h3>`}
    <ul class="ingredients">
      ${s.items.map((ing, i) => {
        const l = ligneIngredient(ing, facteur);
        return html`<li key=${i}><strong>${l.quantite}</strong> ${l.aliment}
          ${l.precision && html` <span class="prec">(${l.precision})</span>`}</li>`;
      })}
    </ul></div>`);
}

/** Contenu d'une fiche déjà chargée (composant pur : utilisé aussi par scripts/verifier-affichage.mjs). */
export function FicheRecette({ r, portions, setPortions, favori, onFavori, moi, profil }) {
  const facteur = portions / r.portions_base;
  const t = r.temps;
  const c = r.conservation;
  const maxPortions = Math.max(PORTIONS_MAX, r.portions_base);
  const conseils = conseilsAdaptation(r, portions);
  return html`<article class="fiche">
    <div class="fiche-hero"><${Pictogramme} recette=${r} grand=${true} /></div>
    <div class="fiche-corps">
      <div class="fiche-titre"><h1>${r.titre}</h1><${Coeur} actif=${favori} onClick=${onFavori} /></div>
      <div class="meta">
        <span>${r.categorie} · ${libSousCategorie(r.sous_categorie)}</span>
        <span>⏱ ${t.total_min} min</span>
        <span>Préparation ${t.preparation_min} min</span>
        ${t.cuisson_min > 0 && html`<span>Cuisson ${t.cuisson_min} min</span>`}
        ${t.repos_min > 0 && html`<span>Repos ${t.repos_min} min</span>`}
        <span>${lib(DIFFICULTES, r.difficulte)}</span>
        <span>Coût : ${lib(COUTS, r.cout).toLowerCase()}</span>
      </div>
      <p class="desc">${r.description}</p>
      <${AlerteProfil} r=${r} moi=${moi} profil=${profil} />
      <${Avertissements} liste=${r.deconseille_a} />
      ${r.allergenes.length > 0 && html`<div class="etiquettes" aria-label="Allergènes">
        <strong>Contient :</strong>
        ${r.allergenes.map((a) => html`<span class="etiquette allergene">${lib(ALLERGENES, a)}</span>`)}</div>`}
      ${r.regimes_compatibles.length > 0 && html`<div class="etiquettes" aria-label="Régimes compatibles">
        ${r.regimes_compatibles.map((g) => html`<span class="etiquette">${lib(REGIMES, g)}</span>`)}</div>`}

      <h2 class="petit-titre">Ingrédients</h2>
      <div class="portions">
        <button type="button" aria-label="Une personne de moins" disabled=${portions <= PORTIONS_MIN}
          onClick=${() => setPortions((p) => Math.max(PORTIONS_MIN, p - 1))}>−</button>
        <output aria-live="polite">${portions} personne${portions > 1 ? 's' : ''}</output>
        <button type="button" aria-label="Une personne de plus" disabled=${portions >= maxPortions}
          onClick=${() => setPortions((p) => Math.min(maxPortions, p + 1))}>+</button>
        ${portions !== r.portions_base && html`<button type="button" class="lien"
          onClick=${() => setPortions(r.portions_base)}>Revenir à ${r.portions_base}</button>`}
      </div>
      ${conseils.length > 0 && html`<${Bandeau} type="info" titre="Pour ${portions} personne${portions > 1 ? 's' : ''}">
        <ul>${conseils.map((x) => html`<li>${x}</li>`)}</ul><//>`}
      <${Ingredients} liste=${r.ingredients} facteur=${facteur} />
      ${r.ustensiles.length > 0 && html`<p class="note">Ustensiles : ${r.ustensiles.join(', ')}</p>`}

      <h2 class="petit-titre">Étapes</h2>
      <ol class="etapes">
        ${r.etapes.map((e) => html`<li key=${e.numero}><span>${e.texte}</span>
          ${e.reglages && Object.keys(e.reglages).length > 0 && html`<div class="reglages">
            ${Object.entries(e.reglages).map(([k, v]) => html`<span>${lib(REGLAGES, k)} : ${v}</span>`)}</div>`}
        </li>`)}
      </ol>

      ${r.astuces.length > 0 && html`<h2 class="petit-titre">Astuces</h2>
        <ul class="simple">${r.astuces.map((a) => html`<li>${a}</li>`)}</ul>`}
      ${c && html`<h2 class="petit-titre">Conservation</h2>
        <ul class="simple">
          <li>Au frigo : ${c.frigo_jours} jour${c.frigo_jours > 1 ? 's' : ''}</li>
          <li>Au congélateur : ${c.congelation_mois} mois</li>
          ${c.reechauffage && html`<li>${c.reechauffage}</li>`}
        </ul>`}

      <h2 class="petit-titre">Nutrition par portion <small>(valeurs estimées)</small></h2>
      <table class="nutrition"><tbody>
        ${NUTRITION.map(([k, nom, u]) => r.nutrition_par_portion[k] != null && html`<tr key=${k}>
          <th scope="row">${nom}</th><td>${String(r.nutrition_par_portion[k]).replace('.', ',')} ${u}</td></tr>`)}
      </tbody></table>
      <p class="note">Estimations pour une portion de la recette de base ; elles ne changent pas avec le nombre de personnes.</p>
    </div></article>`;
}

/** Charge la fiche complète puis l'affiche. */
export function Fiche({ id, index, favori, onFavori, moi, profil }) {
  const [r, setR] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [portions, setPortions] = useState(1);
  const [essai, setEssai] = useState(0);
  const entree = index && index.recettes.find((x) => x.id === id);

  useEffect(() => {
    let actif = true;
    setR(null); setErreur(false);
    if (!index) return undefined;
    chargerFiche(index, id)
      .then((x) => {
        if (!actif) return;
        if (!x) { setErreur(true); return; }
        setR(x); setPortions(x.portions_base);
        document.title = `${x.titre} – NutriCoach`;
      })
      .catch(() => actif && setErreur(true));
    return () => { actif = false; document.title = 'NutriCoach'; };
  }, [id, index, essai]);

  const barre = html`<div class="fiche-barre"><a class="retour" href="#/">← Recettes</a></div>`;
  if (!r) {
    return html`<div class="fiche">${barre}<div class="fiche-corps">
      ${entree && html`<h1>${entree.titre}</h1>`}
      ${erreur
        ? html`<div class="etat"><p>Impossible de charger cette recette. Elle sera disponible hors ligne après une première ouverture avec du réseau.</p>
            <button type="button" class="bouton" onClick=${() => setEssai((n) => n + 1)}>Réessayer</button></div>`
        : html`<p class="etat">Chargement de la recette…</p>`}
    </div></div>`;
  }
  return html`<div>${barre}<${FicheRecette} r=${r} portions=${portions} setPortions=${setPortions}
    favori=${favori} onFavori=${onFavori} moi=${moi} profil=${profil} /></div>`;
}
