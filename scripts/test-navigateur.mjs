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
await p.waitForSelector('.entete.grand');
verif((await p.textContent('.entete.grand')).includes('Bonjour Marie'), 'accueil : « Bonjour Marie »');
await p.goto(serveur.url + '/#/recettes');
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
const cible = toutes.find((r) => r.deconseille_a.length >= 2 && r.portions_base !== 2 && r.ingredients.some((i) => i.unite === 'gousse'));
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
verif((await p.textContent('output')).startsWith('2 personnes'), 'une fiche s\'ouvre pour 2 personnes (le couple)');
await p.click('text=Revenir à ' + base);
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

// Profil : accueil de profil, pages courtes, date de naissance, besoins, garde-fou grossesse
await p.goto(serveur.url + '/#/profil');
await p.waitForSelector('.rangs');
verif(await p.locator('.rang').count() === 7, 'profil : accueil avec 7 rubriques courtes');
await p.goto(serveur.url + '/#/profil/infos');
await p.waitForSelector('input[type=date]');
await p.click('.puce:text-is("Femme")');
await p.fill('input[type=date]', '1991-05-14');
const champs = p.locator('.grille input');
await champs.nth(0).fill('62'); await champs.nth(1).fill('168');
await p.waitForSelector('text=Vous avez');
verif(/Vous avez \d\d ans/.test(await p.textContent('.contenu')), 'âge calculé depuis la date de naissance');
await p.goto(serveur.url + '/#/profil/objectif');
await p.waitForSelector('.besoins');
const kcal = parseInt(await p.textContent('.grosse-valeur strong'), 10);
verif(kcal > 1500 && kcal < 2400, `besoins calculés : ${kcal} kcal`);
await p.click('.puce:text-is("Perdre du poids")');
await p.goto(serveur.url + '/#/profil/situation');
await p.click('.puce:text-is("2e trimestre")');
verif((await p.textContent('.contenu')).includes('sage-femme'), 'mention « à savoir » grossesse');
await p.goto(serveur.url + '/#/profil/objectif'); await p.waitForSelector('.besoins');
verif((await p.textContent('.besoins')).includes('aucun régime amincissant'), 'grossesse + perte de poids : objectif ramené au maintien');
if (captures) await p.screenshot({ path: `${captures}/profil.png`, fullPage: true });
await p.reload(); await p.waitForSelector('.besoins');
await p.goto(serveur.url + '/#/profil/infos'); await p.waitForSelector('input[type=date]');
verif(await p.locator('input[type=date]').inputValue() === '1991-05-14' && await p.locator('.grille input').nth(0).inputValue() === '62', 'profil conservé après rechargement');

// Alertes de profil : Marie enceinte, allergique au lait, évite le poulet
await p.goto(serveur.url + '/#/profil/regimes'); await p.waitForSelector('.puce.exclu');
await p.click('.puce.exclu:text-is("Lait")');
await p.fill('input[placeholder^="ex."]', 'poulet');
await p.goto(serveur.url + '/#/recettes'); await p.waitForSelector('.carte');
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
await p.goto(serveur.url + '/#/recettes'); await p.waitForSelector('.carte');
await p.fill('input[type=search]', '');
await p.click('.profil-applique .lien');
verif(await nb() === 1610, 'profil non appliqué : les 1610 recettes reviennent');
await p.click('.profil-applique .lien');
verif(await nb() === attP, 'profil réappliqué');

// Semaine : un menu qui respecte le profil (ici : sans lait, sans poulet, enceinte)
const parId = new Map(toutes.map((r) => [r.id, r]));
const idsSemaine = async () => (await p.$$eval('.jour .mini-lien', (els) => els.map((e) => e.getAttribute('href').split('/').pop())));
await p.goto(serveur.url + '/#/semaine'); await p.waitForSelector('.actions-semaine');
verif((await p.textContent('.contenu')).includes('sans lait'), 'semaine : rappel des contraintes (sans lait)');
await p.click('text=Générer ma semaine'); await p.waitForSelector('.jour .mini');
const menu = await idsSemaine();
verif(menu.length === 14 && new Set(menu).size === 14, 'semaine : 14 repas, tous différents');
const sur = menu.every((id) => { const r = parId.get(id); return !r.allergenes.includes('lait')
  && !/poulet/i.test(r.titre + r.ingredients.map((i) => i.aliment).join(' ')) && !r.deconseille_a.some((d) => d.profil === 'femme_enceinte'); });
verif(sur, 'SÉCURITÉ : aucun repas avec lait, poulet ni avertissement grossesse');
verif(menu.filter((id) => parId.get(id).allergenes.includes('poisson')).length >= 2, 'au moins 2 repas de poisson');
await p.reload(); await p.waitForSelector('.jour .mini');
verif(JSON.stringify(await idsSemaine()) === JSON.stringify(menu), 'menu conservé après rechargement');
const premier = menu[0];
await p.click('.jour .repas-jour >> nth=0 >> [aria-label^="Changer"]');
verif((await idsSemaine())[0] !== premier, 'bouton « changer » : autre repas proposé');
await p.click('.jour .repas-jour >> nth=0 >> [aria-label^="Retirer"]');
verif(await p.locator('.jour .ajout').count() === 1, 'bouton « retirer » : repas vidé, « Proposer un repas » affiché');
await p.click('.jour .ajout');
verif((await idsSemaine()).length === 14, '« Proposer un repas » remplit le repas');
if (captures) await p.screenshot({ path: `${captures}/semaine.png` });

