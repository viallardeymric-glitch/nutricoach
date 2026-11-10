// Fiche recette : avertissements, ingrédients adaptés au nombre de personnes, étapes, nutrition.
import { html, useState, useEffect, useMemo } from '../../vendor/preact-htm.js';
import { PORTIONS_MIN, PORTIONS_MAX } from '../core/config.js';
import { chargerFiche } from '../core/catalogue.js';
import { RetraitStock } from './stock-retrait.js';
import { REGIMES, ALLERGENES, PROFILS, NUTRITION, REGLAGES, DIFFICULTES, COUTS, lib, libSousCategorie } from '../data/libelles.js';
import { ligneIngredient, conseilsAdaptation } from '../lib/adaptation.js';
import { conflitsProfil, portionConseillee } from '../lib/profils.js';
import { nomRegime } from '../data/regimes.js';
import { PERSONNES } from '../core/config.js';
import { contraintesDeProfil, substitutionsPour, appliquerSubstitutions, nutritionAdaptee } from '../lib/substitutions.js';
import { etapesThermomix, recetteThermomix, capaciteBol, ordrePesee, MODELES } from '../lib/thermomix.js';
import { METHODES, methodeOriginale } from '../lib/methodes.js';
import { reecrire, chargerReecriture, oublierReecriture } from '../core/reecriture.js';
import { chargerAppareils } from '../core/appareils.js';
import { noterRecette, MENTION_SCORE_SANTE } from '../lib/sante.js';
import { LIBELLE_COULEUR } from '../lib/scan.js';
import { photoDeRecette } from '../core/photos.js';
import { Pictogramme, Coeur, Bandeau, Pastille, Puce } from '../ui/composants.js';

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
      ${c.regimes.length > 0 && html`<li>Ne respecte pas votre régime : ${c.regimes.map((g) => nomRegime(g).toLowerCase()).join(', ')}.</li>`}
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
/** Portion conseillée à chacun d'après sa cible calorique (un repas ≈ 35 % de la journée). */
function PortionsChacun({ r, personnes }) {
  if (!personnes || !personnes.length) return null;
  const kcal = r.nutrition_par_portion.calories_kcal;
  return html`<${Bandeau} type="info" titre="Portions conseillées pour chacun">
    <ul>${personnes.map((x) => { const p = portionConseillee(kcal, x.cible * 0.35); return html`<li key=${x.id}><${Pastille} qui=${x.id} label=${x.label} /> <strong>${x.label}</strong> : ${String(p).replace('.', ',')} portion${p > 1 ? 's' : ''} <span class="sous">(≈ ${Math.round(kcal * p)} kcal)</span></li>`; })}</ul>
    <p class="note">Repère d'après les besoins de chacun (un repas ≈ 35 % de la journée). Pour un enfant, c'est un ordre de grandeur.</p><//>`;
}

/** Variantes : pour chaque personne du foyer, les ingrédients à remplacer pour que la recette lui convienne. */
function Variantes({ r, personnes, appliquees, onAppliquer, premier }) {
  const lignes = (personnes || []).map((p) => ({ p, subs: substitutionsPour(r, contraintesDeProfil(p.profil)) })).filter((x) => x.subs.length);
  if (!lignes.length) return null;
  return html`<${Bandeau} type="info" titre="Variantes pour chacun">
    ${lignes.map((x) => html`<div key=${x.p.id}><p><${Pastille} qui=${x.p.id} label=${x.p.label} /> <strong>${x.p.label}</strong> :</p>
      <ul>${x.subs.map((s) => html`<li key=${s.index}>${s.ancien} → <strong>${s.nouveau}</strong>${s.note ? html` <span class="sous">(${s.note})</span>` : ''}</li>`)}</ul></div>`)}
    ${premier && lignes.some((x) => x.p.id === premier) && html`<label class="case"><input type="checkbox" checked=${appliquees} onChange=${(e) => onAppliquer(e.target.checked)} /><span>Afficher la recette adaptée pour ${lignes.find((x) => x.p.id === premier).p.label}</span></label>`}
    <p class="note">Substitutions indicatives. La nutrition adaptée est une estimation, recalculée d'après les ingrédients remplacés.</p><//>`;
}

