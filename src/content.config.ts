import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    /** YouTube video ID of the companion video. Adds an embed and VideoObject structured data. */
    youtubeId: z.string().optional(),
    videoUploadDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(200),
    role: z.string(),
    period: z.string(),
    stack: z.array(z.string()).default([]),
    metrics: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, work };
