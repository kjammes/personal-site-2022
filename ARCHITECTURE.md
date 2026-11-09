# Architecture

This repository is the source for **www.jayeshkarli.dev**: a portfolio, a blog with interactive visualizations, and pages aimed at employers and freelance clients. It is a fully static site. There is no backend, database or server-side runtime.

The site has three jobs:

1. **Rank well in search.** Every page is plain prerendered HTML with complete metadata and structured data.
2. **Teach with interactive articles.** Articles embed React widgets that readers can drive.
3. **Feed a YouTube channel.** The same widgets play scripted sequences on a hidden studio page, which is screen-recorded for videos.

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7, static output | Ships zero JavaScript by default, so pages are fast and fully crawlable |
| Content | MDX in Astro content collections | Markdown for writing, JSX for embedding widgets, schema-validated frontmatter |
| Interactivity | React 19 islands | Only widgets hydrate. They load when scrolled into view |
| Styling | Plain CSS with custom properties | One global token file plus component-scoped styles. No CSS framework |
| Font | JetBrains Mono, self-hosted via Fontsource | Single monospace typeface across the site |
| Code highlighting | Shiki, built into Astro | Highlighting happens at build time. No client JavaScript |
| Hosting | Netlify | Static `dist/` folder, redirects and headers in `netlify.toml` |
| Types | TypeScript strict, checked by `astro check` | The build fails on type errors |

The visual reference is PlanetScale's B-tree article: a narrow text column, a sticky table of contents, a monospace font, flat panels, and widgets with a control strip on top.

---

## Directory map

```
.
├── astro.config.mjs          Site URL, integrations (MDX, React, sitemap), Shiki theme
├── netlify.toml              Build command, Hashnode redirect, cache and noindex headers
├── tsconfig.json             Strict TS, React JSX, "@/*" path alias to src/
├── public/                   Copied to dist/ as is
│   ├── favicon.png
│   └── robots.txt            Disallows /studio/, points to the sitemap
└── src/
    ├── content.config.ts     Collection schemas (blog, work)
    ├── content/
    │   ├── blog/*.mdx        Articles
    │   └── work/*.mdx        Case studies
    ├── data/site.ts          All profile data: identity, socials, experience, stack, projects
    ├── lib/
    │   ├── content.ts        Collection queries, draft filtering, tag slugs, dates, reading time
    │   └── stats.ts          Build-time stats: years of experience, LeetCode solved count
    ├── layouts/Base.astro    HTML shell: head, header, main, footer
    ├── components/
    │   ├── BaseHead.astro    Title, description, canonical, Open Graph, Twitter, JSON-LD
    │   ├── Header.astro      Sticky nav with active state
    │   ├── Footer.astro      Social links and RSS
    │   ├── PostList.astro    Date and title list used on home, blog and tag pages
    │   ├── Toc.astro         Table of contents with scroll-spy
    │   ├── AvailabilityCard.astro   Freelance call to action in article sidebars
    │   ├── YouTube.astro     Click-to-load video embed
    │   ├── mdx/              Components available inside every MDX file without importing
    │   │   ├── Hl.astro      Inline coloured highlight
    │   │   └── Callout.astro Note, tip or warning box
    │   └── viz/              Interactive widget framework (React)
    │       ├── speed.ts      Shared animation-speed store
    │       ├── VizFrame.tsx  Panel, control groups, buttons, number field
    │       ├── viz.css       Widget styles
    │       ├── SpeedControl.tsx    Page-wide speed selector
    │       └── BinarySearch.tsx    First widget, and the reference implementation
    ├── pages/                File-based routes, see below
    └── styles/global.css     Design tokens, base styles, prose styles, highlight classes
```

---

## Routes

