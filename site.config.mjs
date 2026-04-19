/**
 * ============================================================
 *  CONFIGURATION DU SITE — à modifier pour chaque nouveau site
 * ============================================================
 */
const config = {
  // Identité
  name: 'Gustichef',
  url: 'https://gustichef.com',
  description: "Gustichef – La plateforme qui connecte chefs privés et particuliers pour des expériences culinaires uniques à domicile.",

  // Réseaux sociaux (laisser vide '' si inexistant)
  socials: {
    instagram: 'https://www.instagram.com/gustichef',
    tiktok: 'https://www.tiktok.com/@gustichef',
  },

  // Catégories du blog (exactement 5 recommandé)
  categories: ['Conseils', 'Chefs', 'Recettes', 'Nutrition', 'Événements'],

  // Génération d'articles IA
  article: {
    // Qui est ce site ? (utilisé dans le prompt Claude)
    context: "une application française qui connecte des chefs privés avec des particuliers pour des expériences culinaires sur mesure à domicile",
    // Thématique principale des articles
    theme: "la cuisine à domicile, les chefs privés, la gastronomie et les événements culinaires",
    // CTA de fin d'article
    cta: "Téléchargez l'application Gustichef",
    // Auteur affiché dans le frontmatter
    author: "Équipe Gustichef",
    // Mot-clé ajouté aux recherches Unsplash pour cadrer les images
    unsplashContext: "cuisine gastronomie",
  },
};

export default config;
