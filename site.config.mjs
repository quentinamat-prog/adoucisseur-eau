/**
 * ============================================================
 *  CONFIGURATION DU SITE — à modifier pour chaque nouveau site
 * ============================================================
 */
const config = {
  // Identité
  name: 'Adoucisseur-eau.fr',
  url: 'https://www.adoucisseur-eau.fr',
  // Logo : partie principale + partie colorée
  logoPrefix: 'Adoucisseur',
  logoSuffix: '-eau.fr',
  description: "Adoucisseur-eau.fr – Conseils, guides et comparatifs pour choisir et entretenir votre adoucisseur d'eau.",

  // Réseaux sociaux (laisser vide '' si inexistant)
  socials: {
    instagram: '',
    tiktok: '',
  },

  // Catégories du blog (exactement 5 recommandé)
  categories: ['Guide d\'achat', 'Installation', 'Entretien', 'Eau & Santé', 'Comparatif'],

  // Génération d'articles IA
  article: {
    // Qui est ce site ? (utilisé dans le prompt Claude)
    context: "un site français de conseil et d'information sur les adoucisseurs d'eau, destiné aux particuliers qui veulent lutter contre le calcaire et améliorer la qualité de leur eau",
    // Thématique principale des articles
    theme: "les adoucisseurs d'eau, le calcaire, la dureté de l'eau, l'entretien des équipements, les économies d'énergie et la qualité de l'eau à domicile",
    // CTA de fin d'article
    cta: "Découvrez notre guide complet sur les adoucisseurs d'eau",
    // Auteur affiché dans le frontmatter
    author: "Équipe Adoucisseur-eau.fr",
    // Mot-clé ajouté aux recherches Unsplash pour cadrer les images
    unsplashContext: "water home plumbing",
  },
};

export default config;
