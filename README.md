# redditmir

A read-only community mirror of [r/Maine](https://www.reddit.com/r/Maine/) public posts, built for Maine residents who want to follow local news and discussions outside of Reddit.

## What It Does

- Polls the r/Maine subreddit every 30 minutes via the Reddit OAuth API
- Fetches **public posts only** — titles, URLs, author names, scores, and flairs
- Stores posts in a private database (Supabase/PostgreSQL)
- Displays posts on a read-only community website
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
- **Frontend:** Next.js (read-only display)

## Compliance

This project complies with Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) and [Data API Terms](https://www.redditinc.com/policies/data-api-terms).

- Non-commercial, personal/community project
- All content attributed to original Reddit authors and subreddit
- Direct links back to source posts on reddit.com
- No bulk redistribution or resale of Reddit data
- Read-only access, 30-minute polling interval

## Purpose

Built to give Maine residents a clean, accessible way to stay informed about local news and community discussions — particularly for those who prefer not to browse Reddit directly.

## Author

André Davis — [207 Analytix](https://207analytix.com) — Westbrook, Maine
