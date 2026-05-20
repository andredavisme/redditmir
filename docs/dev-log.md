# RedditMirror — Developer Log

## Phase 3: Data Extraction from r/Maine
**Date:** May 20, 2026  
**Status:** Pipeline built — blocked on Reddit OAuth API approval

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

---

### Reddit API Access — Issues Encountered

#### Problem 1: Datacenter IP Block (403)
- Reddit's public JSON API (`reddit.com/*.json`) works from browsers and residential IPs but returns 403 from Supabase Edge Function IPs
- **Resolution:** Must use Reddit OAuth2. Authenticated requests are allowed from any IP.

#### Problem 2: Reddit API Registration Required
- Reddit now requires all apps to register via their Data API form before `reddit.com/prefs/apps` will allow app creation
- The "create app" button silently fails with a link to the Responsible Builder Policy
- **Resolution:** Submit request via the "submit a request" link on `reddit.com/r/reddit.com/wiki/api`

#### Problem 3: First Submission Rejected
- Initial submission rejected for lacking detail and not providing a source code link
- **Resolution:** Created public GitHub repo (`github.com/andredavisme/redditmir`) and resubmitted with full description, attribution language, and GitHub URL

#### Problem 4: Bot Account Setup
- Reddit's API registration requires a dedicated bot account with username/password verification
- Created bot account: `u/Trick_Parfait_924`
- **Note:** Account must not have 2FA enabled for script-type OAuth apps

#### Current Status
- Second API access request submitted May 20, 2026 — awaiting approval
- Once approved: create app at `reddit.com/prefs/apps`, obtain `client_id` + `client_secret`, run password auth curl to get `refresh_token`, store in Supabase Vault

---

### Known Technical Decisions

- **Supabase client subquery workaround:** `.not("id", "in", subquery_string)` fails with UUID parse error. Use two-step JS filter: fetch existing IDs first, filter in memory.
- **Vault functions:** `vault_decrypt_secret(secret_id)` RPC used to retrieve secrets at runtime
- **Reddit submission type:** `kind: "link"` pointing to original `permalink` — preserves full attribution
- **No Devvit:** Devvit only supports in-Reddit experiences; external website display requires legacy Data API

---

### Next Steps (Phase 4)
- [ ] Receive Reddit API approval
- [ ] Create app at `reddit.com/prefs/apps` under `u/Trick_Parfait_924`
- [ ] Run curl to get `refresh_token`
- [ ] Store `client_secret` and `refresh_token` in Supabase Vault
- [ ] Insert `reddit_credentials` row
- [ ] Test full pipeline: poll → transform → approve → deliver
- [ ] Set up `r/MaineMirror` Reddit community
- [ ] Build moderator web app
- [ ] Configure pg_cron for automated scheduling
