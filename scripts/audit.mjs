// Audit de l'appli au format téléphone : débordements, erreurs console, cibles tactiles, accessibilité (axe-core), pages lentes.
// Usage : mkdir /tmp/axe && cd /tmp/axe && npm init -y && npm i axe-core ; puis node scripts/audit.mjs /tmp/axe  (axe n'est PAS une dépendance de l'appli).
import { chargerPlaywright, servir, modeLocal } from './_navigateur.mjs';
import { readFileSync } from 'node:fs';
const axeSrc = readFileSync((process.argv[2] || '.') + '/node_modules/axe-core/axe.min.js', 'utf8');
const { chromium } = chargerPlaywright();
const srv = await servir();
const b = await chromium.launch();
const ROUTES = ['#/', '#/recettes', '#/recette/REC-000010', '#/semaine', '#/courses', '#/suivi', '#/scan', '#/coach', '#/grossesse', '#/plus', '#/profil', '#/profil/infos', '#/profil/situation', '#/profil/regimes', '#/profil/enfants', '#/profil/photos', '#/profil/coach', '#/sport', '#/batch', '#/frigo', '#/favoris', '#/scans', '#/sources', '#/mes-recettes', '#/recette-nouvelle', '#/cuisine/REC-000010?p=3', '#/produit/3017620422003', '#/profil/objectifs', '#/profil/securite', '#/nous'];
const rapport = { debordements: [], erreurs: [], petitesCibles: {}, axe: {}, lents: [] };
for (const [nom, opts] of [['clair-390', { viewport: { width: 390, height: 844 }, colorScheme: 'light' }], ['sombre-360', { viewport: { width: 360, height: 740 }, colorScheme: 'dark' }]]) {
  const ctx = await b.newContext({ ...opts, deviceScaleFactor: 1, bypassCSP: true });   // la CSP de l'appli bloquerait l'injection d'axe-core
  await modeLocal(ctx);
  await ctx.route('https://**', (r) => (r.request().url().startsWith(srv.url) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push('pageerror ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && erreurs.push(m.text()));
  await p.goto(srv.url + '/#/'); await p.click('text=Je suis Marie'); await p.waitForTimeout(500);
  await p.goto(srv.url + '/#/profil/infos'); await p.click('.puce:text-is("Femme")');
  for (const r of ROUTES) {
    const t0 = Date.now();
    await p.goto(srv.url + '/' + r); await p.waitForTimeout(900);
    const dt = Date.now() - t0;
    if (dt > 2500) rapport.lents.push(`${r} ${dt} ms`);
    const d = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
      const larg = document.documentElement.clientWidth;
      const deb = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > larg + 1 && !e.closest('.defilement, .puces, .onglets-internes, pre, .zone-etiquettes')).slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' → ' + Math.round(e.getBoundingClientRect().right));
      const cibles = [...document.querySelectorAll('a, button, input:not([type=hidden]), select, textarea, summary')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 40 || r.height < 40) && !e.closest('.zone-etiquettes') && !(e.tagName === 'A' && e.classList.contains('mini-lien')); }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 28) + ` ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      return { deb, cibles };
    });
    if (d.deb.length) rapport.debordements.push(`${nom} ${r}: ${d.deb.join(' | ')}`);
    for (const c of d.cibles) (rapport.petitesCibles[c.replace(/ \d+x\d+$/, '')] = rapport.petitesCibles[c.replace(/ \d+x\d+$/, '')] || new Set()).add(`${r} ${c.match(/\d+x\d+$/)[0]}`);
    await p.addScriptTag({ content: axeSrc });
    const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'], resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map((n) => n.target.join(' ').slice(0, 70)), aide: v.help })));
    for (const v of res) { const k = `${v.id} [${v.impact}] ${v.aide}`; (rapport.axe[k] = rapport.axe[k] || []).push(`${nom} ${r} ×${v.n} ${v.ex[0]}`); }
  }
  rapport.erreurs.push(...[...new Set(erreurs)].map((e) => `${nom}: ${e}`));
  await ctx.close();
}
await b.close(); srv.fermer();
console.log('DÉBORDEMENTS', rapport.debordements.length); rapport.debordements.slice(0, 15).forEach((x) => console.log('  ', x));
console.log('ERREURS CONSOLE', rapport.erreurs.length); rapport.erreurs.forEach((x) => console.log('  ', x.slice(0, 200)));
console.log('PAGES LENTES', rapport.lents);
console.log('PETITES CIBLES (<40 px)'); Object.entries(rapport.petitesCibles).slice(0, 25).forEach(([k, v]) => console.log('  ', k, '→', [...v].slice(0, 3).join(' ; ')));
console.log('AXE'); Object.entries(rapport.axe).forEach(([k, v]) => console.log('  ', k, `(${v.length} pages)`, '\n      ', v.slice(0, 2).join('\n       ')));
