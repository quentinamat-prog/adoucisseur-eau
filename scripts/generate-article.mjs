import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOPICS_FILE = path.join(__dirname, 'topics.json');

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

function parseTopics() {
  const raw = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  // Accepte "titre simple" ou { title, publishedAt }
  const topics = raw.map(t => typeof t === 'string' ? { title: t } : t);
  const todo = topics.filter(t => !t.publishedAt).map(t => t.title);
  return { todo };
}

function markAsDone(title, date) {
  const raw = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  const updated = raw.map(t => {
    const currentTitle = typeof t === 'string' ? t : t.title;
    if (currentTitle === title) return { title, publishedAt: date };
    return t;
  });
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(updated, null, 2), 'utf8');
}

async function fetchUnsplashImage(query, filename) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) { console.warn('UNSPLASH_ACCESS_KEY manquant.'); return null; }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' cuisine')}&per_page=3&orientation=landscape&content_filter=high`;
  console.log(`Unsplash search: "${query + ' cuisine'}"`);

  let searchRes;
  try { searchRes = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } }); }
  catch (e) { console.warn(`Unsplash fetch error: ${e.message}`); return null; }

  if (!searchRes.ok) {
    const body = await searchRes.text();
    console.warn(`Unsplash API ${searchRes.status}: ${body}`);
    return null;
  }

  const data = await searchRes.json();
  const photo = data.results?.[0];
  if (!photo) { console.warn(`Aucune photo Unsplash pour "${query}"`); return null; }

  let imgRes;
  try { imgRes = await fetch(photo.urls.regular); }
  catch (e) { console.warn(`Download error: ${e.message}`); return null; }
  if (!imgRes.ok) { console.warn(`Image download ${imgRes.status}`); return null; }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const imgDir = path.join(__dirname, '..', 'public', 'images', 'blog');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, filename), buffer);

  // Obligatoire selon les CGU Unsplash
  await fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${accessKey}` } }).catch(() => {});

  console.log(`✓ Image téléchargée : ${filename} (${photo.user.name})`);
  return { filename, photographer: photo.user.name, photographerUrl: photo.user.links.html };
}

async function generateImageSeo(title, kw, context, client) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Pour une image illustrant un article de blog intitulé "${title}" (mot-clé : "${kw}"), dans la section "${context}", génère en JSON sans markdown :
{"alt": "texte alt SEO, 10-15 mots, inclut le mot-clé naturellement", "title": "attribut title HTML, 8-12 mots, complémentaire à l'alt"}`
    }]
  });
  try { return JSON.parse(msg.content[0].text.trim()); }
  catch { return { alt: `${kw} - ${context}`, title: title }; }
}

function extractH2Headings(content) {
  return [...content.matchAll(/^## (.+)$/gm)].map(m => m[1]);
}

function injectAfterSection(content, sectionIndex, imageHtml) {
  // Split on H2 headings, inject at end of target section
  const parts = content.split(/(?=\n## )/);
  if (sectionIndex >= parts.length) return content;
  // Inject before the next section (append to end of this section)
  parts[sectionIndex] = parts[sectionIndex].trimEnd() + '\n\n' + imageHtml + '\n';
  return parts.join('');
}

function buildImageHtml(webPath, alt, title, photographer, photographerUrl) {
  return `<figure>
