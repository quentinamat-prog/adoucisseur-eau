import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import siteConfig from '../site.config.mjs';

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

async function fetchUnsplashImage(query, filename, width = 1200, excludeIds = []) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) { console.warn('UNSPLASH_ACCESS_KEY manquant.'); return null; }

  const ctx = siteConfig.article.unsplashContext;
  const pickPhoto = (results) => (results ?? []).find(p => !excludeIds.includes(p.id));

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' ' + ctx)}&per_page=10&orientation=landscape&content_filter=high`;
  console.log(`Unsplash search: "${query + ' ' + ctx}"${excludeIds.length ? ` (exclude ${excludeIds.length})` : ''}`);

  let searchRes;
  try { searchRes = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } }); }
  catch (e) { console.warn(`Unsplash fetch error: ${e.message}`); return null; }

  if (!searchRes.ok) {
    const body = await searchRes.text();
    console.warn(`Unsplash API ${searchRes.status}: ${body}`);
    return null;
  }

  const data = await searchRes.json();
  let photo = pickPhoto(data.results);

  // Fallback : réessaie avec les 2 premiers mots si aucun résultat (non-exclus)
  if (!photo) {
    console.warn(`Aucun résultat pour "${query}", tentative avec requête simplifiée...`);
    const fallbackQuery = encodeURIComponent(query.split(' ').slice(0, 2).join(' ') + ' ' + ctx);
    const fallbackRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${fallbackQuery}&per_page=10&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    ).catch(() => null);
    const fallbackData = fallbackRes?.ok ? await fallbackRes.json() : null;
    photo = pickPhoto(fallbackData?.results);
    if (!photo) { console.warn(`Aucune photo Unsplash même en fallback pour "${query}"`); return null; }
  }

  // Demande directement le WebP à Unsplash
  const webpUrl = `${photo.urls.raw}&w=${width}&fm=webp&q=82`;
  let imgRes;
  try { imgRes = await fetch(webpUrl); }
  catch (e) { console.warn(`Download error: ${e.message}`); return null; }
  if (!imgRes.ok) { console.warn(`Image download ${imgRes.status}`); return null; }

  const webpFilename = filename.replace(/\.jpg$/, '.webp');
  const imgDir = path.join(__dirname, '..', 'public', 'images', 'blog');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, webpFilename), Buffer.from(await imgRes.arrayBuffer()));

  // Obligatoire selon les CGU Unsplash
  await fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${accessKey}` } }).catch(() => {});

  console.log(`✓ Image téléchargée : ${webpFilename} (${photo.user.name}) [${width}px]`);
  return { id: photo.id, filename: webpFilename, photographer: photo.user.name, photographerUrl: photo.user.links.html, width };
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

