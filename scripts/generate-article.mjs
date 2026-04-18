import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOPICS = [
  { title: "Comment choisir le bon chef privé pour votre événement", category: "Conseils", tags: ["chef privé", "événement", "conseils"] },
  { title: "Dîner romantique à domicile : idées et inspiration", category: "Événements", tags: ["dîner romantique", "domicile", "couple"] },
  { title: "Les cuisines du monde à portée de main avec un chef privé", category: "Chefs", tags: ["cuisine du monde", "chef privé", "gastronomie"] },
  { title: "Organiser un repas de fête inoubliable sans stress", category: "Conseils", tags: ["fête", "organisation", "repas"] },
  { title: "Chef privé vs traiteur : quelle option choisir ?", category: "Conseils", tags: ["chef privé", "traiteur", "comparatif"] },
  { title: "Les tendances culinaires 2026 à découvrir chez vous", category: "Chefs", tags: ["tendances", "gastronomie", "2026"] },
  { title: "Anniversaire gourmet : comment surprendre vos invités", category: "Événements", tags: ["anniversaire", "gourmet", "invités"] },
  { title: "Cuisine italienne authentique à domicile : les secrets des chefs", category: "Recettes", tags: ["cuisine italienne", "domicile", "recettes"] },
  { title: "Comment devenir chef privé : parcours et conseils", category: "Chefs", tags: ["chef privé", "carrière", "conseils"] },
  { title: "Repas de famille réussi : l'apport d'un chef à domicile", category: "Événements", tags: ["famille", "repas", "chef à domicile"] },
  { title: "La cuisine fusion : quand les cultures se rencontrent dans votre assiette", category: "Recettes", tags: ["fusion", "culture", "gastronomie"] },
  { title: "Soirée entre amis : idées de menus originaux avec un chef", category: "Événements", tags: ["amis", "menu", "soirée"] },
  { title: "Les bienfaits d'une alimentation personnalisée par un chef nutritionniste", category: "Nutrition", tags: ["nutrition", "alimentation", "santé"] },
  { title: "Cuisine japonaise à domicile : les essentiels à connaître", category: "Recettes", tags: ["cuisine japonaise", "domicile", "gastronomie"] },
  { title: "Comment évaluer un chef privé : critères et questions à poser", category: "Conseils", tags: ["évaluation", "chef privé", "qualité"] },
  { title: "Menus de saison printemps 2026 : ce que proposent les chefs", category: "Recettes", tags: ["saison", "printemps", "menu"] },
  { title: "L'essor du chef privé en France : chiffres et tendances", category: "Chefs", tags: ["chef privé", "France", "marché"] },
  { title: "Cuisine végétarienne gastronomique : les meilleurs chefs parisiens", category: "Chefs", tags: ["végétarien", "gastronomie", "Paris"] },
  { title: "Baptême et communion : idées repas avec un chef à domicile", category: "Événements", tags: ["baptême", "communion", "famille"] },
  { title: "Comment préparer sa maison pour accueillir un chef privé", category: "Conseils", tags: ["logistique", "préparation", "chef privé"] },
];

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function pickTopic() {
  // Use day-of-year to pick a different topic each week
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const weekNumber = Math.floor(dayOfYear / 7);
  return TOPICS[weekNumber % TOPICS.length];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

async function generateArticle() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const topic = pickTopic();
  const today = todayISO();
  const slug = slugify(topic.title);

  // Check if article already exists
  const filePath = path.join(__dirname, '..', 'src', 'content', 'blog', `${slug}.md`);
  if (fs.existsSync(filePath)) {
    console.log(`Article already exists: ${slug}.md — skipping.`);
    process.exit(0);
  }

  console.log(`Generating article: "${topic.title}"`);

  const prompt = `Tu es un expert en gastronomie et en marketing de contenu. Rédige un article de blog complet, informatif et optimisé SEO pour Gustichef, une application qui connecte des chefs privés avec des particuliers en France.

Sujet : "${topic.title}"
Catégorie : ${topic.category}
Tags : ${topic.tags.join(', ')}
Date : ${today}

Contraintes :
- Langue : français
- Longueur : 600 à 900 mots
- Style : conversationnel mais expert, chaleureux, accessible
- Structure : introduction accrocheuse, 3-4 sections avec titres H2, conclusion avec CTA vers Gustichef
- SEO : utilise les mots-clés naturellement, varie les formulations
- Ton : positif, engageant, donne envie d'utiliser Gustichef

Retourne UNIQUEMENT le contenu Markdown de l'article, sans le frontmatter YAML, en commençant directement par l'introduction (pas de titre H1, il est dans le frontmatter).`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].text;

  const description = `Découvrez ${topic.title.toLowerCase()}. Conseils, astuces et inspiration pour une expérience culinaire inoubliable avec Gustichef.`;

  const frontmatter = `---
title: "${topic.title}"
description: "${description}"
pubDate: ${today}
author: "Équipe Gustichef"
category: ${topic.category}
tags: [${topic.tags.map(t => `"${t}"`).join(', ')}]
featured: false
---

`;

  fs.writeFileSync(filePath, frontmatter + content, 'utf8');
  console.log(`Article saved: ${filePath}`);
}

generateArticle().catch(err => {
  console.error(err);
  process.exit(1);
});
