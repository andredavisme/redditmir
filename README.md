# RedditMirror

A read-only community mirror of [r/Maine](https://www.reddit.com/r/Maine/) public posts, built for Maine residents who want to follow local news and discussions outside of Reddit.

## What It Does

- Ingests r/Maine public posts via a browser bookmarklet (user's session, not server-side)
- Stores posts in a private database (Supabase/PostgreSQL)
- Queues posts for moderator review before publishing
- Displays approved posts on a read-only community website
- Shows anonymised comments (usernames replaced with `RedditUserNNN` aliases)
- Always links back to the original Reddit post

## What It Does NOT Do

- Does not post, vote, comment, or interact with Reddit in any way
- Does not collect or store Reddit user credentials or private data
- Does not authenticate end users through Reddit
- Does not fetch private subreddits or user data
- Does not remove Reddit attribution from any content

## Tech Stack

- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** PostgreSQL (Supabase)
- **Ingest:** Browser bookmarklet (runs on reddit.com, captures visible posts)
- **Ingest Tool:** Static HTML + vanilla JS, hosted on GitHub Pages (`docs/ingest.html`)
- **Frontend:** Static HTML + vanilla JS, hosted on GitHub Pages (`docs/index.html`)

## Fetch Method

Ingestion currently uses the **browser-based method** — a bookmarklet runs on `reddit.com/r/Maine` in the user's own browser session, scrapes visible posts into a JSON array, copies to clipboard, and the operator pastes into `ingest.html` which POSTs to Supabase.

This approach was adopted after Reddit's server-side API access was blocked:

- Reddit's public JSON API returns **403 from all datacenter IPs** (Supabase, Cloudflare Workers)
- Reddit's OAuth app registration requires explicit approval — two submissions were rejected
- An appeal was submitted May 20, 2026 and is awaiting Reddit's response

The pipeline is designed to swap fetch methods without code changes via the `REDDIT_FETCH_METHOD` environment variable:

| Method | Value | Status |
|---|---|---|
| Browser bookmarklet | `browser` | ✅ Active |
| Reddit OAuth | `oauth` | ⏳ Appeal pending |
| RSS feed | `rss` | ⏳ Not yet built |

## Pipeline Overview

```
reddit.com/r/Maine (in user's browser)
    ↓  (bookmarklet scrape → clipboard)
Ingest Tool (ingest.html)
    ↓  Step 1: POST → ingest-posts Edge Function
source_posts table
    ↓  Step 2: POST → transform-posts Edge Function
synced_posts table (status: pending)
    ↓  Step 3: Moderator approves in ingest.html
synced_posts table (status: approved)
    ↓  Step 4 (optional): Paste comment JSON → ingest-comments path
reddit_comments table
    ↓  deliver-posts Edge Function
published_posts view
Frontend (index.html) ← live at andredavisme.github.io/redditmir
```

## Current Status

**Live site:** [andredavisme.github.io/redditmir](https://andredavisme.github.io/redditmir)

| Metric | Value |
|---|---|
| Posts published | 6 |
| Comments stored | 135+ |
| User aliases | 190 |
| Ingest method | Manual (browser bookmarklet) |
| Automated polling | Not yet — pending OAuth approval or RSS build |

See [docs/dev-log.md](docs/dev-log.md) for full session history and roadblock details, and [docs/next-steps.md](docs/next-steps.md) for what's ready to build next.

## Documentation

- [docs/dev-log.md](docs/dev-log.md) — Full development log with schema, edge functions, and roadblock history
- [docs/security.md](docs/security.md) — Access control options (3 paths) + full environment setup guide
- [docs/progress.md](docs/progress.md) — Session-by-session progress log
- [docs/next-steps.md](docs/next-steps.md) — Prioritized next steps
- [docs/bookmarklets.md](docs/bookmarklets.md) — Bookmarklet setup and usage
- [docs/tutorial.md](docs/tutorial.md) — End-to-end ingest walkthrough
- [docs/cors.md](docs/cors.md) — CORS configuration notes

## Compliance

This project complies with Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) and [Data API Terms](https://www.redditinc.com/policies/data-api-terms).

- Non-commercial, personal/community project
- All content attributed to original Reddit authors and subreddit
- Direct links back to source posts on reddit.com
- No bulk redistribution or resale of Reddit data
- Read-only access via manual bookmarklet trigger
- Usernames anonymised before display

## Purpose

Built to give Maine residents a clean, accessible way to stay informed about local news and community discussions — particularly for those who prefer not to browse Reddit directly.

## Author

André Davis — [207 Analytix](https://207analytix.com) — York Harbor, Maine
