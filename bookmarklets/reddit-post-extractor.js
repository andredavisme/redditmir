/**
 * Reddit Post + Comments Extractor Bookmarklet
 * =============================================
 * PURPOSE:
 *   Run this while on a single Reddit post page (e.g. reddit.com/r/Maine/comments/...).
 *   Fetches the post data AND full comment tree from Reddit's JSON API using
 *   your browser session, then copies both to clipboard as JSON.
 *
 * HOW TO INSTALL:
 *   1. Create a new bookmark in your browser
 *   2. Name it: r/Maine Post → Copy
 *   3. Paste the minified version (see docs/bookmarklets.md) as the URL
 *
 * HOW TO RUN:
 *   1. Navigate to any r/Maine post page
 *   2. Click the bookmark
 *   3. Confirm alert shows post title + comment count
 *   4. Open ingest.html and click "Paste Post + Comments"
 *
 * WHY CLIENT-SIDE:
 *   Reddit blocks all server-side requests from datacenter IPs (403).
 *   Your browser session bypasses this entirely. Reddit OAuth approval
 *   is pending (2 submissions rejected, appeal in process May 2026).
 *   Until OAuth is approved this is the only reliable way to fetch comments.
 *
 * LIMITATIONS:
 *   - Only captures comments loaded in the current page (Reddit lazy-loads some)
 *   - "Load more comments" / MoreComments objects are not expanded automatically
 *   - Re-running on the same post updates/adds comments idempotently
 */

(async function () {
  // Must be on a reddit.com/r/.../comments/... page
  var match = location.pathname.match(/\/r\/[^\/]+\/comments\/([a-z0-9]+)/);
  if (!match) {
    alert('RedditMirror: Run this bookmarklet on a Reddit post page.\n(URL must contain /comments/)');
    return;
  }
  var postId = match[1];

  try {
    var res = await fetch(
      'https://www.reddit.com/r/Maine/comments/' + postId + '.json?limit=500&depth=10&raw_json=1',
      { credentials: 'include', headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('Reddit returned HTTP ' + res.status);
    var data = await res.json();

    // data[0] = post listing, data[1] = comment listing
    var postData     = data[0]?.data?.children?.[0]?.data;
    var commentKids  = data[1]?.data?.children ?? [];

    if (!postData) throw new Error('Could not extract post data from response.');

    // Flatten comment tree recursively
    function flatten(children, depth) {
      var out = [];
      if (!depth) depth = 0;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.kind !== 't1') continue;
        var d = child.data;
        out.push({
          reddit_comment_id: d.id,
          reddit_post_id:    postId,
          parent_id:         d.parent_id || null,
          author:            d.author    || '[deleted]',
          body:              d.body      || '',
          score:             d.score     || 0,
          depth:             depth,
          is_deleted:        !d.author || d.author === '[deleted]' || d.body === '[deleted]' || d.body === '[removed]',
          reddit_created_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null
        });
        if (d.replies && d.replies.data && d.replies.data.children) {
          var nested = flatten(d.replies.data.children, depth + 1);
          for (var j = 0; j < nested.length; j++) out.push(nested[j]);
        }
      }
      return out;
    }

    var comments = flatten(commentKids, 0);

    var payload = {
      post:     postData,
      comments: comments,
      reddit_id: postId
    };

    await navigator.clipboard.writeText(JSON.stringify(payload));

    alert(
      'RedditMirror \u2714\ufe0f\n' +
      '"' + postData.title.slice(0, 60) + '"\n' +
      comments.length + ' comment' + (comments.length !== 1 ? 's' : '') + ' captured.\n\n' +
      'Open ingest.html and click "Paste Post + Comments".'
    );

  } catch (err) {
    alert('RedditMirror Error:\n' + err.message);
  }
})();
