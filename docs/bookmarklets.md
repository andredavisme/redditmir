# RedditMirror — Bookmarklets

Bookmarklets are browser-based tools that run JavaScript on the current page when clicked. RedditMirror uses bookmarklets as the **"browser" fetch method** — a fallback when Reddit API OAuth approval is pending.

---

## When to Use Bookmarklets

| Situation | Method |
|---|---|
| Reddit API not yet approved | **Two-step browser ingest** (current) |
| Reddit OAuth approved | `poll-source` edge function |
| OAuth blocked, want automation | RSS feed adapter |

See `REDDIT_FETCH_METHOD` in `docs/dev-log.md` for switching instructions.

---

## Why Two Steps?

Reddit enforces a **Content Security Policy (CSP)** on all its pages that blocks outbound `fetch()` calls to non-Reddit domains. This means a bookmarklet running on reddit.com can fetch Reddit JSON fine, but **cannot POST to Supabase** from within the Reddit tab.

The solution:
- **Bookmarklet** handles the Reddit fetch (needs session cookies, no CSP issue for reading)
- **`tools/ingest.html`** (local file) handles the Supabase POST (no CSP at all on local files)
- Data is passed between the two steps via the **clipboard**

---

## Bookmarklet: Reddit Listing Extractor

**Purpose:** Visit `r/Maine/new`, click this bookmarklet, and it copies the latest posts as JSON to your clipboard.

**Step 1 of 2** — then open `tools/ingest.html` to complete the ingest.

### How to Install
1. Create a new bookmark in your browser (any page)
2. Set the name to: `r/Maine → Copy`
3. Set the URL to the minified bookmarklet code below
4. Save it to your bookmarks bar

### How to Run
1. Go to [reddit.com/r/Maine/new](https://www.reddit.com/r/Maine/new) (logged in)
2. Click the **`r/Maine → Copy`** bookmarklet
3. Alert confirms how many posts were copied to clipboard
4. Open `tools/ingest.html` locally
5. Click **Paste & Ingest**

### Bookmarklet Code

Copy the entire block below (one line) and paste it as the URL of a new bookmark:

```
javascript:(async function(){const SUBREDDIT='Maine';const LIMIT=100;try{const res=await fetch(`https://www.reddit.com/r/${SUBREDDIT}/new.json?limit=${LIMIT}&raw_json=1`,{credentials:'include',headers:{'Accept':'application/json'}});if(!res.ok)throw new Error('Reddit fetch failed: HTTP '+res.status);const data=await res.json();const children=data?.data?.children;if(!children||children.length===0){alert('RedditMirror: No posts found in r/'+SUBREDDIT+'/new.');return;}const posts=children.map(c=>c.data);await navigator.clipboard.writeText(JSON.stringify(posts));alert('RedditMirror \u2714\ufe0f\n'+posts.length+' posts copied to clipboard.\n\nNow open tools/ingest.html and click "Paste & Ingest".');}catch(err){alert('RedditMirror Error:\n'+err.message);}})();
```

---

## tools/ingest.html

**Step 2 of 2** — open this file locally in your browser after running the bookmarklet.

- Click **Paste** to pull from clipboard automatically, or paste manually with Ctrl+V
- Click **Ingest Posts** to send to the `ingest-posts` edge function
- The log confirms how many posts were ingested and the newest cursor saved

---

## Bookmarklet 2: Single Thread Extractor (original tool)

**Purpose:** Extract a single Reddit thread (post + all comments) and copy to clipboard. Used for manual review or one-off imports.

See `reddit-extract.txt` in project files for the original bookmarklet code.

---

## Switching to Automated Polling (when Reddit approves)

When Reddit OAuth is approved, you no longer need the bookmarklet for regular syncing:

1. Go to Supabase Dashboard → Edge Functions → `poll-source` → Secrets
2. Set `REDDIT_FETCH_METHOD` = `oauth`
3. Add `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN` secrets
4. `poll-source` will take over automated polling
5. This bookmarklet remains available as a manual override anytime
