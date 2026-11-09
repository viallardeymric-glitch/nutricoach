// Parcours complet dans Chromium au format téléphone. Usage : node scripts/test-navigateur.mjs [dossier-captures]
import { readFileSync } from 'node:fs';
import { chargerPlaywright, servir, modeLocal } from './_navigateur.mjs';

const captures = process.argv[2];
const { chromium } = chargerPlaywright();
const serveur = await servir();
const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
await modeLocal(ctx);
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
let echecs = 0;
const verif = (ok, msg) => { console.log(ok ? 'ok   ' : 'ÉCHEC', msg); if (!ok) echecs++; };
const toutes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url), 'utf8'));
const nb = async () => parseInt((await p.textContent('.nb-resultats')).trim(), 10);

await p.goto(serveur.url + '/');
await p.waitForSelector('text=Qui utilise ce téléphone');
verif(true, 'mode local : choix de la personne au premier lancement');
await p.click('text=Je suis Marie');
await p.waitForSelector('.carte');
verif(await nb() === 1610, '1610 recettes listées');
verif(await p.locator('.carte').count() === 40, '40 cartes par page, « Afficher plus » disponible');

// Recherche (titre, ingrédient, tag, accents)
await p.fill('input[type=search]', 'CREME BRULEE');
verif(await nb() > 0, `recherche « CREME BRULEE » sans accents : ${await nb()} résultat(s)`);
await p.fill('input[type=search]', 'citron');
const nbCitron = await nb();
const attenduCitron = toutes.filter((r) => /citron/.test(JSON.stringify([r.titre, r.tags, r.ingredients.map((i) => i.aliment)]).toLowerCase())).length;
verif(nbCitron === attenduCitron, `recherche « citron » (titre/ingrédients/tags) : ${nbCitron} = ${attenduCitron}`);
await p.fill('input[type=search]', '');

// Filtres cumulables + règle de sécurité
await p.click('.btn-filtres');
await p.click('.puce:text-is("Plats")');
await p.click('.puce:text-is("Végan")');
await p.click('.puce.exclu:text-is("Fruits à coque")');
await p.click('.puce:text-is("30 min")');
const attendu = toutes.filter((r) => r.categorie === 'Plats' && r.regimes_compatibles.includes('vegan')
  && !r.allergenes.includes('fruits_a_coque') && r.temps.total_min <= 30).length;
verif(await nb() === attendu, `Plats + végan + sans fruits à coque + ≤ 30 min : ${await nb()} = ${attendu}`);
verif(await p.locator('.bandeau.info', { hasText: 'Allergènes exclus' }).count() === 1, 'bandeau « allergènes exclus » affiché');
await p.click('.filtres >> text=Tout effacer');
verif(await nb() === 1610, 'tout effacer');
await p.click('.puce:text-is("Facile")'); await p.click('.puce:text-is("Hiver")'); await p.click('.puce:text-is("Four")');
const att2 = toutes.filter((r) => r.difficulte === 'facile' && (r.saisons.includes('hiver') || r.saisons.includes('toute_annee')) && r.appareils_possibles.includes('four')).length;
verif(await nb() === att2, `facile + hiver + four : ${await nb()} = ${att2}`);
await p.click('.filtres >> text=Tout effacer');
await p.click('.btn-filtres');
if (captures) await p.screenshot({ path: `${captures}/liste.png` });

// Fiche avec avertissements
const cible = toutes.find((r) => r.deconseille_a.length >= 2 && r.ingredients.some((i) => i.unite === 'gousse'));
await p.fill('input[type=search]', cible.titre);
await p.click('.carte-lien >> nth=0');
await p.waitForSelector('.fiche h1');
verif(await p.textContent('.fiche h1') === cible.titre, `fiche ouverte : ${cible.titre}`);
const alerte = await p.textContent('.bandeau.alerte');
verif(cible.deconseille_a.every((d) => alerte.includes(d.raison)), 'tous les avertissements sont visibles en haut');
verif(await p.locator('.etapes li').count() === cible.etapes.length, 'étapes numérotées');
verif((await p.textContent('.nutrition')).includes('kcal') && (await p.textContent('.fiche')).includes('valeurs estimées'), 'nutrition « valeurs estimées »');

// Nombre de personnes : 1 à 12
const base = cible.portions_base;
const avant = (await p.textContent('.ingredients')).trim();
await p.click('[aria-label="Une personne de plus"]');
verif((await p.textContent('output')).startsWith(String(base + 1)), `portions ${base} → ${base + 1}`);
verif((await p.textContent('.ingredients')).trim() !== avant, 'quantités recalculées');
for (let i = 0; i < 20; i++) if (await p.locator('[aria-label="Une personne de moins"]').isEnabled()) await p.click('[aria-label="Une personne de moins"]');
verif((await p.textContent('output')).startsWith('1 personne'), 'minimum : 1 personne');
verif(await p.locator('.bandeau.info').count() >= 0 && !/\d,\d{3}/.test(await p.textContent('.ingredients')), 'pas de quantité à 3 décimales');
if (captures) await p.screenshot({ path: `${captures}/fiche.png` });
await p.click('text=Revenir à ' + base);
verif((await p.textContent('.ingredients')).trim() === avant, 'retour à la recette de base : quantités d\'origine');

