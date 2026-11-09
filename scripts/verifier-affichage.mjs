// Affiche les 1 610 fiches dans Chromium (3 nombres de personnes chacune) et contrôle le contenu.
// Usage : node scripts/verifier-affichage.mjs   (nécessite Playwright)
import { chargerPlaywright, servir, modeLocal } from './_navigateur.mjs';

const { chromium } = chargerPlaywright();
const serveur = await servir();
const navigateur = await chromium.launch();
const contexte = await navigateur.newContext();
await modeLocal(contexte);
const page = await contexte.newPage();
const erreursPage = [];
page.on('pageerror', (e) => erreursPage.push(e.message));
await page.addInitScript(() => localStorage.setItem('nutricoach.moi', '"M"'));
await page.goto(serveur.url + '/#/recettes');
await page.waitForSelector('.carte');

const bilan = await page.evaluate(async () => {
  const { html, render } = await import('/vendor/preact-htm.js');
  const { FicheRecette } = await import('/js/views/fiche.js');
  const { PORTIONS_MAX } = await import('/js/core/config.js');
  const recettes = await (await fetch('/data/recettes.json')).json();
  const problemes = [];
  const zone = document.createElement('div');
  document.body.append(zone);
  let rendus = 0;
  for (const r of recettes) {
    for (const portions of [r.portions_base, 1, PORTIONS_MAX]) {
      try {
        render(html`<${FicheRecette} r=${r} portions=${portions} setPortions=${() => {}} favori=${false} onFavori=${() => {}} />`, zone);
        rendus++;
        const q = (s) => zone.querySelectorAll(s);
        if (zone.querySelector('h1')?.textContent !== r.titre) problemes.push(`${r.id} : titre`);
        if (q('.ingredients li').length !== r.ingredients.length) problemes.push(`${r.id} : ingrédients`);
        if (q('.etapes li').length !== r.etapes.length) problemes.push(`${r.id} : étapes`);
        if (q('.nutrition tr').length !== 7) problemes.push(`${r.id} : nutrition`);
        if (!zone.textContent.includes('valeurs estimées')) problemes.push(`${r.id} : mention « valeurs estimées »`);
        const alerte = zone.querySelector('.bandeau.alerte');
        if (r.deconseille_a.length) {
          if (!alerte) problemes.push(`${r.id} : avertissements absents`);
          else for (const d of r.deconseille_a) if (!alerte.textContent.includes(d.raison)) problemes.push(`${r.id} : raison manquante`);
          // l'avertissement est AVANT les ingrédients
          if (alerte && !(alerte.compareDocumentPosition(zone.querySelector('.ingredients')) & Node.DOCUMENT_POSITION_FOLLOWING)) problemes.push(`${r.id} : avertissements après les ingrédients`);
        } else if (alerte) problemes.push(`${r.id} : avertissement sans raison d'être`);
        if (/NaN|undefined|\[object/.test(zone.textContent)) problemes.push(`${r.id} (${portions} pers.) : texte invalide`);
      } catch (e) { problemes.push(`${r.id} : ${e.message}`); }
    }
  }
  return { rendus, total: recettes.length, problemes: problemes.slice(0, 30), nb: problemes.length };
});

await navigateur.close();
serveur.fermer();
console.log(`${bilan.rendus} affichages pour ${bilan.total} recettes`);
if (bilan.nb || erreursPage.length) {
  console.error(`✗ ${bilan.nb} problème(s)\n- ` + [...bilan.problemes, ...erreursPage].join('\n- '));
  process.exit(1);
}
console.log('✓ Toutes les fiches s\'affichent sans erreur');
