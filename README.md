# Forever Cloud — HTML/CSS/JavaScript + Supabase

A small private cloud-drive starter. Users can create accounts, sign in, upload,
list, search, sort, download, and delete their own files.

## 1. Create a Supabase project
1. Create a project at https://supabase.com/.
2. Open Project Settings → API (or Data API / API Keys depending on dashboard version).
3. Copy the Project URL and the `anon` / publishable public key.
4. Open `app.js` and replace:
   - `https://YOUR-PROJECT.supabase.co`
   - `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`
5. Never paste the `service_role` or secret key into frontend JavaScript.

## 2. Create the private storage bucket and access policies
1. In Supabase, open SQL Editor → New query.
2. Paste the contents of `supabase-setup.sql` and run it.
3. The script creates a private `user-files` bucket with a 50 MiB per-file limit.
   Adjust `52428800` in SQL if you want a different limit that your plan supports.
4. Keep the bucket private. The policies restrict each authenticated user to
   objects whose first folder is their own user ID.

## 3. Configure authentication
1. In Authentication → URL Configuration, add your deployed website URL to
   Site URL and Redirect URLs.
2. For a quick test, use email/password authentication.
3. If email confirmation is enabled, users must confirm their email before
   signing in. Configure SMTP for reliable production email delivery.

## 4. Deploy
Upload `index.html`, `style.css`, and `app.js` to any static web host (for example
GitHub Pages, Netlify, Cloudflare Pages, or your own web server). Keep the SQL
file private or public as you prefer; it is only setup instructions.
Use HTTPS in production.

## 5. Important storage expectations
- “Forever” cannot be guaranteed. Files remain available while your Supabase
  project, account, billing, and storage remain active and in good standing.
- Free plans have quotas, upload limits, inactivity/pausing rules, and policies
  that can change. Check the current Supabase plan limits before relying on it.
- Keep a second backup of important files. A cloud bucket is not a backup by itself.
- This starter sets a 50 MiB per-file limit. Increase it only within the limits
  supported by your Supabase plan and upload method.
- For large files, use Supabase resumable uploads (TUS) rather than the simple
  upload method used here.
- Storage usage shown in the UI is the sum of listed file metadata and may not
  include all provider billing/overhead details.

## Security notes
- The browser contains only the Supabase project URL and anon/publishable key.
  This key is intended for public clients; Row Level Security / Storage policies
  are what protect user data.
- Never expose service-role keys, database passwords, or secret API keys.
- Do not add a public read policy to this bucket.
- Consider adding rate limits, malware scanning, and audit logging before
  opening the service to untrusted public signups.
