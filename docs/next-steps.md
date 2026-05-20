# RedditMirror — Next Steps

This file is the canonical handoff document. At the start of a new session, read this file to know exactly where the project is and what to build next.

**To resume:** Say *“Let’s pick up where we left off”* while connected to the GitHub (`andredavisme/redditmir`) and Supabase (`hhyhulqngdkwsxhymmcd`) accounts. Read this file and `docs/progress.md` to orient.

---

## Immediate Priority — Deliver Approved Posts

The pipeline is complete through moderator approval. The next step is building the **delivery layer** that takes `approved` posts and makes them available to the frontend.

### Step 4: `deliver-posts` Edge Function

**What it should do:**
1. Query `synced_posts` where `status = 'approved'`
2. Join with `source_posts` to get full post data
3. Write or upsert records into a `published_posts` table (to be created)
4. Update `synced_posts.status` to `'delivered'` for processed records
5. Return a summary: `{ delivered: N }`

**Trigger:** Manual button in `ingest.html` Step 4 (add after the approve step), or on a schedule.

**New table needed: `published_posts`**
```sql
CREATE TABLE published_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_post_id uuid REFERENCES synced_posts(id),
  reddit_id     text UNIQUE NOT NULL,
  title         text NOT NULL,
  url           text,
  permalink     text,
  author        text,
  score         integer,
  flair_text    text,
  reddit_created_at timestamptz,
  published_at  timestamptz DEFAULT now()
);
```

---

## Next Priority — Frontend Display

Once `published_posts` is populated, build the Next.js frontend to display posts.

- Read from `published_posts` via Supabase REST (anon key, public read)
- Display: title (linked to original Reddit URL), author, score, flair, date
- Sort by `reddit_created_at` descending
- No authentication required for readers
- Hosted on Vercel or GitHub Pages

---

## Later — Automation

Currently the ingest step is manual (bookmarklet → paste → click). Options to automate:

- **Scheduled Edge Function** using `pg_cron` or Supabase scheduled functions to call the Reddit API directly on a timer
- This would replace the bookmarklet workflow entirely
- Reddit OAuth credentials are already stored in `reddit_credentials` table

---

## Later — Security Hardening

Current security path is Path 1 (anon). When ready to harden:

- See `docs/security.md` for full implementation guide for Path 2 (password gate) or Path 3 (Supabase Auth)
- The Admin panel in `ingest.html` has a Security Path selector ready — just choose and configure
- For Path 3, the authenticated moderator RLS policies are already in place on `synced_posts` and `source_posts`

---

## Later — Shareability

The project is designed to be cloneable for other subreddit communities. When ready:

- `docs/security.md` already contains the full environment setup guide (Steps 1–7)
- The Admin panel in `ingest.html` lets a new deployer enter their own Supabase URL and anon key without touching code
- Remaining work: generalize the bookmarklet to accept any subreddit name, and parameterize the subreddit name in the ingest tool UI

---

## Known Issues / Tech Debt

- `tools/ingest.html` and `docs/ingest.html` are kept in sync manually — consider consolidating to one source of truth
- The `transform-posts` function message currently says `1 posts queued` (grammar) — minor fix
- Anon key is hardcoded as a default in the HTML source — acceptable for now, worth noting for shareability
