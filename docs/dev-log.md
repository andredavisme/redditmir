# RedditMirror — Developer Log

## Phase 3: Data Extraction from r/Maine
**Date:** May 20, 2026  
**Status:** Pipeline built. Browser ingest method active. Reddit OAuth approval pending.

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

Key column notes:
- `sync_jobs.last_fetched_reddit_id` — Reddit fullname used as `after` cursor (not `last_cursor`)
- `reddit_credentials` stores `client_secret` and `refresh_token` as Vault UUIDs (`client_secret_vault_id`, `refresh_token_vault_id`)
- `community_config.auto_approve = false` — moderator must approve posts before delivery
- `community_config.require_min_score = 1`
- `community_config.target_subreddit = 'MaineMirror'`

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

#### `transform-posts` (v2)
- Loads all `source_posts` for active config
- Loads existing `synced_posts` source_post_ids to avoid duplicates (JS Set filter — Supabase client doesn't support subqueries)
- Filters out NSFW and spoiler posts
- Inserts eligible posts into `synced_posts` with `status = 'pending'`
- Logs to `activity_log`
- **Status:** ✅ Tested and working

#### `deliver-posts` (v1)
- Reads `synced_posts` with `status = 'approved'` and `scheduled_for <= now()`
- Checks `reddit_credentials` for active OAuth creds
- Retrieves `refresh_token` and `client_secret` from Supabase Vault
- Exchanges refresh token for access token via Reddit OAuth (`/api/v1/access_token`)
- Caches new access token + expiry in `reddit_credentials`
- Submits each post to `r/MaineMirror` as a link post via `oauth.reddit.com/api/submit`
- Retries up to 3x on failure, then marks `status = 'failed'`
- Rate limits: 10-second delay between posts, max 5 posts per run
- Logs to `activity_log`
- **Status:** ✅ Deployed — correctly blocked on missing credentials

#### `ingest-posts` (v2) — NEW
- Accepts POST from browser-based tools containing `{ posts: [...] }`
- Maps Reddit post fields to `source_posts` schema
- Upserts rows (conflict on `reddit_id`, duplicates silently ignored)
- Updates `sync_jobs` cursor to newest fullname
- CORS headers on all responses + OPTIONS preflight handled
- Logs to `activity_log`
- **Status:** ✅ Deployed and functional
- **Activation:** Active now as `REDDIT_FETCH_METHOD=browser`
- **Retire when:** Reddit OAuth approved and `poll-source` takes over. Keep deployed as manual import fallback.

---

### Fetch Method Adapter Pattern

The pipeline is designed so the data source can be swapped without touching `transform-posts` or `deliver-posts`. Three methods are supported:

| Method | Env Value | When to Use | Status |
|---|---|---|---|
| Browser tool | `browser` | Reddit API not approved | ✅ Active now |
| Reddit OAuth | `oauth` | After API approval | ⏳ Pending |
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
- Appeal email sent May 20, 2026
- **Resolution path:** Pivoted to browser-based ingestion while appeal is pending

#### Roadblock 5: Cloudflare Worker proxy considered and ruled out
- Cloudflare Worker IPs are also datacenter IPs — same 403 from Reddit
- **Resolution path:** Browser fetch using user's session cookies bypasses IP block entirely

#### Roadblock 6: Bookmarklet blocked by Reddit's CSP
- Reddit enforces `connect-src` Content Security Policy preventing outbound fetch to non-Reddit domains
- Bookmarklet could fetch Reddit JSON fine but could not POST to Supabase
- `about:blank` tabs opened programmatically inherit the opener's CSP context
- **Resolution path:** Local HTML file (`tools/ingest.html`) has no CSP; popup + postMessage approach attempted

#### Roadblock 7: Popup fetch also failing (in progress)
- `about:blank` popup opened from local HTML file cannot fetch Reddit with credentials
- Reddit session cookies do not travel to blank popup context
- **Current status:** Working on two-step solution — bookmarklet handles Reddit fetch, local tool handles Supabase POST

#### Current Best Path
- Appeal email sent to Reddit — may resolve OAuth access
- Browser ingest solution being refined
- Once either unblocks, full pipeline test can proceed

---

### Known Technical Decisions

- **Supabase client subquery workaround:** `.not("id", "in", subquery_string)` fails with UUID parse error. Use two-step JS filter: fetch existing IDs first, filter in memory.
- **Vault functions:** `vault_decrypt_secret(secret_id)` RPC used to retrieve secrets at runtime
- **Reddit submission type:** `kind: "link"` pointing to original `permalink` — preserves full attribution
- **No Devvit:** Devvit only supports in-Reddit experiences; external website display requires legacy Data API
- **CORS on ingest-posts:** All responses include CORS headers; OPTIONS preflight returns 200 explicitly

---

### Next Steps
- [ ] Resolve browser ingest: two-step bookmarklet+paste or postMessage approach
- [ ] Run first successful end-to-end ingest → transform → approve → deliver test
- [ ] Monitor Reddit API appeal response
- [ ] If approved: store credentials in Vault, switch to `poll-source` oauth method
- [ ] Set up `r/MaineMirror` Reddit community
- [ ] Build moderator web app for post approval
- [ ] Configure pg_cron for automated scheduling
- [ ] Build RSS adapter as third fetch method option
