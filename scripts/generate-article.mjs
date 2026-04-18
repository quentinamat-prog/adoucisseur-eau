import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOPICS = [
  { title: "Comment choisir le bon chef privé pour votre événement", category: "Conseils", tags: ["chef privé", "événement", "conseils"], kw: "chef privé événement" },
  { title: "Dîner romantique à domicile : idées et inspiration", category: "Événements", tags: ["dîner romantique", "domicile", "couple"], kw: "dîner romantique domicile" },
  { title: "Les cuisines du monde à portée de main avec un chef privé", category: "Chefs", tags: ["cuisine du monde", "chef privé", "gastronomie"], kw: "cuisines du monde chef privé" },
  { title: "Organiser un repas de fête inoubliable sans stress", category: "Conseils", tags: ["fête", "organisation", "repas"], kw: "repas de fête chef à domicile" },
  { title: "Chef privé vs traiteur : quelle option choisir ?", category: "Conseils", tags: ["chef privé", "traiteur", "comparatif"], kw: "chef privé vs traiteur" },
  { title: "Les tendances culinaires 2026 à découvrir chez vous", category: "Chefs", tags: ["tendances", "gastronomie", "2026"], kw: "tendances culinaires 2026" },
  { title: "Anniversaire gourmet : comment surprendre vos invités", category: "Événements", tags: ["anniversaire", "gourmet", "invités"], kw: "anniversaire chef privé domicile" },
  { title: "Cuisine italienne authentique à domicile : les secrets des chefs", category: "Recettes", tags: ["cuisine italienne", "domicile", "recettes"], kw: "cuisine italienne chef domicile" },
  { title: "Comment devenir chef privé : parcours et conseils", category: "Chefs", tags: ["chef privé", "carrière", "conseils"], kw: "devenir chef privé France" },
  { title: "Repas de famille réussi : l'apport d'un chef à domicile", category: "Événements", tags: ["famille", "repas", "chef à domicile"], kw: "repas famille chef domicile" },
  { title: "La cuisine fusion : quand les cultures se rencontrent dans votre assiette", category: "Recettes", tags: ["fusion", "culture", "gastronomie"], kw: "cuisine fusion chef privé" },
  { title: "Soirée entre amis : idées de menus originaux avec un chef", category: "Événements", tags: ["amis", "menu", "soirée"], kw: "soirée entre amis chef privé" },
  { title: "Les bienfaits d'une alimentation personnalisée par un chef nutritionniste", category: "Nutrition", tags: ["nutrition", "alimentation", "santé"], kw: "chef nutritionniste domicile" },
  { title: "Cuisine japonaise à domicile : les essentiels à connaître", category: "Recettes", tags: ["cuisine japonaise", "domicile", "gastronomie"], kw: "cuisine japonaise chef domicile" },
  { title: "Comment évaluer un chef privé : critères et questions à poser", category: "Conseils", tags: ["évaluation", "chef privé", "qualité"], kw: "évaluer chef privé critères" },
  { title: "Menus de saison printemps 2026 : ce que proposent les chefs", category: "Recettes", tags: ["saison", "printemps", "menu"], kw: "menu printemps chef domicile" },
  { title: "L'essor du chef privé en France : chiffres et tendances", category: "Chefs", tags: ["chef privé", "France", "marché"], kw: "chef privé France tendances" },
  { title: "Cuisine végétarienne gastronomique : les meilleurs chefs parisiens", category: "Chefs", tags: ["végétarien", "gastronomie", "Paris"], kw: "chef végétarien domicile Paris" },
  { title: "Baptême et communion : idées repas avec un chef à domicile", category: "Événements", tags: ["baptême", "communion", "famille"], kw: "chef domicile baptême communion" },
  { title: "Comment préparer sa maison pour accueillir un chef privé", category: "Conseils", tags: ["logistique", "préparation", "chef privé"], kw: "préparer maison chef privé" },
];

