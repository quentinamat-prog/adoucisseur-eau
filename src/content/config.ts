import { defineCollection, z } from 'astro:content';
import siteConfig from '../../site.config.mjs';

const categories = siteConfig.categories as [string, ...string[]];

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default(siteConfig.article.author),
    category: z.enum(categories),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageTitle: z.string().optional(),
    featured: z.boolean().default(false),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  }),
});

export const collections = { blog };
