# RedditMirror

A read-only community mirror of [r/Maine](https://www.reddit.com/r/Maine/) public posts, built for Maine residents who want to follow local news and discussions outside of Reddit.

## What It Does

- Polls the r/Maine subreddit via the Reddit OAuth API
- Fetches **public posts only** — titles, URLs, author names, scores, and flairs
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
- **API:** Reddit OAuth2 (script app, read-only scope)
- **Ingest Tool:** Static HTML + vanilla JS, hosted on GitHub Pages (`docs/ingest.html`)
- **Frontend:** Static HTML + vanilla JS, hosted on GitHub Pages (`docs/index.html`)

## Pipeline Overview

```
Reddit r/Maine
    ↓  (bookmarklet copy)
Ingest Tool (ingest.html)
    ↓  Step 1: POST → ingest-posts Edge Function
source_posts table
    ↓  Step 2: POST → transform-posts Edge Function
synced_posts table (status: pending)
    ↓  Step 3: Moderator approves in ingest.html
synced_posts table (status: approved)
    ↓  published_posts view
Frontend (index.html) ← live at andredavisme.github.io/redditmir
```

## Current Status

See [docs/progress.md](docs/progress.md) for a full session log and [docs/next-steps.md](docs/next-steps.md) for what's ready to build next.

**Live site:** [andredavisme.github.io/redditmir](https://andredavisme.github.io/redditmir)

## Documentation

- [docs/security.md](docs/security.md) — Access control options (3 paths) + full environment setup guide for new deployments
- [docs/progress.md](docs/progress.md) — Development log by session
- [docs/next-steps.md](docs/next-steps.md) — Prioritized next steps

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

André Davis — [207 Analytix](https://207analytix.com) — Westbrook, Maine
