import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts, pageAfter, toSummary, type PostSummary } from '@/lib/content';

/**
 * One JSON file per post: /blog/feed/<post-id>.json lists the posts that come after it.
 * Every post is a valid cursor, so a reader whose page is older than the latest deploy
 * still gets the right next page instead of a gap or duplicates.
 */
export const getStaticPaths = (async () => {
  const posts = await getPosts();
  return posts.slice(0, -1).map((post, i) => {
    const { posts: page, next } = pageAfter(posts, i);
    return { params: { cursor: post.id }, props: { posts: page.map(toSummary), next } };
  });
}) satisfies GetStaticPaths;

interface Props {
  posts: PostSummary[];
  next: string | null;
}

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(JSON.stringify(props), { headers: { 'Content-Type': 'application/json' } });
