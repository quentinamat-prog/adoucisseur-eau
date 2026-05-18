import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { remarkAlert } from 'remark-github-blockquote-alert';
import siteConfig from './site.config.mjs';

export default defineConfig({
  site: siteConfig.url,
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
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
