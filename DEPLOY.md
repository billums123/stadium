# Deploy checklist

Ship order for the ~1 hour before the submission deadline.

## Architecture note

As of the most recent commit, **API keys live server-side only.** The
browser never sees them. Every ElevenLabs / OpenAI call goes through
same-origin `/api/*` Vercel serverless functions that hold the
credentials in `process.env`.

Env vars (no `VITE_` prefix — these are server-side):
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY`

Local `.env` works the same way; the Vite dev plugin (`apiDevPlugin`
in `vite.config.ts`) mounts the same handlers for `npm run dev`.

## 1. Env (30 s)

```bash
cp .env.example .env
# paste both keys into .env
```

## 2. Local smoke-test (2 min)

```bash
npm run dev
# open http://localhost:5173
# tap GO → listen for welcome → 3-2-1 beeps → horn
# HUD appears AFTER the horn; timer starts from 00:00 then
# tap SIM · RUN PACE → a pace-surge line should fire after ~14s
# tap LINE HYPE → force-fires an immediate line
# tap ◉ SHARE in the scoreboard → photo-finish PNG downloads
# tap STOP → career stats persist (reload and cold-open references them)
```

If any step fails, fix before deploying.

## 3. Build + deploy (5 min)

### Vercel (recommended)

```bash
npm install -g vercel
vercel link                       # one-time: link this dir to a Vercel project
vercel env add ELEVENLABS_API_KEY production
vercel env add OPENAI_API_KEY production
vercel deploy --prod
```

Vercel auto-detects Vite for the frontend build and picks up each
`/api/*.ts` as a Node serverless function. Nothing else to configure.

### Other hosts

Cloudflare Pages / Netlify can also run Node serverless functions, but
the handler signature / file conventions differ slightly. For a
hackathon, stick with Vercel.

## 4. Real-device QA (10 min)

On your actual phone, open the deployed HTTPS URL. Don't skip — iOS
Safari handles motion, mic, and audio-context permissions differently
from desktop Chrome.

- **iOS Safari:**
  - Tap GO. Allow motion + mic on the first tap. Audio context must
    initialise inside that same gesture or the countdown beeps will
    be silent.
  - Confirm welcome voice, 3-2-1 beeps, horn, and then clock at 00:00.
  - Screen should stay awake while holding (wake lock is active).
  - "Add to Home Screen" should install with the STADIUM icon.
- **Android Chrome:**
  - Same checks. Web Speech API works here — shout into the phone and
    confirm a quote line fires.

If the iOS motion prompt never appears, you're on HTTP, not HTTPS.

## 5. Push to GitHub (2 min)

```bash
gh repo create stadium --public --source=. --push
```

## 6. Submit

Submission page on hacks.elevenlabs.io:
- Deployed URL
- GitHub URL
- Video link
- Links to each social post (+50 points each)
- Written blurb

Deadline: Thursday, April 23, 5 PM.