/** Choix de la méthode : version d'origine, Thermomix (si disponible) ou réécriture par l'IA (proposition à vérifier). */
function Methodes({ r, methode, setMethode, modele, setModele, reecriture, erreur, enCours, onReecrire }) {
  const origine = methodeOriginale(r);
  const reel = methode === origine || (methode === 'thermomix' && recetteThermomix(r));
  return html`<div>
    <h2 class="petit-titre">Méthode de cuisson</h2>
    <div class="puces libres">${Object.entries(METHODES).map(([k, n]) => html`<${Puce} key=${k} actif=${methode === k} onClick=${() => setMethode(k)}>${n}${k === origine ? ' ✓' : ''}<//>`)}</div>
    ${methode === 'thermomix' && html`<div class="puces libres">${Object.keys(MODELES).map((m) => html`<${Puce} key=${m} actif=${modele === m} onClick=${() => setModele(m)}>${m}<//>`)}</div>`}
    ${!reel && html`<${Bandeau} type="avertissement" titre="Version proposée par l'IA">
      <p>Les étapes d'origine sont écrites pour : <strong>${METHODES[origine] || origine}</strong>. ${reecriture ? 'Voici une réécriture proposée par l\'IA : vérifiez les durées et les températures avant de cuisiner.' : `Pour ${METHODES[methode].toLowerCase()}, l'IA peut réécrire les étapes (clé Gemini ou Groq nécessaire dans Profil › Coach IA ; avec les deux, la réponse est plus rapide).`}</p>
      ${erreur && html`<p class="erreur-champ" role="alert">${erreur}</p>`}
      ${!reecriture && html`<button type="button" class="bouton secondaire" disabled=${enCours} onClick=${onReecrire}>${enCours ? 'Réécriture…' : `✨ Réécrire pour ${METHODES[methode].toLowerCase()}`}</button>`}
      ${reecriture && html`<button type="button" class="lien" onClick=${() => onReecrire(true)}>Refaire la réécriture</button>`}<//>`}
  </div>`;
}

export function FicheRecette({ stock = [], opsStock = null, foyer = 2, nomsFoyer = '', r, portions, setPortions, favori, onFavori, moi, profil, onMange, portionsChacun, personnesVariantes }) {
  const origine = methodeOriginale(r);
  const appareils = chargerAppareils();
  const [methode, setMethode] = useState(origine);
  const [modele, setModele] = useState(appareils.modele || 'TM6');
  const [reecriture, setReecriture] = useState(null);
  const [erreurIA, setErreurIA] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [adaptee, setAdaptee] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [erreurPhoto, setErreurPhoto] = useState('');
  useEffect(() => { let actif = true; setPhoto(null); setErreurPhoto(''); photoDeRecette(r).then((p) => actif && setPhoto(p)).catch((e) => actif && setErreurPhoto(e.message)); return () => { actif = false; }; }, [r.id]);
  const premier = personnesVariantes && personnesVariantes.length ? personnesVariantes[0].id : null;
  const subsMoi = useMemo(() => (adaptee && premier ? substitutionsPour(r, contraintesDeProfil(personnesVariantes[0].profil)) : []), [adaptee, r, premier]);
  const ingredientsAffiches = useMemo(() => (adaptee ? appliquerSubstitutions(r.ingredients, subsMoi) : r.ingredients), [adaptee, subsMoi, r]);
  const nutAdaptee = useMemo(() => (adaptee ? nutritionAdaptee(r, subsMoi) : null), [adaptee, subsMoi, r]);
  const reel = methode === origine || (methode === 'thermomix' && recetteThermomix(r));
  useEffect(() => { setReecriture(!reel ? chargerReecriture(r.id, methode, modele) : null); setErreurIA(''); }, [r.id, methode, modele]);
  const reecrireIA = async (refaire) => {
    setEnCours(true); setErreurIA('');
    try { if (refaire === true) oublierReecriture(r.id, methode, modele); setReecriture(await reecrire(r, methode, modele)); }
    catch (e) { setErreurIA(e.message); }
    setEnCours(false);
  };
  const etapesAffichees = methode === 'thermomix' && recetteThermomix(r) ? etapesThermomix(r, modele)
    : reecriture ? reecriture.etapes.map((e) => ({ ...e, pastilles: [], avertissements: [] })) : r.etapes.map((e) => ({ ...e, pastilles: [], avertissements: [] }));
  const bol = methode === 'thermomix' ? capaciteBol(r, portions, modele) : null;
  const pesee = methode === 'thermomix' && recetteThermomix(r) ? ordrePesee(ingredientsAffiches, portions / r.portions_base) : null;
  const facteur = portions / r.portions_base;
  const t = r.temps;
  const nutri = nutAdaptee ? { ...r.nutrition_par_portion, calories_kcal: nutAdaptee.kcal, proteines_g: nutAdaptee.p, glucides_g: nutAdaptee.g, lipides_g: nutAdaptee.l } : r.nutrition_par_portion;
  const sante = noterRecette({ nutrition_par_portion: nutri });
  const c = r.conservation;
  const maxPortions = Math.max(PORTIONS_MAX, r.portions_base);
  const conseils = conseilsAdaptation(r, portions);
  return html`<article class="fiche">
    ${photo ? html`<figure class="fiche-photo"><img src=${photo.url} alt=${`Photo : ${r.titre}`} loading="lazy" />
        <figcaption>Photo : <a href=${photo.lien} target="_blank" rel="noopener">${photo.credit}</a> · <a href=${photo.fournisseur === 'Unsplash' ? 'https://unsplash.com/?utm_source=nutricoach&utm_medium=referral' : 'https://www.pexels.com'} target="_blank" rel="noopener">${photo.fournisseur}</a></figcaption></figure>`
      : html`<div class="fiche-hero"><${Pictogramme} recette=${r} grand=${true} /></div>`}
    ${erreurPhoto && html`<p class="note centre-texte">${erreurPhoto}</p>`}
    <div class="fiche-corps">
      <div class="fiche-titre"><h1>${r.titre}</h1><${Coeur} actif=${favori} onClick=${onFavori} /></div>
      ${r.perso && html`<p class="sous">📝 Recette de la famille · <a href=${'#/recette-modifier/' + r.id}>Modifier</a></p>`}
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
      <${PortionsChacun} r=${r} personnes=${portionsChacun} />
      <${Variantes} r=${r} personnes=${personnesVariantes} appliquees=${adaptee} onAppliquer=${setAdaptee} premier=${premier} />
      <a class="bouton cuisiner" href=${`#/cuisine/${r.id}?p=${portions}&m=${methode}&t=${modele}`}>👩‍🍳 Cuisiner pas à pas</a>
      ${onMange && html`<button type="button" class="bouton secondaire large" onClick=${() => onMange(1)}>📓 Je l'ai mangé (1 portion au journal)</button>`}
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
        ${portions !== foyer && html`<button type="button" class="lien" onClick=${() => setPortions(foyer)}>Revenir à ${foyer} (notre foyer)</button>`}
        ${portions !== r.portions_base && r.portions_base !== foyer && html`<button type="button" class="lien" onClick=${() => setPortions(r.portions_base)}>Revenir à ${r.portions_base} (recette d'origine)</button>`}
      </div>
      <p class="note">Par défaut : ${foyer} personne${foyer > 1 ? 's' : ''}${nomsFoyer ? ` (${nomsFoyer})` : ''}, d'après votre foyer. Ajustez au moment de la préparation.</p>
      ${conseils.length > 0 && html`<${Bandeau} type="info" titre="Pour ${portions} personne${portions > 1 ? 's' : ''}">
        <ul>${conseils.map((x) => html`<li>${x}</li>`)}</ul><//>`}
      ${bol && html`<${Bandeau} type=${bol.depasse ? 'avertissement' : 'info'} titre="Capacité du bol"><p>Volume estimé : ${bol.volume_ml} ml pour ${bol.max_ml} ml au maximum (${Math.round(bol.rempli * 100)} %).${bol.conseil ? ' ' + bol.conseil : ''}${bol.conseilPetrin ? ' ' + bol.conseilPetrin : ''}</p><//>`}
      <${Ingredients} liste=${ingredientsAffiches} facteur=${facteur} />
      ${pesee && html`<details class="repli"><summary>⚖ Pesée guidée (ordre optimisé)</summary><ol class="pesee">${pesee.map((x) => html`<li key=${x.ordre}><strong>${x.aliment}</strong> : ${String(Math.round(x.quantite * 10) / 10).replace('.', ',')} ${x.unite}<span class="sous"> · ${{ sec: 'sec', solide: 'solide', liquide: 'liquide', a_part: 'à ajouter à part' }[x.groupe]}</span></li>`)}</ol><p class="note">Placez le bol sur la balance, tarez après chaque ajout.</p></details>`}
      <${Methodes} r=${r} methode=${methode} setMethode=${setMethode} modele=${modele} setModele=${setModele} reecriture=${reecriture} erreur=${erreurIA} enCours=${enCours} onReecrire=${reecrireIA} />
      ${r.ustensiles.length > 0 && html`<p class="note">Ustensiles : ${r.ustensiles.join(', ')}</p>`}

      <h2 class="petit-titre">Étapes</h2>
      ${reecriture && reecriture.remarques && reecriture.remarques.length > 0 && html`<ul class="simple">${reecriture.remarques.map((x) => html`<li key=${x}>${x}</li>`)}</ul>`}
      <ol class="etapes">
        ${etapesAffichees.map((e, i) => html`<li key=${i}><span>${e.texte}</span>
          ${e.pastilles && e.pastilles.length > 0 ? html`<div class="reglages thermo">${e.pastilles.map((p) => html`<span key=${p.cle}>${p.icone} ${p.texte}</span>`)}</div>`
            : e.reglages && Object.keys(e.reglages).length > 0 && html`<div class="reglages">${Object.entries(e.reglages).map(([k, v]) => html`<span key=${k}>${lib(REGLAGES, k)} : ${v}</span>`)}</div>`}
          ${e.avertissements && e.avertissements.map((a) => html`<p class="note" key=${a}>⚠ ${a}</p>`)}
        </li>`)}
      </ol>
      ${opsStock && html`<h2 class="petit-titre">Après la cuisine</h2><${RetraitStock} recette=${r} portions=${portions} stock=${stock} ops=${opsStock} />`}

      ${r.astuces.length > 0 && html`<h2 class="petit-titre">Astuces</h2>
        <ul class="simple">${r.astuces.map((a) => html`<li>${a}</li>`)}</ul>`}
      ${c && html`<h2 class="petit-titre">Conservation</h2>
        <ul class="simple">
          <li>Au frigo : ${c.frigo_jours} jour${c.frigo_jours > 1 ? 's' : ''}</li>
          <li>Au congélateur : ${c.congelation_mois} mois</li>
          ${c.reechauffage && html`<li>${c.reechauffage}</li>`}
        </ul>`}

      ${sante && html`<div class=${'score-sante ' + sante.couleur}>
        <p class="score-sante-tete"><strong>Score santé : ${sante.note}/100</strong> · ${LIBELLE_COULEUR[sante.couleur]}</p>
        <ul class="score-sante-details">${sante.details.map((d) => html`<li key=${d.rubrique}><span>${d.rubrique}</span><span class="sous">${d.texte}</span><strong>${d.points}/${d.max}</strong></li>`)}</ul>
        <p class="note">${MENTION_SCORE_SANTE}</p></div>`}
      ${nutri.calories_kcal > 0 ? html`<div><h2 class="petit-titre">Nutrition par portion <small>(valeurs estimées)</small></h2>
      <table class="nutrition"><tbody>
        ${NUTRITION.map(([k, nom, u]) => nutri[k] != null && html`<tr key=${k}>
          <th scope="row">${nom}</th><td>${String(nutri[k]).replace('.', ',')} ${u}</td></tr>`)}
      </tbody></table></div>` : html`<p class="note">Nutrition non renseignée pour cette recette.</p>`}
      <p class="note">${nutAdaptee ? `Estimation recalculée d'après ${nutAdaptee.nb} ingrédient${nutAdaptee.nb > 1 ? 's' : ''} remplacé${nutAdaptee.nb > 1 ? 's' : ''}.` : 'Estimations pour une portion de la recette de base ; elles ne changent pas avec le nombre de personnes.'}</p>
    </div></article>`;
}

/** Charge la fiche complète puis l'affiche. */
export function Fiche({ id, index, favori, onFavori, moi, profil, onMange, portionsChacun, personnesVariantes, foyer = 2, nomsFoyer = '', stock = [], opsStock = null }) {
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
        setR(x); setPortions(Math.min(Math.max(PORTIONS_MAX, x.portions_base), Math.max(1, foyer)));
        document.title = `${x.titre} – NutriCoach`;
      })
      .catch(() => actif && setErreur(true));
    return () => { actif = false; document.title = 'NutriCoach'; };
  }, [id, index, essai]);

  const barre = html`<div class="fiche-barre"><a class="retour" href="#/recettes">← Recettes</a></div>`;
  if (!r) {
    return html`<div class="fiche">${barre}<div class="fiche-corps">
      ${entree && html`<h1>${entree.titre}</h1>`}
      ${erreur
        ? html`<div class="etat"><p>Impossible de charger cette recette. Elle sera disponible hors ligne après une première ouverture avec du réseau.</p>
            <button type="button" class="bouton" onClick=${() => setEssai((n) => n + 1)}>Réessayer</button></div>`
        : html`<p class="etat">Chargement de la recette…</p>`}
    </div></div>`;
  }
  const choisir = (f) => setPortions((p) => (typeof f === 'function' ? f(p) : f));       // l'ajustement ne vaut que pour cette préparation
  return html`<div>${barre}<${FicheRecette} stock=${stock} opsStock=${opsStock} foyer=${foyer} nomsFoyer=${nomsFoyer} r=${r} portions=${portions} setPortions=${choisir}
    favori=${favori} onFavori=${onFavori} moi=${moi} profil=${profil} onMange=${onMange} portionsChacun=${portionsChacun} personnesVariantes=${personnesVariantes} /></div>`;
}
