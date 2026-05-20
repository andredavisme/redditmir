# RedditMirror — Tutorial
## How to Mirror Any Subreddit to a New Reddit Community

This tutorial documents how to build an automated system that polls a source subreddit, queues posts for moderation, and delivers them to a new target community. Follow along to replicate this for any subreddit.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- A Reddit account (your personal account)
- A dedicated Reddit bot account (separate from your personal account)
- Basic comfort with terminals and copy/pasting commands

---

## Phase 3: Connecting to Reddit's API

### Step 1 — Register for Reddit Data API Access

Reddit now requires all developers to register before creating API apps. This is a manual review process.

1. Go to [reddit.com/r/reddit.com/wiki/api](https://www.reddit.com/r/reddit.com/wiki/api)
2. Click **"submit a request"**
3. Select **"I'm a Developer"** → **"I want to register to use the Reddit API"**
4. Fill in the form (see recommended answers below)
5. Submit and wait for approval (minutes to 1-2 business days)

> ⚠️ **First submissions are often rejected** for lacking detail. Use specific language about read-only access, attribution, and non-commercial use. Include a public GitHub repo link.

**Recommended form answers:**

| Field | Answer |
|---|---|
| Reddit account name | Your bot account username |
| Benefit to Redditors | Clean mirror for users who prefer not to browse Reddit directly; links back to original posts |
| Detailed description | Read-only bot polling `r/[subreddit]/new.json` every 30 min. Fetches title, URL, author, score, flair only. No writes, no user auth, no private data. Non-commercial. Full attribution with links back to reddit.com. Source: [your GitHub repo] |
| Missing from Devvit | Devvit only supports in-Reddit experiences; this project displays content on an external website |
| Source code link | Your public GitHub repo URL |
| Subreddits | `r/[your source subreddit]` |
| Bot username | Your bot account username |

---

### Step 2 — Create a Bot Account

Reddit requires a dedicated account for API automation — not your personal account.

1. Open an **incognito/private browser window**
2. Go to [reddit.com/register](https://www.reddit.com/register)
3. Create a new account (e.g. `yourproject_bot`)
4. **Do not enable 2FA** — script-type OAuth apps require username/password auth
5. Use this account when completing the API registration form

---

### Step 3 — Create a Reddit App (after approval)

Once your API request is approved:

1. Log in as your **bot account**
2. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
3. Click **"create another app"**
4. Fill in:
   - **Name:** anything (e.g. `mirror`)
   - **Type:** script
   - **Redirect URI:** `http://localhost:8080`
5. Complete the CAPTCHA and click **"create app"**
6. Copy your **`client_id`** (short string under app name) and **`client_secret`**

---

### Step 4 — Get a Refresh Token

Run this in your terminal, replacing the placeholders:

```bash
curl -X POST https://www.reddit.com/api/v1/access_token \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -d "grant_type=password&username=YOUR_BOT_USERNAME&password=YOUR_BOT_PASSWORD" \
  -H "User-Agent: RedditMirror/1.0 (by /u/YOUR_BOT_USERNAME)"
```

The response will include:
- `access_token` — short-lived (expires in 24h)
- `refresh_token` — long-lived, used to get new access tokens automatically

Save both. **Never commit these to code or GitHub.**

---

### Step 5 — Store Secrets in Supabase Vault

Supabase Vault encrypts secrets at rest. Store `client_secret` and `refresh_token` there:

```sql
-- Store client_secret
SELECT vault.create_secret('YOUR_CLIENT_SECRET', 'reddit_client_secret');

-- Store refresh_token  
SELECT vault.create_secret('YOUR_REFRESH_TOKEN', 'reddit_refresh_token');
```

Each returns a UUID. Use those UUIDs when inserting into `reddit_credentials`:

```sql
INSERT INTO reddit_credentials (
  config_id,
  reddit_username,
  client_id,
  client_secret_vault_id,
  refresh_token_vault_id,
  is_active
) VALUES (
  '[your config_id]',
  'YOUR_BOT_USERNAME',
  'YOUR_CLIENT_ID',
  '[vault UUID for client_secret]',
  '[vault UUID for refresh_token]',
  true
);
```

---

### Step 6 — Test the Full Pipeline

With credentials in place, invoke each function in order:

```bash
# 1. Poll Reddit for new posts
curl -X POST https://[your-project].supabase.co/functions/v1/poll-source

# 2. Transform posts into the delivery queue
curl -X POST https://[your-project].supabase.co/functions/v1/transform-posts

# 3. Manually approve a post in synced_posts (status = 'approved')
# Do this via Supabase dashboard or moderator web app

# 4. Deliver approved posts to target community
curl -X POST https://[your-project].supabase.co/functions/v1/deliver-posts
```

> 💡 **Customize It:** Swap `r/Maine` for any public subreddit by updating `community_config.source_subreddit`. The pipeline is fully config-driven.

---

### Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `403` from Reddit on poll | Datacenter IP blocked without OAuth | Must use OAuth credentials (Step 4-5) |
| "create app" button does nothing | API access not yet approved | Complete Step 1 registration first |
| First API request rejected | Insufficient detail or missing source link | Add GitHub repo URL, attribution language, resubmit |
| `Unable to add account` on bot verification | Wrong password or 2FA enabled | Disable 2FA on bot account |
| `No active Reddit credentials` from deliver-posts | Credentials not inserted yet | Complete Steps 4-5 |

---

## Coming Up — Phase 4

- Create `r/MaineMirror` (or your target community) on Reddit
- Build the moderator web app for approving/rejecting posts
- Configure `pg_cron` to run the pipeline automatically every 30 minutes
