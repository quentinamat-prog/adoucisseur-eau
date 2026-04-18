import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOPICS_FILE = path.join(__dirname, 'topics.json');
const DONE_FILE = path.join(__dirname, 'topics-done.json');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function pickNextTopic() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  const done = JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'));
  const doneTitles = done.map(d => d.title.toLowerCase().trim());

  const next = topics.find(t => !doneTitles.includes(t.toLowerCase().trim()));
  if (!next) {
    console.log('Tous les sujets ont déjà été traités. Ajoutez de nouveaux sujets dans topics.json.');
    process.exit(0);
  }
  return next;
}

function markAsDone(title, date) {
  const done = JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'));
  done.push({ title, publishedAt: date });
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2), 'utf8');
}

async function generateArticle() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const title = pickNextTopic();
  const today = todayISO();
  const slug = slugify(title);

  const filePath = path.join(__dirname, '..', 'src', 'content', 'blog', `${slug}.md`);
  if (fs.existsSync(filePath)) {
    console.log(`Fichier déjà existant: ${slug}.md — marqué comme fait et on passe.`);
    markAsDone(title, today);
    process.exit(0);
  }

  console.log(`Génération de l'article : "${title}"`);

  // Demander à Claude de définir catégorie, tags et mot-clé
  const metaMsg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Pour cet article de blog sur Gustichef (app de chefs privés à domicile en France) :
Titre : "${title}"

Réponds en JSON uniquement, sans markdown :
{
  "category": "une valeur parmi : Conseils, Chefs, Recettes, Nutrition, Événements",
  "tags": ["tag1", "tag2", "tag3"],
  "kw": "mot-clé principal SEO (3-5 mots)"
}`
    }]
  });

  let meta = { category: 'Conseils', tags: ['chef privé', 'domicile'], kw: title };
  try {
    meta = JSON.parse(metaMsg.content[0].text.trim());
  } catch {
    console.warn('Impossible de parser les métadonnées, utilisation des valeurs par défaut.');
  }

  // Liens internes existants
  const internalLinksRaw = [
    { url: '/', label: 'Gustichef', desc: "page d'accueil de l'application" },
    { url: '/blog/', label: 'notre blog culinaire', desc: 'tous nos articles' },
    { url: '/blog/comment-choisir-chef-prive/', label: 'comment choisir son chef privé', desc: 'guide complet' },
    { url: '/blog/avantages-cuisine-domicile/', label: 'les avantages de la cuisine à domicile', desc: 'pourquoi opter pour un chef' },
    { url: `/blog/${slug}/`, label: null, desc: null },
  ];
  const internalLinks = internalLinksRaw
    .filter(l => !l.url.includes(slug) && l.label)
    .map(l => `- [${l.label}](${l.url}) — ${l.desc}`)
    .join('\n');

  const prompt = `Tu es un rédacteur SEO expert spécialisé en gastronomie et en expériences culinaires à domicile. Tu travailles pour **Gustichef**, une application française qui connecte des chefs privés avec des particuliers pour des expériences culinaires sur mesure.

## MISSION
Rédige un article de blog long-format, de haute qualité éditoriale, optimisé pour le référencement Google selon les critères **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness).

## SUJET
- **Titre** : ${title}
- **Mot-clé principal** : ${meta.kw}
- **Catégorie** : ${meta.category}

## STRUCTURE OBLIGATOIRE (dans cet ordre)
1. **Introduction** (150-180 mots) — accroche avec un constat ou une question, inclure le mot-clé principal dans les 100 premiers mots
2. **3 à 4 sections H2** — chaque section avec 150-200 mots, sous-titres H3 si pertinent
3. **Section FAQ** — titre H2 "Questions fréquentes", 3 questions/réponses en format ### Question / réponse courte
4. **Conclusion + CTA** (80-100 mots) — synthèse et invitation à télécharger Gustichef

## RÈGLES E-E-A-T
- **Expertise** : chiffres concrets, vocabulaire professionnel culinaire
- **Experience** : "chez Gustichef, nous avons constaté...", retour d'expérience réel
- **Autorité** : structure claire, contenu actionnable et non générique
- **Confiance** : ton honnête, nuances quand pertinent

## BALISAGE MARKDOWN
- **Gras** : termes clés, chiffres importants, conseils actionnables (3-5 fois par section)
- *Italique* : termes techniques ou étrangers
- Listes : quand 3+ éléments énumérés
- > Citations : pour un conseil fort ou une stat marquante

## MAILLAGE INTERNE (2 à 3 liens obligatoires, intégrés naturellement)
${internalLinks}

## LONGUEUR
800 à 1000 mots. Pas de titre H1. Commencer directement par l'introduction.`;

  const articleMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = articleMsg.content[0].text;

  // Meta description optimisée
  const descMsg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Écris une meta description SEO de 150 caractères maximum pour cet article. Inclure le mot-clé "${meta.kw}". Retourne UNIQUEMENT la meta description, sans guillemets.
Titre : ${title}`
    }]
  });

  const description = descMsg.content[0].text.trim().replace(/"/g, "'").slice(0, 155);

  const frontmatter = `---
title: "${title}"
description: "${description}"
pubDate: ${today}
author: "Équipe Gustichef"
category: ${meta.category}
tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]
featured: false
---

`;

  fs.writeFileSync(filePath, frontmatter + content, 'utf8');
  markAsDone(title, today);

  console.log(`Article sauvegardé : ${filePath}`);
  console.log(`Mots : ~${content.split(/\s+/).length}`);
}

generateArticle().catch(err => {
  console.error(err);
  process.exit(1);
});
