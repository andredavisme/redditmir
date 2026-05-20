/**
 * Reddit Listing Extractor Bookmarklet
 * =====================================
 * PURPOSE:
 *   Fetches the latest posts from r/Maine/new and copies them to the
 *   clipboard as JSON. Then open tools/ingest.html locally and paste
 *   to send them to the RedditMirror ingest-posts edge function.
 *
 * HOW TO INSTALL:
 *   1. Create a new bookmark in your browser
 *   2. Set the name to: r/Maine → Copy
 *   3. Paste the minified version (see docs/bookmarklets.md) as the URL
 *   4. Save to bookmarks bar
 *
 * HOW TO RUN:
 *   1. Go to reddit.com/r/Maine/new (must be logged in)
 *   2. Click the bookmark
 *   3. Alert confirms posts copied to clipboard
 *   4. Open tools/ingest.html locally and click "Paste & Ingest"
 *
 * WHY TWO STEPS:
 *   Reddit enforces a Content Security Policy (connect-src) that blocks
 *   outbound fetch() to non-Reddit domains. The bookmarklet can fetch
 *   Reddit JSON fine, but cannot POST to Supabase from within the Reddit
 *   tab. Copying to clipboard and finishing in a local HTML file (no CSP)
 *   is the clean workaround.
 *
 * SWAP OUT WHEN:
 *   - Reddit OAuth is approved → switch to poll-source with REDDIT_FETCH_METHOD=oauth
 *   - See docs/bookmarklets.md for full switching instructions
 */

(async function () {
  const SUBREDDIT = 'Maine';
  const LIMIT = 100;

  try {
    // Fetch listing from Reddit using browser session (bypasses datacenter IP block)
    const res = await fetch(
      `https://www.reddit.com/r/${SUBREDDIT}/new.json?limit=${LIMIT}&raw_json=1`,
      {
        credentials: 'include',
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

    const posts = children.map((c) => c.data);

    // Copy posts JSON to clipboard — no Supabase POST here (blocked by Reddit CSP)
    await navigator.clipboard.writeText(JSON.stringify(posts));

    alert(
      'RedditMirror \u2714\ufe0f\n' +
      posts.length + ' posts copied to clipboard.\n\n' +
      'Now open tools/ingest.html and click "Paste & Ingest".'
    );

  } catch (err) {
    alert('RedditMirror Error:\n' + err.message);
  }
})();
