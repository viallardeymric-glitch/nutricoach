// Parcours complet dans Chromium au format téléphone. Usage : node scripts/test-navigateur.mjs [dossier-captures]
import { readFileSync } from 'node:fs';
import { chargerPlaywright, servir, modeLocal } from './_navigateur.mjs';

const captures = process.argv[2];
const { chromium } = chargerPlaywright();
const serveur = await servir();
const navigateur = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
await modeLocal(ctx);
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/status of 401/.test(m.text()) && erreurs.push(m.text()));   // le 401 est provoqué volontairement (clé de photos refusée)
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
verif((await p.textContent('output')).startsWith('2 personnes') && (await p.textContent('.fiche')).includes('Par défaut : 2 personnes (Eymric et Marie)'), 'une fiche s\'ouvre pour le foyer : 2 personnes (Eymric et Marie)');
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
verif(await p.locator('.rang').count() === 9, 'profil : accueil avec 9 rubriques courtes');
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
await p.click('.mini-action:has-text("Ce soir") >> nth=0');
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
await p.fill('.coach-saisie textarea', 'Que cuisiner ce soir ?'); await p.click('.coach-saisie button');
await p.waitForSelector('.bulle.coach strong');
verif((await p.textContent('.bulle.coach')).includes('carottes'), 'coach : réponse affichée avec mise en forme');
verif(requetes.length === 1 && requetes[0].cle === 'CLE-DE-TEST-123' && !requetes[0].url.includes('CLE-DE-TEST'), 'coach : clé envoyée en en-tête, jamais dans l\'URL');
verif(!requetes[0].corps.includes('ALLERGIES'), 'coach : profil NON envoyé par défaut');
await p.goto(serveur.url + '/#/profil/coach'); await p.waitForSelector('.case input');
await p.check('.case input');
await p.goto(serveur.url + '/#/coach'); await p.waitForSelector('.coach-saisie');
await p.fill('.coach-saisie textarea', 'Et pour demain ?'); await p.click('.coach-saisie button');
await p.waitForFunction(() => document.querySelectorAll('.bulle.coach:not(.attente)').length >= 2);
verif(requetes.length === 2 && requetes[1].corps.includes('ALLERGIES') && requetes[1].corps.includes('lait'), 'coach : profil envoyé seulement après accord (allergie au lait incluse)');
verif(requetes[1].corps.includes('Que cuisiner ce soir'), 'coach : l\'historique est transmis');
verif(requetes[1].corps.includes('INTERDIT') && requetes[1].corps.includes('ne poses JAMAIS de diagnostic'), 'coach : base médicale et repères grossesse transmis');
verif(await p.locator('.avertissement-sante:has-text("sage-femme")').count() >= 1, 'coach : « je ne suis pas médecin » affiché sous la réponse (grossesse)');
await p.reload(); await p.waitForSelector('.bulle.coach');
const nbBulles = await p.locator('.bulle').count(); verif(nbBulles === 4, 'coach : conversation conservée (' + nbBulles + ' bulles)');
await p.click('text=Effacer la conversation');
verif(await p.locator('.bulle').count() === 0, 'coach : conversation effacée');
// Coach : onglet dédié, pièces jointes, copier-coller
verif(await p.locator('.onglets a:has-text("Coach")').count() === 1 && (await p.getAttribute('.onglets a.actif', 'href')) === '#/coach', 'coach : onglet dédié dans la barre du bas, actif sur la page');
const PNGC = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await p.setInputFiles('.coach-saisie input[type=file]', [{ name: 'etiquette.png', mimeType: 'image/png', buffer: PNGC }, { name: 'bilan.txt', mimeType: 'text/plain', buffer: Buffer.from('Fer : 8 µmol/L') }]);
await p.waitForSelector('.coach-pieces .piece:nth-child(2)');
verif((await p.textContent('.coach-pieces')).includes('etiquette.png') && (await p.textContent('.coach-pieces')).includes('bilan.txt'), 'coach : pièces jointes affichées avant envoi');
await p.fill('.coach-saisie textarea', 'Que penses-tu de ça ?\nLigne 2'); await p.click('.coach-saisie button[type=submit]');
await p.waitForSelector('.bulle.coach');
const dernier = requetes[requetes.length - 1].corps;
verif(dernier.includes('inlineData') && dernier.includes('image/jpeg') && dernier.includes('Fer : 8') && dernier.includes('Ligne 2'), 'coach : photo envoyée à l\'IA, fichier texte ajouté à la question, retour à la ligne conservé');
verif((await p.textContent('.bulle.moi')).includes('etiquette.png'), 'coach : les noms des pièces jointes restent visibles dans la conversation');
await p.setInputFiles('.coach-saisie input[type=file]', [{ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') }]);
await p.waitForSelector('text=pas pris en charge');
verif(true, 'coach : fichier non pris en charge refusé clairement');
await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
await p.click('.bulle.coach .copier');
await p.waitForSelector('text=Copié');
verif(true, 'coach : bouton Copier');
verif(await p.evaluate(() => getComputedStyle(document.querySelector('.bulle')).userSelect) === 'text', 'coach : le texte des bulles est sélectionnable (copier-coller)');
// Deuxième IA (Groq) : les deux sont interrogées en même temps
let appelsGroq = 0;
await p.route('https://api.groq.com/**', async (route) => { appelsGroq++; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'Réponse rapide de Groq' } }] }) }); });
await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('nutricoach.coach.reglages') || '{}'); localStorage.setItem('nutricoach.coach.reglages', JSON.stringify({ ...r, cleGroq: 'gsk_TEST' })); });
await p.reload(); await p.waitForSelector('.coach-saisie');
const avantGemini = requetes.length;
await p.fill('.coach-saisie textarea', 'Une idée de dessert ?'); await p.click('.coach-saisie button[type=submit]');
await p.waitForSelector('.bulle.coach .copier');
verif(appelsGroq === 1 && requetes.length === avantGemini + 1, 'coach : Gemini et Groq interrogés en même temps');
verif(/Gemini|Groq/.test(await p.textContent('.bulle.coach .sous')), 'coach : la réponse indique quelle IA a répondu');
verif((await p.getAttribute('.coach-saisie textarea', 'style') || '').indexOf('height: 140') < 0 && (await p.locator('.coach-saisie textarea').evaluate((e) => e.getBoundingClientRect().height)) <= 52, 'coach : la zone de saisie retrouve sa taille après l\'envoi');
await p.unroute('https://api.groq.com/**');
await p.click('text=Effacer la conversation');

