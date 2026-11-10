// Mes recettes : ajouter une recette à la main, importer un fichier, exporter le modèle ou ses recettes, modifier, supprimer.
import { html, useState } from '../../vendor/preact-htm.js';
import { CATEGORIES, REGIMES, ALLERGENES, DIFFICULTES, COUTS, APPAREILS, SAISONS } from '../data/libelles.js';
import { normaliserRecette, lireFichierRecettes, modeleFichier, exporterRecettes, prochainId, ingredientVersTexte } from '../lib/recette-perso.js';
import { Entete, Section, Bandeau, Puce } from '../ui/composants.js';

function telecharger(nom, objet) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(objet, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  a.click(); URL.revokeObjectURL(url);
}
const basculer = (liste, v) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

export function MesRecettes({ recettes, ops }) {
  const [msg, setMsg] = useState(null);
  const [apercu, setApercu] = useState(null);     // { recettes, erreurs, nom }
  const lireFichier = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = lireFichierRecettes(await f.text(), recettes.map((x) => x.titre));
    setMsg(null); setApercu({ ...r, nom: f.name });
  };
  const importer = () => {
    const ids = recettes.map((r) => r.id);
    for (const { recette } of apercu.recettes) { const id = prochainId(ids); ids.push(id); ops.ecrire({ ...recette, id, perso: true }); }
    setMsg({ type: 'info', texte: `${apercu.recettes.length} recette${apercu.recettes.length > 1 ? 's' : ''} importée${apercu.recettes.length > 1 ? 's' : ''}.` });
    setApercu(null);
  };
  return html`<div class="page-mes-recettes">
    <${Entete} titre="Mes recettes" sous="Ajoutez vos propres recettes" retour=${{ href: '#/plus', nom: 'Plus' }} />
    <div class="contenu">
      ${msg && html`<${Bandeau} type=${msg.type}><p>${msg.texte}</p><//>`}
      <a class="bouton grand" href="#/recette-nouvelle">＋ Ajouter une recette</a>
      <${Section} titre="Importer un fichier">
        <p class="note">Téléchargez le modèle, remplissez-le (un éditeur de texte suffit, ou demandez au coach de le remplir pour vous), puis importez-le. Plusieurs recettes d'un coup sont possibles.</p>
        <button type="button" class="bouton secondaire large" onClick=${() => telecharger('modele-recettes-nutricoach.json', modeleFichier())}>⬇️ Télécharger le modèle de fichier</button>
        <label class="bouton secondaire large fichier">📂 Importer un fichier de recettes<input type="file" accept=".json,application/json" aria-label="Importer un fichier de recettes" onChange=${lireFichier} /></label>
        ${apercu && html`<div class="apercu-import">
          ${apercu.recettes.length > 0 && html`<${Bandeau} type="info" titre=${`${apercu.recettes.length} recette${apercu.recettes.length > 1 ? 's' : ''} prête${apercu.recettes.length > 1 ? 's' : ''} à importer`}>
            <ul class="simple">${apercu.recettes.map(({ recette, avertissements }, i) => html`<li key=${i}><strong>${recette.titre}</strong>${avertissements.map((a) => html`<span class="sous" key=${a}> · ${a}</span>`)}</li>`)}</ul><//>`}
          ${apercu.erreurs.length > 0 && html`<${Bandeau} type="alerte" titre="À corriger"><ul class="simple">${apercu.erreurs.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul><//>`}
          ${apercu.recettes.length > 0 && html`<button type="button" class="bouton grand" onClick=${importer}>Importer ${apercu.recettes.length} recette${apercu.recettes.length > 1 ? 's' : ''}</button>`}
          <button type="button" class="lien" onClick=${() => setApercu(null)}>Annuler</button></div>`}
      <//>
      <${Section} titre=${`Mes recettes (${recettes.length})`}>
        ${recettes.length === 0 ? html`<p class="note">Aucune recette pour l'instant. Elles sont partagées entre vos deux téléphones.</p>` : html`<ul class="articles">${recettes.map((r) => html`<li class="article" key=${r.id}>
          <span class="article-texte plein"><a href=${'#/recette/' + r.id}><strong>${r.titre}</strong></a><span class="sous">${r.categorie} · ⏱ ${r.temps.total_min} min · ${r.portions_base} portions</span></span>
          <a class="mini-action" href=${'#/recette-modifier/' + r.id} aria-label=${`Modifier ${r.titre}`}>✏️</a>
          <button type="button" class="supprimer" aria-label=${`Supprimer ${r.titre}`} onClick=${() => { if (window.confirm(`Supprimer « ${r.titre} » pour vous deux ?`)) ops.supprimer(r.id); }}>✕</button></li>`)}</ul>
          <button type="button" class="bouton secondaire large" onClick=${() => telecharger('mes-recettes-nutricoach.json', exporterRecettes(recettes))}>⬆️ Exporter mes recettes (fichier)</button>`}
      <//>
    </div></div>`;
}

const FORM_VIDE = { titre: '', categorie: 'Plats', description: '', portions_base: '4', preparation_min: '15', cuisson_min: '0', repos_min: '0', difficulte: 'facile', cout: 'moyen',
  appareil_principal: 'classique', ingredients: '', etapes: '', astuces: '', regimes: [], allergenes: [], saisons: [], kcal: '', proteines: '', glucides: '', lipides: '', fibres: '', sucres: '', sel: '', tags: '' };

function formDepuisRecette(r) {
  const n = r.nutrition_par_portion || {};
  const v = (x) => (x ? String(x).replace('.', ',') : '');
  return { ...FORM_VIDE, titre: r.titre, categorie: r.categorie, description: r.description, portions_base: String(r.portions_base), preparation_min: String(r.temps.preparation_min), cuisson_min: String(r.temps.cuisson_min), repos_min: String(r.temps.repos_min),
    difficulte: r.difficulte, cout: r.cout, appareil_principal: r.appareil_principal, ingredients: r.ingredients.map(ingredientVersTexte).join('\n'), etapes: r.etapes.map((e) => e.texte).join('\n'), astuces: (r.astuces || []).join('\n'),
    regimes: r.regimes_compatibles.filter((x) => x !== 'omnivore'), allergenes: r.allergenes, saisons: r.saisons.filter((s) => s !== 'toute_annee'),
    kcal: v(n.calories_kcal), proteines: v(n.proteines_g), glucides: v(n.glucides_g), lipides: v(n.lipides_g), fibres: v(n.fibres_g), sucres: v(n.sucres_g), sel: v(n.sel_g), tags: (r.tags || []).filter((t) => t !== 'perso').join(', ') };
}

export function FormulaireRecette({ id, recettes, ops }) {
  const existante = id ? recettes.find((r) => r.id === id) : null;
  const [f, setF] = useState(() => (existante ? formDepuisRecette(existante) : FORM_VIDE));
  const [erreurs, setErreurs] = useState([]);
  const maj = (c) => setF({ ...f, ...c });
  const champ = (k, titre, props = {}) => html`<label class="champ"><span>${titre}</span><input type="text" value=${f[k]} onInput=${(e) => maj({ [k]: e.target.value })} ...${props} /></label>`;
  const enregistrer = (e) => {
    e.preventDefault();
    const r = normaliserRecette({ ...f, temps: { preparation_min: f.preparation_min, cuisson_min: f.cuisson_min, repos_min: f.repos_min }, regimes_compatibles: f.regimes,
      nutrition_par_portion: { calories_kcal: f.kcal, proteines_g: f.proteines, glucides_g: f.glucides, lipides_g: f.lipides, fibres_g: f.fibres, sucres_g: f.sucres, sel_g: f.sel } });
    if (!r.recette) { setErreurs(r.erreurs); window.scrollTo(0, 0); return; }
    const doublon = recettes.find((x) => x.id !== id && x.titre.toLowerCase() === r.recette.titre.toLowerCase());
    if (doublon) { setErreurs([`Une de vos recettes s'appelle déjà « ${doublon.titre} ».`]); window.scrollTo(0, 0); return; }
    const nouvelId = existante ? existante.id : prochainId(recettes.map((x) => x.id));
    ops.ecrire({ ...r.recette, id: nouvelId, perso: true });
    location.hash = '#/recette/' + nouvelId;
  };
  return html`<div class="page-form-recette">
    <${Entete} titre=${existante ? 'Modifier la recette' : 'Nouvelle recette'} retour=${{ href: '#/mes-recettes', nom: 'Mes recettes' }} />
    <form class="contenu" onSubmit=${enregistrer}>
      ${erreurs.length > 0 && html`<${Bandeau} type="alerte" titre="À corriger"><ul class="simple">${erreurs.map((x) => html`<li key=${x}>${x}</li>`)}</ul><//>`}
      <label class="champ"><span>Titre *</span><input type="text" value=${f.titre} maxlength="120" onInput=${(e) => maj({ titre: e.target.value })} /></label>
      <h2 class="petit-titre">Catégorie</h2>
      <div class="puces libres">${CATEGORIES.map((c) => html`<${Puce} key=${c} actif=${f.categorie === c} onClick=${() => maj({ categorie: c })}>${c}<//>`)}</div>
      <label class="champ"><span>Description (facultatif)</span><input type="text" value=${f.description} onInput=${(e) => maj({ description: e.target.value })} /></label>
      <div class="grille deux">${champ('portions_base', 'Portions', { inputmode: 'numeric' })}${champ('preparation_min', 'Préparation (min)', { inputmode: 'numeric' })}${champ('cuisson_min', 'Cuisson (min)', { inputmode: 'numeric' })}${champ('repos_min', 'Repos (min)', { inputmode: 'numeric' })}</div>
      <h2 class="petit-titre">Ingrédients *</h2>
      <label class="champ"><span>Un par ligne, par exemple « 200 g de farine » ou « 2 gousses d'ail, hachées »</span>
        <textarea rows="7" value=${f.ingredients} onInput=${(e) => maj({ ingredients: e.target.value })} aria-label="Ingrédients"></textarea></label>
      <h2 class="petit-titre">Étapes *</h2>
      <label class="champ"><span>Une par ligne</span><textarea rows="7" value=${f.etapes} onInput=${(e) => maj({ etapes: e.target.value })} aria-label="Étapes"></textarea></label>
      <label class="champ"><span>Astuces (facultatif, une par ligne)</span><textarea rows="2" value=${f.astuces} onInput=${(e) => maj({ astuces: e.target.value })}></textarea></label>
      <h2 class="petit-titre">Difficulté et coût</h2>
      <div class="puces libres">${Object.entries(DIFFICULTES).map(([k, n]) => html`<${Puce} key=${k} actif=${f.difficulte === k} onClick=${() => maj({ difficulte: k })}>${n}<//>`)}${Object.entries(COUTS).map(([k, n]) => html`<${Puce} key=${'c' + k} actif=${f.cout === k} onClick=${() => maj({ cout: k })}>${n}<//>`)}</div>
      <h2 class="petit-titre">Appareil principal</h2>
      <div class="puces libres">${Object.entries(APPAREILS).map(([k, n]) => html`<${Puce} key=${k} actif=${f.appareil_principal === k} onClick=${() => maj({ appareil_principal: k })}>${n}<//>`)}</div>
      <h2 class="petit-titre">Régimes compatibles</h2>
      <div class="puces libres">${Object.entries(REGIMES).filter(([k]) => k !== 'omnivore').map(([k, n]) => html`<${Puce} key=${k} actif=${f.regimes.includes(k)} onClick=${() => maj({ regimes: basculer(f.regimes, k) })}>${n}<//>`)}</div>
      <h2 class="petit-titre">Allergènes contenus</h2>
      <div class="puces libres">${Object.entries(ALLERGENES).map(([k, n]) => html`<${Puce} key=${k} actif=${f.allergenes.includes(k)} onClick=${() => maj({ allergenes: basculer(f.allergenes, k) })}>${n}<//>`)}</div>
      <p class="note">Les allergènes sont aussi détectés automatiquement d'après les ingrédients (lait, gluten, œuf…), pour que vos filtres restent sûrs. Vérifiez-les quand même.</p>
      <h2 class="petit-titre">Saisons</h2>
      <div class="puces libres">${Object.entries(SAISONS).filter(([k]) => k !== 'toute_annee').map(([k, n]) => html`<${Puce} key=${k} actif=${f.saisons.includes(k)} onClick=${() => maj({ saisons: basculer(f.saisons, k) })}>${n}<//>`)}</div>
      <details class="repli"><summary>Nutrition par portion (facultatif)</summary>
        <div class="grille deux">${champ('kcal', 'Calories (kcal)', { inputmode: 'decimal' })}${champ('proteines', 'Protéines (g)', { inputmode: 'decimal' })}${champ('glucides', 'Glucides (g)', { inputmode: 'decimal' })}${champ('lipides', 'Lipides (g)', { inputmode: 'decimal' })}${champ('fibres', 'Fibres (g)', { inputmode: 'decimal' })}${champ('sucres', 'Sucres (g)', { inputmode: 'decimal' })}${champ('sel', 'Sel (g)', { inputmode: 'decimal' })}</div>
        <p class="note">Sans nutrition, les calories et le score santé ne sont pas affichés.</p></details>
      ${champ('tags', 'Mots-clés (séparés par des virgules)')}
      <button type="submit" class="bouton grand">${existante ? 'Enregistrer les modifications' : 'Enregistrer la recette'}</button>
    </form></div>`;
}
