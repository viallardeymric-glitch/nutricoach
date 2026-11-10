// Pièces jointes du coach : photo (réduite), PDF ou fichier texte. Rien n'est gardé : elles ne sont envoyées qu'avec la question en cours.
import { reduireImage } from './image.js';

export const MAX_PIECES = 4;
export const MAX_PDF_OCTETS = 8 * 1024 * 1024;
export const MAX_TEXTE = 20000;

/** Type de pièce d'après le fichier : 'image' | 'pdf' | 'texte' | null (non pris en charge). */
export function typeDePiece(nom, mime) {
  const n = String(nom || '').toLowerCase();
  if (/^image\//.test(mime || '') || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(n)) return 'image';
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (/^text\//.test(mime || '') || /\.(txt|md|csv|json)$/.test(n)) return 'texte';
  return null;
}

const versBase64 = (fichier) => new Promise((resolve, reject) => {
  const lecteur = new FileReader();
  lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
  lecteur.onerror = () => reject(new Error('Fichier illisible.'));
  lecteur.readAsDataURL(fichier);
});

/** Fichier → { nom, type, mime?, data? (base64) , texte? }. Lève une Error au message lisible. */
export async function preparerPiece(fichier) {
  const type = typeDePiece(fichier.name, fichier.type);
  if (!type) throw new Error(`« ${fichier.name || 'Ce fichier'} » n'est pas pris en charge (photo, PDF ou fichier texte).`);
  if (type === 'image') return { nom: fichier.name || 'photo', type, mime: 'image/jpeg', data: await reduireImage(fichier, 1600, 0.85) };
  if (type === 'pdf') {
    if (fichier.size > MAX_PDF_OCTETS) throw new Error('Ce PDF est trop lourd (8 Mo maximum).');
    return { nom: fichier.name, type, mime: 'application/pdf', data: await versBase64(fichier) };
  }
  const texte = (await fichier.text()).slice(0, MAX_TEXTE);
  if (!texte.trim()) throw new Error('Ce fichier est vide.');
  return { nom: fichier.name, type, texte };
}

/** Texte de la question enrichi du contenu des fichiers texte joints. */
export function texteAvecPieces(texte, pieces) {
  const docs = (pieces || []).filter((p) => p.type === 'texte').map((p) => `\n\n--- Document « ${p.nom} » ---\n${p.texte}`);
  return (texte + docs.join('')).trim();
}