// Guide grossesse
await p.goto(serveur.url + '/#/grossesse'); await p.waitForSelector('.carte-grossesse');
verif(!(await p.textContent('.contenu')).includes('Profil → Ma situation'), 'grossesse : grossesse déclarée (profil de test) → pas d\'invitation à la renseigner');
await p.fill('input[aria-label="Chercher un aliment"]', 'saumon fumé'); 
verif((await p.textContent('.carte-grossesse')).includes('À éviter') && (await p.textContent('.carte-grossesse')).includes('listériose'), 'grossesse : « saumon fumé » → à éviter, avec la raison');
await p.fill('input[aria-label="Chercher un aliment"]', 'alcool');
verif((await p.textContent('.carte-grossesse')).includes('Interdit'), 'grossesse : alcool → interdit');
await p.fill('input[aria-label="Chercher un aliment"]', 'zzzzzz');
verif((await p.textContent('.contenu')).includes('ne le mangez pas'), 'grossesse : aliment inconnu → prudence et renvoi vers un professionnel');
await p.fill('input[aria-label="Chercher un aliment"]', '');
await p.click('.puce:has-text("Autorisé")');
verif(await p.locator('.carte-grossesse.ok').count() > 5 && await p.locator('.carte-grossesse.interdit').count() === 0, 'grossesse : filtre « Autorisé »');
verif((await p.getAttribute('.onglets a.actif', 'href')) === '#/grossesse' && await p.locator('.onglets a:has-text("Grossesse")').count() === 1, 'grossesse : onglet dédié dans la barre du bas, actif sur la page');
verif(await p.locator('.onglets a').count() === 6 && await p.locator('.onglets a:has-text("Planning")').count() === 1, 'ergonomie : grossesse déclarée → 6 entrées, le Planning reste dans la barre');
await p.goto(serveur.url + '/#/plus'); await p.waitForSelector('.rangs');
verif(await p.evaluate(() => document.querySelector('.contenu').firstElementChild.classList.contains('carte-profil')), 'plus : le profil est en premier');
{ const t = await p.textContent('.contenu'); verif(['Recettes', 'Courses', 'Suivi'].every((n) => t.includes(n)), 'ergonomie : Recettes, Courses et Suivi sont dans « Plus »'); }
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.raccourcis');
{ const t = await p.textContent('.raccourcis'); verif(['Recettes', 'Ma semaine', 'Courses', 'Suivi'].every((n) => t.includes(n)), 'ergonomie : raccourcis vers Recettes, Ma semaine, Courses et Suivi sur l\'accueil'); }
await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
verif((await p.getAttribute('.onglets a.actif', 'href')) === '#/plus', 'ergonomie : sur Courses, l\'onglet « Plus » reste actif');
await p.goto(serveur.url + '/#/grossesse'); await p.waitForSelector('.carte-grossesse');
verif(/user-scalable=no/.test(await p.getAttribute('meta[name=viewport]', 'content')) && /maximum-scale=1/.test(await p.getAttribute('meta[name=viewport]', 'content')), 'zoom : bloqué (viewport)');
verif(await p.evaluate(() => getComputedStyle(document.body).touchAction) === 'pan-x pan-y', 'zoom : pincement et double toucher bloqués (touch-action)');
verif(await p.evaluate(() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; }), 'zoom : gestes de pincement Safari bloqués');
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.carte-grossesse-accueil');
verif(true, 'grossesse : carte sur l\'accueil quand la grossesse est déclarée');
await p.goto(serveur.url + '/#/plus'); await p.waitForSelector('text=Grossesse : que puis-je manger ?');
verif(true, 'grossesse : entrée dans « Plus » quand la grossesse est déclarée');
await p.goto(serveur.url + '/#/coach');
verif((await p.textContent('.coach-accueil')).includes('saumon fumé'), 'coach : suggestions adaptées à la grossesse');