function buildImageHtml(webPath, alt, title, photographer, photographerUrl, width = 1200) {
  const height = Math.round(width * 2 / 3); // ratio 3:2 landscape
  const utmSource = siteConfig.name.toLowerCase().replace(/\s+/g, '');
  return `<figure>
<img src="${webPath}" alt="${alt}" title="${title}" width="${width}" height="${height}" loading="lazy" />
<figcaption>Photo de <a href="${photographerUrl}?utm_source=${utmSource}&utm_medium=referral" rel="nofollow" target="_blank">${photographer}</a> sur <a href="https://unsplash.com?utm_source=${utmSource}&utm_medium=referral" rel="nofollow" target="_blank">Unsplash</a></figcaption>
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
        content: `Tu es expert SEO pour ${siteConfig.name}, ${siteConfig.article.context}.

Propose UN nouveau sujet d'article de blog original, en français, optimisé SEO, en lien avec ${siteConfig.article.theme}.

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
      content: `Pour cet article de blog sur ${siteConfig.name} (${siteConfig.article.context}) :
Titre : "${title}"

Réponds en JSON uniquement, sans markdown :
{
  "category": "une valeur parmi : ${siteConfig.categories.join(', ')}",
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

  // Maillage interne dynamique — liste des articles existants
  const blogDir = path.join(__dirname, '..', 'src', 'content', 'blog');
  const existingArticles = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.md') && !f.includes(slug))
    .map(f => {
      const content = fs.readFileSync(path.join(blogDir, f), 'utf8');
      const titleMatch = content.match(/^title:\s*"(.+)"/m);
      const articleSlug = f.replace('.md', '');
      return titleMatch ? { title: titleMatch[1], slug: articleSlug } : null;
    })
    .filter(Boolean);

  let internalLinks = `- [${siteConfig.name}](/) — page d'accueil du site\n- [notre blog](/blog/) — tous nos articles`;

  if (existingArticles.length > 0) {
    const articleList = existingArticles.map(a => `"${a.title}" -> /blog/${a.slug}/`).join('\n');
    const linkMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Nouvel article : "${title}" (mot-clé : "${meta.kw}")

Articles existants :
${articleList}

Choisis les 3 articles les plus pertinents à lier naturellement depuis le nouvel article.
Réponds en JSON sans markdown : [{"title": "...", "path": "/blog/slug/", "anchor": "texte du lien naturel 3-5 mots"}]`
      }]
    });

    try {
      const raw = linkMsg.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
      const picks = JSON.parse(raw);
      const dynamicLinks = picks.map(p => `- [${p.anchor}](${p.path}) — ${p.title}`).join('\n');
      internalLinks += '\n' + dynamicLinks;
      console.log(`Liens internes construits :\n${internalLinks}`);
    } catch (e) {
      console.warn(`Maillage dynamique échoué (${e.message}), réponse : ${linkMsg.content[0].text.slice(0, 200)}`);
    }
  }

  const prompt = `Tu es un rédacteur SEO expert spécialisé dans la thématique suivante : ${siteConfig.article.theme}. Tu travailles pour **${siteConfig.name}**, ${siteConfig.article.context}.

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
4. **Conclusion + CTA** (80-100 mots) - synthèse et invitation à ${siteConfig.article.cta}

## RÈGLES E-E-A-T
- **Expertise** : chiffres concrets, vocabulaire professionnel culinaire
- **Experience** : "chez ${siteConfig.name}, nous avons constaté...", retour d'expérience réel
- **Autorité** : structure claire, contenu actionnable et non générique
- **Confiance** : ton honnête, nuances quand pertinent

## MAILLAGE INTERNE — RÈGLE ABSOLUE
Tu DOIS intégrer CHACUN de ces liens dans le corps du texte (pas en liste, de manière naturelle dans une phrase) :
${internalLinks}

Aucun lien ne peut être omis. Chaque lien doit apparaître une fois dans le texte rédigé.

## BALISAGE MARKDOWN
- **Gras** : termes clés, chiffres importants, conseils actionnables (3-5 fois par section)
- *Italique* : termes techniques ou étrangers
- Listes : quand 3+ éléments énumérés
- > Citations : pour un conseil fort ou une stat marquante
- Interdiction absolue d'utiliser le caractère "—" (tiret cadratin), utilise "-" à la place

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

  // Image contenu 1 — après la 1ère section H2 (900px)
  const img1Query = headings[0] ?? meta.kw;
  const img1Data = await fetchUnsplashImage(img1Query, `${slug}-1.jpg`, 900, coverData ? [coverData.id] : []);
  let img1Seo = null;
  if (img1Data) {
    img1Seo = await generateImageSeo(title, meta.kw, headings[0] ?? 'section 1', client);
    const img1Html = buildImageHtml(`/images/blog/${img1Data.filename}`, img1Seo.alt, img1Seo.title, img1Data.photographer, img1Data.photographerUrl, 900);
    rawContent = injectAfterSection(rawContent, 1, img1Html);
  }

  // Image contenu 2 — après la 3ème section H2 (900px)
  const img2Heading = headings[2] ?? headings[1] ?? meta.kw;
  const usedIds = [coverData?.id, img1Data?.id].filter(Boolean);
  const img2Data = await fetchUnsplashImage(img2Heading, `${slug}-2.jpg`, 900, usedIds);
  let img2Seo = null;
  if (img2Data) {
    img2Seo = await generateImageSeo(title, meta.kw, img2Heading, client);
    const img2Html = buildImageHtml(`/images/blog/${img2Data.filename}`, img2Seo.alt, img2Seo.title, img2Data.photographer, img2Data.photographerUrl, 900);
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
    ? `image: "/images/blog/${coverData.filename}"\nimageAlt: "${coverSeo.alt}"\nimageTitle: "${coverSeo.title}"\n`
    : '';

  const frontmatter = `---
title: "${title}"
description: "${description}"
pubDate: ${today}
author: "${siteConfig.article.author}"
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