// Pages existantes pour le maillage interne
const INTERNAL_LINKS = [
  { url: "/", label: "Gustichef", desc: "page d'accueil de l'application" },
  { url: "/blog/", label: "notre blog culinaire", desc: "tous nos articles" },
  { url: "/blog/comment-choisir-chef-prive/", label: "comment choisir son chef privé", desc: "guide complet pour choisir un chef" },
  { url: "/blog/avantages-cuisine-domicile/", label: "les avantages de la cuisine à domicile", desc: "pourquoi opter pour un chef à domicile" },
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
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const weekNumber = Math.floor(dayOfYear / 7);
  return TOPICS[weekNumber % TOPICS.length];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function buildInternalLinksContext(currentSlug) {
  return INTERNAL_LINKS
    .filter(l => !l.url.includes(currentSlug))
    .map(l => `- [${l.label}](${l.url}) — ${l.desc}`)
    .join('\n');
}

async function generateArticle() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const topic = pickTopic();
  const today = todayISO();
  const slug = slugify(topic.title);

  const filePath = path.join(__dirname, '..', 'src', 'content', 'blog', `${slug}.md`);
  if (fs.existsSync(filePath)) {
    console.log(`Article already exists: ${slug}.md — skipping.`);
    process.exit(0);
  }

  console.log(`Generating article: "${topic.title}"`);

  const internalLinks = buildInternalLinksContext(slug);

  const prompt = `Tu es un rédacteur SEO expert spécialisé en gastronomie et en expériences culinaires à domicile. Tu travailles pour **Gustichef**, une application française qui connecte des chefs privés avec des particuliers pour des expériences culinaires sur mesure.

## MISSION
Rédige un article de blog long-format, de haute qualité éditoriale, optimisé pour le référencement Google selon les critères **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness).

## SUJET
- **Titre H1** (ne pas inclure, il est dans le frontmatter) : ${topic.title}
- **Mot-clé principal** : ${topic.kw}
- **Catégorie** : ${topic.category}
- **Tags** : ${topic.tags.join(', ')}

## STRUCTURE OBLIGATOIRE (dans cet ordre)
1. **Introduction** (150-180 mots) — accroche avec un constat ou une question, présenter le problème que l'article résout, inclure le mot-clé principal dans les 100 premiers mots
2. **3 à 4 sections H2** — chaque section avec 150-200 mots, peut contenir des sous-titres H3 si pertinent
3. **Section FAQ** — titre H2 "Questions fréquentes", 3 questions/réponses en format ### Question / réponse courte (bon pour les featured snippets Google)
4. **Conclusion + CTA** (80-100 mots) — synthèse et invitation à télécharger Gustichef

## RÈGLES DE RÉDACTION E-E-A-T
- **Expertise** : cite des faits concrets, des chiffres plausibles (ex: "selon une étude, 78% des Français..."), utilise un vocabulaire professionnel culinaire
- **Experience** : écris à la première personne du pluriel ("chez Gustichef, nous avons constaté..."), donne l'impression d'un vrai retour d'expérience
- **Autorité** : structure claire, sous-titres explicites, contenu actionnable et non générique
- **Confiance** : ton honnête, mentionne les limites ou nuances quand c'est pertinent, pas de survente

## RÈGLES DE BALISAGE MARKDOWN
- **Gras** : mettre en gras les **termes clés**, les **chiffres importants**, les **conseils actionnables** (3-5 fois par section max, pas de surcharge)
- *Italique* : pour les termes techniques ou étrangers (ex: *mise en place*, *tasting menu*)
- Listes à puces ou numérotées : utiliser quand il y a 3+ éléments énumérés
- Citations : utiliser le format > pour mettre en avant un conseil fort ou une stat marquante

## MAILLAGE INTERNE OBLIGATOIRE
Intègre **2 à 3 liens internes** de manière naturelle dans le texte (pas tous dans la conclusion). Utilise exactement ces URLs et labels :
${internalLinks}

Exemple d'intégration naturelle : "...c'est pourquoi nous avons développé [Gustichef](/) pour simplifier cette démarche."

## LONGUEUR CIBLE
**800 à 1000 mots** (hors frontmatter). Un article trop court ne rankera pas.

## FORMAT DE RÉPONSE
Retourne UNIQUEMENT le contenu Markdown, sans frontmatter YAML, en commençant directement par l'introduction. Pas de titre H1.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].text;

  // Generate a proper meta description (150-160 chars)
  const descPrompt = `Écris une meta description SEO pour cet article en exactement 150 caractères maximum. Elle doit inclure le mot-clé "${topic.kw}" et donner envie de cliquer. Retourne UNIQUEMENT la meta description, sans guillemets ni ponctuation finale.

Titre de l'article : ${topic.title}`;

  const descMsg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: descPrompt }],
  });

  const description = descMsg.content[0].text.trim().replace(/"/g, "'").slice(0, 155);

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
  console.log(`Word count: ~${content.split(/\s+/).length} words`);
}

generateArticle().catch(err => {
  console.error(err);
  process.exit(1);
});
