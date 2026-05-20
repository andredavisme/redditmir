/**
 * Reddit Listing Extractor Bookmarklet
 * =====================================
 * PURPOSE:
 *   Fetches the latest posts from r/Maine/new and sends them to the
 *   RedditMirror ingest-posts edge function.
 *
 * HOW TO INSTALL:
 *   1. Create a new bookmark in your browser
 *   2. Set the name to: r/Maine → Mirror
 *   3. Paste the minified version (see docs/bookmarklets.md) as the URL
 *   4. Save to bookmarks bar
 *
 * HOW TO RUN:
 *   1. Go to reddit.com/r/Maine/new (must be logged in)
 *   2. Click the bookmark
 *   3. Alert will confirm how many posts were ingested
 *
 * DEPENDENCIES:
 *   - ingest-posts edge function must be deployed
 *   - INGEST_URL below must match your Supabase project URL
 *   - Must be run from a Reddit page (cookies needed for fetch)
 *
 * SWAP OUT WHEN:
 *   - Reddit OAuth is approved → switch to poll-source with REDDIT_FETCH_METHOD=oauth
 *   - See docs/bookmarklets.md for full switching instructions
 */

(async function () {
  // ============================================================
  // CONFIG — update INGEST_URL if project changes
  // ============================================================
  const INGEST_URL = 'https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/ingest-posts';
  const SUBREDDIT = 'Maine';   // change to mirror a different subreddit
  const LIMIT = 100;           // max posts per run (Reddit max: 100)

  try {
    // Step 1: Fetch listing from Reddit using browser session (bypasses datacenter IP block)
    const res = await fetch(
      `https://www.reddit.com/r/${SUBREDDIT}/new.json?limit=${LIMIT}&raw_json=1`,
      {
        credentials: 'include',       // sends your Reddit session cookies
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!res.ok) throw new Error('Reddit fetch failed: HTTP ' + res.status);

    const data = await res.json();
    const children = data?.data?.children;

    if (!children || children.length === 0) {
      alert('RedditMirror: No posts found in r/' + SUBREDDIT + '/new.');
      return;
    }

    // Step 2: Extract post data objects from the Reddit listing children
    // Each child has { kind: 't3', data: { ...post fields... } }
    // raw_json=1 decodes HTML entities in titles/selftext automatically
    const posts = children.map((c) => c.data);

    // Step 3: POST to ingest-posts edge function
    const ingestRes = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts }),
    });

    if (!ingestRes.ok) {
      const err = await ingestRes.text();
      throw new Error('Ingest failed: ' + err);
    }

    const result = await ingestRes.json();

    alert(
      'RedditMirror \u2714\ufe0f\n' +
      'Ingested ' + result.ingested + ' posts from r/' + SUBREDDIT + '\n' +
      'Newest cursor: ' + result.newest_cursor
    );

  } catch (err) {
    alert('RedditMirror Error:\n' + err.message);
  }
})();
