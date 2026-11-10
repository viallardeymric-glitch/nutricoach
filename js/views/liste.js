// Écran « Recettes » et « Favoris » : recherche, filtres cumulables et liste.
import { html, useMemo } from '../../vendor/preact-htm.js';
import { TAILLE_PAGE } from '../core/config.js';
import { CATEGORIES, REGIMES, ALLERGENES, SAISONS, APPAREILS, DIFFICULTES, TEMPS_MAX, PROFILS, lib, libSousCategorie } from '../data/libelles.js';
import { filtrerRecettes, nombreFiltres, basculer, FILTRES_VIDES } from '../lib/recettes.js';
import { REGIMES_AVANCES, nomRegime } from '../data/regimes.js';
import { filtresDuProfil, profilsARisque } from '../lib/profils.js';
import { PERSONNES } from '../core/config.js';
import { Puce, Vignette, Coeur, Bandeau, Pastille } from '../ui/composants.js';

function Groupe({ titre, children }) {
  return html`<div class="groupe"><h3 class="petit-titre">${titre}</h3><div class="puces">${children}</div></div>`;
}

function Filtres({ f, setF, regimesDispo, effacer }) {
  const maj = (cle) => (valeur) => () => setF((s) => ({ ...s, nb: TAILLE_PAGE, [cle]: basculer(s[cle], valeur) }));
  const liste = (cle, table, cles, exclu) => cles.map((k) => html`<${Puce} key=${k} exclu=${exclu}
    actif=${f[cle].includes(k)} onClick=${maj(cle)(k)}>${lib(table, k)}<//>`);
  return html`<section class="filtres" aria-label="Filtres">
    <${Groupe} titre="Catégorie">${liste('categories', {}, CATEGORIES)}<//>
    <${Groupe} titre="Régime (tous ceux choisis)">${liste('regimes', REGIMES, regimesDispo)}<//>
    <${Groupe} titre="Autres régimes (sélection indicative)">${f.regimes.length >= 0 && Object.entries(REGIMES_AVANCES).filter(([, r]) => r.famille !== 'medical' && !r.fenetre && !r.points).map(([k, r]) => html`<${Puce} key=${k}
      actif=${f.regimes.includes(k)} onClick=${maj('regimes')(k)}>${r.nom}<//>`)}<//>
    <${Groupe} titre="Médicaux (avis médical)">${Object.entries(REGIMES_AVANCES).filter(([, r]) => r.famille === 'medical').map(([k, r]) => html`<${Puce} key=${k}
      actif=${f.regimes.includes(k)} onClick=${maj('regimes')(k)}>${r.nom}<//>`)}<//>
    <${Groupe} titre="Allergènes à exclure">${liste('allergenes', ALLERGENES, Object.keys(ALLERGENES), true)}<//>
    <${Groupe} titre="Temps maximum">
      ${TEMPS_MAX.map((t) => html`<${Puce} key=${t} actif=${f.tempsMax === t}
        onClick=${() => setF((s) => ({ ...s, nb: TAILLE_PAGE, tempsMax: s.tempsMax === t ? null : t }))}>${t} min<//>`)}
    <//>
    <${Groupe} titre="Difficulté">${liste('difficultes', DIFFICULTES, Object.keys(DIFFICULTES))}<//>
    <${Groupe} titre="Saison">${liste('saisons', SAISONS, Object.keys(SAISONS).filter((s) => s !== 'toute_annee'))}<//>
    <${Groupe} titre="Appareil">${liste('appareils', APPAREILS, Object.keys(APPAREILS))}<//>
    <button type="button" class="lien" onClick=${effacer}>Tout effacer</button>
  </section>`;
}

function Carte({ r, favori, onFavori, onOuvrir, risques, par }) {
  return html`<li class="carte">
    <a class="carte-lien" href=${'#/recette/' + r.id} onClick=${onOuvrir}>
      <${Vignette} r=${r} />
      <span class="carte-texte">
        <strong>${r.titre}</strong>
        <span class="sous">${r.categorie} · ${libSousCategorie(r.sous_categorie)}</span>
        <span class="sous">⏱ ${r.temps} min · ${lib(DIFFICULTES, r.difficulte)}</span>
        ${risques.length > 0 && html`<span class="alerte-carte">⚠ Déconseillé : ${risques.map((x) => lib(PROFILS, x).toLowerCase()).join(', ')}</span>`}
      </span>
    </a>
    ${par.length > 0 && html`<span class="par">${par.map((q) => html`<${Pastille} key=${q} qui=${q} />`)}</span>`}
    <${Coeur} actif=${favori} onClick=${onFavori} />
  </li>`;
}

/** Résumé court de ce que le profil impose : « : sans lait, sans coriandre, végan ». */
function resume(profil, fp) {
  const morceaux = [...fp.allergenes.map((a) => 'sans ' + lib(ALLERGENES, a).toLowerCase()),
    ...fp.regimes.map((g) => nomRegime(g).toLowerCase()),
    ...String(profil.exclusions || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => 'sans ' + x)];
  const risques = profilsARisque(profil);
  if (risques.length) morceaux.push('alertes : ' + risques.map((x) => lib(PROFILS, x).toLowerCase()).join(', '));
  return morceaux.length ? ' (' + morceaux.join(', ') + ')' : '';
}

export function Liste({ index, erreur, f, setF, favoris, onFavori, favorisSeulement, onOuvrir, moi, profil, onAppliquerProfil, favorisTous, favorisPar }) {
  const regimesDispo = useMemo(() => {
    if (!index) return [];
    const presents = new Set(index.recettes.flatMap((r) => r.regimes));
    return Object.keys(REGIMES).filter((k) => presents.has(k));
  }, [index]);

  // Le profil impose ses régimes, allergènes et aliments à éviter, en plus des filtres choisis ici.
  const fp = useMemo(() => filtresDuProfil(profil), [profil]);
  const risquesProfil = useMemo(() => (profil && profil.appliquer !== false ? profilsARisque(profil) : []), [profil]);
  const resultats = useMemo(() => (index ? filtrerRecettes(index.recettes, {
    ...f, favoris: favorisSeulement,
    regimes: [...new Set([...f.regimes, ...fp.regimes])],
    allergenes: [...new Set([...f.allergenes, ...fp.allergenes])],
    exclusions: fp.exclusions,
  }, favorisTous) : []), [index, f, favorisSeulement, favorisTous, fp]);
  const nbFiltres = nombreFiltres({ ...f, favoris: false });
  const effacer = () => setF((s) => ({ ...FILTRES_VIDES, ouvert: s.ouvert, nb: TAILLE_PAGE }));

  return html`
    <header class="entete">
      <div class="entete-ligne"><h1>${favorisSeulement ? 'Mes favoris' : 'Recettes'}</h1>
        <span class="entete-liens"><a class="entete-lien" href="#/recette-nouvelle" aria-label="Ajouter une recette">＋ Recette</a>
          <a class="entete-lien" href=${favorisSeulement ? '#/recettes' : '#/favoris'}>${favorisSeulement ? 'Toutes' : '♥ Favoris'}</a></span></div>
      <div class="recherche">
        <input type="search" placeholder="Titre, ingrédient, mot-clé…" value=${f.q}
          aria-label="Rechercher une recette" autocomplete="off" enterkeyhint="search"
          onInput=${(e) => { const v = e.target.value; setF((s) => ({ ...s, q: v, nb: TAILLE_PAGE })); }} />
        <button type="button" class="btn-filtres" aria-expanded=${f.ouvert}
          onClick=${() => setF((s) => ({ ...s, ouvert: !s.ouvert }))}>
          Filtres${nbFiltres ? html`<b>${nbFiltres}</b>` : ''}
        </button>
      </div>
    </header>
    ${f.ouvert && index && html`<${Filtres} f=${f} setF=${setF} regimesDispo=${regimesDispo} effacer=${effacer} />`}
    ${moi && profil && html`<${Bandeau} type="info">
      <div class="profil-applique">
        <span><${Pastille} qui=${moi} /> ${profil.appliquer === false
          ? html`Profil de ${PERSONNES[moi].prenom} <strong>non appliqué</strong> : toutes les recettes sont affichées.`
          : html`Profil de ${PERSONNES[moi].prenom} appliqué${resume(profil, fp)}.`}</span>
        <button type="button" class="lien" onClick=${onAppliquerProfil}>${profil.appliquer === false ? 'Appliquer' : 'Ne pas appliquer'}</button>
      </div><//>`}
    ${f.allergenes.length > 0 && html`<${Bandeau} type="info" titre="Allergènes exclus">
      <p>${f.allergenes.map((a) => lib(ALLERGENES, a)).join(', ')} : les recettes qui en contiennent sont masquées.
      Vérifiez toujours l'étiquette des produits que vous achetez.</p><//>`}
    ${erreur ? html`<div class="etat"><p>Impossible de charger le catalogue.</p>
        <button type="button" class="bouton" onClick=${() => location.reload()}>Réessayer</button></div>`
      : !index ? html`<p class="etat">Chargement des recettes…</p>`
      : html`
        <p class="nb-resultats" aria-live="polite">${resultats.length} recette${resultats.length > 1 ? 's' : ''}
          ${(nbFiltres > 0 || f.q) && html` · <button type="button" class="lien" onClick=${effacer}>Effacer les filtres</button>`}</p>
        ${resultats.length === 0 && html`<div class="etat">
          <p>${favorisSeulement && !nbFiltres && !f.q
            ? 'Aucun favori pour l\'instant. Touchez ♡ sur une recette pour la retrouver ici.'
            : 'Aucune recette ne correspond. Essayez de retirer un filtre.'}</p></div>`}
        <ul class="liste">
          ${resultats.slice(0, f.nb).map((r) => html`<${Carte} key=${r.id} r=${r}
            favori=${favoris.has(r.id)} onFavori=${() => onFavori(r.id)} onOuvrir=${onOuvrir}
            risques=${r.risques.filter((x) => risquesProfil.includes(x))} par=${favorisPar.get(r.id) || []} />`)}
        </ul>
        ${resultats.length > f.nb && html`<button type="button" class="bouton secondaire centre"
          onClick=${() => setF((s) => ({ ...s, nb: s.nb + TAILLE_PAGE }))}>Afficher plus</button>`}`}`;
}
