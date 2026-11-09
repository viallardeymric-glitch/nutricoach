// Open Food Facts (gratuit, sans clé) : un produit par code-barres, et des alternatives de la même catégorie.
import { lireProduitOFF, noterProduit } from '../lib/scan.js';

const BASE = 'https://world.openfoodfacts.org';
const CHAMPS = ['code', 'product_name', 'product_name_fr', 'brands', 'quantity', 'image_front_small_url', 'image_front_url', 'ingredients_text',
  'ingredients_text_fr', 'allergens_tags', 'traces_tags', 'additives_tags', 'nutriscore_grade', 'nova_group', 'ecoscore_grade', 'labels_tags',
  'categories_tags', 'ingredients_analysis_tags', 'nutriments'].join(',');

async function appelerJson(url, appeler, delai) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), delai);
  try {
    const rep = await appeler(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (rep.status === 404) return { status: 0 };
    if (!rep.ok) throw new Error(`Open Food Facts a répondu ${rep.status}`);
    return await rep.json();
  } finally { clearTimeout(t); }
}

/** Produit compact, ou null s'il n'existe pas dans la base. Lève une Error en cas de réseau coupé ou trop lent. */
export async function chargerProduitOFF(code, { appeler = fetch, delai = 8000 } = {}) {
  let json;
  try { json = await appelerJson(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${CHAMPS}`, appeler, delai); }
  catch { throw new Error('Impossible de joindre Open Food Facts. Vérifiez votre connexion.'); }
  return lireProduitOFF(code, json);
}

/** Meilleurs produits de la même catégorie (note supérieure d'au moins `ecart` points), du mieux noté au moins bien. */
export async function chercherAlternatives(produit, { appeler = fetch, delai = 8000, ecart = 10, max = 3 } = {}) {
  const categorie = (produit.categories || []).slice(-1)[0];
  if (!categorie) return [];
  let json;
  try {
    json = await appelerJson(`${BASE}/api/v2/search?categories_tags=${encodeURIComponent('en:' + categorie)}&sort_by=nutriscore_score&page_size=24&fields=${CHAMPS}`, appeler, delai);
  } catch { throw new Error('Impossible de joindre Open Food Facts. Vérifiez votre connexion.'); }
  const note0 = noterProduit(produit).note;
  return (json.products || [])
    .map((p) => lireProduitOFF(p.code, { status: 1, product: p }))
    .filter((p) => p && p.code !== produit.code && p.nom !== 'Produit sans nom' && p.nutrition.kcal != null)
    .map((p) => ({ produit: p, note: noterProduit(p).note }))
    .filter((x) => x.note >= note0 + ecart)
    .sort((a, b) => b.note - a.note)
    .slice(0, max);
}
