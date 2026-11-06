# TWWIOS — Next.js + Node.js + MongoDB

```
twwios-app/
  web/   Next.js 14 (App Router), fully responsive frontend
  api/   Express + Mongoose backend (MongoDB)
```

## Run locally
1. MongoDB running locally, or an Atlas URI.
2. `cd api && cp .env.example .env && npm install && npm run dev`   (http://localhost:4000)
3. `cd web && cp .env.example .env.local && npm install && npm run dev`   (http://localhost:3000)

The web app proxies `/api/*` to the API (`API_URL`), so no CORS setup is needed in dev.

## API
- `POST /api/demo-requests` saves a Book-a-Demo request (collection `demorequests`)
- `POST /api/chat` routes a task to an agent, saves chat + `workflowruns`
- `POST /api/runs/:id/decision` approve or reject a run (audit trail)
- `GET /api/stats` live counters; `GET /health`

## Deploy
Web: Vercel (set `API_URL`). API: Render/Railway/EC2 (set `MONGODB_URI`, `CORS_ORIGIN`).

## Notes
- `API_URL` is read at **build time** by `next.config.mjs` (rewrites), so set it before `next build` (on Vercel: Project Settings > Environment Variables).
- Logos are inlined SVGs (`web/lib/logos.json`, from the simple-icons set), so nothing external is fetched.
- Not yet ported from the original single-file site: the 7-step Studio simulator and the ROI calculator (the chat copilot runs the same agent workflow with approval).


## Company pages
Routes `/about /research /community /impact /trust /privacy /contact` are generated from `web/lib/pages.json` via `app/[slug]/page.js`. Footer and extra diagram sections live in `lib/company.json` / `components/Company.jsx`. Legal details (CIN, address, team) and the privacy policy are placeholders you must supply.

## WhatsApp solution (`/solutions/whatsapp`)
Multi-client login, WhatsApp connection, contacts with consent, templates with a pre-approval checker, campaigns with **Shield** (consent, opt-out, frequency caps, daily-limit-aware sending, test wave, auto-pause), auto-replies, hot-lead detection, and an API to trigger templates from your ERP.

**Run it**
1. `cd api && cp .env.example .env` and set `AUTH_SECRET`, `ENC_KEY`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, `MONGODB_URI`. Without MongoDB the API uses memory (demo only, data lost on restart).
2. `npm i && npm start` in `api/`, then `npm i && npm run dev` in `web/`.
3. Without WhatsApp credentials a client is in **demo mode** (simulated sending). Under Settings they enter Phone number ID, WABA ID and token to go live.
4. In Meta App Dashboard set the webhook to `https://YOUR-API/api/pulse/webhook`, verify token = `WA_VERIFY_TOKEN`, subscribe to `messages`.

**Before selling:** become a Meta Tech Provider (business verification, app review, advanced permissions) to add Embedded Signup; until then clients paste their own token. Billing (Razorpay) is not wired: plans are enforced as limits, set per org in the `orgs` collection (`plan`: trial | starter | growth). Test with a real number before launch. Backend logic is covered by an automated test against a mock Meta API, not against Meta itself.


## Deploy and sell
Developers: start with `docs/DEVELOPER_HANDOFF.md`. Business and Meta steps: `docs/GO_LIVE.md`, `docs/META_APPROVAL.md`.