| URL | Source | Notes |
| --- | --- | --- |
| `/` | `pages/index.astro` | Hero, two audience paths, stats, recent posts, experience, stack, contact |
| `/blog` | `pages/blog/index.astro` | All posts with a tag list |
| `/blog/<slug>` | `pages/blog/[...slug].astro` | Article layout. Slug is the MDX file name |
| `/blog/tags/<tag>` | `pages/blog/tags/[tag].astro` | One page per tag |
| `/work` | `pages/work/index.astro` | Case study list, or a placeholder when there are none |
| `/work/<slug>` | `pages/work/[...slug].astro` | Case study layout with a metrics panel |
| `/services` | `pages/services.astro` | Freelance offerings, process and contact |
| `/rss.xml` | `pages/rss.xml.ts` | Feed of published posts |
| `/sitemap-index.xml` | `@astrojs/sitemap` | Generated, excludes `/studio/` |
| `/studio/<widget>` | `pages/studio/[widget].astro` | Recording page, never indexed |
| 404 | `pages/404.astro` | Points old blog links at `/blog` |

`build.format: 'file'` with `trailingSlash: 'never'` produces `blog.html` rather than `blog/index.html`. Netlify serves these at clean URLs with no trailing slash, which matches the canonical tags.

---

## Rendering model

Everything is rendered to HTML at build time. There are two kinds of JavaScript on the client, and nothing else:

1. **Small inline scripts** in Astro components: the table-of-contents scroll-spy and the YouTube click-to-load. Astro bundles these as modules.
2. **React islands** for widgets. An MDX file mounts a widget with `client:visible`. Astro renders the widget's initial state to HTML on the server, then hydrates it when it scrolls into view. Crawlers and readers without JavaScript still see the initial state, such as the sorted array in the binary search widget.

All islands on a page import the same `speed.ts` module, so they share one speed setting even though each is a separate React root.

---

## Content model

Schemas live in `src/content.config.ts`. Zod validates frontmatter at build time, and a bad field fails the build.

### Blog post (`src/content/blog/*.mdx`)

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | string | Page title and heading |
| `description` | string, at most 170 characters | Meta description, RSS, post lists |
| `pubDate` | date | Publish date, sort order |
| `updatedDate` | date, optional | Shown under the meta line, used for `dateModified` |
| `tags` | string array | Tag pages. The first tag is also the breadcrumb |
| `series` | string, optional | Shown as "Part of the series". No series pages yet |
| `youtubeId` | string, optional | Adds the video embed and VideoObject structured data |
| `videoUploadDate` | date, optional | VideoObject `uploadDate`. Falls back to `pubDate` |
| `draft` | boolean, default false | Excluded from production builds |

### Case study (`src/content/work/*.mdx`)

| Field | Type | Purpose |
| --- | --- | --- |
| `title`, `summary` | string | List and page heading |
| `role`, `period` | string | Meta line |
| `stack` | string array | Technologies used |
| `metrics` | array of `{ label, value }` | Headline numbers. The list shows the first three |
| `order` | number, default 100 | Sort order, lowest first |
| `draft` | boolean | Same behaviour as posts |

### Drafts

`getPosts()` and `getCaseStudies()` in `lib/content.ts` include drafts when running `astro dev` and drop them in production. Draft pages also get `noindex`. RSS filters drafts out explicitly.

### Profile data

Everything about the person, rather than an article, lives in `src/data/site.ts`: name, role, headline, email, booking link, resume link, career start dates, LeetCode username, socials, `knowsAbout` topics, nav items, experience, education, stack and projects. Change the copy here, not in the pages.

Setting `bookingUrl` switches every "send an email" and "get in touch" call to action to "book a call".

---

## Build-time data

`src/lib/stats.ts` replaces the old site's runtime JavaScript.

- **Experience years** are computed from `careerStart` and `codingStart` when the site builds.
- **LeetCode solved count** is fetched once per build from LeetCode's public GraphQL endpoint, with an 8 second timeout. On any failure it returns `null` and the homepage hides that stat rather than showing a wrong number.

Both values go stale between deploys. The fix is a Netlify build hook on a daily schedule, which is not set up yet.

---

## Design system

All tokens are CSS custom properties on `:root` in `src/styles/global.css`.

