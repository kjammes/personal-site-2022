import { site } from '@/data/site';

/** Whole years elapsed since an ISO date, evaluated at build time. */
export function yearsSince(iso: string, now = new Date()): number {
  const start = new Date(iso);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, Math.floor(months / 12));
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

let leetcodePromise: Promise<number | null> | undefined;

/**
 * Solved-problem count from LeetCode's public GraphQL API, fetched once per build.
 * Returns null on any failure so the page can hide the stat instead of showing a wrong number.
 * A scheduled Netlify build hook keeps it fresh.
 */
export function leetcodeSolved(): Promise<number | null> {
  leetcodePromise ??= (async () => {
    try {
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
        body: JSON.stringify({
          query:
            'query($u:String!){matchedUser(username:$u){submitStatsGlobal{acSubmissionNum{difficulty count}}}}',
          variables: { u: site.leetcodeUsername },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: { matchedUser?: { submitStatsGlobal?: { acSubmissionNum?: { difficulty: string; count: number }[] } } };
      };
      const all = json.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum?.find((d) => d.difficulty === 'All');
      return typeof all?.count === 'number' ? all.count : null;
    } catch {
      return null;
    }
  })();
  return leetcodePromise;
}
