# jayeshkarli.dev

Personal site and blog. Astro static site with MDX articles and interactive React widgets, deployed on Netlify.

```sh
npm install
npm run dev      # http://localhost:4321, drafts visible
npm run build    # type checks, then static build to dist/
```

## Layout

| Path | What it is |
| --- | --- |
| `src/data/site.ts` | Profile, experience, stack, projects, socials, booking link |
| `src/content/blog/` | Articles (`.mdx`). `draft: true` keeps a post out of production |
| `src/content/work/` | Case studies, one per file. Copy an existing one to start a new one |
| `src/components/viz/` | Interactive widgets, shared speed control, panel primitives |
| `src/pages/studio/` | Full-screen scripted widget playback for video recording |
| `src/styles/global.css` | Design tokens and prose styles |

## Writing an interactive article

1. Build the widget in `src/components/viz/` using `VizFrame`, `Group` and `Btn`. Give each control group a colour.
2. Import it in the MDX file and mount it with `client:visible`.
3. In the prose, wrap phrases that refer to a control in `<Hl c="green">...</Hl>` using the same colour.
4. Give the widget a `script` prop that plays a sequence automatically, and register it in `src/pages/studio/[widget].astro`.
5. Record `/studio/<widget>?speed=1` at 1920x1080 or 3840x2160 for the YouTube video.
6. Once the video is live, add `youtubeId` to the post frontmatter. That adds the embed and VideoObject structured data.

## Stats

Experience years are computed at build time from `careerStart` and `codingStart`. The LeetCode count is fetched at build time and hidden if the request fails. Add a Netlify build hook on a daily schedule to keep both fresh.

## Domain

The canonical origin is `https://www.jayeshkarli.dev`. `netlify.toml` permanently redirects `blog.jayeshkarli.dev/*` to `/blog/*` once that subdomain is added to this Netlify site and its CNAME is moved off Hashnode.
