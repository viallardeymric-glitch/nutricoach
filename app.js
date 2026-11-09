import { html, render, useState, useEffect, useMemo } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

/* ---------- Libellés ---------- */
const REGIMES = {
  omnivore: 'Omnivore', sans_gluten: 'Sans gluten', sans_lactose: 'Sans lactose',
  sans_porc: 'Sans porc', halal: 'Halal', pescetarien: 'Pescétarien',
  vegetarien: 'Végétarien', vegan: 'Végan', hypocalorique: 'Hypocalorique',
  riche_en_proteines: 'Riche en protéines', sportif: 'Sportif', diabetique: 'Diabétique',
  sans_sel_ajoute: 'Sans sel ajouté', enceinte: 'Enceinte',
};
const ALLERGENES = {
  gluten: 'Gluten', lait: 'Lait', oeuf: 'Œuf', poisson: 'Poisson', crustaces: 'Crustacés',
  mollusques: 'Mollusques', arachides: 'Arachides', fruits_a_coque: 'Fruits à coque',
  soja: 'Soja', celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame',
  sulfites: 'Sulfites', lupin: 'Lupin',
};
const PROFILS = {
  femme_enceinte: 'Femme enceinte', allaitante: 'Femme allaitante',
  enfant_moins_de_3_ans: 'Enfant de moins de 3 ans', enfant: 'Enfant',
  senior: 'Senior', diabetique: 'Personne diabétique', hypertendu: 'Personne hypertendue',
  immunodeprime: 'Personne immunodéprimée',
};
const NUTRITION = [
  ['calories_kcal', 'Calories', 'kcal'], ['proteines_g', 'Protéines', 'g'],
  ['glucides_g', 'Glucides', 'g'], ['sucres_g', 'dont sucres', 'g'],
  ['lipides_g', 'Lipides', 'g'], ['fibres_g', 'Fibres', 'g'], ['sel_g', 'Sel', 'g'],
];
const REGLAGES = {
  mode: 'Mode', temperature: 'Température', duree: 'Durée', feu: 'Feu',
  vitesse: 'Vitesse', sens: 'Sens', accessoire: 'Accessoire', pression: 'Pression',
  position_grille: 'Grille',
};
const lib = (table, cle) => table[cle] || cle.replace(/_/g, ' ');

/* ---------- Outils ---------- */
const PAGE = 40;
const norm = (s) =>
  s.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');

const FRACTIONS = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
function formaterQuantite(q) {
  if (q >= 20) return String(Math.round(q)).replace('.', ',');
  const entier = Math.floor(q);
  const reste = q - entier;
  if (reste < 0.03) return String(entier);
  if (reste > 0.97) return String(entier + 1);
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(reste - v) < 0.03) return entier ? `${entier} ${s}` : s;
  }
  return String(Math.round(q * 10) / 10).replace('.', ',');
}
const UNITES_AVEC_DE = new Set(['g', 'kg', 'ml', 'cl', 'l', 'c. à soupe', 'c. à café',
  'pincée', 'gousse', 'branche', 'tranche', 'feuille', 'sachet', 'noix']);
const UNITES_PLURIEL = new Set(['pincée', 'gousse', 'branche', 'tranche', 'feuille', 'sachet', 'noix']);

function ligneIngredient(ing, facteur) {
  const q = ing.quantite * facteur;
  const qte = formaterQuantite(q);
  const pluriel = q > 1.001;
  let unite = ing.unite;
  if (unite === 'pièce') unite = '';
  else if (pluriel && UNITES_PLURIEL.has(unite)) unite += 's';
  const liaison = ing.unite !== 'pièce' && UNITES_AVEC_DE.has(ing.unite)
    ? (/^[aeiouyhàâéèêëîïôöûüœ]/i.test(ing.aliment) ? "d'" : 'de ')
    : '';
  const texte = [qte, unite].filter(Boolean).join(' ') + ' ' + liaison + ing.aliment;
  return texte;
}

