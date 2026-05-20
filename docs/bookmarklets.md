# RedditMirror — Bookmarklets

Bookmarklets are browser-based tools that run JavaScript on the current page when clicked. RedditMirror uses bookmarklets as the **"browser" fetch method** — a fallback when Reddit API OAuth approval is pending.

---

## When to Use Bookmarklets

| Situation | Method |
|---|---|
| Reddit API not yet approved | **Browser bookmarklet** (current) |
| Reddit OAuth approved | `poll-source` edge function |
| OAuth blocked, want automation | RSS feed adapter |

See `REDDIT_FETCH_METHOD` in `docs/dev-log.md` for switching instructions.

---

## Bookmarklet 1: Reddit Listing Extractor

**Purpose:** Visit `r/Maine/new`, click this bookmarklet, and it will fetch the latest posts and send them directly to the `ingest-posts` edge function.

**When to use:** Any time you want to sync new posts from r/Maine into the pipeline. Run this instead of waiting for automated polling.

**What it does:**
1. Fetches `r/Maine/new.json?limit=100` from your browser session (no IP block)
2. Extracts all post fields that map to `source_posts`
3. POSTs the array to `ingest-posts`
4. Alerts you with how many posts were ingested

**How to install:**
1. Create a new bookmark in your browser (any page)
2. Set the name to: `r/Maine → Mirror`
3. Set the URL to the full bookmarklet code below
4. Save it to your bookmarks bar

**How to run:**
1. Go to [reddit.com/r/Maine/new](https://www.reddit.com/r/Maine/new) (logged in)
2. Click the bookmarklet in your bookmarks bar
3. Wait for the alert confirming how many posts were ingested

---

### Bookmarklet Code

Copy the entire block below (one line) and paste it as the URL of a new bookmark:

```
javascript:(async function(){const INGEST_URL='https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/ingest-posts';try{const res=await fetch('https://www.reddit.com/r/Maine/new.json?limit=100&raw_json=1',{credentials:'include',headers:{'Accept':'application/json'}});if(!res.ok)throw new Error('Reddit fetch failed: HTTP '+res.status);const data=await res.json();const children=data?.data?.children;if(!children||children.length===0){alert('RedditMirror: No posts found.');return;}const posts=children.map(c=>c.data);const ingestRes=await fetch(INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({posts})});if(!ingestRes.ok){const err=await ingestRes.text();throw new Error('Ingest failed: '+err);}const result=await ingestRes.json();alert('RedditMirror \u2714\ufe0f\nIngested '+result.ingested+' posts from r/Maine\nNewest cursor: '+result.newest_cursor);}catch(err){alert('RedditMirror Error:\n'+err.message);}})();
```

---

## Bookmarklet 2: Single Thread Extractor (original tool)

**Purpose:** Extract a single Reddit thread (post + all comments) and copy to clipboard. Used for manual review or one-off imports.

**When to use:** When you want to inspect a specific post's full comment thread, or manually import a single post.

See `reddit-extract.txt` in project files for the original bookmarklet code.

---

## Switching to Automated Polling (when Reddit approves)

When Reddit OAuth is approved, you no longer need the bookmarklet for regular syncing. Switch methods:

1. Go to Supabase Dashboard → Edge Functions → `poll-source` → Secrets
2. Set `REDDIT_FETCH_METHOD` = `oauth`
3. Add `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN` secrets
4. `poll-source` will take over automated polling
5. This bookmarklet remains available as a manual override anytime