// Courses : générées depuis le menu, rayons, cochage, saisie libre, alertes de profil, stock
await p.goto(serveur.url + '/#/recette/REC-000001'); await p.waitForSelector('.score-sante');
{ const t = await p.textContent('.fiche .score-sante, .score-sante'); verif(/Score santé : \d+\/100/.test(t) && t.includes('Sel') && t.includes('Fibres') && t.includes('pas un avis médical'), 'fiche : score santé détaillé avec rappel'); }
await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
verif((await p.textContent('.etat')).includes('La liste est vide'), 'courses : état vide soigné');
await p.click('text=Depuis le menu de la semaine'); await p.waitForSelector('.article');
const nbArticles = await p.locator('.article').count();
verif(nbArticles > 30, `courses : ${nbArticles} articles générés depuis le menu`);
verif((await p.locator('.page-courses .bandeau').first().textContent()).includes('pour 2 portions adultes'), 'courses : calculées pour 2 personnes');
verif((await p.textContent('.rayon .petit-titre >> nth=0')).includes('Fruits et légumes'), 'courses : groupées par rayon (fruits et légumes en premier)');
verif(await p.locator('.rayon .petit-titre').count() >= 4, 'courses : plusieurs rayons');
const nom0 = (await p.textContent('.article >> nth=0 >> strong')).trim();
await p.click('.case-article >> nth=0');
await p.waitForSelector('text=Dans le panier (1)');
verif(await p.locator('.article.coche').count() === 1 && await p.locator('.article.coche .article-qui .pastille.M').count() === 1, 'courses : article coché, pastille M (qui l\'a coché)');
await p.fill('input[aria-label="Ajouter un article"]', '2 kg de pommes'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
await p.fill('input[aria-label="Ajouter un article"]', '1 kg de pommes'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
verif((await p.locator('.article', { hasText: 'Pommes' }).first().textContent()).includes('3 kg'), 'courses : 2 kg + 1 kg de pommes fusionnés en 3 kg');
await p.fill('input[aria-label="Ajouter un article"]', 'saumon fumé'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
await p.fill('input[aria-label="Ajouter un article"]', 'beurre'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
verif((await p.locator('.article', { hasText: 'Saumon fumé' }).textContent()).includes('listériose'), 'courses : saumon fumé signalé à Marie enceinte, avec la raison');
verif(await p.locator('.article', { hasText: 'Beurre' }).locator('.alerte-article.rouge').count() === 1, 'courses : beurre signalé en rouge (allergie au lait)');
await p.click('text=Depuis le menu de la semaine'); await p.waitForTimeout(600);
verif(await p.locator('.article', { hasText: 'Pommes' }).count() === 1 && await p.locator('.article.coche').count() === 1, 'courses : régénérer ne perd ni les articles saisis ni les cochés');
const memeNomAvant = (await p.locator('.article strong').allTextContents()).filter((t) => t.trim() === nom0).length;
p.once('dialog', (d) => d.accept());
await p.click('text=Terminer les courses');
await p.waitForSelector('text=Courses terminées');
await p.click('role=tab[name="📦 Stock"]');
verif((await p.textContent('.page-courses')).includes(nom0), `stock : « ${nom0} » ajouté après les courses`);
await p.click('role=tab[name="🛒 Liste"]');
verif(await p.locator('.article.coche').count() === 0, 'courses : les articles achetés quittent la liste');
await p.click('text=Depuis le menu de la semaine'); await p.waitForTimeout(600);
const memeNomApres = (await p.locator('.article strong').allTextContents()).filter((t) => t.trim() === nom0).length;
verif(memeNomApres === memeNomAvant - 1, `courses : le stock est déduit à la génération suivante (${memeNomAvant} → ${memeNomApres} articles « ${nom0} »)`);
if (captures) await p.screenshot({ path: `${captures}/courses.png`, fullPage: true });

// Scan de produits (fausse API Open Food Facts)
const PRODUITS = {
  '3017620422003': { status: 1, product: { product_name: 'Camembert de Normandie au lait cru', brands: 'Fromagerie Test', allergens_tags: ['en:milk'], categories_tags: ['en:dairies', 'en:cheeses', 'en:camemberts'],
    ingredients_text: 'Lait cru de vache, sel, présure', nutriscore_grade: 'd', nova_group: 3, nutriments: { 'energy-kcal_100g': 300, 'saturated-fat_100g': 17, sugars_100g: 0.5, salt_100g: 1.6, proteins_100g: 20, fiber_100g: 0 } } },
  '5449000000996': { status: 1, product: { product_name: 'Cola zéro', brands: 'Boissons Test', additives_tags: ['en:e150d', 'en:e338', 'en:e951', 'en:e950'], categories_tags: ['en:beverages', 'en:sodas'],
    nutriscore_grade: 'b', nova_group: 4, nutriments: { 'energy-kcal_100g': 0.4, 'saturated-fat_100g': 0, sugars_100g: 0, salt_100g: 0.01, proteins_100g: 0, fiber_100g: 0 } } },
};
let appelsOFF = 0;
await ctx.route('https://world.openfoodfacts.org/**', async (route) => {
  appelsOFF++;
  const u = route.request().url();
  if (/\/api\/v2\/search/.test(u)) {
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ products: [
      { code: '5449000000996', product_name: 'Cola zéro', nova_group: 4, additives_tags: ['en:e951'], nutriments: { 'energy-kcal_100g': 0.4, sugars_100g: 0, 'saturated-fat_100g': 0, salt_100g: 0.01 } },
      { code: '3274080005003', product_name: 'Eau pétillante nature', brands: 'Source Test', nova_group: 1, nutriments: { 'energy-kcal_100g': 0, sugars_100g: 0, 'saturated-fat_100g': 0, salt_100g: 0.01, proteins_100g: 0, fiber_100g: 0 } }] }) });
  }
  const code = (u.match(/product\/(\d+)\.json/) || [])[1];
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(PRODUITS[code] || { status: 0 }) });
});
await p.goto(serveur.url + '/#/scan'); await p.waitForSelector('.scanner');
await p.waitForSelector('.viseur.pret', { timeout: 6000 }).then(() => verif(true, 'scan : la caméra démarre (lecteur local ZXing, caméra factice)'), () => verif(false, 'scan : la caméra démarre'));
await p.fill('input[aria-label="Numéro du code-barres"]', '3017620422004'); await p.click('text=Chercher');
verif((await p.textContent('.erreur-champ')).includes('clé de contrôle'), 'scan : numéro invalide refusé (clé de contrôle)');
await p.fill('input[aria-label="Numéro du code-barres"]', '3017620422003'); await p.click('text=Chercher');
await p.waitForSelector('.produit .jauge');
verif((await p.locator('.entete:visible h1').textContent()).includes('Camembert'), 'scan : fiche produit affichée');
const noteTxt = await p.getAttribute('.produit .jauge', 'aria-label');
verif(/Note \d+ sur 100/.test(noteTxt), `scan : ${noteTxt}`);
verif((await p.textContent('.bandeau.alerte')).includes('À savoir pour Marie') && (await p.textContent('.bandeau.alerte')).includes('listériose'), 'scan : fromage au lait cru + profil grossesse = avertissement rouge expliqué');
verif((await p.textContent('.bandeau.alerte')).includes('lait'), 'scan : allergie au lait signalée');
verif((await p.textContent('.produit')).includes('Pourquoi cette note'), 'scan : détail du « pourquoi »');
verif((await p.textContent('.produit')).includes('ne remplace pas un avis médical'), 'scan : mention « note indicative »');
if (captures) await p.screenshot({ path: `${captures}/produit.png`, fullPage: true });
await p.click('text=Aux courses'); await p.waitForSelector('text=Ajouté à la liste de courses');
await p.click('role=button[name="♡ Favori"]');
verif(await p.locator('role=button[name="♥ Favori"]').count() === 1, 'scan : favori');
const appelsAvant = appelsOFF;
await p.goto(serveur.url + '/#/produit/5449000000996'); await p.waitForSelector('.produit .jauge');
verif((await p.textContent('.additifs')).includes('E951') && (await p.textContent('.additifs')).includes('Risque modéré'), 'scan : additifs classés par niveau de risque');
await p.click('text=Voir des alternatives'); await p.waitForSelector('.alt');
verif((await p.textContent('.alt')).includes('Eau pétillante'), 'scan : alternative mieux notée proposée');
await p.goto(serveur.url + '/#/produit/4006381333931'); await p.waitForSelector('text=Produit inconnu');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await p.evaluate(() => localStorage.removeItem('nutricoach.coach.reglages'));
await p.setInputFiles('input[aria-label="Photo du tableau nutritionnel"]', { name: 'tableau.png', mimeType: 'image/png', buffer: PNG });
await p.waitForSelector('text=ajoutez d\'abord votre clé Gemini');
verif(true, 'scan : photo du tableau sans clé → message clair, aucun appel');
await p.evaluate(() => localStorage.setItem('nutricoach.coach.reglages', JSON.stringify({ cle: 'CLE-TEST', modele: 'gemini-2.5-flash' })));
let corpsImage = null;
await p.route('https://generativelanguage.googleapis.com/**', async (route) => {
  corpsImage = route.request().postData();
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ nom: 'Pain maison', marque: null, kcal: 250, graisses: 2, satures: 0.5, glucides: 48, sucres: 3, fibres: 3, proteines: 8, sel: 1.2, ingredients: 'farine, eau, sel' }) }] } }] }) });
});
await p.setInputFiles('input[aria-label="Photo du tableau nutritionnel"]', { name: 'tableau.png', mimeType: 'image/png', buffer: PNG });
await p.waitForSelector('text=Tableau lu');
verif(corpsImage && corpsImage.includes('inlineData') && corpsImage.includes('image/jpeg'), 'scan : la photo réduite est envoyée à l\'IA');
verif(await p.getByLabel('Énergie (kcal)').inputValue() === '250' && await p.getByLabel('Sel (g)').inputValue() === '1,2' && await p.getByLabel('Nom du produit').inputValue() === 'Pain maison', 'scan : le tableau lu remplit le formulaire (à vérifier par la personne)');
await p.unroute('https://generativelanguage.googleapis.com/**');
await p.getByLabel('Nom du produit').fill('Pain maison');
await p.getByLabel('Énergie (kcal)').fill('250'); await p.getByLabel('Sucres (g)').fill('3'); await p.getByLabel('Graisses saturées (g)').fill('0.5'); await p.getByLabel('Sel (g)').fill('1.2');
await p.click('text=Enregistrer et noter');
await p.waitForSelector('.produit .jauge');
verif((await p.locator('.entete:visible h1').textContent()).includes('Pain maison') && /Note \d+ sur 100/.test(await p.getAttribute('.produit .jauge', 'aria-label')), 'scan : produit inconnu saisi à la main puis noté');
await p.click('text=Partager ce produit avec Open Food Facts');
await p.getByLabel("Nom d'utilisateur Open Food Facts").fill('eymric-test'); await p.getByLabel('Mot de passe Open Food Facts').fill('secret');
let envoiOFF = null;
await p.route('https://world.openfoodfacts.org/cgi/product_jqm2.pl', async (route) => { envoiOFF = route.request().postData(); await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, status_verbose: 'fields saved' }) }); });
await p.click('text=Envoyer à Open Food Facts');
await p.waitForSelector('text=a été envoyé à Open Food Facts');
verif(envoiOFF && envoiOFF.includes('code=4006381333931') && envoiOFF.includes('nutriment_salt=1.2') && envoiOFF.includes('user_id=eymric-test'), 'scan : produit saisi envoyé à Open Food Facts avec les chiffres saisis');
await p.unroute('https://world.openfoodfacts.org/cgi/product_jqm2.pl');
await ctx.route('https://world.openfoodfacts.org/**', (r) => r.abort());
await p.goto(serveur.url + '/#/produit/3017620422003'); await p.waitForSelector('.produit .jauge');
verif(true, 'scan : produit déjà scanné consultable sans réseau');
await p.goto(serveur.url + '/#/scans'); await p.waitForSelector('.sans-marge-liste .carte');
verif(await p.locator('.sans-marge-liste .carte').count() === 3, 'historique : 3 produits scannés');
await p.click('.puce:has-text("Favoris")');
verif(await p.locator('.sans-marge-liste .carte').count() === 1, 'historique : filtre favoris');
await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
verif((await p.textContent('.page-courses')).includes('Camembert de Normandie'), 'scan : le produit est dans la liste de courses commune');

