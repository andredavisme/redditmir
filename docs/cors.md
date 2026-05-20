# Understanding CORS — A Plain-English Guide for RedditMirror

CORS stands for **Cross-Origin Resource Sharing**. It's a browser security rule, not a server rule. Understanding it will save you hours of debugging.

---

## The Core Idea

Your browser is protective. When a web page makes a `fetch()` request to a **different origin** (different domain, port, or protocol), the browser asks the destination server: *"Do you allow requests from this page?"*

If the server doesn't explicitly say yes, the browser **blocks the response** — even if the server processed the request fine.

> **Key insight:** The request often *does* reach the server. CORS blocks the browser from reading the response. This is why you sometimes see a successful database write paired with a "Failed to fetch" error in the UI.

---

## What Is an "Origin"?

An origin is the combination of **protocol + domain + port**:

| URL | Origin |
|---|---|
| `https://reddit.com/r/Maine` | `https://reddit.com` |
| `https://hhyhulqngdkwsxhymmcd.supabase.co/functions/v1/ingest-posts` | `https://hhyhulqngdkwsxhymmcd.supabase.co` |
| `file:///C:/Users/ADavis/Downloads/ingest.html` | `null` (local file) |

If the page origin and the request destination origin are different, it's a **cross-origin request** and CORS rules apply.

---

## How It Works (the Browser's Checklist)

1. Page makes a `fetch()` to a different origin
2. Browser sends the request, but also checks: does the response include `Access-Control-Allow-Origin`?
3. If the header is **present and matches** the requesting origin → browser lets the response through ✅
4. If the header is **missing or doesn't match** → browser blocks the response and throws a CORS error ❌

For `POST` requests with a `Content-Type` of `application/json`, the browser also sends a **preflight** — an `OPTIONS` request first — to ask for permission before sending the real request.

---

## How This Affects RedditMirror

This project has three different "pages" making fetch requests:

### 1. Bookmarklet running on reddit.com
- **Origin:** `https://reddit.com`
- **Fetching:** Reddit JSON → no CORS issue (same origin)
- **Fetching:** Supabase Edge Functions → **CORS required** on the Edge Function
- **Reddit's CSP** adds another layer: Reddit blocks outbound `fetch()` to non-Reddit domains entirely (not even a CORS question — it never leaves the tab)
- **Resolution:** Bookmarklet only reads Reddit; Supabase POST happens from `ingest.html` instead

### 2. tools/ingest.html (local file)
- **Origin:** `null` (browsers treat `file://` pages as a null origin)
- **Fetching:** Supabase Edge Functions → **CORS required**, and the Edge Function must explicitly allow `null` origin or use `*`
- **Resolution:** Edge Functions need `Access-Control-Allow-Origin: *` in their responses

### 3. Future Next.js frontend (e.g. on Vercel)
- **Origin:** `https://yourdomain.com`
- **Fetching:** Supabase — Supabase's client library handles CORS automatically for database queries
- **Fetching:** Edge Functions directly → still need CORS headers on the functions

---

## The Fix: CORS Headers on Edge Functions

Every Supabase Edge Function that is called from a browser needs to return these headers:

```ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight OPTIONS request
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: CORS_HEADERS });
}

// Include CORS headers on every real response too
return new Response(JSON.stringify(data), {
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
});
```

**Why `*`?** The wildcard allows any origin — fine for a personal operator tool. If this were a public app with authentication, you'd restrict it to specific domains.

**Why handle `OPTIONS`?** Before sending a POST with JSON, the browser sends a preflight OPTIONS request. If the server doesn't respond correctly to that, the real request never happens.

---

## Why "Failed to fetch" Is Misleading

When you see `Failed to fetch` in the browser console, it almost always means one of:

1. **CORS blocked** — the server responded but the browser rejected it
2. **Network error** — the server was unreachable (wrong URL, server down)
3. **Mixed content** — trying to fetch `http://` from an `https://` page

The real clue is in the **browser console** (F12 → Console tab). A CORS error looks like:

```
Access to fetch at 'https://...supabase.co/...' from origin 'null' has been blocked
by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## Quick Reference for This Project

| Caller | Destination | CORS Needed? | Status |
|---|---|---|---|
| Bookmarklet (reddit.com) | Reddit JSON | No (same origin) | ✅ |
| Bookmarklet (reddit.com) | Supabase `ingest-posts` | Yes — but blocked by Reddit CSP first | Avoided by design |
| `ingest.html` (local file) | Supabase `ingest-posts` | Yes — `*` wildcard | ✅ Fixed |
| `ingest.html` (local file) | Supabase `transform-posts` | Yes — `*` wildcard | ⚠️ Missing — needs fix |
| Future Next.js app | Supabase DB (via client lib) | Handled automatically | ✅ |
| Future Next.js app | Supabase Edge Functions | Yes | Add when building |