// Accueil : « ce soir » et idées
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.entete.grand');
await p.waitForSelector('.section >> text=Qu\'est-ce qu\'on mange ce soir');
verif(await p.locator('.mini >> text=Ce soir').count() === 3, '« Ce soir » : 3 propositions');
await p.click('.puce:has-text("Rapide")');
const rapides = await p.$$eval('.section:has(h2:text-is("Qu\'est-ce qu\'on mange ce soir ?")) .mini-lien', (els) => els.map((e) => e.getAttribute('href').split('/').pop()));
verif(rapides.length > 0 && rapides.every((id) => parId.get(id).temps.total_min <= 20), `filtre rapide : ${rapides.length} idées, toutes ≤ 20 min`);
await p.click('.puce:has-text("Rapide")');
await p.click('.mini-action >> nth=0');
verif(await p.locator('.mini-action.fait').count() === 1, '« Ce soir » : repas choisi pour le dîner');
verif(await p.locator('.repas-jour:has-text("Dîner") .mini').count() === 1, 'Aujourd\'hui : le dîner choisi apparaît');

// Mode cuisine pas à pas
const recette = toutes.find((r) => r.etapes.some((e) => e.reglages && e.reglages.duree && /min/.test(e.reglages.duree)));
const numEtape = recette.etapes.findIndex((e) => e.reglages && e.reglages.duree && /min/.test(e.reglages.duree)) + 1;
await p.goto(serveur.url + '/#/recette/' + recette.id); await p.waitForSelector('.fiche h1');
await p.click('text=Cuisiner pas à pas');
await p.waitForSelector('.cuisine-corps h2');
verif((await p.textContent('.cuisine-corps')).includes('Ingrédients'), 'cuisine : écran des ingrédients d\'abord');
await p.click('text=Commencer');
for (let k = 1; k < numEtape; k++) await p.click('.cuisine-nav .bouton:not(.secondaire)');
verif((await p.textContent('.cuisine-etape-num')).includes(`Étape ${numEtape} sur ${recette.etapes.length}`), `cuisine : étape ${numEtape}/${recette.etapes.length}`);
verif(await p.locator('.minuteur').count() === 1, 'cuisine : minuteur proposé sur une étape avec durée');
const avantTemps = await p.textContent('.minuteur-temps');
await p.click('text=Lancer le minuteur'); await p.waitForTimeout(1300);
verif((await p.textContent('.minuteur-temps')) !== avantTemps, 'cuisine : le minuteur décompte');
await p.click('.minuteur-boutons >> text=Pause');
verif(await p.locator('text=Reprendre').count() === 1, 'cuisine : pause / reprise');
if (captures) await p.screenshot({ path: `${captures}/cuisine.png` });
await p.click('[aria-label="Quitter le mode cuisine"]');
await p.waitForSelector('.fiche h1');
verif(true, 'cuisine : retour à la fiche');

// Coach IA (fausse API Gemini)
const requetes = [];
await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
  requetes.push({ url: route.request().url(), cle: route.request().headers()['x-goog-api-key'], corps: route.request().postData() });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Essayez une **soupe** de légumes :\n- carottes\n- poireaux' }] } }] }) });
});
await p.goto(serveur.url + '/#/coach'); await p.waitForSelector('text=Activez votre coach');
verif(true, 'coach : invite à saisir la clé gratuite');
await p.fill('input[type=password]', 'CLE-DE-TEST-123');
await p.waitForSelector('.coach-saisie');
verif(true, 'coach : clé enregistrée, conversation ouverte');
await p.fill('.coach-saisie input', 'Que cuisiner ce soir ?'); await p.click('.coach-saisie button');
await p.waitForSelector('.bulle.coach strong');
verif((await p.textContent('.bulle.coach')).includes('carottes'), 'coach : réponse affichée avec mise en forme');
verif(requetes.length === 1 && requetes[0].cle === 'CLE-DE-TEST-123' && !requetes[0].url.includes('CLE-DE-TEST'), 'coach : clé envoyée en en-tête, jamais dans l\'URL');
verif(!requetes[0].corps.includes('ALLERGIES'), 'coach : profil NON envoyé par défaut');
await p.goto(serveur.url + '/#/profil/coach'); await p.waitForSelector('.case input');
await p.check('.case input');
await p.goto(serveur.url + '/#/coach'); await p.waitForSelector('.coach-saisie');
await p.fill('.coach-saisie input', 'Et pour demain ?'); await p.click('.coach-saisie button');
await p.waitForFunction(() => document.querySelectorAll('.bulle.coach:not(.attente)').length >= 2);
verif(requetes.length === 2 && requetes[1].corps.includes('ALLERGIES') && requetes[1].corps.includes('lait'), 'coach : profil envoyé seulement après accord (allergie au lait incluse)');
verif(requetes[1].corps.includes('Que cuisiner ce soir'), 'coach : l\'historique est transmis');
await p.reload(); await p.waitForSelector('.bulle.coach');
const nbBulles = await p.locator('.bulle').count(); verif(nbBulles === 4, 'coach : conversation conservée (' + nbBulles + ' bulles)');
await p.click('text=Effacer la conversation');
verif(await p.locator('.bulle').count() === 0, 'coach : conversation effacée');

// Installation et hors ligne
await p.goto(serveur.url + '/#/recettes');
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
await p.goto(serveur.url + '/#/recettes');
await p.waitForSelector('.carte', { timeout: 8000 }).then(() => verif(true, 'liste affichée hors ligne'), () => verif(false, 'liste affichée hors ligne'));

verif(erreurs.length === 0, 'aucune erreur console ' + erreurs.join(' | '));
await navigateur.close();
serveur.fermer();
process.exit(echecs ? 1 : 0);