// Suivi : journal, hydratation, poids, bilan de la semaine
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.entete.grand');
const nbMange = await p.locator('[aria-label^="J\'ai mangé"]').count();
if (nbMange > 0) await p.locator('[aria-label^="J\'ai mangé"]').first().click();
await p.goto(serveur.url + '/#/suivi'); await p.waitForSelector('.bilan-jour');
const kcalSuivi = async () => parseInt(await p.textContent('.bilan-jour .grosse-valeur strong'), 10);
const k0 = await kcalSuivi();
verif(nbMange === 0 || k0 > 0, `suivi : « Mangé » depuis l'accueil ajoute le repas au journal (${k0} kcal)`);
await p.locator('section.section:has(h2:text-is("☀️ Déjeuner")) .ajout').click();
await p.click('.ajout-repas .puce:text-is("Libre")');
await p.getByLabel('Qu\'est-ce').fill('Salade composée').catch(async () => p.locator('.ajout-repas input[type=text]').first().fill('Salade composée'));
await p.getByLabel('kcal', { exact: true }).fill('300');
await p.click('.ajout-repas button[type=submit]');
verif(await kcalSuivi() === k0 + 300, 'suivi : repas saisi librement (+300 kcal)');
await p.click('role=button[name="＋ Un verre (250 ml)"]'); await p.click('role=button[name="＋ Un verre (250 ml)"]');
verif((await p.textContent('.hydratation')).includes('500 ml'), 'suivi : hydratation 2 verres = 500 ml');
await p.click('role=button[name="− Retirer"]');
verif((await p.textContent('.hydratation')).includes('250 ml'), 'suivi : un verre retiré');
await p.locator('section.section:has(h2:text-is("🌙 Dîner")) .ajout').click();
await p.click('.ajout-repas .puce:text-is("Produit scanné")');
await p.locator('.ajout-repas .ligne-choix').first().click();
verif(await kcalSuivi() > k0 + 300, 'suivi : produit scanné ajouté au journal (grammes)');
await p.goto(serveur.url + '/#/produit/3017620422003'); await p.waitForSelector('.produit .jauge');
await p.click('.ligne-journal .bouton'); await p.waitForSelector('text=Ajouté au journal');
verif(true, 'scan : « Au journal » depuis la fiche produit');
await p.goto(serveur.url + '/#/recette/' + toutes[5].id); await p.waitForSelector('.fiche h1');
await p.click('text=Je l\'ai mangé');
await p.goto(serveur.url + '/#/suivi'); await p.waitForSelector('.bilan-jour');
verif(await p.locator('.entree-journal').count() >= 4, `suivi : ${await p.locator('.entree-journal').count()} entrées au journal (accueil, libre, scan, recette)`);
const avantSupp = await p.locator('.entree-journal').count();
await p.locator('.entree-journal .supprimer').first().click();
verif(await p.locator('.entree-journal').count() === avantSupp - 1, 'suivi : entrée supprimée');
await p.click('role=tab[name="Poids"]');
await p.waitForSelector('text=Ajouter une pesée');
await p.getByLabel('Poids (kg)').fill('62,4');
await p.click('summary:has-text("Mensurations")'); await p.getByLabel('Tour de taille (cm)').fill('72');
await p.click('role=button[name="Enregistrer"]');
await p.waitForSelector('.courbe');
verif((await p.textContent('.contenu')).includes('62,4 kg') && (await p.textContent('.contenu')).includes('Tour de taille 72 cm'), 'poids : pesée et mensurations enregistrées, courbe affichée');
await p.click('role=tab[name="Semaine"]');
await p.waitForSelector('.stats');
verif((await p.textContent('.stats')).includes('1/7'), 'bilan hebdomadaire : 1 jour suivi sur 7');
verif(!/raté|honte|coupable|interdit/i.test(await p.textContent('.contenu')), 'bilan : ton sans culpabilisation');
if (captures) await p.screenshot({ path: `${captures}/suivi.png`, fullPage: true });

// Enfants : profil, portions conseillées, menus et courses adaptés
await p.goto(serveur.url + '/#/profil/enfants'); await p.waitForSelector('text=Aucun enfant enregistré');
await p.click('text=Ajouter un enfant');
await p.getByLabel('Prénom').fill('Léa');
const naiss5 = new Date(); naiss5.setFullYear(naiss5.getFullYear() - 5); naiss5.setMonth(naiss5.getMonth() - 1);
await p.getByLabel('Date de naissance').fill(naiss5.toISOString().slice(0, 10));
await p.click('.puce.exclu:text-is("Arachides")');
await p.click('role=button[name="Enregistrer"]');
await p.waitForSelector('.carte-nous >> text=Léa');
verif((await p.textContent('.carte-nous')).includes('Évite :') && (await p.textContent('.carte-nous')).includes('Enfant'), 'enfants : profil de Léa (5 ans, évite les arachides)');
await p.goto(serveur.url + '/#/profil'); await p.waitForSelector('.rangs');
verif((await p.locator('.rang:has-text("Enfants")').textContent()).includes('Léa'), 'enfants : rubrique « Enfants » du profil');
await p.goto(serveur.url + '/#/recette/' + toutes[5].id); await p.waitForSelector('text=Portions conseillées pour chacun');
verif((await p.textContent('.fiche')).includes('Portions conseillées pour chacun') && (await p.textContent('.fiche')).includes('Léa'), 'fiche : portions conseillées pour Marie et Léa');
await p.goto(serveur.url + '/#/semaine'); await p.waitForSelector('.actions-semaine');
verif((await p.textContent('.contenu')).includes('Marie et Léa'), 'semaine : menus pensés pour Marie et Léa');
p.once('dialog', (d) => d.accept());
await p.click('text=Tout refaire'); await p.waitForTimeout(500);
const menuLea = await idsSemaine();
verif(menuLea.length === 14 && menuLea.every((id) => { const r = parId.get(id); return !r.allergenes.includes('arachides') && !r.allergenes.includes('lait') && !r.deconseille_a.some((d) => ['enfant', 'femme_enceinte'].includes(d.profil)); }),
  'SÉCURITÉ : menu sans arachides (Léa), sans lait ni avertissement grossesse (Marie), sans avertissement enfant');
