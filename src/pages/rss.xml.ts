import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '@/lib/content';
import { site } from '@/data/site';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((p) => !p.data.draft);
  return rss({
    title: `${site.name}, blog`,
    description: 'Interactive deep dives into backend systems, data at scale and AI-assisted engineering.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/blog/${p.id}`,
      categories: p.data.tags,
    })),
  });
}
