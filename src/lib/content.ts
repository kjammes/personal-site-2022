import { getCollection, type CollectionEntry } from 'astro:content';

/** Drafts are visible in `astro dev` and excluded from production builds. */
const visible = (draft: boolean) => import.meta.env.DEV || !draft;

export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => visible(data.draft));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getCaseStudies(): Promise<CollectionEntry<'work'>[]> {
  const items = await getCollection('work', ({ data }) => visible(data.draft));
  return items.sort((a, b) => a.data.order - b.data.order);
}

export function slugifyTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function readingMinutes(body: string | undefined): number {
  const words = (body ?? '').replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
