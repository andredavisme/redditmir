# RedditMirror — Development Progress

This file is the running session log for the RedditMirror project. Each session documents what was built, what was fixed, and what state the project is in at close.

---

## Session 1 — May 20, 2026

### What Was Built

**Ingest pipeline (end-to-end, working)**
- `ingest-posts` Edge Function: accepts a JSON array of Reddit posts, writes new records to `source_posts`, deduplicates by `reddit_id`
- `transform-posts` Edge Function: reads unprocessed `source_posts`, filters NSFW/spoilers, writes eligible posts to `synced_posts` with `status = 'pending'`
- Bookmarklet (`bookmarklets/`): runs on reddit.com/r/Maine, scrapes visible posts into a JSON array, copies to clipboard
- `ingest.html` ingest tool (hosted on GitHub Pages at `docs/ingest.html` and mirrored at `tools/ingest.html`):
  - Step 1: Paste clipboard JSON → POST to `ingest-posts`
  - Step 2: Trigger `transform-posts`
  - Step 3: Review and approve/reject pending posts
  - Admin section: configure Supabase URL, anon key, function slugs, and security path — all saved to `localStorage`

**Database (Supabase — project: hhyhulqngdkwsxhymmcd)**
- Tables in use: `community_config`, `source_posts`, `synced_posts`, `activity_log`
- RLS enabled on all four tables
- Policies added this session:
  - `anon can read synced_posts` (SELECT)
  - `anon can read source_posts` (SELECT)
  - `anon can update synced_posts status` (UPDATE)
  - Authenticated moderator policies were pre-existing

**Documentation**
- `docs/security.md`: access control guide (3 paths: anon, password gate, Supabase Auth) + full environment setup guide for new deployments (Steps 1–7)
- `docs/progress.md`: this file
- `docs/next-steps.md`: prioritized next steps
- `README.md`: updated with pipeline diagram, current status, and doc links

### What Was Fixed

- **Invalid API key error** on queue load: anon key had rotated; updated in both `docs/` and `tools/`
- **Queue showing empty after transform**: root cause was missing `anon` RLS policies on `source_posts` and `synced_posts` — all requests were being silently blocked. Fixed by adding the three policies above.

### Session-End State

| Metric | Value |
|--------|-------|
| Posts ingested (source_posts) | ~100+ |
| Posts queued (synced_posts) | 101 total |
| Approved | 6 |
| Pending | 95 |
| Rejected | 0 |

Approval writes confirmed correct via direct DB query. Pipeline is fully operational through Step 3.

### What Is NOT Yet Built

- `deliver-posts` Edge Function (push approved posts to the frontend)
- Next.js frontend (display layer)
- Automated polling (currently manual via bookmarklet)
- Supabase Auth integration (Path 3 security)

---

*Next session: see [docs/next-steps.md](next-steps.md)*