// Favoris
await p.click('.fiche-titre .coeur');
verif(await p.locator('.fiche-titre .coeur.actif').count() === 1, 'favori ajouté depuis la fiche');
await p.goto(serveur.url + '/#/favoris');
await p.waitForSelector('.liste .carte');
verif(await nb() === 1, 'onglet Favoris : 1 recette');
await p.reload(); await p.waitForSelector('.liste .carte');
verif(await nb() === 1, 'favori conservé après rechargement');
await p.click('.liste .coeur');
verif(await p.locator('.liste .carte').count() === 0 && (await p.textContent('.etat')).includes('Aucun favori'), 'favori retiré : état vide soigné');

// Profil : choix de la personne, besoins, garde-fou grossesse, conservation locale
await p.goto(serveur.url + '/#/profil');
await p.waitForSelector('h1:has-text("Profil de Marie")');
verif(!(await p.textContent('body')).includes('Chargement…'), 'plus de « Chargement… » résiduel à l\'écran');
await p.click('.puce:text-is("Femme")');
const champs = p.locator('.grille input');
await champs.nth(0).fill('34'); await champs.nth(1).fill('62'); await champs.nth(2).fill('168');
await p.waitForSelector('.besoins');
const kcal = parseInt(await p.textContent('.grosse-valeur strong'), 10);
verif(kcal > 1500 && kcal < 2400, `besoins calculés : ${kcal} kcal`);
await p.click('.puce:text-is("Perdre du poids")');
await p.click('.puce:text-is("2e trimestre")');
verif((await p.textContent('.besoins')).includes('aucun régime amincissant'), 'grossesse + perte de poids : objectif ramené au maintien');
verif((await p.textContent('.besoins')).includes('sage-femme'), 'mention « à savoir » grossesse');
if (captures) await p.screenshot({ path: `${captures}/profil.png`, fullPage: true });
await p.reload(); await p.waitForSelector('.besoins');
verif(await p.locator('.grille input').nth(1).inputValue() === '62' && await p.locator('.puce[aria-pressed="true"]:text-is("2e trimestre")').count() === 1, 'profil conservé après rechargement');

// Alertes de profil : Marie enceinte, allergique au lait, évite le poulet
await p.goto(serveur.url + '/#/profil'); await p.waitForSelector('.besoins');
await p.click('.puce.exclu:text-is("Lait")');
await p.fill('input[placeholder^="ex."]', 'poulet');
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.carte');
const attP = toutes.filter((r) => !r.allergenes.includes('lait') && !/poulet/i.test(r.titre + ' ' + r.ingredients.map((i) => i.aliment).join(' '))).length;
verif(await nb() === attP, `profil appliqué (sans lait, sans poulet) : ${await nb()} = ${attP}`);
verif((await p.textContent('.profil-applique')).includes('Marie'), 'bandeau « profil appliqué »');
await p.fill('input[type=search]', 'vin blanc');
const carteAlerte = p.locator('.carte', { has: p.locator('.alerte-carte') }).first();
if (await carteAlerte.count()) {
  verif((await carteAlerte.textContent()).includes('femme enceinte'), 'carte marquée « Déconseillé : femme enceinte »');
  await carteAlerte.locator('.carte-lien').click();
  await p.waitForSelector('.fiche h1');
  verif((await p.textContent('.bandeau.alerte')).includes('À savoir pour Marie'), 'fiche : « À savoir pour Marie » avec la raison');
  if (captures) await p.screenshot({ path: `${captures}/alerte.png` });
} else verif(false, 'aucune carte marquée pour une femme enceinte');
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.carte');
await p.fill('input[type=search]', '');
await p.click('.profil-applique .lien');
verif(await nb() === 1610, 'profil non appliqué : les 1610 recettes reviennent');
await p.click('.profil-applique .lien');
verif(await nb() === attP, 'profil réappliqué');

// Installation et hors ligne
await p.goto(serveur.url + '/');
await p.waitForSelector('.carte');
verif(await p.evaluate(async () => !!(await navigator.serviceWorker.ready).active), 'service worker actif');
const man = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
verif(man.display === 'standalone' && man.icons.length >= 3, 'manifeste installable');
await p.goto(serveur.url + '/#/recette/' + cible.id); await p.waitForSelector('.fiche h1');  // met le catalogue complet en cache
await p.waitForTimeout(800);
await ctx.setOffline(true);
await p.goto(serveur.url + '/#/recette/REC-000002');
await p.reload();
await p.waitForSelector('.fiche h1', { timeout: 8000 }).then(() => verif(true, 'fiche affichée hors ligne'), () => verif(false, 'fiche affichée hors ligne'));
await p.goto(serveur.url + '/#/');
await p.waitForSelector('.carte', { timeout: 8000 }).then(() => verif(true, 'liste affichée hors ligne'), () => verif(false, 'liste affichée hors ligne'));

verif(erreurs.length === 0, 'aucune erreur console ' + erreurs.join(' | '));
await navigateur.close();
serveur.fermer();
process.exit(echecs ? 1 : 0);