| Token group | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--bg`, `--bg-panel`, `--bg-raised` | Page, panels and cards, control strips and inline code |
| Borders | `--border`, `--border-strong` | Dividers, panel outlines |
| Text | `--text`, `--text-strong`, `--muted` | Body, headings and emphasis, secondary text |
| Accent | `--accent`, `--accent-strong`, `--accent-soft` | Links, primary buttons, active states. The only brand colour |
| Semantic | `--green`, `--purple`, `--pink`, `--amber` | **Only** inside widgets and `Hl` highlights. Amber also marks warning callouts |
| Layout | `--measure` (42rem), `--toc-width` (15rem), `--container` (66rem) | Text column, sidebar, outer width |

Rules the current design follows:

- Flat surfaces only. No gradients, shadows or glows.
- One accent colour across the site. Semantic colours never appear in page chrome.
- One typeface. Headings differ by weight, underline and small size steps, not by font.
- Bullets are asterisks (`ul.star`, and every list in `.prose`).
- Section headings use the `.h` class: bold, underlined, close to body size.
- Dark only. There is no light theme. The tokens make one straightforward to add under `prefers-color-scheme: light`.

Shared utility classes: `.container`, `.narrow`, `.muted`, `.panel`, `.btn`, `.btn.solid`, `.sr-only`, `.prose`, `.hl-*`.

Shiki inlines its own background on code blocks. `global.css` overrides it with `--bg-panel` so code matches the panels.

---

## Interactive widget framework

### Building blocks (`components/viz/VizFrame.tsx`)

- `VizFrame` is the bordered figure. It has an optional control strip, a stage and an optional caption. With `bare`, it drops all chrome for studio recording.
- `Group` is a labelled cluster of controls with a colour: `blue`, `green`, `purple`, `pink`, `amber` or `neutral`. The colour applies to the label and to every button inside it.
- `Btn` is a styled button. `aria-pressed="true"` gives it the filled state.
- `NumberField` is the minus, input and plus control, with clamping.

### Speed (`components/viz/speed.ts`)

- `SPEEDS` are 0.5, 0.75, 1, 1.5 and 2.
- `useSpeed()` reads the shared value through `useSyncExternalStore`. The server snapshot is always 1, so hydration never mismatches.
- `setSpeed()` updates every widget on the page and saves the choice to `localStorage`. Storage failures are ignored.
- `scaled(ms, speed)` converts a base duration. It shortens animations for users who prefer reduced motion.

### Widget contract

`BinarySearch.tsx` is the reference implementation. New widgets should follow the same shape:

1. **Deterministic initial state.** Generate data from a seed prop, never `Math.random()` during the first render, or server and client HTML will not match. Randomness is fine after hydration, for example on a Shuffle button.
2. **A plan, then playback.** Compute the full list of algorithm steps up front, then advance a cursor through it. Autoplay, single-stepping and scripted playback all just move the cursor.
3. **Timings through `scaled()`.** Every timeout and CSS transition duration goes through the shared speed.
4. **A `script` prop.** When present, the widget hides its controls (`bare`) and loops through a scripted sequence by itself. This is what the studio page records.
5. **An `aria-live` status line.** It narrates each step in plain text, which helps screen readers and doubles as a caption in videos.
6. **SVG for drawing.** CSS classes per element state, colours from tokens.

### Prose highlights

`<Hl c="purple">Step</Hl>` in an article should use the same colour as the `Group` that holds the control it names. This link between the text and the widget is the main device borrowed from the reference design.

---

## Blog to YouTube pipeline

```
 MDX article ──mounts──▶ Widget (client:visible) ◀──same component──  /studio/<widget>
      │                                                                      │
      │ youtubeId in frontmatter                                  screen record at
      ▼                                                           1080p or 4K
 Embed + VideoObject JSON-LD  ◀────────── upload to YouTube ◀──── edit with voiceover
