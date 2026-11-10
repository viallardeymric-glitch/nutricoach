// Génère docs/recettes-exemples.md : 15 recettes du catalogue qui illustrent le schéma (Thermomix, apéros, desserts, batch, sport…).
import { writeFileSync } from 'node:fs';
import { lireRecettes } from './build-index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const toutes = Object.values(lireRecettes()).flat();
const dejaPris = new Set();
const prendre = (n, test) => toutes.filter((r) => !dejaPris.has(r.id) && test(r)).slice(0, n).map((r) => { dejaPris.add(r.id); return r; });
const groupes = [
  ['Thermomix (vraies étapes réglées)', prendre(5, (r) => r.appareil_principal === 'thermomix' && r.etapes.some((e) => e.reglages && e.reglages.vitesse) && r.etapes.length >= 5)],
  ['Apéros', prendre(2, (r) => r.categorie === 'Apéros')],
  ['Desserts', prendre(2, (r) => r.categorie === 'Desserts')],
  ['Batch cooking', prendre(2, (r) => r.sous_categorie === 'batch')],
  ['Sport (régime « sportif »)', prendre(2, (r) => r.regimes_compatibles.includes('sportif'))],
  ['Autres : végétarien et sans gluten', [...prendre(1, (r) => r.regimes_compatibles.includes('vegan')), ...prendre(1, (r) => r.regimes_compatibles.includes('sans_gluten') && r.regimes_compatibles.includes('vegetarien'))]],
];
let md = `# Recettes d'exemple

Quinze recettes du catalogue (\`data/recettes.json\`) qui illustrent le schéma décrit dans \`docs/schema-recette.md\`. Elles sont choisies automatiquement par \`node scripts/exemples.mjs\`.

`;
for (const [titre, liste] of groupes) {
  md += `## ${titre}\n\n`;
  for (const r of liste) {
    const n = r.nutrition_par_portion;
    md += `- **${r.titre}** (\`${r.id}\`) — ${r.categorie} · ${r.sous_categorie} · ${r.temps.total_min} min · ${r.portions_base} portions · ${Math.round(n.calories_kcal)} kcal, ${n.proteines_g} g de protéines par portion · appareil : ${r.appareil_principal} · régimes : ${r.regimes_compatibles.join(', ')} · allergènes : ${r.allergenes.join(', ') || 'aucun'}\n`;
  }
  md += '\n';
}
const total = groupes.reduce((n, g) => n + g[1].length, 0);
md += `Total : ${total} recettes. Pour voir une fiche complète : ouvrez \`#/recette/<identifiant>\` dans l'appli.\n`;
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(join(racine, 'docs', 'recettes-exemples.md'), md);
console.log(`docs/recettes-exemples.md : ${total} recettes`);
