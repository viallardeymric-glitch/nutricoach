// Sources officielles des règles d'alerte. Version des règles : à incrémenter à chaque relecture.
export const VERSION_REGLES = '2026-11';
export const SOURCES = [
  { id: 'SPF', nom: 'Santé publique France', url: 'https://www.santepubliquefrance.fr', sujet: 'Listériose, alcool et grossesse' },
  { id: 'ANSES', nom: 'ANSES', url: 'https://www.anses.fr', sujet: 'Sécurité des aliments, mercure dans les poissons, caféine, additifs' },
  { id: 'HAS', nom: 'Haute Autorité de santé', url: 'https://www.has-sante.fr', sujet: 'Recommandations de suivi, grossesse' },
  { id: 'PNNS', nom: 'PNNS / Manger Bouger', url: 'https://www.mangerbouger.fr', sujet: 'Repères nutritionnels (sel, sucre, fibres…)' },
];
export const MENTION_GENERALE = 'Ces informations sont générales et ne remplacent pas l\'avis d\'un médecin, d\'une sage-femme ou d\'un diététicien.';
export const MENTION_SCAN = 'Note indicative qui ne remplace pas un avis médical ou diététique.';
