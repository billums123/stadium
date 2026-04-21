# Deploy checklist

Ship order for the ~1 hour before the submission deadline.

## 1. Env var (30 seconds)

```bash
cp .env.example .env
# paste your ElevenLabs key into VITE_ELEVENLABS_API_KEY
```

## 2. Smoke-test locally (2 minutes)

```bash
npm run dev
# open http://localhost:5173 in Chrome
# tap GO → should hear 3 cold-open lines (two voices alternating)
# tap SIM · RUN PACE → should hear a pace-surge line after ~14s
# tap LINE HYPE → should force-fire an immediate line
# tap the ◉ PHOTO FINISH button → PNG downloads
# tap STOP → career stats persist (reload and check cold-open references them)
```

If any step fails, fix before deploying.

## 3. Build + deploy (5 minutes)

### Vercel

```bash
npm install -g vercel
vercel deploy --prod
# follow prompts; accept the inferred Vite settings
# when asked about env vars, paste VITE_ELEVENLABS_API_KEY
```

### Cloudflare Pages

```bash
npm run build
npm install -g wrangler
wrangler pages deploy dist --project-name stadium
# set VITE_ELEVENLABS_API_KEY in the Cloudflare dashboard → redeploy
```

### Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
# set the env var in the Netlify dashboard
```

## 4. Real-device QA (10 minutes)

On your actual phone, open the deployed HTTPS URL. Don't skip this — on
iOS Safari, motion and mic permissions behave very differently from
Chrome desktop.

- **iOS Safari** (iPhone):
  - Tap GO. Allow motion, allow mic. Both prompts should appear on the
    first tap.
  - Confirm the cold-open fires and the two voices sound different.
  - Confirm the screen doesn't dim while you hold the phone (wake
    lock is active).
  - Confirm "Add to Home Screen" installs with the STADIUM icon.
- **Android Chrome:**
  - Same checks. Web Speech API works here — shout into the phone and
    confirm a quote line fires.

If the iOS motion prompt never appears, you're on HTTP instead of HTTPS
— re-check the deployed URL.

## 5. Push to GitHub (2 minutes)

```bash
gh repo create stadium --public --source=. --push
# or just: git remote add origin <url> && git push -u origin main
```

## 6. Film + post (see VIDEO.md, POSTS.md)

## 7. Submit

Submission page on hacks.elevenlabs.io:

- Paste the deployed URL.
- Paste the GitHub URL.
- Use the blurb at the end of POSTS.md.
- Upload / link the video.
- Include links to all four social posts. Each is +50 points.

Submission deadline: Thursday, April 23, 5 PM.
