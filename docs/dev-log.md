# RedditMirror — Developer Log

## Phase 3: Data Extraction from r/Maine
**Date:** May 20, 2026  
**Status:** Pipeline built. Browser ingest method active. Reddit OAuth approval pending (2nd appeal in process).

---

### Supabase Project
- **Project:** andredavisme's Project  
- **ID:** `hhyhulqngdkwsxhymmcd`  
- **Region:** us-west-2

---

### Database Schema (confirmed live)

| Table | Purpose |
|---|---|
| `community_config` | Source/target subreddit settings, sync rules |
| `source_posts` | Raw posts fetched from r/Maine |
| `synced_posts` | Queue of posts pending/approved/delivered to r/MaineMirror |
| `sync_jobs` | Polling cursor, last run metadata |
| `reddit_credentials` | OAuth client_id, Vault references for secrets |
| `activity_log` | Audit trail of all function runs |
| `reddit_comments` | Flattened comment trees fetched per post |
| `reddit_user_aliases` | Username anonymisation map (session + permanent aliases) |
| `published_posts` | Posts approved and delivered to public mirror feed |

Key column notes:
- `sync_jobs.last_fetched_reddit_id` — Reddit fullname used as `after` cursor (not `last_cursor`)
- `reddit_credentials` stores `client_secret` and `refresh_token` as Vault UUIDs (`client_secret_vault_id`, `refresh_token_vault_id`)
- `community_config.auto_approve = false` — moderator must approve posts before delivery
- `community_config.require_min_score = 1`
- `community_config.target_subreddit = 'MaineMirror'`
- `reddit_comments.reddit_comment_id` — unique per comment; sentinel rows (`_sentinel_{reddit_id}`) mark posts with 0 comments to prevent re-fetch
- `reddit_user_aliases.alias_type` — `session` (RedditUserA–Z, recycled) or `permanent` (RedditUser001+, stable after 5+ appearances)

---

### Edge Functions Deployed

#### `poll-source` (v4)
- Reads active `community_config`
- Creates `sync_jobs` row if none exists
- Fetches `r/Maine/new.json` with `after` cursor
- Upserts rows into `source_posts` (conflict on `reddit_id`)
- Updates `sync_jobs.last_fetched_reddit_id` with newest post fullname
- Logs to `activity_log`
- **Status:** Functional — blocked on Reddit 403 (datacenter IP rejection without OAuth)
- **Activation:** Set `REDDIT_FETCH_METHOD=oauth` once Reddit credentials are stored