<img src="${webPath}" alt="${alt}" title="${title}" loading="lazy" />
<figcaption>Photo de <a href="${photographerUrl}?utm_source=gustichef&utm_medium=referral" rel="nofollow" target="_blank">${photographer}</a> sur <a href="https://unsplash.com?utm_source=gustichef&utm_medium=referral" rel="nofollow" target="_blank">Unsplash</a></figcaption>
</figure>`;
}

async function generateArticle() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let { todo } = parseTopics();

  if (todo.length === 0) {
    console.log('Liste vide — génération automatique d\'un nouveau sujet...');

    const raw = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
    const doneTitles = raw
      .filter(t => typeof t === 'object' && t.publishedAt)
      .map(t => `"${t.title}"`)
      .join(', ');

    const topicMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Tu es expert SEO pour Gustichef, une app qui connecte des chefs privés avec des particuliers en France.

Propose UN nouveau sujet d'article de blog original, en français, optimisé SEO, en lien avec la cuisine à domicile, les chefs privés, la gastronomie ou les événements culinaires.

Sujets déjà traités : ${doneTitles}

Retourne UNIQUEMENT le titre du sujet, sans guillemets ni ponctuation finale.`
      }]
    });

    const newTitle = topicMsg.content[0].text.trim();
    console.log(`Nouveau sujet généré : "${newTitle}"`);

    const updated = raw.concat([newTitle]);
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    todo = [newTitle];
  }

  const title = todo[0];
  const today = todayISO();
  const slug = slugify(title);

  const filePath = path.join(__dirname, '..', 'src', 'content', 'blog', `${slug}.md`);
  if (fs.existsSync(filePath)) {
    console.log(`Fichier déjà existant: ${slug}.md — marqué comme fait.`);
    markAsDone(title, today);
    process.exit(0);
  }

  console.log(`Génération : "${title}"`);

  // Claude définit catégorie, tags et mot-clé
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
    const raw = metaMsg.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    meta = JSON.parse(raw);
  } catch {
    console.warn('Métadonnées par défaut utilisées.');
  }

  const internalLinks = [
    `- [Gustichef](/) — page d'accueil de l'application`,
    `- [notre blog culinaire](/blog/) — tous nos articles`,
    `- [comment choisir son chef privé](/blog/comment-choisir-chef-prive/) — guide complet`,
    `- [les avantages de la cuisine à domicile](/blog/avantages-cuisine-domicile/) — pourquoi opter pour un chef`,
  ].filter(l => !l.includes(slug)).join('\n');

  const prompt = `Tu es un rédacteur SEO expert spécialisé en gastronomie et en expériences culinaires à domicile. Tu travailles pour **Gustichef**, une application française qui connecte des chefs privés avec des particuliers pour des expériences culinaires sur mesure.

## MISSION
Rédige un article de blog long-format, de haute qualité éditoriale, optimisé pour le référencement Google selon les critères **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness).

## SUJET
- **Titre** : ${title}
- **Mot-clé principal** : ${meta.kw}
- **Catégorie** : ${meta.category}

## STRUCTURE OBLIGATOIRE (dans cet ordre)
1. **Introduction** (150-180 mots) - accroche avec un constat ou une question, inclure le mot-clé principal dans les 100 premiers mots
2. **3 à 4 sections H2** - chaque section avec 150-200 mots, sous-titres H3 si pertinent
3. **Section FAQ** - titre H2 "Questions fréquentes", puis 3 accordéons HTML avec ce format EXACT (pas de markdown, HTML pur) :
<details>
<summary>La question ici ?</summary>
<p>La réponse complète ici en une ou deux phrases.</p>
</details>
4. **Conclusion + CTA** (80-100 mots) - synthèse et invitation à télécharger Gustichef

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
- Interdiction absolue d'utiliser le caractère "—" (tiret cadratin), utilise "-" à la place

## MAILLAGE INTERNE (2 à 3 liens obligatoires, intégrés naturellement)
${internalLinks}

## LONGUEUR
800 à 1000 mots. Pas de titre H1. Commencer directement par l'introduction.`;

  const articleMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  let rawContent = articleMsg.content[0].text.replace(/—/g, '-');

  // Extraire les Q&A pour le schema FAQ
  const faqItems = [];
  const detailsRegex = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  let match;
  while ((match = detailsRegex.exec(rawContent)) !== null) {
    faqItems.push({
      q: match[1].trim(),
      a: match[2].trim().replace(/<[^>]+>/g, '').trim(),
    });
  }

  // --- Images Unsplash ---
  const headings = extractH2Headings(rawContent);

  // Image de couverture
  const coverData = await fetchUnsplashImage(meta.kw, `${slug}.jpg`);
  let coverSeo = null;
  if (coverData) {
    coverSeo = await generateImageSeo(title, meta.kw, 'couverture', client);
  }

  // Image contenu 1 — après la 1ère section H2
  const img1Query = headings[0] ?? meta.kw;
  const img1Data = await fetchUnsplashImage(img1Query, `${slug}-1.jpg`);
  let img1Seo = null;
  if (img1Data) {
    img1Seo = await generateImageSeo(title, meta.kw, headings[0] ?? 'section 1', client);
    const img1Html = buildImageHtml(`/images/blog/${slug}-1.jpg`, img1Seo.alt, img1Seo.title, img1Data.photographer, img1Data.photographerUrl);
    rawContent = injectAfterSection(rawContent, 1, img1Html);
  }

  // Image contenu 2 — après la 3ème section H2 (ou 2ème si moins)
  const img2Heading = headings[2] ?? headings[1] ?? meta.kw;
  const img2Data = await fetchUnsplashImage(img2Heading, `${slug}-2.jpg`);
  let img2Seo = null;
  if (img2Data) {
    img2Seo = await generateImageSeo(title, meta.kw, img2Heading, client);
    const img2Html = buildImageHtml(`/images/blog/${slug}-2.jpg`, img2Seo.alt, img2Seo.title, img2Data.photographer, img2Data.photographerUrl);
    rawContent = injectAfterSection(rawContent, 3, img2Html);
  }

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

  const faqYaml = faqItems.length > 0
    ? `faq:\n${faqItems.map(f => `  - q: "${f.q.replace(/"/g, "'")}"\n    a: "${f.a.replace(/"/g, "'")}"`).join('\n')}\n`
    : '';

  const imageFrontmatter = coverData && coverSeo
    ? `image: "/images/blog/${slug}.jpg"\nimageAlt: "${coverSeo.alt}"\nimageTitle: "${coverSeo.title}"\n`
    : '';

  const frontmatter = `---
title: "${title}"
description: "${description}"
pubDate: ${today}
author: "Équipe Gustichef"
category: ${meta.category}
tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]
featured: false
${imageFrontmatter}${faqYaml}---

`;

  fs.writeFileSync(filePath, frontmatter + rawContent, 'utf8');
  markAsDone(title, today);

  console.log(`Article sauvegardé : ${filePath}`);
  console.log(`Mots : ~${rawContent.split(/\s+/).length}`);
}

generateArticle().catch(err => {
  console.error(err);
  process.exit(1);
});
