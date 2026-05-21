# RedditMirror — Tutorial & Setup Guide

This guide walks through the full RedditMirror pipeline: from capturing a Reddit post in your browser to displaying it (with anonymised comments) on the public mirror feed.

---

## Architecture Overview

```
Browser (you, logged into Reddit)
    ↓  Bookmarklet captures post + comments
Ingest Tool (ingest.html — local or hosted)
    ↓  POST → ingest-posts + ingest-comments
Database (source_posts + reddit_comments)
    ↓  transform-posts Edge Function
synced_posts (status: pending)
    ↓  Moderator approves in ingest.html
synced_posts (status: approved)
    ↓  deliver-posts Edge Function
published_posts + discussion_threads
    ↓
Public Mirror Feed (index.html)
```

---

## Prerequisites

- A Supabase project (project ID: `hhyhulqngdkwsxhymmcd`)
- Access to the GitHub repo: [andredavisme/redditmir](https://github.com/andredavisme/redditmir)
- A modern browser (Chrome or Firefox recommended)
- VS Code or any text editor

---

## Step 1 — Install the Bookmarklet

The bookmarklet runs in your browser while you're on a Reddit post page. It captures both the post data and the comment thread visible in your browser session.

1. Open `bookmarklets/` in the repo
2. Copy the bookmarklet code
3. Create a new bookmark in your browser
4. Paste the code as the URL
5. Name it something like `Mirror Post`

**What the bookmarklet captures:**
- Post title, URL, permalink, author, score, flair, timestamp
- Full visible comment tree (`data[1]` from Reddit's JSON response)
- All of this happens client-side — your Reddit session cookies are used automatically

> **Why client-side only?**  
> Reddit blocks server-side requests from datacenter IPs (including Supabase Edge Functions) with a 403 error. All direct Reddit API attempts from the server return 403 regardless of User-Agent. Reddit OAuth approval is pending (2 submissions rejected, appeal in process as of May 20, 2026). Until OAuth is approved, all Reddit data must be fetched from a real browser session.

---

## Step 2 — Capture a Post

1. Navigate to any post on `reddit.com/r/Maine`
2. **Expand the comments you want to capture** — the bookmarklet only captures what Reddit has rendered in the DOM
3. Click the `Mirror Post` bookmarklet
4. A confirmation message appears with the post title and comment count
5. The data is held in memory, ready to send

---

## Step 3 — Send to Ingest Tool

1. Open `ingest.html` (either locally or at the admin URL)
2. The tool will show the captured post in Step 1
3. Click **Ingest Post** — this POSTs to `ingest-posts` edge function
4. If comments were captured, click **Ingest Comments** — this POSTs to `ingest-comments` edge function
5. Both upsert safely — re-ingesting the same post/comments is idempotent

---

## Step 4 — Transform

Click **Run Transform** in Step 2 of ingest.html, or trigger manually:

```
POST https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/transform-posts
```

This moves eligible posts from `source_posts` → `synced_posts` with `status = 'pending'`.

Posts are filtered out if:
- Marked NSFW or spoiler
- Score below minimum threshold
- Already in `synced_posts`

---

## Step 5 — Review & Approve

In Step 3 of ingest.html:

1. Pending posts appear in a queue
2. Review each post — title, flair, score, original Reddit link
3. Click **Approve** or **Reject**
4. Approved posts move to `status = 'approved'`

---

## Step 6 — Deliver

Trigger delivery manually or via cron:

```
POST https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/deliver-posts
```

This writes approved posts to `published_posts`, making them visible on the public feed.

---

## Step 7 — View the Feed

The public mirror is at:  
**[andredavisme.github.io/redditmir](https://andredavisme.github.io/redditmir)**

Each post card shows:
- Anonymised author alias (e.g. `RedditUserA`, `RedditUser042`)
- Score, flair, time ago
- Collapsible comment thread (lazy-loaded on click)
- Link back to original Reddit post

---

## Comment Ingest via Bookmarklet

> **Current status:** Comment fetching from the server is blocked (Reddit 403 on all Supabase IPs). Comments must be captured client-side at bookmarklet time.

### How it works

When you click the bookmarklet on a Reddit post page, Reddit's page already contains `window.__REDUX_STORE__` or the JSON response at `{post_url}.json` which includes both the post (`data[0]`) and comments (`data[1]`). The bookmarklet fetches this and extracts the full comment tree.

### What gets captured
- All top-level comments and nested replies visible in `data[1]`
- Per comment: `id`, `parent_id`, `author`, `body`, `score`, `created_utc`, `depth`
- Reddit only returns ~200 top-level comments by default; "load more" comments require additional fetches (not yet implemented)

### What does NOT get captured
- Comments hidden behind "load more" / `MoreComments` objects
- Comments on posts you haven't navigated to
- Comments added after you ran the bookmarklet

### Updating comments

To refresh comments on a previously ingested post:
1. Navigate back to the Reddit post
2. Click the bookmarklet again
3. In ingest.html, click **Update Comments** — this re-upserts on `reddit_comment_id`, so existing comments are updated and new ones added

---

## Username Anonymisation

All Reddit usernames are replaced with anonymous aliases before display. Raw usernames are stored in the database but never exposed publicly.

| Condition | Alias assigned |
|---|---|
| New author (< 5 appearances) | `RedditUserA` – `RedditUserZ` (session, recycled) |
| Author with 5+ appearances | `RedditUser001`, `RedditUser002`, … (permanent, never recycled) |
| Deleted account | `[deleted]` |

Alias assignment happens automatically during comment ingest. The public feed reads aliases from `reddit_user_aliases` at render time.

---

## Reddit OAuth — Current Status

> As of May 20, 2026, Reddit OAuth access has been **denied twice** and an **appeal is in process**.

### Timeline
| Date | Event |
|---|---|
| May 2026 | First OAuth app submission — rejected (insufficient detail) |
| May 2026 | Second submission with GitHub repo link — rejected (Responsible Builder Policy, no specific reason given) |
| May 20, 2026 | Appeal email submitted to Reddit |
| Pending | Awaiting Reddit response |

### Impact
Without OAuth approval:
- `poll-source` cannot fetch posts automatically (403 from Supabase IPs)
- `fetch-comments` cannot fetch comments automatically (same 403)
- All Reddit data must be captured manually via bookmarklet in a live browser session

### When OAuth is approved
1. Register the app at `reddit.com/prefs/apps` (script type, read-only scope)
2. Store `client_id` in `reddit_credentials` table
3. Store `client_secret` and `refresh_token` in Supabase Vault
4. Set `REDDIT_FETCH_METHOD=oauth` in Edge Function secrets
5. `poll-source` and `fetch-comments` will activate automatically

---

## Troubleshooting

### Reddit 403 on fetch-comments
Expected. Reddit blocks all server-side requests from datacenter IPs. Use the bookmarklet to capture comments client-side instead. See "Comment Ingest via Bookmarklet" above.

### PowerShell syntax errors running curl commands
PowerShell uses different syntax than bash. Use `Invoke-RestMethod` instead:
```powershell
Invoke-RestMethod -Uri "https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/fetch-comments" -Method GET | ConvertTo-Json -Depth 5
```

### Edge function 500 errors
Check logs in the Supabase dashboard under Edge Functions → Logs. Common causes:
- Supabase client `.not("id", "in", subquery)` — use two-step JS filter instead
- Missing `source_post_id` on reddit_comments insert
- `reddit_comment_id` conflict not handled (use `upsert` with `onConflict`)

### Aliases showing as `RedditUser?` in feed
The alias fetch URL in `index.html` has an encoding bug on the `in.()` filter. Fix in progress.

---

## Environment Variables (Edge Functions)

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | Auto-set | Injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set | Injected by Supabase runtime |
| `REDDIT_FETCH_METHOD` | `browser` / `oauth` | Switches ingest path |

---

## Repository Structure

```
redditmir/
├── README.md
├── bookmarklets/        # Browser bookmarklet source
├── docs/
│   ├── index.html       # Public mirror feed (GitHub Pages)
│   ├── ingest.html      # Admin ingest tool
│   ├── tutorial.md      # This file
│   ├── dev-log.md       # Full development log + roadblock history
│   ├── next-steps.md    # Prioritised backlog
│   ├── security.md      # Access control + environment setup
│   ├── cors.md          # CORS configuration notes
│   └── bookmarklets.md  # Bookmarklet usage guide
└── tools/               # Supporting scripts
```
