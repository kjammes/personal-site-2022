// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.jayeshkarli.dev',
  trailingSlash: 'never',
  // Keeps the overlay out of /studio screen recordings.
  devToolbar: { enabled: false },
  build: { format: 'file' },
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !page.includes('/studio/'),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: false,
      // Code blocks can scroll sideways, so keyboard users need to be able to focus them.
      transformers: [
        {
          pre(node) {
            node.properties.tabindex = 0;
          },
        },
      ],
    },
  },
});
