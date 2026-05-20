# Ingest Tool — Access Control & Setup Guide

The ingest tool (`ingest.html`) makes direct REST calls to Supabase from the browser using the **anon key**. This key is intentionally public-facing — it is not a secret. What controls what the key can actually do is **Row Level Security (RLS)** on each table.

This document covers:
1. [Access control options](#access-control-options)
2. [Environment setup for new deployments](#environment-setup)

---

## Access Control Options

### Path 1 — Keep It As-Is (Anon, No Auth)

#### How it works
Every request uses the anon key with no login. Supabase treats these as the `anon` role. RLS policies decide what that role can read or write.

#### What's exposed
Anyone who finds the anon key (it's in the HTML source) can make the same API calls you can — reading pending posts, approving, rejecting. They would need to know the table structure and endpoints to do anything meaningful.

#### When to choose this
- The tool is for personal use only and not publicly linked
- You accept the low risk of someone stumbling across the key
- You want zero friction — no login, open and use

#### Hardening tip
Tighten RLS so the `anon` role can only read `synced_posts`, not write. Then only an authenticated user (Path 3) can approve/reject.

---

### Path 2 — Password Gate (Client-Side)

#### How it works
A JavaScript prompt or form requires a hardcoded passphrase before any Supabase calls are made. The page is non-functional until the correct password is entered.

#### What's exposed
The password is visible in the HTML source to anyone who views it. This stops casual access but not a determined person who reads the source.

#### When to choose this
- You want a quick deterrent without adding a login system
- The tool URL is not widely shared but you want a lightweight barrier
- You're comfortable with the security tradeoff (obscurity, not real auth)

#### Implementation
Add this at the top of the `<script>` block in `ingest.html`:

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

`sessionStorage` means you only enter the passphrase once per browser tab session.

---

### Path 3 — Supabase Auth (Real Authentication)

#### How it works
A user logs in via Supabase Auth (email/password, magic link, or OAuth). Supabase issues a JWT scoped to that user. RLS policies reference `auth.uid()` to restrict access to verified users only.

#### What's exposed
The anon key is still in the HTML (unavoidable for browser clients), but it can do nothing without a valid authenticated session.

#### When to choose this
- You want real security, not obscurity
- You may share the tool with other trusted moderators
- You want an audit trail of who approved/rejected what

#### Implementation overview
1. Enable Email Auth in your Supabase Auth settings
2. Create your user account via Authentication → Users → Invite
3. Add the Supabase JS client to `ingest.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   ```
4. Initialize with `createClient(SUPABASE_URL, ANON_KEY)` and call `supabase.auth.signInWithPassword()`
5. Update RLS policies on `synced_posts`:
   ```sql
   -- Allow read for anon
   CREATE POLICY "anon can read pending"
     ON synced_posts FOR SELECT TO anon
     USING (status = 'pending');

   -- Allow write only for authenticated users
   CREATE POLICY "authenticated can update status"
     ON synced_posts FOR UPDATE TO authenticated
     USING (true) WITH CHECK (true);
   ```

---

### Path Comparison

| Path | Friction | Security | Best For |
|------|----------|----------|---------|
| Anon (no auth) | None | Low | Solo personal tool, locked-down RLS |
| Password gate | Minimal | Medium | Deterrent without login infrastructure |
| Supabase Auth | Login required | High | Shared tools, audit trails, real enforcement |

All three paths benefit from RLS hardening — tightening what the anon role can do is recommended regardless of which path you choose.

---

## Environment Setup

This section is for anyone setting up RedditMirror in their own Supabase environment.

### Prerequisites
- A [Supabase](https://supabase.com) account and project
- Node.js (for local Supabase CLI use, optional)
- A Reddit account with a [script-type OAuth app](https://www.reddit.com/prefs/apps) (read-only scope)

---

### Step 1 — Create your Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note your **Project URL** and **anon key** from Settings → API
3. These replace the hardcoded values in `ingest.html`:
   ```js
   var SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
   var ANON_KEY     = 'YOUR_ANON_KEY';
   ```

---

### Step 2 — Create required tables

Run the following SQL in your Supabase SQL editor (Database → SQL Editor):

```sql
-- Community config: one active row per deployment
CREATE TABLE community_config (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  is_active  boolean DEFAULT true,
  subreddit  text NOT NULL DEFAULT 'Maine',
  label      text
);

-- Raw posts as ingested from Reddit
CREATE TABLE source_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid REFERENCES community_config(id),
  reddit_id         text UNIQUE NOT NULL,
  title             text NOT NULL,
  url               text,
  permalink         text,
  author            text,
  score             integer DEFAULT 0,
  flair_text        text,
  is_nsfw           boolean DEFAULT false,
  is_spoiler        boolean DEFAULT false,
  is_deleted        boolean DEFAULT false,
  reddit_created_at timestamptz,
  ingested_at       timestamptz DEFAULT now()
);

-- Posts queued for moderator review
CREATE TABLE synced_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id      uuid REFERENCES community_config(id),
  source_post_id uuid REFERENCES source_posts(id),
  status         text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','delivered')),
  scheduled_for  timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now()
);

-- Activity log for pipeline events
CREATE TABLE activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id  uuid REFERENCES community_config(id),
  action     text,
  status     text,
  message    text,
  created_at timestamptz DEFAULT now()
);
```

---

### Step 3 — Enable Row Level Security

Run this to enable RLS on all tables (required for anon key access to work safely):

```sql
ALTER TABLE community_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log     ENABLE ROW LEVEL SECURITY;

-- Allow anon to read everything (tighten per your chosen security path)
CREATE POLICY "anon read" ON community_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon read" ON source_posts     FOR SELECT TO anon USING (true);
CREATE POLICY "anon read" ON synced_posts     FOR SELECT TO anon USING (true);
CREATE POLICY "anon read" ON activity_log     FOR SELECT TO anon USING (true);

-- Allow anon to update synced_posts status (remove this if using Path 3)
CREATE POLICY "anon update status" ON synced_posts FOR UPDATE TO anon
  USING (true) WITH CHECK (true);
```

---

### Step 4 — Deploy Edge Functions

The pipeline uses two Supabase Edge Functions. Deploy them via the Supabase CLI:

```bash
supabase functions deploy ingest-posts
supabase functions deploy transform-posts
```

Source files are in the `supabase/functions/` directory of this repo. Both functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment — these are set automatically in hosted Supabase projects.

---

### Step 5 — Seed community_config

Insert one active config row for your target subreddit:

```sql
INSERT INTO community_config (is_active, subreddit, label)
VALUES (true, 'Maine', 'r/Maine Mirror');
```

Replace `'Maine'` with your subreddit name if mirroring a different community.

---

### Step 6 — Update ingest.html

Replace the hardcoded credentials at the top of the `<script>` block:

```js
var SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
var ANON_KEY      = 'YOUR_ANON_KEY';
```

Then choose your security path (see [Access Control Options](#access-control-options) above) and apply any additional hardening.

---

### Step 7 — Host ingest.html

The tool must be served over `http://` or `https://` — it will not work when opened as a local `file://` URL due to browser security restrictions.

Recommended options:
- **GitHub Pages** — free, auto-deploys on push. Enable in repo Settings → Pages, point to `/docs` branch
- **Netlify Drop** — drag the `docs/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)
- **Any static host** — Vercel, Cloudflare Pages, S3, etc.

---

### Checklist

- [ ] Supabase project created
- [ ] Tables created and RLS enabled
- [ ] Edge functions deployed
- [ ] `community_config` seeded
- [ ] `ingest.html` updated with your project URL and anon key
- [ ] Tool hosted over HTTP/HTTPS
- [ ] Security path chosen and applied
