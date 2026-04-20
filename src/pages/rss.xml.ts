import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import siteConfig from '../../site.config.mjs';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  return rss({
    title: `Blog ${siteConfig.name}`,
    description: siteConfig.description,
    site: context.site ?? siteConfig.url,
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/blog/${post.slug}/`,
        categories: [post.data.category, ...post.data.tags],
        author: post.data.author,
      })),
    customData: '<language>fr-FR</language>',
    stylesheet: undefined,
  });
}
