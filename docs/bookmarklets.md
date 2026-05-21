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
- **`docs/ingest.html`** (local file or GitHub Pages) handles the Supabase POST (no CSP at all on local files)
- Data is passed between the two steps via the **clipboard**

---

## Bookmarklet 1: Reddit Listing Extractor

**Purpose:** Visit `r/Maine/new`, click this bookmarklet, and it copies the latest posts as JSON to your clipboard.

Use for **Step 1a** in `ingest.html` — bulk import of recent posts without comments.

### How to Install
1. Create a new bookmark in your browser (any page)
2. Set the name to: `r/Maine → Copy`
3. Set the URL to the minified bookmarklet code below
4. Save it to your bookmarks bar

### How to Run
1. Go to [reddit.com/r/Maine/new](https://www.reddit.com/r/Maine/new) (logged in)
2. Click the **`r/Maine → Copy`** bookmarklet
3. Alert confirms how many posts were copied to clipboard
4. Open `ingest.html`
5. Under **Step 1a**, click **Paste** then **Ingest Posts**

### Bookmarklet Code

Copy the entire line below and paste it as the URL of a new bookmark:

```
javascript:(async function(){const SUBREDDIT='Maine';const LIMIT=100;try{const res=await fetch(`https://www.reddit.com/r/${SUBREDDIT}/new.json?limit=${LIMIT}&raw_json=1`,{credentials:'include',headers:{'Accept':'application/json'}});if(!res.ok)throw new Error('Reddit fetch failed: HTTP '+res.status);const data=await res.json();const children=data?.data?.children;if(!children||children.length===0){alert('RedditMirror: No posts found in r/'+SUBREDDIT+'/new.');return;}const posts=children.map(c=>c.data);await navigator.clipboard.writeText(JSON.stringify(posts));alert('RedditMirror \u2714\ufe0f\n'+posts.length+' posts copied to clipboard.\n\nNow open ingest.html and click "Paste & Ingest".');}catch(err){alert('RedditMirror Error:\n'+err.message);}})();
```

---

## Bookmarklet 2: Reddit Post + Comments Extractor

**Purpose:** Visit a single r/Maine post page, click this bookmarklet, and it copies the post data **and full comment tree** as JSON to your clipboard.

Use for **Step 1b** in `ingest.html` — captures comments from your live browser session, bypassing Reddit's server-side 403 block on Supabase IPs.

> **Why this exists:** Reddit blocks all server-to-server requests from datacenter IPs with 403. Reddit OAuth approval is pending (2 rejections, appeal submitted May 20, 2026). This bookmarklet uses your existing Reddit browser session to fetch comment data that the server cannot reach.

### How to Install
1. Create a new bookmark in your browser
2. Set the name to: `r/Maine Post → Copy`
3. Set the URL to the minified bookmarklet code below
4. Save it to your bookmarks bar

### How to Run
1. Navigate to any post on [reddit.com/r/Maine](https://www.reddit.com/r/Maine) (logged in)
2. Click the **`r/Maine Post → Copy`** bookmarklet
3. Alert confirms the post title and number of comments captured
4. Open `ingest.html`
5. Under **Step 1b**, click **Paste** then **Ingest Post + Comments**

### Limitations
- Only captures comments **already loaded** in the page — Reddit lazy-loads some threads
- "Load more comments" links are **not** auto-expanded; scroll and expand manually before clicking
- Re-running on the same post is safe — ingest is idempotent (upserts on `reddit_comment_id`)

### Bookmarklet Code

Copy the entire line below and paste it as the URL of a new bookmark:

```
javascript:(async function(){var match=location.pathname.match(/\/r\/[^\/]+\/comments\/([a-z0-9]+)/);if(!match){alert('RedditMirror: Run this on a Reddit post page.\n(URL must contain /comments/)');return;}var postId=match[1];try{var res=await fetch('https://www.reddit.com/r/Maine/comments/'+postId+'.json?limit=500&depth=10&raw_json=1',{credentials:'include',headers:{Accept:'application/json'}});if(!res.ok)throw new Error('Reddit returned HTTP '+res.status);var data=await res.json();var postData=data[0]?.data?.children?.[0]?.data;var commentKids=data[1]?.data?.children??[];if(!postData)throw new Error('Could not extract post data.');function flatten(children,depth){var out=[];if(!depth)depth=0;for(var i=0;i<children.length;i++){var child=children[i];if(child.kind!=='t1')continue;var d=child.data;out.push({reddit_comment_id:d.id,reddit_post_id:postId,parent_id:d.parent_id||null,author:d.author||'[deleted]',body:d.body||'',score:d.score||0,depth:depth,is_deleted:!d.author||d.author==='[deleted]'||d.body==='[deleted]'||d.body==='[removed]',reddit_created_at:d.created_utc?new Date(d.created_utc*1000).toISOString():null});if(d.replies&&d.replies.data&&d.replies.data.children){var nested=flatten(d.replies.data.children,depth+1);for(var j=0;j<nested.length;j++)out.push(nested[j]);}}return out;}var comments=flatten(commentKids,0);var payload={post:postData,comments:comments,reddit_id:postId};await navigator.clipboard.writeText(JSON.stringify(payload));alert('RedditMirror \u2714\ufe0f\n"'+postData.title.slice(0,60)+'"\n'+comments.length+' comment'+(comments.length!==1?'s':'')+' captured.\n\nOpen ingest.html and click "Paste Post + Comments".');}catch(err){alert('RedditMirror Error:\n'+err.message);}})();
```

---

## ingest.html

Open this file locally or at the GitHub Pages admin URL after running either bookmarklet.

- **Step 1a** — bulk post import from `r/Maine/new` (Bookmarklet 1)
- **Step 1b** — single post + comments import from a post page (Bookmarklet 2)
- **Step 2** — transform ingested posts into the approval queue
- **Step 3** — approve or reject pending posts
- **Step 4** — deliver approved posts to `published_posts`

---

## Switching to Automated Polling (when Reddit approves)

When Reddit OAuth is approved, you no longer need bookmarklets for regular syncing:

1. Go to Supabase Dashboard → Edge Functions → `poll-source` → Secrets
2. Set `REDDIT_FETCH_METHOD` = `oauth`
3. Add `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN` secrets
4. `poll-source` will take over automated polling
5. Bookmarklets remain available as a manual override anytime
