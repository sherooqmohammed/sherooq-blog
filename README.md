# Sherooq's Blog

A simple personal blog with seven self-updating news sections: **Tech**, **AI**, **Software Engineering**, **Dev Tools & Languages**, **Kerala**, **UAE**, and **Germany**.

## How it's organized

```
index.html          Homepage — intro, latest posts, news previews
blog.html            Full list of blog posts
posts/               Individual blog post pages
  post-1.html
  post-2.html
news/                The seven news sections
  tech.html
  ai.html
  software-engineering.html
  dev-tools.html
  kerala.html
  uae.html
  germany.html
css/style.css         All styling
js/main.js            Nav menu + small helpers
js/news.js            Fetches and renders live headlines
api/news.js           Vercel serverless proxy for fetching feeds (see below)
```

## How the news sections work

Each news page loads a live Google News RSS feed for its topic/region using
`js/news.js`. Because the fetch happens on every page load, the headlines are
always current — "daily updates" happen automatically, with no manual work
and nothing to schedule.

- On Vercel, requests go through `api/news.js`, a small serverless function
  that fetches the feed server-side and returns it — this avoids the
  reliability/rate-limit issues of public CORS-proxy services entirely. If
  you open the site as a local file (no server), or if the API route is ever
  unavailable, it automatically falls back to public proxies
  (`allorigins.win`, `rss2json.com`, `corsproxy.io`) so the page still works.
- Each attempt has a 6-second timeout, so a slow/unresponsive source doesn't
  stall the page — it moves to the next one automatically.
- Headlines are cached in the browser for **1 hour** so repeat visits load
  instantly. Click **"Refresh now"** on any news page to force a fresh pull.
- If every source fails, the page falls back to the last successfully loaded
  headlines and says so.

### Changing what each section covers

Open the relevant file in `news/` and edit the `FEED_URL` line near the
bottom. Any Google News RSS URL works, for example:

- Topic feeds: `https://news.google.com/rss/headlines/section/topic/<TOPIC>?hl=en-US&gl=US&ceid=US:en`
  (topics include `TECHNOLOGY`, `BUSINESS`, `SPORTS`, `SCIENCE`, `HEALTH`, `ENTERTAINMENT`)
- Region feeds: `https://news.google.com/rss/headlines/section/geo/<PLACE>?hl=en-US&gl=US&ceid=US:en`
  (replace `<PLACE>` with any city, state, or country — e.g. `Kochi`, `Dubai`, `Berlin`)
- Search feeds: `https://news.google.com/rss/search?q=<YOUR SEARCH>&hl=en-US&gl=US&ceid=US:en`

You can also point `FEED_URL` at any other public RSS feed (a specific
newspaper's feed, for instance) — it doesn't have to be Google News.

## Adding a blog post

1. Duplicate `posts/post-1.html`, rename it (e.g. `posts/post-3.html`).
2. Edit the title and body text.
3. Add a matching card to `blog.html` (and optionally `index.html`) linking
   to the new file — copy an existing `.post-item` block as a starting point.

## Personalizing the site

- Edit the bio text and headline in `index.html` (the `<section class="hero">`
  and `.about-box` blocks).
- Change colors in `css/style.css` under `:root` (the `--color-*` variables
  near the top).
- Change the site name by replacing "Sherooq" in the `<title>` tags and the
  `.site-title` links across all pages.

## Viewing the site

You can open `index.html` directly by double-clicking it — everything works
from a local file, including the live news sections (they fetch over HTTPS,
which works even when the page itself is opened locally).

## Publishing it online (optional, all free)

Any static hosting service works since this is plain HTML/CSS/JS:

- **Netlify** — drag the whole folder onto [app.netlify.com/drop](https://app.netlify.com/drop)
- **GitHub Pages** — push the folder to a GitHub repo, enable Pages in repo settings
- **Vercel** — `vercel` CLI or drag-and-drop import from a GitHub repo

No build step or server is required.
