# Ingest Tool — Access Control Guide

The ingest tool (`ingest.html`) makes direct REST calls to Supabase from the browser using the **anon key**. This key is intentionally public-facing — it is not a secret. What controls what the key can actually do is **Row Level Security (RLS)** on each table.

This document explains the three paths available for securing the tool, with guidance on when to choose each.

---

## Path 1 — Keep It As-Is (Anon, No Auth)

### How it works
Every request uses the anon key with no login. Supabase treats these as the `anon` role. RLS policies decide what that role can read or write.

### What's exposed
Anyone who finds the anon key (it's in the HTML source) can make the same API calls you can — reading pending posts, approving, rejecting. They would need to know the table structure and endpoints to do anything meaningful.

### When to choose this
- The tool is for personal use only and not publicly linked
- You accept the low risk of someone stumbling across the key
- You want zero friction — no login, open and use

### Hardening tip
Tighten RLS so the `anon` role can only read `synced_posts`, not write. Then only an authenticated user (Path 3) can approve/reject. This is the best of both worlds if you later add auth.

---

## Path 2 — Password Gate (Client-Side)

### How it works
A JavaScript prompt or form requires a hardcoded passphrase before any Supabase calls are made. The page is non-functional until the correct password is entered. The password never leaves the browser.

### What's exposed
The password is visible in the HTML source to anyone who views it. This stops casual access but not a determined person who reads the source. The anon key is still present.

### When to choose this
- You want a quick deterrent without adding a login system
- The tool URL is not widely shared but you want a lightweight barrier
- You're comfortable with the security tradeoff (obscurity, not real auth)

### Implementation
Add this before any button actions fire:

```js
var PASSWORD = 'your-passphrase-here';
var entered = sessionStorage.getItem('auth');
if (entered !== PASSWORD) {
  var input = prompt('Enter passphrase:');
  if (input !== PASSWORD) {
    document.body.innerHTML = '<p style="color:#f85149;font-family:monospace;padding:40px">Access denied.</p>';
    throw new Error('Unauthorized');
  }
  sessionStorage.setItem('auth', input);
}
```

Place this at the top of the `<script>` block. `sessionStorage` means you only enter it once per browser tab session.

---

## Path 3 — Supabase Auth (Real Authentication)

### How it works
A user logs in via Supabase Auth (email/password, magic link, or OAuth). Supabase issues a JWT scoped to that user. All subsequent API calls include that JWT, and RLS policies can reference `auth.uid()` to restrict access to verified users only.

### What's exposed
The anon key is still in the HTML (unavoidable for browser clients), but it can do nothing without a valid authenticated session. RLS policies enforce that only your specific user account can read or write sensitive tables.

### When to choose this
- You want real security, not obscurity
- You may eventually share the tool with other trusted moderators
- You want an audit trail of who approved/rejected what

### Implementation overview
1. Enable Email Auth in your [Supabase Auth settings](https://supabase.com/dashboard/project/hhyhulqngdkwsxhymmcd/auth/providers)
2. Create your user account via the Supabase dashboard (Authentication → Users → Invite)
3. Add the Supabase JS client to `ingest.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   ```
4. Initialize with `createClient(SUPABASE_URL, ANON_KEY)` and call `supabase.auth.signInWithPassword()`
5. Update RLS policies on `synced_posts` to:
   ```sql
   -- Allow read for anon (so the queue loads)
   CREATE POLICY "anon can read pending"
     ON synced_posts FOR SELECT
     TO anon
     USING (status = 'pending');

   -- Allow write only for authenticated users
   CREATE POLICY "authenticated can update status"
     ON synced_posts FOR UPDATE
     TO authenticated
     USING (true)
     WITH CHECK (true);
   ```

### Tradeoff
Adds a login step on every new session. Worth it if the tool is shared or if approving/rejecting posts has downstream consequences you want to protect.

---

## Summary

| Path | Friction | Security | Best For |
|------|----------|----------|---------|
| Anon (no auth) | None | Low | Solo personal tool, locked-down RLS |
| Password gate | Minimal | Medium | Deterrent without login infrastructure |
| Supabase Auth | Login required | High | Shared tools, audit trails, real enforcement |

All three paths can coexist with RLS hardening — tightening what the anon role can do is a good idea regardless of which path you choose.
