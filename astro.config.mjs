import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { remarkAlert } from 'remark-github-blockquote-alert';
import fs from 'node:fs';
import path from 'node:path';
import siteConfig from './site.config.mjs';

// Précalcule lastmod par article depuis le frontmatter (updatedDate ou pubDate)
function getBlogDates() {
  const map = new Map();
  const blogDir = path.join(process.cwd(), 'src/content/blog');
  if (!fs.existsSync(blogDir)) return map;
  for (const file of fs.readdirSync(blogDir)) {
    if (!file.endsWith('.md')) continue;
    const slug = file.replace(/\.md$/, '');
    const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const upd = content.match(/^updatedDate:\s*(.+)$/m)?.[1];
    const pub = content.match(/^pubDate:\s*(.+)$/m)?.[1];
    const dateStr = (upd || pub || '').trim().replace(/^["']|["']$/g, '');
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (!isNaN(d.valueOf())) map.set(slug, d.toISOString());
  }
  return map;
}
const blogDates = getBlogDates();

export default defineConfig({
  site: siteConfig.url,
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        // Pour les articles de blog, utilise la date du frontmatter
        const m = item.url.match(/\/blog\/([^/]+)\/?$/);
        if (m && blogDates.has(m[1])) {
          item.lastmod = blogDates.get(m[1]);
          item.priority = 0.8;
        }
        return item;
      },
    }),
  ],
  prefetch: {
    defaultStrategy: 'hover',
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'always',
  },
  markdown: {
    remarkPlugins: [remarkAlert],
  },
});