```

1. Write the article and build its widget.
2. Register the widget in the `getStaticPaths` of `pages/studio/[widget].astro` and give it a `script`.
3. Run `npm run dev` and open `/studio/<widget>?speed=1` in a browser window sized to 1920x1080 or 3840x2160. The dev toolbar is disabled in `astro.config.mjs` so it does not appear in recordings.
4. Record, then edit in DaVinci Resolve or similar.
5. Upload the video, link the article in the description, and add `youtubeId` to the post.

The studio is kept out of search four ways: a `noindex` meta tag, an `X-Robots-Tag` header from `netlify.toml`, a `robots.txt` disallow, and the sitemap filter.

---

## SEO

`BaseHead.astro` handles every page:

- A title in the form "Page | Jayesh Karli", plus a meta description.
- A canonical URL on `https://www.jayeshkarli.dev` with no trailing slash.
- Open Graph and Twitter tags. `og:image` is emitted only when a page passes `image`, and no page does yet.
- A **Person** JSON-LD block on every page, with `jobTitle`, `knowsAbout` and `sameAs` links to all socials. That last part ties the identity together for search engines.
- RSS and sitemap discovery links.

The article page adds **TechArticle** JSON-LD, plus **VideoObject** when `youtubeId` is set. Draft posts and draft case studies get `noindex`.

Performance choices that matter for ranking: no client JavaScript outside widgets, widgets hydrate only when visible, a self-hosted font, YouTube iframes that load only on click, and immutable caching for hashed assets under `/_astro/`.

---

## Deployment and domains

- Netlify runs `npm run build`, which runs `astro check` and then `astro build`, and publishes `dist/` on Node 22.
- **Canonical origin is `www.jayeshkarli.dev`.** That keeps the existing CNAME setup and the URL Google already knows.
- **Blog migration** is ready in `netlify.toml`: a forced 301 from `blog.jayeshkarli.dev/*` to `/blog/:splat`. It takes effect only after these steps:
  1. Migrate the Hashnode posts into `src/content/blog/` **with the same slugs**.
  2. Add `blog.jayeshkarli.dev` as a domain alias on the Netlify site.
  3. Point its DNS CNAME at Netlify instead of Hashnode.
  4. Set each Hashnode post's canonical URL to its new address until Hashnode is retired.
  5. Submit the sitemap in Google Search Console.
- The old Spring Boot backend on Heroku is not used by this site.

---

## Common tasks

**Add a post.** Create `src/content/blog/<slug>.mdx` with the frontmatter above. Set `draft: true` while writing. `Hl` and `Callout` work without imports. Widgets need an import and a `client:visible` directive.

**Add a widget.** Create `src/components/viz/<Name>.tsx` following the widget contract. Import it in a post. Add it to the studio `getStaticPaths` and to the conditional render in that page.

**Add a case study.** Copy an existing file in `src/content/work/` (for example `upgrad-backend-platform.mdx`) and replace its frontmatter and body. Set `draft: true` to keep it out of production while writing.

**Change profile copy, experience or socials.** Edit `src/data/site.ts`.

**Change colours or layout widths.** Edit the tokens at the top of `src/styles/global.css`.

**Add a nav item.** Add it to `nav` in `src/data/site.ts`.

---

## Not built yet

| Item | Plan |
| --- | --- |
| Social preview images | Generate one per post at build time, for example with Satori, and pass it to `BaseHead` as `image` |
| Site search | Pagefind, indexed after the build, with a search page or dialog |
| Comments | Giscus backed by GitHub Discussions, loaded on demand |
| Series pages | `/blog/series/<series>` listing posts in order, with previous and next links on posts |
| "How I build" page | Your real AI-assisted workflow. It needs your input |
| Light theme | Redefine tokens under `prefers-color-scheme: light` |
| Stats freshness | Daily Netlify build hook |
| Analytics | Plausible or Umami script in `BaseHead` |
| Hashnode migration | See Deployment and domains |
| Booking link | Set `bookingUrl` in `src/data/site.ts` |
| Tests | Playwright checks for routes, phone-width overflow and widget behaviour |