/* ---------- Chargement des données ---------- */
let promesseIndex = null;
function chargerIndex() {
  if (!promesseIndex) {
    promesseIndex = fetch('data/index.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((liste) => liste.map((r) => ({ ...r, _n: norm(r.titre) })))
      .catch((e) => { promesseIndex = null; throw e; });
  }
  return promesseIndex;
}
let promesseFiches = null;
function chargerFiche(id) {
  if (!promesseFiches) {
    promesseFiches = fetch('data/recettes.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((liste) => new Map(liste.map((x) => [x.id, x])))
      .catch((e) => { promesseFiches = null; throw e; });
  }
  return promesseFiches.then((m) => m.get(id) || null);
}

/* ---------- Routage par ancre (#/recette/REC-000001) ---------- */
function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const m = hash.match(/^#\/recette\/(REC-\d+)$/);
  return m ? m[1] : null;
}

/* ---------- Composants ---------- */
function Puce({ actif, onClick, exclu, children }) {
  return html`<button type="button" class=${'puce' + (exclu ? ' exclu' : '')}
    aria-pressed=${actif} onClick=${onClick}>${children}</button>`;
}

function Filtres({ regimesDispo, regimes, allergenes, basculer, effacer }) {
  return html`<section class="filtres" aria-label="Filtres">
    <h2>Régime (tous ceux choisis)</h2>
    <div class="puces">
      ${regimesDispo.map((k) => html`<${Puce} key=${k} actif=${regimes.includes(k)}
        onClick=${() => basculer('regimes', k)}>${lib(REGIMES, k)}<//>`)}
    </div>
    <h2>Allergènes à exclure</h2>
    <div class="puces">
      ${Object.keys(ALLERGENES).map((k) => html`<${Puce} key=${k} exclu=${true}
        actif=${allergenes.includes(k)} onClick=${() => basculer('allergenes', k)}>${ALLERGENES[k]}<//>`)}
    </div>
    <button type="button" class="lien" onClick=${effacer}>Tout effacer</button>
  </section>`;
}

function Liste({ index, erreur, f, setF, onOuvrir }) {
  const { q, regimes, allergenes, ouvert, nb } = f;
  const regimesDispo = useMemo(() => {
    if (!index) return [];
    const presents = new Set(index.flatMap((r) => r.regimes));
    return Object.keys(REGIMES).filter((k) => presents.has(k));
  }, [index]);

  const resultats = useMemo(() => {
    if (!index) return [];
    const mot = norm(q.trim());
    return index.filter((r) =>
      (!mot || r._n.includes(mot)) &&
      regimes.every((k) => r.regimes.includes(k)) &&
      !allergenes.some((a) => r.allergenes.includes(a)));
  }, [index, q, regimes, allergenes]);

  const basculer = (cle, valeur) => setF((s) => ({
    ...s, nb: PAGE,
    [cle]: s[cle].includes(valeur) ? s[cle].filter((v) => v !== valeur) : [...s[cle], valeur],
  }));
  const effacer = () => setF((s) => ({ ...s, q: '', regimes: [], allergenes: [], nb: PAGE }));
  const nbFiltres = regimes.length + allergenes.length;

  return html`
    <header class="entete">
      <h1>NutriCoach</h1>
      <div class="recherche">
        <input type="search" placeholder="Rechercher une recette" value=${q}
          aria-label="Rechercher par titre" autocomplete="off"
          onInput=${(e) => { const v = e.target.value; setF((s) => ({ ...s, q: v, nb: PAGE })); }} />
        <button type="button" class="btn-filtres" aria-expanded=${ouvert}
          onClick=${() => setF((s) => ({ ...s, ouvert: !s.ouvert }))}>
          Filtres${nbFiltres ? html`<b>${nbFiltres}</b>` : ''}
        </button>
      </div>
    </header>
    ${ouvert && html`<${Filtres} regimesDispo=${regimesDispo} regimes=${regimes}
      allergenes=${allergenes} basculer=${basculer} effacer=${effacer} />`}
    ${erreur ? html`<div class="erreur"><p>Impossible de charger le catalogue.</p>
        <button type="button" class="plus" onClick=${() => location.reload()}>Réessayer</button></div>`
      : !index ? html`<p class="chargement">Chargement des recettes…</p>`
      : html`
        <p class="nb-resultats" aria-live="polite">
          ${resultats.length} recette${resultats.length > 1 ? 's' : ''}</p>
        ${resultats.length === 0 && html`<p class="vide">Aucune recette ne correspond.</p>`}
        <ul class="liste">
          ${resultats.slice(0, nb).map((r) => html`<li key=${r.id}>
            <a class="carte" href=${'#/recette/' + r.id} onClick=${onOuvrir}>
              <h3>${r.titre}</h3>
              <div class="sous">${r.categorie} · ${r.sous_categorie} · ${r.temps} min</div>
            </a></li>`)}
        </ul>
        ${resultats.length > nb && html`<button type="button" class="plus"
          onClick=${() => setF((s) => ({ ...s, nb: s.nb + PAGE }))}>Afficher plus</button>`}`}`;
}

function Avertissements({ liste }) {
  if (!liste || !liste.length) return null;
  return html`<section class="avertissements" role="note" aria-label="Avertissements">
    <h2>⚠ Déconseillé à</h2>
    <ul>${liste.map((d) => html`<li><strong>${lib(PROFILS, d.profil)}</strong> : ${d.raison}</li>`)}</ul>
  </section>`;
}

function Ingredients({ liste, facteur }) {
  const sections = [];
  for (const ing of liste) {
    let s = sections.find((x) => x.nom === ing.section);
    if (!s) { s = { nom: ing.section, items: [] }; sections.push(s); }
    s.items.push(ing);
  }
  return sections.map((s) => html`<div key=${s.nom}>
    ${s.nom && html`<h3>${s.nom}</h3>`}
    <ul class="ingredients">
      ${s.items.map((ing, i) => html`<li key=${i}>${ligneIngredient(ing, facteur)}
        ${ing.precision && html` <span class="prec">(${ing.precision})</span>`}</li>`)}
    </ul></div>`);
}

function Fiche({ id, entree }) {
  const [r, setR] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [portions, setPortions] = useState(1);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let actif = true;
    setR(null); setErreur(false);
    chargerFiche(id)
      .then((x) => {
        if (!actif) return;
        if (!x) { setErreur(true); return; }
        setR(x); setPortions(x.portions_base);
        document.title = x.titre + ' – NutriCoach';
      })
      .catch(() => actif && setErreur(true));
    return () => { actif = false; document.title = 'NutriCoach'; };
  }, [id, essai]);

  const barre = html`<div class="fiche-barre"><a class="retour" href="#/">← Recettes</a></div>`;
  if (!r) {
    return html`<div class="fiche">${barre}<div class="fiche-corps">
      ${entree && html`<h1>${entree.titre}</h1>`}
      ${erreur
        ? html`<div class="erreur"><p>Impossible de charger cette recette.</p>
            <button type="button" class="plus" onClick=${() => setEssai((n) => n + 1)}>Réessayer</button></div>`
        : html`<p class="chargement">Chargement de la recette…</p>`}
    </div></div>`;
  }

  const facteur = portions / r.portions_base;
  const t = r.temps;
  const c = r.conservation;
  return html`<article class="fiche">${barre}<div class="fiche-corps">
    <h1>${r.titre}</h1>
    <div class="meta">
      <span>${r.categorie} · ${r.sous_categorie}</span>
      <span>⏱ ${t.total_min} min</span>
      <span>Préparation ${t.preparation_min} min</span>
      ${t.cuisson_min > 0 && html`<span>Cuisson ${t.cuisson_min} min</span>`}
      ${t.repos_min > 0 && html`<span>Repos ${t.repos_min} min</span>`}
      <span>Difficulté : ${r.difficulte}</span>
      <span>Coût : ${r.cout}</span>
    </div>
    <p class="desc">${r.description}</p>
    <${Avertissements} liste=${r.deconseille_a} />
    ${r.allergenes.length > 0 && html`<div class="etiquettes" aria-label="Allergènes">
      <strong>Contient :</strong>
      ${r.allergenes.map((a) => html`<span class="etiquette allergene">${lib(ALLERGENES, a)}</span>`)}</div>`}
    ${r.regimes_compatibles.length > 0 && html`<div class="etiquettes" aria-label="Régimes compatibles">
      ${r.regimes_compatibles.map((g) => html`<span class="etiquette">${lib(REGIMES, g)}</span>`)}</div>`}

    <h2>Ingrédients</h2>
    <div class="portions">
      <button type="button" aria-label="Une portion de moins" disabled=${portions <= 1}
        onClick=${() => setPortions((p) => Math.max(1, p - 1))}>−</button>
      <output aria-live="polite">${portions} portion${portions > 1 ? 's' : ''}</output>
      <button type="button" aria-label="Une portion de plus" disabled=${portions >= 50}
        onClick=${() => setPortions((p) => Math.min(50, p + 1))}>+</button>
    </div>
    <${Ingredients} liste=${r.ingredients} facteur=${facteur} />
    ${r.ustensiles.length > 0 && html`<p class="note">Ustensiles : ${r.ustensiles.join(', ')}</p>`}

    <h2>Étapes</h2>
    <ol class="etapes">
      ${r.etapes.map((e) => html`<li key=${e.numero}>${e.texte}
        ${e.reglages && Object.keys(e.reglages).length > 0 && html`<div class="reglages">
          ${Object.entries(e.reglages).map(([k, v]) => html`<span>${lib(REGLAGES, k)} : ${v}</span>`)}</div>`}
      </li>`)}
    </ol>

    ${r.astuces.length > 0 && html`<h2>Astuces</h2>
      <ul class="simple">${r.astuces.map((a) => html`<li>${a}</li>`)}</ul>`}
    ${c && html`<h2>Conservation</h2>
      <ul class="simple">
        <li>Au frigo : ${c.frigo_jours} jour${c.frigo_jours > 1 ? 's' : ''}</li>
        <li>Au congélateur : ${c.congelation_mois} mois</li>
        ${c.reechauffage && html`<li>${c.reechauffage}</li>`}
      </ul>`}

    <h2>Nutrition par portion</h2>
    <table class="nutrition"><tbody>
      ${NUTRITION.map(([k, nom, u]) => r.nutrition_par_portion[k] != null && html`<tr key=${k}>
        <th scope="row">${nom}</th><td>${String(r.nutrition_par_portion[k]).replace('.', ',')} ${u}</td></tr>`)}
    </tbody></table>
    <p class="note">Valeurs estimées, pour une portion (indépendantes du nombre de portions choisi).</p>
  </div></article>`;
}

function App() {
  const id = useRoute();
  const [index, setIndex] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [f, setF] = useState({ q: '', regimes: [], allergenes: [], ouvert: false, nb: PAGE });
  const [defil, setDefil] = useState(0);

  useEffect(() => { chargerIndex().then(setIndex).catch(() => setErreur(true)); }, []);
  useEffect(() => { window.scrollTo(0, id ? 0 : defil); }, [id]);

  const entree = index && id ? index.find((r) => r.id === id) : null;
  return html`
    <div hidden=${!!id}>
      <${Liste} index=${index} erreur=${erreur} f=${f} setF=${setF}
        onOuvrir=${() => setDefil(window.scrollY)} />
    </div>
    ${id && html`<${Fiche} id=${id} entree=${entree} />`}`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
