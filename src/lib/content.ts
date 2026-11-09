import { getCollection, type CollectionEntry } from 'astro:content';

/** Drafts are visible in `astro dev` and excluded from production builds. */
const visible = (draft: boolean) => import.meta.env.DEV || !draft;

export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => visible(data.draft));
  // Ties break on id so the order, and therefore every pagination cursor, is stable between builds.
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.id.localeCompare(b.id));
}

/** Posts per page on /blog. Later pages load as the reader scrolls. */
export const PAGE_SIZE = 10;

/** The fields a post list needs. Used for the JSON pages behind infinite scroll. */
export interface PostSummary {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  video: boolean;
  draft: boolean;
}

export function toSummary(p: CollectionEntry<'blog'>): PostSummary {
  return {
    id: p.id,
    title: p.data.title,
    description: p.data.description,
    pubDate: p.data.pubDate.toISOString(),
    video: Boolean(p.data.youtubeId),
    draft: p.data.draft,
  };
}

/**
 * Cursor pagination: the cursor is the id of the last post the reader has seen.
 * Returns up to PAGE_SIZE posts after it, plus the cursor for the page after that (null at the end).
 */
export function pageAfter(posts: CollectionEntry<'blog'>[], index: number) {
  const page = posts.slice(index + 1, index + 1 + PAGE_SIZE);
  const next = index + 1 + PAGE_SIZE < posts.length ? page[page.length - 1].id : null;
  return { posts: page, next };
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