await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
await p.click('text=Depuis le menu de la semaine'); await p.waitForTimeout(600);
verif((await p.locator('.page-courses .bandeau').first().textContent()).includes('2,6 portions adultes'), 'courses : 2 adultes + Léa = 2,6 portions adultes');
await p.fill('input[aria-label="Ajouter un article"]', 'cacahuètes'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
verif(await p.locator('.article', { hasText: 'Cacahuètes' }).locator('.alerte-article.rouge .pastille.enfant').count() === 1, 'courses : cacahuètes signalées pour Léa (allergie), pastille enfant');

// Sport : objectif de course, plan par phases, import de séances, charge en glucides
const plusJours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
await p.goto(serveur.url + '/#/sport'); await p.waitForSelector('text=Objectif sportif');
await p.click('.puce:text-is("Marathon")');
await p.getByLabel('Date de l\'épreuve').fill(plusJours(60));
await p.click('role=button[name="Générer mon plan nutritionnel"]');
await p.waitForSelector('.pastille-info');
verif(/J-60/.test(await p.textContent('.pastille-info')) && (await p.textContent('.pastille-info')).includes('Développement'), 'sport : J-60, phase « Développement »');
verif((await p.textContent('.contenu')).includes('Ne testez rien de nouveau'), 'sport : rappel « rien de nouveau le jour J »');
if (captures) await p.screenshot({ path: `${captures}/sport.png`, fullPage: true });
verif(await p.locator('.jour-sport').count() === 14, 'sport : plan des 14 prochains jours');
verif((await p.textContent('.contenu')).includes('g par heure'), 'sport : stratégie de ravitaillement (glucides par heure)');
verif(await p.locator('input[type=file]').count() === 0 && await p.getByText('Ajouter une séance').count() === 0, 'sport : plus d\'import ni de saisie de séances');
await p.click('text=Modifier mon objectif');
await p.getByLabel('Date de l\'épreuve').fill(plusJours(2));
await p.click('role=button[name="Générer mon plan nutritionnel"]');
await p.waitForSelector('.pastille-info');
verif((await p.textContent('.pastille-info')).includes('J-2') && (await p.textContent('.pastille-info')).includes('Semaine de course'), 'sport : J-2, semaine de course');
verif((await p.locator('.jour-sport.special').allTextContents()).filter((t) => /charge glucides/.test(t)).length >= 2, 'sport : charge en glucides affichée sur les 2 jours avant');
verif((await p.textContent('.contenu')).includes('pauvres en fibres'), 'sport : veille de course : repas pauvres en fibres');
await p.goto(serveur.url + '/#/semaine'); await p.waitForSelector('.actions-semaine');
verif((await p.textContent('.contenu')).includes('Menus adaptés à votre préparation sportive'), 'semaine : menus adaptés à la préparation');
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.carte-sport');
verif((await p.textContent('.carte-sport')).includes('J-2'), 'accueil : carte « J-2 » avec les besoins du jour');
await p.goto(serveur.url + '/#/sport'); await p.waitForSelector('.pastille-info');
p.once('dialog', (d) => d.accept());
await p.click('text=Supprimer l\'objectif');
await p.waitForSelector('text=Objectif sportif');
verif(true, 'sport : objectif supprimé');

// Portions par défaut d'une fiche = le foyer (Eymric, Marie et Léa = 3), ajustable sans changer le défaut
await p.goto(serveur.url + '/#/recette/REC-000002'); await p.waitForSelector('.fiche h1');
verif((await p.textContent('output')).startsWith('3 personnes') && (await p.textContent('.fiche')).includes('Eymric, Marie et Léa'), 'fiche : portions par défaut = notre foyer (3 personnes : Eymric, Marie et Léa)');
await p.click('[aria-label="Une personne de plus"]');
verif((await p.textContent('output')).startsWith('4 personnes'), 'fiche : ajustable au moment de la préparation');
const titreAvant = await p.textContent('.fiche h1');
await p.goto(serveur.url + '/#/recette/REC-000003'); await p.waitForFunction((t) => document.querySelector('.fiche h1') && document.querySelector('.fiche h1').textContent !== t, titreAvant);
verif((await p.textContent('output')).startsWith('3 personnes'), 'fiche : l\'ajustement ne change pas le défaut du foyer');
await p.click('.bouton.cuisiner');
await p.waitForSelector('text=pour 3 personnes');
verif(true, 'mode cuisine : ouvert pour 3 personnes');

// Batch cooking : sélection depuis le menu, planning chronométré, boîtes et étiquettes, courses dédiées, stock de plats
await p.goto(serveur.url + '/#/batch'); await p.waitForSelector('.page-batch');
verif(await p.locator('.ligne-batch').count() >= 3, 'batch : recettes du menu proposées');
verif((await p.locator('.reglage-batch').nth(0).textContent()).includes('7 jours'), 'batch : nombre de jours réglable (7 par défaut)');
await p.click('[aria-label="Un jour de plus"]'); await p.click('[aria-label="Un jour de plus"]'); await p.click('[aria-label="Un jour de moins"]');
verif((await p.locator('.reglage-batch').nth(0).textContent()).includes('8 jours') && (await p.textContent('[data-bilan-repas]')).includes('16 à couvrir'), 'batch : on peut choisir le nombre de jours (8 jours = 16 repas à couvrir)');
{ const t = await p.locator('.reglage-batch').nth(1).textContent(); verif(t.includes('3 portions') && t.includes('Eymric, Marie et Léa'), 'batch : portions par repas = la famille (Eymric, Marie et Léa = 3)'); }

await p.locator('.ligne-batch').nth(0).locator('button').nth(1).click(); await p.locator('.ligne-batch').nth(0).locator('button').nth(1).click();
await p.locator('.ligne-batch').nth(1).locator('button').nth(1).click(); await p.locator('.ligne-batch').nth(1).locator('button').nth(1).click();
await p.locator('.ligne-batch').nth(2).locator('button').nth(1).click();
verif((await p.textContent('.ligne-batch >> nth=0')).includes('6 portions'), 'batch : 2 repas × 3 personnes = 6 portions');
await p.click('role=button[name="✨ Préparer la session"]');
await p.waitForSelector('.chrono');
const gain = parseInt(await p.locator('.stats >> nth=0').locator('div').nth(1).locator('strong').textContent(), 10);
verif(gain > 0, `batch : planning chronométré, ${gain} min gagnées en travaillant en parallèle`);
if (captures) await p.screenshot({ path: `${captures}/batch.png`, fullPage: true });
verif(await p.locator('.chrono li.passif').count() > 0 && await p.locator('.chrono li.actif').count() > 0, 'batch : tâches à faire soi-même et tâches passives (four, mijotage)');
verif(/^\d{2}:\d{2}$/.test((await p.locator('.chrono .heure').first().textContent()).trim()), 'batch : heures de la session');
const nbBoites = (await p.locator('.etiquette-carte').allTextContents()).map((t) => parseInt(/(\d+) boîte/.exec(t)[1], 10)).reduce((a, b) => a + b, 0);
verif(nbBoites > 0 && await p.locator('.etiquette-imprimee').count() === nbBoites, `batch : ${nbBoites} boîtes, une étiquette imprimable par boîte`);
verif((await p.textContent('.zone-etiquettes')).includes('Préparé le') && (await p.textContent('.zone-etiquettes')).includes('À consommer avant le'), 'batch : étiquettes avec date de préparation et date limite');
verif((await p.textContent('.page-batch')).includes('Décongeler la veille'), 'batch : conseils de décongélation et de réchauffage');
await p.click('text=Créer la liste de courses de la session');
await p.waitForSelector('text=Liste « Batch cooking du');
await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
await p.click('.selecteur-listes .puce:has-text("Batch cooking")');
verif(await p.locator('.article').count() > 5, 'batch : liste de courses dédiée à la session');
await p.goto(serveur.url + '/#/batch'); await p.waitForSelector('.page-batch');
await p.locator('.ligne-batch').nth(0).locator('button').nth(1).click();
await p.locator('.ligne-batch').nth(0).locator('button').nth(1).click();
await p.click('role=button[name="✨ Préparer la session"]'); await p.waitForSelector('.chrono');
await p.click('text=Session terminée');
await p.waitForSelector('.plat-stock');
const portionsAvant = parseInt(/(\d+) portion/.exec(await p.locator('.plat-stock').first().textContent())[1], 10);
verif(portionsAvant > 0, 'batch : plats préparés ajoutés au stock avec leur date limite');
await p.locator('.plat-stock').first().locator('button:has-text("Mangé 1")').click();
verif(parseInt(/(\d+) portion/.exec(await p.locator('.plat-stock').first().textContent())[1], 10) === portionsAvant - 1, 'batch : « Mangé 1 » retire une portion');
verif((await p.textContent('.plat-stock')).includes('avant le'), 'batch : date limite affichée');

// Semaine : petit-déjeuners et collations, budget, échange de repas ; courses : récurrents ; stock : péremption ; frigo magique
await p.goto(serveur.url + '/#/semaine'); await p.waitForSelector('.actions-semaine');
verif((await p.textContent('.budget-semaine')).includes('€'), 'semaine : budget estimé affiché');
await p.getByLabel('Budget de la semaine').fill('5');
verif((await p.textContent('.budget-semaine')).includes('dépasse votre budget'), 'semaine : alerte quand le menu dépasse le budget');
await p.getByLabel('Budget de la semaine').fill('');
const idsAvant = await idsSemaine();
await p.locator('[aria-label^="Déplacer le"]').first().click();
await p.waitForSelector('text=Choisissez où placer ce repas');
await p.locator('.mini-action:has-text("⇄ Ici")').nth(2).click();
const idsApres = await idsSemaine();
verif(JSON.stringify(idsApres) !== JSON.stringify(idsAvant) && [...idsApres].sort().join() === [...idsAvant].sort().join(), 'semaine : deux repas échangés (mêmes recettes, autres places)');
// Score santé du menu
verif(/Score santé du menu : \d+\/100/.test(await p.textContent('[data-score-semaine]')), 'semaine : score santé du menu affiché');
verif(await p.locator('.jour .badge-sante').count() >= 5, 'semaine : score santé de chaque jour');
// Glisser-déposer avec la poignée (pointer events : doigt ou souris)
{
  const avantGlisse = await idsSemaine();
  const poignees = p.locator('.poignee');
  await poignees.nth(0).scrollIntoViewIfNeeded();
  const cibleEl = p.locator('.repas-jour:has(.poignee)').nth(1);
  const s1 = await poignees.nth(0).boundingBox(); const c1 = await cibleEl.boundingBox();
  await p.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2);
  await p.mouse.down();
  await p.mouse.move(s1.x + s1.width / 2 + 12, s1.y + s1.height / 2 + 12, { steps: 3 });
  await p.mouse.move(c1.x + c1.width / 2, c1.y + c1.height / 2, { steps: 6 });
  verif(await p.locator('.glisser-fantome').count() === 1 && await p.locator('.repas-jour.depot').count() === 1, 'semaine : glisser — un fantôme suit le doigt et la zone visée est surlignée');
  await p.mouse.up();
  await p.waitForTimeout(300);
  const apresGlisse = await idsSemaine();
  verif(JSON.stringify(apresGlisse) !== JSON.stringify(avantGlisse) && [...apresGlisse].sort().join() === [...avantGlisse].sort().join(), 'semaine : glisser-déposer au doigt — deux repas échangés');
  verif(await p.locator('.glisser-fantome').count() === 0, 'semaine : le fantôme disparaît au dépôt');
  const avant2 = await idsSemaine();
  const h = await p.locator('.poignee').nth(0).boundingBox();
  await p.mouse.move(h.x + 5, h.y + 5); await p.mouse.down(); await p.mouse.move(h.x + 40, h.y + 5, { steps: 4 }); await p.mouse.move(2, 2); await p.mouse.up();
  verif(JSON.stringify(await idsSemaine()) === JSON.stringify(avant2), 'semaine : lâcher en dehors d\'un repas n\'change rien');
}
await p.click('.puce:has-text("Petit-déjeuners et collations")');
await p.click('text=Compléter la semaine'); await p.waitForTimeout(600);
const nbSlots = await p.locator('.jour .repas-jour').count();
verif(nbSlots === 28, `semaine : 4 repas par jour avec petit-déjeuner et collation (${nbSlots} repas)`);
const pdj = await p.$$eval('.jour .repas-jour:has(.repas-nom:has-text("Petit-déjeuner")) .mini-lien', (els) => els.map((e) => e.getAttribute('href').split('/').pop()));
verif(pdj.length === 7 && pdj.every((id) => parId.get(id).sous_categorie === 'petit_dejeuner'), 'semaine : 7 petits-déjeuners tirés de la catégorie petit-déjeuner');
await p.click('.puce:has-text("Petit-déjeuners et collations")');