#### `transform-posts` (v3)
- Loads all `source_posts` for active config
- Loads existing `synced_posts` source_post_ids to avoid duplicates (JS Set filter — Supabase client doesn't support subqueries)
- Filters out NSFW and spoiler posts
- Inserts eligible posts into `synced_posts` with `status = 'pending'`
- Logs to `activity_log`
- **Status:** ✅ Tested and working

#### `deliver-posts` (v4)
- Reads `synced_posts` with `status = 'approved'` and `scheduled_for <= now()`
- Writes approved posts to `published_posts` table
- Logs to `activity_log`
- **Status:** ✅ Deployed and functional

#### `ingest-posts` (v2) — Browser ingest path
- Accepts POST from browser-based tools containing `{ posts: [...] }`
- Maps Reddit post fields to `source_posts` schema
- Upserts rows (conflict on `reddit_id`, duplicates silently ignored)
- Updates `sync_jobs` cursor to newest fullname
- CORS headers on all responses + OPTIONS preflight handled
- Logs to `activity_log`
- **Status:** ✅ Deployed and functional
- **Activation:** Active now as `REDDIT_FETCH_METHOD=browser`
- **Retire when:** Reddit OAuth approved and `poll-source` takes over. Keep deployed as manual import fallback.

#### `fetch-comments` (v2) — Comment tree fetcher
- Accepts `GET ?post_id=<uuid>` (single post) or bare `GET` (batch of 10 unfetched posts)
- Hits `reddit.com/r/Maine/comments/{reddit_id}.json?limit=500&depth=10`
- Flattens full nested comment tree recursively
- Upserts into `reddit_comments` (conflict on `reddit_comment_id`)
- Inserts sentinel row for posts with 0 comments to prevent re-fetch loops
- Runs alias resolution pass after each post — assigns/promotes usernames in `reddit_user_aliases`
- 1.1s polite delay between posts
- **Status:** ⛔ Blocked — Reddit returns 403 from Supabase datacenter IPs (same root cause as `poll-source`)
- **Resolution path:** Extend bookmarklet to capture comments at ingest time (see Roadblock 8 below)

#### `ingest-canonical` / `ingest-fact` / `compute-analytics`
- Supporting functions for Alexandria education platform (separate product, same Supabase project)

---

### Fetch Method Adapter Pattern

The pipeline is designed so the data source can be swapped without touching `transform-posts` or `deliver-posts`. Three methods are supported:

| Method | Env Value | When to Use | Status |
|---|---|---|---|
| Browser tool | `browser` | Reddit API not approved | ✅ Active now |
| Reddit OAuth | `oauth` | After API approval | ⏳ Pending (appeal #2 in process) |
| RSS feed | `rss` | OAuth blocked, want automation | ⏳ Not yet built |

To switch: update `REDDIT_FETCH_METHOD` in Supabase Edge Function secrets. No code changes needed.

---

### Reddit API Access — Full Roadblock History

#### Roadblock 1: Datacenter IP Block (403)
- Reddit's public JSON API returns 403 from Supabase Edge Function IPs
- **Attempted:** Direct fetch from `poll-source`
- **Resolution path:** Must use Reddit OAuth2 or fetch from a real browser

#### Roadblock 2: Reddit API Registration Required
- Reddit now requires approval before `reddit.com/prefs/apps` allows app creation
- The "create app" button silently fails
- **Resolution path:** Submit request at `reddit.com/r/reddit.com/wiki/api`

#### Roadblock 3: First API Request Rejected
- Rejected for lacking detail and no source code link
- **Resolution path:** Created public GitHub repo, resubmitted with full description

#### Roadblock 4: Second API Request Rejected
- Generic rejection citing Responsible Builder Policy with no specific reason given
- `old.reddit.com/prefs/apps` also blocked — same wall
- **Date:** May 20, 2026
- **Status:** Appeal email sent. Awaiting Reddit response.
- **Resolution path:** Pivoted to browser-based ingestion while appeal is pending

#### Roadblock 5: Cloudflare Worker proxy considered and ruled out
- Cloudflare Worker IPs are also datacenter IPs — same 403 from Reddit
- **Resolution path:** Browser fetch using user's session cookies bypasses IP block entirely

#### Roadblock 6: Bookmarklet blocked by Reddit's CSP
- Reddit enforces `connect-src` Content Security Policy preventing outbound fetch to non-Reddit domains
- Bookmarklet could fetch Reddit JSON fine but could not POST to Supabase
- `about:blank` tabs opened programmatically inherit the opener's CSP context
- **Resolution path:** Local HTML file (`tools/ingest.html`) has no CSP; popup + postMessage approach attempted

#### Roadblock 7: Popup fetch also failing
- `about:blank` popup opened from local HTML file cannot fetch Reddit with credentials
- Reddit session cookies do not travel to blank popup context
- **Resolution:** Two-step solution — bookmarklet handles Reddit fetch, local tool handles Supabase POST

#### Roadblock 8: `fetch-comments` edge function returns 403 on all posts
- **Date:** May 20, 2026
- Same root cause as Roadblock 1 — Supabase datacenter IPs blocked by Reddit
- `fetch-comments` was designed to hit `reddit.com/r/Maine/comments/{id}.json` server-side
- All 101 posts returned `"error": "Reddit 403"` in backfill attempt
- The sentinel/skip logic also could not advance because 403 errors short-circuit before the sentinel insert
- **Resolution path:** Comments must be fetched client-side at bookmarklet time, then POSTed to a new `ingest-comments` endpoint alongside the post. See "Comment Ingest via Bookmarklet" in `tutorial.md`.
- **Status:** ⏳ Bookmarklet extension planned as next development step

#### Roadblock 9: Reddit OAuth — Two submissions rejected, appeal pending
- **First submission:** Rejected for insufficient detail, no source code
- **Second submission:** Rejected citing Responsible Builder Policy (no specific reason)
- **Appeal:** Submitted May 20, 2026 — awaiting Reddit response
- **Impact:** `poll-source`, `fetch-comments`, and future automated sync all require OAuth
- **Mitigation:** Full browser-based ingest path (bookmarklet → ingest.html → Supabase) is operational for posts. Comment ingest extension in progress.
- **If appeal succeeds:** Store `client_id` + `client_secret` in Supabase Vault, set `REDDIT_FETCH_METHOD=oauth`, activate `poll-source` cron

---

### Username Anonymisation System

All Reddit usernames are anonymised before appearing in the public mirror feed.

**Rules:**
- Every author initially receives a session alias: `RedditUserA` through `RedditUserZ`
- Session aliases are recycled for new authors when all 26 are in use (lowest-count author loses their slot)
- Authors who appear **more than 5 times** across posts + comments are promoted to a permanent alias: `RedditUser001`, `RedditUser002`, etc.
- Permanent aliases are never recycled or reassigned
- `[deleted]` authors remain as `[deleted]`

**Tables:**
- `reddit_user_aliases` — stores `author` (raw), `alias` (display), `alias_type`, `appearance_count`, `promoted_at`
- Alias resolution runs inside `fetch-comments` after each post batch
- The public mirror feed reads aliases from this table at render time

---

### Known Technical Decisions

- **Supabase client subquery workaround:** `.not("id", "in", subquery_string)` fails with UUID parse error. Use two-step JS filter: fetch existing IDs first, filter in memory.
- **Vault functions:** `vault_decrypt_secret(secret_id)` RPC used to retrieve secrets at runtime
- **Reddit submission type:** `kind: "link"` pointing to original `permalink` — preserves full attribution
- **No Devvit:** Devvit only supports in-Reddit experiences; external website display requires legacy Data API
- **CORS on ingest-posts:** All responses include CORS headers; OPTIONS preflight returns 200 explicitly
- **Comment sentinel rows:** Posts with 0 comments get a `_sentinel_{reddit_id}` row in `reddit_comments` so the batch fetcher skips them on future runs
- **Comment tree flattening:** Reddit returns a nested tree; `flattenComments()` recursively walks `replies.data.children` and tracks `depth` for indented display

---

### Next Steps
- [ ] Extend bookmarklet to capture `data[1]` (comment listing) at ingest time and POST to new `ingest-comments` endpoint
- [ ] Build `ingest-comments` edge function (accepts flat comment array, upserts to `reddit_comments`, runs alias resolution)
- [ ] Fix alias fetch URL encoding bug in `index.html` (`in.()` filter)
- [ ] Run first successful end-to-end post + comments ingest test
- [ ] Monitor Reddit API appeal response (submitted May 20, 2026)
- [ ] If approved: store credentials in Vault, switch to `poll-source` oauth method
- [ ] Set up `r/MaineMirror` Reddit community
- [ ] Configure pg_cron for automated scheduling
- [ ] Build RSS adapter as third fetch method option
- [ ] Build "pipe to community thread" delivery (discussion_threads table)
