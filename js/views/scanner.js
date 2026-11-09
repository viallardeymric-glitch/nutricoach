// Scan de produits « façon Yuka » : caméra ou saisie du numéro, fiche produit avec note, alertes et alternatives, historique.
import { html, useState, useEffect, useRef, useMemo } from '../../vendor/preact-htm.js';
import { PERSONNES } from '../core/config.js';
import { demarrerScan, cameraDisponible } from '../core/camera.js';
import { chargerProduitOFF, chercherAlternatives } from '../core/off.js';
import { codeBarresValide, noterProduit, alertesProduit, LIBELLE_COULEUR } from '../lib/scan.js';
import { risqueAdditif, NIVEAUX_ADDITIFS } from '../data/additifs.js';
import { MENTION_SCAN } from '../data/sources.js';
import { ALLERGENES, lib } from '../data/libelles.js';
import { rayonDe } from '../data/rayons.js';
import { cleAliment } from '../lib/courses.js';
import { Entete, Bandeau, Pastille, Puce } from '../ui/composants.js';

const ALLER = (code) => { location.hash = `#/produit/${code}`; };

export function Scanner() {
  const video = useRef(null);
  const [erreur, setErreur] = useState('');
  const [pret, setPret] = useState(false);
  const [numero, setNumero] = useState('');
  const [invalide, setInvalide] = useState(false);

  useEffect(() => {
    let arret = null;
    let ferme = false;
    if (!cameraDisponible()) { setErreur('Ce navigateur ne permet pas d\'utiliser la caméra. Saisissez le numéro du code-barres.'); return undefined; }
    demarrerScan(video.current, (code) => { if (codeBarresValide(code)) { if (navigator.vibrate) navigator.vibrate(60); ALLER(code); } })
      .then((a) => { if (ferme) a(); else { arret = a; setPret(true); } })
      .catch((e) => setErreur(e.message));
    return () => { ferme = true; if (arret) arret(); };
  }, []);

  const chercher = (e) => {
    e.preventDefault();
    const code = numero.replace(/\s/g, '');
    if (!codeBarresValide(code)) { setInvalide(true); return; }
    ALLER(code);
  };
  return html`<div class="scanner">
    <${Entete} titre="Scanner" sous="Visez le code-barres d'un produit" retour=${{ href: '#/', nom: 'Accueil' }} />
    <div class="contenu">
      <div class=${'viseur' + (pret ? ' pret' : '')}>
        <video ref=${video} muted playsinline aria-label="Aperçu de la caméra"></video>
        <div class="cadre" aria-hidden="true"></div>
        ${!pret && !erreur && html`<p class="viseur-texte">Démarrage de la caméra…</p>`}
      </div>
      ${erreur && html`<${Bandeau} type="info"><p>${erreur}</p><//>`}
      <form class="ligne-saisie" onSubmit=${chercher}>
        <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Ou saisissez le numéro (13 chiffres)" value=${numero} maxlength="14"
          onInput=${(e) => { setNumero(e.target.value.replace(/[^\d\s]/g, '')); setInvalide(false); }} aria-label="Numéro du code-barres" />
        <button type="submit" class="bouton" disabled=${numero.replace(/\s/g, '').length < 8}>Chercher</button>
      </form>
      ${invalide && html`<p class="erreur-champ" role="alert">Ce numéro n'est pas valide (clé de contrôle incorrecte). Vérifiez-le.</p>`}
      <p class="note">La caméra n'est utilisée que sur cet écran, uniquement pour lire les codes-barres. Rien n'est enregistré à partir de l'image.</p>
      <a class="bouton secondaire" href="#/scans">🕘 Historique des scans</a>
    </div></div>`;
}

const COULEURS = { excellent: '#1a9e5c', bon: '#7bb339', mediocre: '#f0932b', mauvais: '#d63031' };
function Jauge({ note, couleur }) {
  return html`<div class="jauge" style=${`--c:${COULEURS[couleur]}`} role="img" aria-label=${`Note ${note} sur 100 : ${LIBELLE_COULEUR[couleur]}`}>
    <strong>${note}</strong><span>/100</span></div>`;
}
const LETTRE = { a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11' };

function Formulaire({ code, onCreer }) {
  const [v, setV] = useState({ nom: '', marque: '', kcal: '', sucres: '', satures: '', sel: '', fibres: '', proteines: '', ingredients: '' });
  const maj = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const num = (k) => (v[k] === '' ? null : Number(String(v[k]).replace(',', '.')));
  const champ = (k, titre, unite) => html`<label class="champ"><span>${titre}${unite ? ` (${unite})` : ''}</span>
    <input type="text" inputmode="decimal" value=${v[k]} onInput=${maj(k)} /></label>`;
  return html`<form onSubmit=${(e) => { e.preventDefault(); if (v.nom.trim()) onCreer({ code, nom: v.nom.trim(), marque: v.marque.trim(), quantite: '', image: '', ingredients: v.ingredients.trim(),
      allergenes: [], traces: [], additifs: [], nutriscore: null, nova: null, ecoscore: null, bio: false, labels: [], categories: [], vegan: null, vegetarien: null,
      nutrition: { kcal: num('kcal'), graisses: null, satures: num('satures'), glucides: null, sucres: num('sucres'), fibres: num('fibres'), proteines: num('proteines'), sel: num('sel') } }); }}>
    <label class="champ"><span>Nom du produit</span><input type="text" value=${v.nom} onInput=${maj('nom')} required /></label>
    ${champ('marque', 'Marque')}
    <h3 class="petit-titre">Pour 100 g</h3>
    <div class="grille deux">${champ('kcal', 'Énergie', 'kcal')}${champ('sucres', 'Sucres', 'g')}${champ('satures', 'Graisses saturées', 'g')}${champ('sel', 'Sel', 'g')}${champ('fibres', 'Fibres', 'g')}${champ('proteines', 'Protéines', 'g')}</div>
    <label class="champ"><span>Ingrédients (facultatif)</span><input type="text" value=${v.ingredients} onInput=${maj('ingredients')} /></label>
    <button type="submit" class="bouton grand" disabled=${!v.nom.trim()}>Enregistrer et noter ce produit</button>
    <p class="note">Le produit est gardé dans votre historique partagé. L'envoi vers Open Food Facts (qui demande un compte) n'est pas encore possible depuis l'appli.</p>
  </form>`;
}

export function Produit({ code, scans, moi, profil, ops, articlesListe }) {
  const enCache = scans.find((s) => s.code === code);
  const [statut, setStatut] = useState(enCache ? 'ok' : 'chargement'); // chargement | ok | absent | erreur
  const [produit, setProduit] = useState(enCache ? enCache.produit : null);
  const [messageErreur, setMessageErreur] = useState('');
  const [alternatives, setAlternatives] = useState(null);   // null = pas demandé, [] = aucune
  const [attenteAlt, setAttenteAlt] = useState(false);
  const [retour, setRetour] = useState(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (enCache) { setProduit(enCache.produit); setStatut('ok'); return undefined; }
    let actif = true;
    setStatut('chargement'); setAlternatives(null);
    chargerProduitOFF(code).then((p) => {
      if (!actif) return;
      if (!p) { setStatut('absent'); return; }
      setProduit(p); setStatut('ok');
      ops.ecrireScan({ code, produit: p, t: Date.now(), par: moi, favoriPar: [], eviterPar: [], saisie: false });
    }).catch((e) => { if (actif) { setMessageErreur(e.message); setStatut('erreur'); } });
    return () => { actif = false; };
  }, [code, essai]);

  const scan = scans.find((s) => s.code === code);
  const note = useMemo(() => (produit ? noterProduit(produit) : null), [produit]);
  const alertes = useMemo(() => (produit ? alertesProduit(produit, profil) : []), [produit, profil]);
  const retourBandeau = retour && html`<${Bandeau} type="info"><p>${retour}</p><//>`;

  const entete = html`<${Entete} titre=${produit ? produit.nom : 'Produit'} sous=${produit && produit.marque} retour=${{ href: '#/scan', nom: 'Scanner' }} />`;
  if (statut === 'chargement') return html`<div>${entete}<p class="etat">Recherche du produit…</p></div>`;
  if (statut === 'erreur') {
    return html`<div>${entete}<div class="contenu"><${Bandeau} type="alerte"><p>${messageErreur}</p><//>
      <button type="button" class="bouton" onClick=${() => setEssai((n) => n + 1)}>Réessayer</button>
      <p class="note">Les produits déjà scannés restent disponibles hors ligne.</p></div></div>`;
  }
  if (statut === 'absent') {
    return html`<div>${entete}<div class="contenu"><${Bandeau} type="info" titre="Produit inconnu"><p>Le code ${code} n'est pas dans Open Food Facts. Vous pouvez saisir ses informations pour le noter.</p><//>
      <${Formulaire} code=${code} onCreer=${(p) => { ops.ecrireScan({ code, produit: p, t: Date.now(), par: moi, favoriPar: [], eviterPar: [], saisie: true }); setProduit(p); setStatut('ok'); }} /></div></div>`;
  }

  const moi_ = moi;
  const favori = (scan && scan.favoriPar || []).includes(moi_);
  const eviter = (scan && scan.eviterPar || []).includes(moi_);
  const basculer = (champ) => {
    const base = scan || { code, produit, t: Date.now(), par: moi_, favoriPar: [], eviterPar: [], saisie: false };
    const liste = base[champ] || [];
    ops.ecrireScan({ ...base, [champ]: liste.includes(moi_) ? liste.filter((x) => x !== moi_) : [...liste, moi_] });
  };
  // « Scan en rayon » : un article non coché de la liste qui correspond au produit
  const mots = cleAliment(`${produit.nom} ${(produit.categories || []).join(' ').replace(/-/g, ' ')}`).split(' ');
  const dansLaListe = articlesListe.find((a) => !a.coche && a.cle && cleAliment(a.nom).split(' ').every((m) => mots.includes(m) || mots.some((x) => x.startsWith(m))));
  const n = produit.nutrition;
  const fmt = (x, d = 1) => (x == null ? '—' : String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ','));
  const chargerAlt = async () => {
    setAttenteAlt(true);
    try { setAlternatives(await chercherAlternatives(produit)); } catch (e) { setRetour(e.message); }
    setAttenteAlt(false);
  };

  return html`<div>${entete}<div class="contenu produit">
    <div class="produit-tete">
      ${produit.image ? html`<img src=${produit.image} alt="" loading="lazy" />` : html`<span class="picto grand">🛒</span>`}
      <div><${Jauge} note=${note.note} couleur=${note.couleur} />
        <p class=${'verdict ' + note.couleur}>${LIBELLE_COULEUR[note.couleur]}${note.partiel ? ' (estimation)' : ''}</p></div>
    </div>
    ${scan && html`<p class="sous">Scanné par <${Pastille} qui=${scan.par} /> ${scan.saisie ? '· saisi à la main' : ''}</p>`}
    ${retourBandeau}
    ${alertes.length > 0 && html`<${Bandeau} type=${alertes.some((a) => a.niveau === 'rouge') ? 'alerte' : 'avertissement'} titre=${html`<${Pastille} qui=${moi_} /> À savoir pour ${PERSONNES[moi_].prenom}`}>
      <ul>${alertes.map((a) => html`<li key=${a.id}>${a.niveau === 'rouge' ? '⛔' : '⚠'} ${a.raison}${a.source !== 'profil' ? html` <span class="sous">(${a.source})</span>` : ''}</li>`)}</ul>
      <p class="note"><a href="#/sources">Voir les sources</a></p><//>`}
    <div class="actions-produit">
      <button type="button" class="bouton" onClick=${() => { ops.ajouterAuxCourses(produit); setRetour('Ajouté à la liste de courses.'); }}>🛒 Aux courses</button>
      <button type="button" class="bouton secondaire" onClick=${() => { ops.ajouterAuStock(produit); setRetour('Ajouté au stock.'); }}>📦 Au stock</button>
      <button type="button" class=${'bouton secondaire' + (favori ? ' on' : '')} aria-pressed=${favori} onClick=${() => basculer('favoriPar')}>${favori ? '♥ Favori' : '♡ Favori'}</button>
      <button type="button" class=${'bouton secondaire' + (eviter ? ' on' : '')} aria-pressed=${eviter} onClick=${() => basculer('eviterPar')}>🚫 À éviter</button>
    </div>
    ${dansLaListe && html`<button type="button" class="bouton secondaire large" onClick=${() => { ops.cocher(dansLaListe); setRetour(`« ${dansLaListe.nom} » coché dans votre liste.`); }}>✓ Cocher « ${dansLaListe.nom} » dans ma liste</button>`}

    <h2 class="petit-titre">Pourquoi cette note ?</h2>
    ${note.details.map((d) => html`<div class="detail-note" key=${d.rubrique}>
      <div class="detail-tete"><strong>${d.rubrique}</strong>${d.max > 0 && html`<span>${d.points}/${d.max}</span>`}</div>
      <ul>${d.lignes.map((l, i) => html`<li key=${i} class=${l.type === '+' ? 'plus' : 'moins'}>${l.type === '+' ? '＋' : '－'} ${l.texte}</li>`)}</ul></div>`)}

    <h2 class="petit-titre">Repères</h2>
    <div class="reperes">
      ${produit.nutriscore && html`<span class="repere" style=${`background:${LETTRE[produit.nutriscore]}`}>Nutri-Score ${produit.nutriscore.toUpperCase()}</span>`}
      ${produit.nova && html`<span class="repere nova">NOVA ${produit.nova}</span>`}
      ${produit.ecoscore && html`<span class="repere" style=${`background:${LETTRE[produit.ecoscore]}`}>Éco-Score ${produit.ecoscore.toUpperCase()}</span>`}
      ${produit.bio && html`<span class="repere bio">Bio</span>`}
    </div>
    <h2 class="petit-titre">Pour 100 g</h2>
    <table class="nutrition"><tbody>
      <tr><th scope="row">Énergie</th><td>${fmt(n.kcal, 0)} kcal</td></tr><tr><th scope="row">Sucres</th><td>${fmt(n.sucres)} g</td></tr>
      <tr><th scope="row">Graisses saturées</th><td>${fmt(n.satures)} g</td></tr><tr><th scope="row">Sel</th><td>${fmt(n.sel, 2)} g</td></tr>
      <tr><th scope="row">Fibres</th><td>${fmt(n.fibres)} g</td></tr><tr><th scope="row">Protéines</th><td>${fmt(n.proteines)} g</td></tr>
    </tbody></table>
    ${produit.additifs.length > 0 && html`<h2 class="petit-titre">Additifs</h2><ul class="additifs">${produit.additifs.map((c) => { const r = risqueAdditif(c); return html`<li key=${c}><span class=${'pastille-risque ' + r.niveau}></span><strong>${r.code}</strong> ${r.nom} <span class="sous">· ${NIVEAUX_ADDITIFS[r.niveau].nom}</span>${r.note && html`<span class="sous"> — ${r.note}</span>`}</li>`; })}</ul>`}
    ${produit.allergenes.length > 0 && html`<h2 class="petit-titre">Allergènes</h2><div class="etiquettes">${produit.allergenes.map((a) => html`<span class="etiquette allergene" key=${a}>${lib(ALLERGENES, a)}</span>`)}</div>`}
    ${produit.traces.length > 0 && html`<p class="note">Traces possibles : ${produit.traces.map((a) => lib(ALLERGENES, a).toLowerCase()).join(', ')}.</p>`}
    ${produit.ingredients && html`<h2 class="petit-titre">Ingrédients</h2><p class="note ingredients-texte">${produit.ingredients}</p>`}

    <h2 class="petit-titre">Alternatives</h2>
    ${alternatives === null ? html`<button type="button" class="bouton secondaire large" disabled=${attenteAlt} onClick=${chargerAlt}>${attenteAlt ? 'Recherche…' : '🔎 Voir des alternatives mieux notées'}</button>`
      : alternatives.length === 0 ? html`<p class="note">Aucune alternative nettement meilleure trouvée dans cette catégorie.</p>`
      : alternatives.map((x) => html`<a class="mini-lien alt" key=${x.produit.code} href=${`#/produit/${x.produit.code}`}>
          ${x.produit.image ? html`<img src=${x.produit.image} alt="" loading="lazy" />` : html`<span class="picto">🛒</span>`}
          <span class="mini-texte"><strong>${x.produit.nom}</strong><span class="sous">${x.produit.marque}</span></span>
          <${Jauge} note=${x.note} couleur=${noterProduit(x.produit).couleur} /></a>`)}
    <p class="note">${MENTION_SCAN}</p>
  </div></div>`;
}

export function Historique({ scans, moi }) {
  const [filtre, setFiltre] = useState('tous');
  const visibles = scans.filter((s) => filtre === 'tous' || (filtre === 'favoris' && s.favoriPar.length) || (filtre === 'eviter' && s.eviterPar.length));
  return html`<div>
    <${Entete} titre="Historique des scans" sous="Partagé entre vous deux" retour=${{ href: '#/scan', nom: 'Scanner' }} />
    <div class="contenu">
      <div class="puces sans-marge">
        ${[['tous', 'Tous'], ['favoris', '♥ Favoris'], ['eviter', '🚫 À éviter']].map(([k, n]) => html`<${Puce} key=${k} actif=${filtre === k} onClick=${() => setFiltre(k)}>${n}<//>`)}
      </div>
      ${visibles.length === 0 ? html`<div class="etat"><p>Aucun produit.</p><p class="sous">Scannez un code-barres : il apparaîtra ici, même hors ligne.</p></div>`
        : html`<ul class="liste sans-marge-liste">${visibles.map((s) => { const n = noterProduit(s.produit); return html`<li class="carte" key=${s.code}>
          <a class="carte-lien" href=${`#/produit/${s.code}`}>
            ${s.produit.image ? html`<img class="vignette" src=${s.produit.image} alt="" loading="lazy" />` : html`<span class="picto">🛒</span>`}
            <span class="carte-texte"><strong>${s.produit.nom}</strong><span class="sous">${s.produit.marque || 'Sans marque'} · ${LIBELLE_COULEUR[n.couleur]} ${n.note}/100</span>
              <span class="sous">${s.par && html`<${Pastille} qui=${s.par} />`} ${s.favoriPar.length ? '♥ ' : ''}${s.eviterPar.length ? '🚫' : ''}</span></span></a></li>`; })}</ul>`}
      <p class="note">${MENTION_SCAN}</p>
    </div></div>`;
}