await p.goto(serveur.url + '/#/courses'); await p.waitForSelector('.page-courses');
await p.fill('input[aria-label="Ajouter un article"]', 'yaourts nature'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
await p.locator('.article', { hasText: 'Yaourts nature' }).locator('.article-etoile').click();
await p.locator('.article', { hasText: 'Yaourts nature' }).locator('.supprimer').click();
await p.click('text=Ajouter mes articles récurrents');
verif(await p.locator('.article', { hasText: 'Yaourts nature' }).count() === 1, 'courses : article récurrent remis dans la liste en un geste');
verif((await p.textContent('.budget-ligne')).includes('€'), 'courses : budget estimé');

// stock : péremption -> anti-gaspi -> frigo magique
await p.fill('input[aria-label="Ajouter un article"]', '1 kg de carottes'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
await p.fill('input[aria-label="Ajouter un article"]', '500 g de riz'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
await p.fill('input[aria-label="Ajouter un article"]', '3 oignons'); await p.press('input[aria-label="Ajouter un article"]', 'Enter');
for (const nom of [/carotte/i, /^\s*riz/i, /oignon/i]) await p.locator('.article', { hasText: nom }).first().locator('.case-article').click();
p.once('dialog', (d) => d.accept());
await p.click('text=Terminer les courses'); await p.waitForSelector('text=Courses terminées');
await p.click('role=tab[name="📦 Stock"]');
const demain = new Date(); demain.setDate(demain.getDate() + 1);
await p.getByLabel(/Date de péremption de carotte/i).fill(demain.toISOString().slice(0, 10));
await p.waitForSelector('text=À consommer bientôt');
verif(/carotte/i.test(await p.textContent('.page-courses')), 'stock : la date de péremption déclenche « à consommer bientôt »');
await p.goto(serveur.url + '/#/'); await p.waitForSelector('.carte-sport.gaspi');
verif(/carotte/i.test(await p.textContent('.carte-sport.gaspi')), 'accueil : carte anti-gaspi');
await p.goto(serveur.url + '/#/frigo'); await p.waitForSelector('text=Anti-gaspi');
await p.waitForSelector('.resultat-frigo');
const nbFrigo = await p.locator('.resultat-frigo').count();
if (captures) await p.screenshot({ path: `${captures}/frigo.png`, fullPage: true });
verif(nbFrigo > 0, `frigo magique : ${nbFrigo} recettes possibles avec le stock`);
const titresFrigo = await p.$$eval('.resultat-frigo .mini-lien', (els) => els.map((e) => e.getAttribute('href').split('/').pop()));
verif(titresFrigo.every((id) => !parId.get(id).allergenes.includes('lait') && !parId.get(id).allergenes.includes('arachides')), 'SÉCURITÉ : le frigo magique respecte les allergies de la famille');
verif((await p.locator('.resultat-frigo >> nth=0').textContent()).includes('♻'), 'frigo magique : la première recette utilise ce qui périme');
const manquant = p.locator('.resultat-frigo .lien:has-text("Ajouter aux courses")').first();
if (await manquant.count()) { await manquant.click(); await p.waitForSelector('text=ajouté'); verif(true, 'frigo magique : ingrédients manquants ajoutés aux courses'); }

// Variantes (substitutions), Thermomix, réécriture par l'IA, lecture à voix haute
const avecLait = toutes.find((r) => r.allergenes.includes('lait') && r.ingredients.some((i) => /^(beurre|lait|crème)/i.test(i.aliment)) && r.portions_base !== 2);
await p.goto(serveur.url + '/#/recette/' + avecLait.id); await p.waitForSelector('text=Variantes pour chacun');
verif((await p.textContent('.fiche')).includes('Variantes pour chacun') && (await p.textContent('.fiche')).includes('→'), 'fiche : variantes pour chacun (Marie évite le lait)');
await p.check('.case input');
await p.waitForSelector('text=Estimation recalculée');
verif((await p.textContent('.ingredients')).includes('remplace :'), 'fiche : la recette adaptée remplace les ingrédients (avec rappel de l\'ingrédient d\'origine)');

const th = toutes.find((r) => r.appareil_principal === 'thermomix' && r.etapes.some((e) => e.reglages && e.reglages.temperature === '120°C'));
await p.goto(serveur.url + '/#/recette/' + th.id); await p.waitForSelector('text=Capacité du bol');
if (captures) await p.screenshot({ path: `${captures}/thermo.png`, fullPage: false });
verif(await p.locator('.reglages.thermo span').count() > 3, 'Thermomix : pastilles durée / température / vitesse / sens / accessoire');
verif((await p.textContent('.fiche')).includes('Pesée guidée'), 'Thermomix : pesée guidée');
verif((await p.textContent('.fiche')).includes('120 °C'), 'Thermomix TM6 : 120 °C');
await p.click('.puce:text-is("TM31")');
verif((await p.textContent('.fiche')).includes('100 °C au maximum'), 'Thermomix TM31 : 100 °C au maximum, avertissement');
await p.goto(serveur.url + `/#/cuisine/${th.id}?p=2&m=thermomix&t=TM6`); await p.waitForSelector('.cuisine-corps h2');
await p.click('text=Commencer'); await p.waitForSelector('.reglages.grands.thermo');
verif((await p.textContent('.cuisine-titre')).includes('Thermomix TM6'), 'cuisine : mode pas à pas en version Thermomix avec pastilles');

// réécriture par l'IA (fausse API)
const reponses = [];
await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
  const corps = route.request().postData() || '';
  if (!corps.includes('responseMimeType')) return route.fallback();
  reponses.push(corps);
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"etapes":[{"texte":"Préchauffez l\'airfryer à 180 °C pendant 5 minutes.","duree":"5 min","temperature":"180°C"},{"texte":"Disposez les morceaux dans le panier et cuisez 18 minutes en les retournant à mi-cuisson.","duree":"18 min","temperature":"180°C"}],"remarques":["Ne surchargez pas le panier."]}\n```' }] } }] }) });
});
const four = toutes.find((r) => r.appareil_principal === 'four' && r.portions_base !== 2);
await p.goto(serveur.url + '/#/recette/' + four.id); await p.waitForSelector('text=Méthode de cuisson');
await p.click('.puce:has-text("Airfryer")');
await p.waitForSelector('text=Version proposée par l\'IA');
await p.click('role=button[name="✨ Réécrire pour airfryer"]');
await p.waitForSelector('text=Ne surchargez pas le panier');
verif((await p.textContent('.etapes')).includes('airfryer') && reponses.length === 1, 'IA : étapes réécrites pour l\'airfryer (proposition à vérifier)');
verif(reponses[0].includes('Airfryer') && reponses[0].includes(four.titre.slice(0, 20)), 'IA : la requête contient la méthode cible et la recette');
await p.reload(); await p.waitForSelector('text=Méthode de cuisson'); await p.click('.puce:has-text("Airfryer")');
await p.waitForSelector('text=Ne surchargez pas le panier');
verif(reponses.length === 1, 'IA : réécriture gardée sur le téléphone (aucun nouvel appel, disponible hors ligne)');
await p.goto(serveur.url + `/#/cuisine/${four.id}?p=2&m=airfryer&t=TM6`); await p.waitForSelector('.cuisine-corps h2');
verif((await p.textContent('.cuisine-titre')).includes('version IA'), 'cuisine : version IA signalée « à vérifier »');
await p.click('text=Commencer'); await p.waitForSelector('.cuisine-texte');
verif((await p.textContent('.cuisine-texte')).includes('airfryer'), 'cuisine : étapes de la réécriture');

// Photos des recettes (fausse API Pexels)
let appelsPhotos = 0;
await ctx.route('https://api.pexels.com/**', async (route) => {
  appelsPhotos++;
  const cle = route.request().headers()['authorization'];
  if (cle !== 'CLE-PEXELS-TEST') return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ photos: [{ src: { large: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=' }, photographer: 'Anna Dupont', photographer_url: 'https://www.pexels.com/@anna' }] }) });
});
await p.goto(serveur.url + '/#/recette/' + toutes[20].id); await p.waitForSelector('.fiche h1');
await p.waitForTimeout(600);
verif(await p.locator('.fiche-photo').count() === 0 && appelsPhotos === 0, 'photos : sans clé, pictogramme et aucun appel réseau');
await p.goto(serveur.url + '/#/profil/photos'); await p.waitForSelector('text=Fournisseur principal');
verif((await p.textContent('.contenu')).includes('pexels.com/api'), 'photos : instructions pour obtenir la clé gratuite');
await p.getByLabel(/Clé Pexels/).fill('CLE-PEXELS-TEST');
await p.goto(serveur.url + '/#/recette/' + toutes[21].id); await p.waitForSelector('.fiche-photo');
verif((await p.textContent('.fiche-photo figcaption')).includes('Anna Dupont') && (await p.textContent('.fiche-photo figcaption')).includes('Pexels'), 'photos : photo affichée avec le crédit du photographe');
verif(appelsPhotos === 1, 'photos : une seule recherche à l\'ouverture de la fiche');
await p.goto(serveur.url + '/#/'); await p.goto(serveur.url + '/#/recette/' + toutes[21].id); await p.waitForSelector('.fiche-photo');
verif(appelsPhotos === 1, 'photos : photo gardée en cache (aucun nouvel appel)');
// Miniatures dans la liste des recettes : seulement les cartes visibles, quota protégé, désactivables
const avantListe = appelsPhotos;
await p.goto(serveur.url + '/#/recettes'); await p.waitForSelector('.vignette-photo', { timeout: 8000 });
await p.waitForTimeout(1800);
const nbVign = await p.locator('.vignette-photo').count();
verif(nbVign >= 3 && nbVign <= 14, `miniatures : ${nbVign} photos à la place des pictogrammes dans la liste`);
verif(appelsPhotos - avantListe <= 14, `miniatures : seules les cartes visibles déclenchent une recherche (${appelsPhotos - avantListe} appels, pas 40)`);
const apresListe = appelsPhotos;
await p.goto(serveur.url + '/#/recettes'); await p.waitForTimeout(1200);
verif(appelsPhotos === apresListe, 'miniatures : déjà en cache, aucun nouvel appel au retour sur la liste');
// Préchargement : les favoris reçoivent leur photo sans ouvrir la fiche ni défiler la liste
const avantPre = appelsPhotos;
await p.goto(serveur.url + '/#/'); await p.evaluate(() => localStorage.setItem('nutricoach.favoris', JSON.stringify(['REC-000401', 'REC-000402'])));
await p.reload(); await p.waitForSelector('.entete.grand');
await p.waitForFunction(() => { const c = JSON.parse(localStorage.getItem('nutricoach.photos') || '{}'); return c['REC-000401'] && c['REC-000402']; }, null, { timeout: 12000 }).then(
  () => verif(true, 'préchargement : photos des favoris récupérées en arrière-plan'), () => verif(false, 'préchargement des favoris'));
verif(appelsPhotos - avantPre <= 12, `préchargement : ${appelsPhotos - avantPre} appels (favoris + cartes visibles de l'accueil, pas des centaines)`);
await p.goto(serveur.url + '/#/profil/photos'); await p.click('role=button[name="✓ Miniatures activées"]');
await p.evaluate(() => { localStorage.removeItem('nutricoach.photos'); });
await p.waitForTimeout(800);
const baseOff = appelsPhotos;
await p.goto(serveur.url + '/#/recettes'); await p.waitForSelector('.carte'); await p.waitForTimeout(1500);
verif(await p.locator('.vignette-photo').count() === 0 && appelsPhotos === baseOff, 'miniatures désactivées : pictogrammes et aucun appel');
await p.goto(serveur.url + '/#/profil/photos'); await p.click('role=button[name="Miniatures désactivées"]');
await p.goto(serveur.url + '/#/profil/photos'); await p.getByLabel(/Clé Pexels/).fill('mauvaise');
await p.goto(serveur.url + '/#/recette/' + toutes[1500].id); await p.waitForSelector('text=clé de photos est refusée');
verif(await p.locator('.fiche-hero').count() === 1, 'photos : clé refusée, message clair et pictogramme conservé');
// Deux clés : Pexels en panne (clé refusée) -> Unsplash prend le relais
let appelsUnsplash = 0;
await ctx.route('https://api.unsplash.com/**', async (route) => {
  if (/\/download/.test(route.request().url())) return route.fulfill({ contentType: 'application/json', body: '{}' });
  appelsUnsplash++;
  if (route.request().headers()['authorization'] !== 'Client-ID CLE-UNS-TEST') return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ urls: { regular: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=' }, user: { name: 'Paul Martin', links: { html: 'https://unsplash.com/@paul' } }, links: { download_location: 'https://api.unsplash.com/photos/x/download' } }] }) });
});
await p.goto(serveur.url + '/#/profil/photos'); await p.waitForSelector('text=Fournisseur principal');
await p.getByLabel(/Clé Unsplash/).fill('CLE-UNS-TEST');
verif((await p.textContent('.contenu')).includes('Pexels + Unsplash') || (await p.textContent('.contenu')).includes('Les deux fournisseurs sont activés'), 'photos : les deux clés peuvent être enregistrées');
await p.goto(serveur.url + '/#/recette/' + toutes[1501].id); await p.waitForSelector('.fiche-photo');
verif((await p.textContent('.fiche-photo figcaption')).includes('Paul Martin') && (await p.textContent('.fiche-photo figcaption')).includes('Unsplash') && appelsUnsplash === 1, 'photos : Pexels refuse la clé, Unsplash prend le relais avec son crédit');
await p.goto(serveur.url + '/#/profil'); await p.waitForSelector('.rangs');
verif((await p.locator('.rang:has-text("Photos des recettes")').textContent()).includes('Unsplash'), 'photos : la rubrique du profil indique les fournisseurs activés');
await p.goto(serveur.url + '/#/profil/photos'); await p.getByLabel(/Clé Pexels/).fill(''); await p.getByLabel(/Clé Unsplash/).fill('');

// Plus : sources, thème
await p.goto(serveur.url + '/#/plus'); await p.waitForSelector('.rangs');
await p.click('.puce:text-is("Rose")');
verif(await p.evaluate(() => document.documentElement.dataset.theme) === 'rose', 'thème de couleur changé');
// Restauration d'une sauvegarde : valeurs restaurées, secrets ignorés
await p.setInputFiles('input[aria-label="Restaurer une sauvegarde"]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('pas une sauvegarde') });
await p.waitForSelector('text=pas une sauvegarde');
verif(true, 'restauration : fichier invalide refusé clairement');
await p.evaluate(() => localStorage.setItem('nutricoach.pin', '{"sel":"origine"}'));
p.once('dialog', (d) => d.accept());
await p.setInputFiles('input[aria-label="Restaurer une sauvegarde"]', { name: 's.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ 'nutricoach.theme': '"marine"', 'nutricoach.pin': '{"sel":"pirate"}' })) });
await p.waitForFunction(() => document.documentElement.dataset.theme === 'marine', null, { timeout: 5000 });
verif(await p.evaluate(() => localStorage.getItem('nutricoach.pin')) === '{"sel":"origine"}', 'restauration : données restaurées, le code PIN du téléphone n\'est jamais écrasé');
await p.evaluate(() => localStorage.removeItem('nutricoach.pin'));
await p.reload(); await p.waitForSelector('.carte-profil');
await p.click('.puce:text-is("Rose")');
await p.click('.puce:text-is("Lagon")');
await p.goto(serveur.url + '/#/sources'); await p.waitForSelector('text=Santé publique France');
verif((await p.textContent('.contenu')).includes('lait cru') && (await p.textContent('.contenu')).includes('ne remplacent pas'), 'sources : règles d\'alerte et mention affichées');

// Mes recettes : ajout à la main, import d'un fichier, modèle téléchargeable, export, modification, suppression
await p.goto(serveur.url + '/#/mes-recettes'); await p.waitForSelector('text=Aucune recette pour l\'instant');
await p.click('text=＋ Ajouter une recette');
await p.getByLabel('Titre *').fill('Gratin du dimanche');
await p.getByLabel('Ingrédients').fill('800 g de pommes de terre\n20 cl de crème\n1 gousse d\'ail, hachée');
await p.getByLabel('Étapes').fill('Préchauffer le four à 180 °C.\nCouper et cuire 45 minutes.');
await p.click('role=button[name="Enregistrer la recette"]');
await p.waitForSelector('.fiche h1');
verif((await p.textContent('.fiche h1')) === 'Gratin du dimanche' && (await p.textContent('.fiche')).includes('Recette de la famille'), 'mes recettes : recette ajoutée à la main, fiche affichée');
verif((await p.textContent('.fiche')).includes('Nutrition non renseignée') && (await p.textContent('.fiche')).includes('crème'), 'mes recettes : ingrédients et nutrition absente gérés');
verif((await p.textContent('.fiche')).toLowerCase().includes('lait'), 'mes recettes : allergène « lait » détecté d\'après la crème');
await p.goto(serveur.url + '/#/recettes'); await p.waitForSelector('.carte');
await p.fill('input[type=search]', 'Gratin du dimanche');
await p.waitForTimeout(500);
verif(await p.locator('.carte:has-text("Gratin du dimanche")').count() === 0, 'mes recettes : le profil « sans lait » de Marie exclut ma recette à la crème (filtre d\'allergène sûr)');
await p.click('.profil-applique >> text=Ne pas appliquer');
await p.waitForSelector('.carte:has-text("Gratin du dimanche")');
verif(true, 'mes recettes : la recette est trouvée dans la recherche du catalogue (profil non appliqué)');
await p.click('.profil-applique >> text=Appliquer');
await p.fill('input[type=search]', '');
await p.goto(serveur.url + '/#/mes-recettes');
const dl = p.waitForEvent('download');
await p.click('text=Télécharger le modèle de fichier');
const modele = JSON.parse(await (await import('node:fs/promises')).readFile(await (await dl).path(), 'utf8'));
verif(Array.isArray(modele.recettes) && modele.recettes[0].titre && modele._valeurs_autorisees.unites.includes('g'), 'mes recettes : modèle de fichier téléchargeable (recette d\'exemple et valeurs autorisées)');
await p.setInputFiles('input[aria-label="Importer un fichier de recettes"]', { name: 'modele.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ recettes: [...modele.recettes, { titre: 'Sans étapes', ingredients: ['1 oeuf'] }] })) });
await p.waitForSelector('text=prête à importer');
verif((await p.textContent('.apercu-import')).includes('Gratin de courgettes') && (await p.textContent('.apercu-import')).includes('Sans étapes'), 'mes recettes : aperçu avant import, recette invalide signalée');
await p.click('role=button[name="Importer 1 recette"]');
await p.waitForSelector('text=1 recette importée');
verif(await p.locator('.page-mes-recettes .article').count() === 2, 'mes recettes : fichier importé (2 recettes au total)');
const dl2 = p.waitForEvent('download');
await p.click('text=Exporter mes recettes');
const exp = JSON.parse(await (await import('node:fs/promises')).readFile(await (await dl2).path(), 'utf8'));
verif(exp.recettes.length === 2 && !('id' in exp.recettes[0]), 'mes recettes : export de mes recettes (sans identifiant interne)');
await p.click('[aria-label="Modifier Gratin du dimanche"]');
await p.getByLabel('Titre *').fill('Gratin dauphinois');
await p.click('role=button[name="Enregistrer les modifications"]');
await p.waitForSelector('.fiche h1:has-text("Gratin dauphinois")');
verif(true, 'mes recettes : modification enregistrée');
await p.goto(serveur.url + '/#/mes-recettes');
p.once('dialog', (d) => d.accept());
await p.click('[aria-label="Supprimer Gratin dauphinois"]');
await p.waitForFunction(() => document.querySelectorAll('.page-mes-recettes .article').length === 1);
verif(true, 'mes recettes : suppression');
await p.click('[aria-label="Supprimer Gratin de courgettes (exemple)"]').catch(() => {});


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
