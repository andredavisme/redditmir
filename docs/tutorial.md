# RedditMirror — Tutorial
## How to Mirror Any Subreddit to a New Reddit Community

This tutorial documents how to build an automated system that polls a source subreddit, queues posts for moderation, and delivers them to a new target community.

It also documents something equally important: **how to work through technical roadblocks**. This project ran into seven distinct blockers in a single session. None of them were dead ends. Each one had a path forward — sometimes forward meant sideways.

---

## A Note on Problem-Solving in Real Projects

When you hit a wall, the instinct is to keep pushing at it harder. Often the better move is to **step back and ask what you actually need**, not what you originally planned to do.

In this project:
- We needed Reddit data → planned to use the API → API required approval → approval was rejected twice
- At that point we didn’t need the API — we needed *the data*. Those are different things.
- A browser-based fetch with session cookies gets the same data, no approval required

That reframe — from "how do I fix the API problem" to "how do I get the data" — is the key mental move. Work backward from what you actually need, not forward from the solution you assumed.

**The pattern:**
1. Try the ideal solution
2. When blocked, identify *what you actually need* (not the solution, the underlying goal)
3. Find the next-best path that satisfies that need
4. Design so you can swap back to the ideal when it becomes available

Step 4 is what the [fetch adapter pattern](#the-fetch-adapter-pattern) in this project implements.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- A Reddit account (your personal account)
- A dedicated Reddit bot account (separate from your personal account)
- Basic comfort with terminals and copy/pasting commands

---

## Phase 3: Connecting to Reddit Data

### The Fetch Adapter Pattern

Before building anything, design for swappability. The pipeline has one step that touches Reddit — fetching new posts. Everything downstream (transform, approve, deliver) doesn’t care *how* the posts got into `source_posts`, only that they’re there.

So the fetch step is isolated behind an adapter interface. Three implementations exist:

| Method | How it works | When to use |
|---|---|---|
| `browser` | You run a tool in your browser; your session fetches Reddit | API not yet approved |
| `oauth` | `poll-source` edge function uses Reddit OAuth credentials | After API approval |
| `rss` | `poll-source` parses Reddit’s RSS feed | OAuth blocked, want automation |

One env variable (`REDDIT_FETCH_METHOD`) controls which is active. Switching methods requires no code changes.

---

### Step 1 — Try Reddit OAuth First

The ideal solution is automated OAuth polling. Attempt this first:

1. Go to [reddit.com/r/reddit.com/wiki/api](https://www.reddit.com/r/reddit.com/wiki/api)
2. Click **"submit a request"** and fill in the form
3. Be specific: include your GitHub repo URL, describe read-only access, mention attribution

**If approved:** See Steps 3–5 for credential setup. You’re done.

**If rejected (common):** Don’t resubmit immediately. Reply to the rejection email directly, ask specifically what policy was violated. Then proceed to Step 2 as your working path while you wait.

> ⚠️ The "create app" button at `reddit.com/prefs/apps` silently fails until approval is granted. `old.reddit.com/prefs/apps` has the same wall. This is expected.

---

### Step 2 — Browser Ingest (working path while OAuth is pending)

Reddit’s JSON endpoints block requests from datacenter IPs (Supabase, Cloudflare, Vercel) but work fine from real browsers. Your logged-in browser session carries cookies that authenticate the request without any API approval.

The browser ingest flow:
1. A tool running in your browser fetches `r/[subreddit]/new.json` using your session
2. It POSTs the post array to the `ingest-posts` edge function
3. `ingest-posts` upserts into `source_posts` identically to how `poll-source` would

**Roadblocks you’ll hit and how to handle them:**

**Bookmarklet blocked by Reddit CSP**  
Reddit enforces a `connect-src` Content Security Policy that blocks outbound fetch calls to non-Reddit domains. A bookmarklet running on reddit.com can fetch Reddit data fine but cannot POST to Supabase. Solution: don’t POST from Reddit’s page — use a local HTML file instead, which has no CSP.

**`about:blank` tabs inherit opener CSP**  
If you open a blank tab programmatically from a Reddit page, it inherits Reddit’s CSP context. A truly fresh `about:blank` tab (typed manually in the address bar) does not. But even then, Reddit session cookies may not travel to a blank context. Solution: two-step approach — fetch on Reddit, deliver to Supabase separately.

See `tools/ingest.html` and `docs/bookmarklets.md` for the current working implementation.

---

### Step 3 — Create a Bot Account

Required for OAuth path. Reddit requires a dedicated account for API automation.

1. Open an **incognito/private browser window**
2. Go to [reddit.com/register](https://www.reddit.com/register) and create a new account
3. **Do not enable 2FA** — script-type OAuth apps require username/password auth
4. Use this account when completing the API registration form

---

### Step 4 — Create a Reddit App (after OAuth approval)

1. Log in as your **bot account**
2. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
3. Click **"create another app"**, select type **script**, set redirect URI to `http://localhost:8080`
4. Copy your **`client_id`** (short string under app name) and **`client_secret`**

---

### Step 5 — Get a Refresh Token and Store in Vault

```bash
curl -X POST https://www.reddit.com/api/v1/access_token \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -d "grant_type=password&username=YOUR_BOT_USERNAME&password=YOUR_BOT_PASSWORD" \
  -H "User-Agent: RedditMirror/1.0 (by /u/YOUR_BOT_USERNAME)"
```

Store secrets in Supabase Vault:

```sql
SELECT vault.create_secret('YOUR_CLIENT_SECRET', 'reddit_client_secret');
SELECT vault.create_secret('YOUR_REFRESH_TOKEN', 'reddit_refresh_token');
```

Then insert the `reddit_credentials` row using the returned Vault UUIDs. See `docs/dev-log.md` for the full INSERT statement.

---

### Step 6 — Switch the Fetch Method

When OAuth credentials are ready:

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Set `REDDIT_FETCH_METHOD` = `oauth`
3. `poll-source` takes over — `ingest-posts` stays deployed as a manual fallback

---

### Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| 403 from Reddit in poll-source | Datacenter IP blocked | Use browser ingest method |
| "create app" button does nothing | API not yet approved | Complete Step 1 registration |
| First/second API request rejected | Insufficient detail | Reply to rejection email; use browser ingest in the meantime |
| Bookmarklet "Failed to fetch" to Supabase | Reddit CSP blocks outbound requests | Use local HTML tool instead |
| `about:blank` popup can't fetch Reddit | CSP inherited from opener or cookies don't travel | Use two-step: fetch on Reddit, POST separately |
| `No active Reddit credentials` from deliver-posts | Credentials not inserted yet | Complete Steps 4–5 |
| Supabase `.not(id, in, subquery)` UUID error | Client doesn't support subqueries | Use two-step JS filter in memory |

---

## Coming Up — Phase 4

- Resolve browser ingest path fully
- First end-to-end pipeline test: ingest → transform → approve → deliver
- Create `r/MaineMirror` community on Reddit
- Build moderator web app for post approval queue
- Configure `pg_cron` for automated scheduling
- Build RSS adapter as third fetch method
