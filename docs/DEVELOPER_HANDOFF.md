# Developer handoff: take Relay live

Product: Relay by TWWIOS. WhatsApp bulk messaging with a safety layer (Shield), Instagram/Facebook comment-to-DM and auto replies, monthly subscriptions, customer self-signup. Stack: Next.js 14 (web), Node/Express (api), MongoDB. Everything runs with Docker Compose behind Caddy (automatic HTTPS).

## Products in this repo
1. **TWWIOS**, the company site (home, company pages, chatbot, demo booking).
2. **Relay by TWWIOS** (`/solutions/whatsapp`): bulk WhatsApp messaging with Shield, Instagram/Facebook comment-to-DM. Own subscription.
3. **Mira by TWWIOS** (`/solutions/saathi`): AI assistant that answers customers on website chat, WhatsApp, Instagram and Facebook, captures leads and bookings, learns from the customer's website or price list. Own paid-only subscription, no free plan (Starter Rs 1,499, Growth Rs 3,499, prices in env). Backend `api/saathi/*`, UI `web/components/SaathiApp.jsx` with its own design system `saathi.css`. The name lives in `web/lib/saathi.js`.
All three share one login (one TWWIOS account) and the same Meta app, Razorpay account and Resend email.

## Mira setup (extra to the steps below)
- `ANTHROPIC_API_KEY` (console.anthropic.com) and `SAATHI_MODEL` (default `claude-haiku-5-5`). Without the key Mira falls back to a basic matcher and the dashboard tells the customer AI is off. **Do not launch without the key.**
- Razorpay: create 2 more monthly plans (Mira Starter, Mira Growth), set `RAZORPAY_PLAN_SAATHI_STARTER/GROWTH`. Same webhook URL as Relay: the payment notes carry `product: saathi`.
- **AI cost control:** each AI reply costs model tokens. Plans cap replies per month (Starter 2,000, Growth 8,000, in `api/saathi/engine.js`). There is no free plan: new accounts can set up and use the test chat (40 messages a day), but customer-facing replies and the website bubble stay off until the plan is paid or activated from /admin. Check your real cost per reply in the Anthropic console after a week and adjust caps or prices so every plan keeps a margin.
- Website chat widget works without any Meta approval: customers paste one `<script>` line. It is the fastest channel to sell while Meta approval is pending. Set `PUBLIC_URL` correctly: the snippet uses it.
- WhatsApp/Instagram/Facebook for Mira use the same Meta app, webhooks and connections as Relay. Mira answers customer-initiated messages only.
- Learn-from-website fetches customer-supplied URLs server-side. It blocks private/internal addresses (SSRF guard). Never set `SAATHI_ALLOW_PRIVATE_URLS` in production.
- Tests: `node saathitest.mjs` (needs no real keys).

## 0. What the customer experiences (do not change this flow)
Sign up, confirm email, Connect WhatsApp (one click), upload Excel, send. Settings, Your plan: save billing details (GST), choose Starter/Growth, pay with Razorpay, plan active in seconds. Stop paying: sending stops after the paid period. Forgot password works by email.

## 1. Accounts to create (business owner decides who)
| Need | Where | Output |
|---|---|---|
| Server (2 vCPU, 4 GB, Ubuntu, Docker) + domain | any cloud (DigitalOcean/AWS/Hetzner) | server IP, DNS A record for DOMAIN |
| Razorpay (KYC done) | razorpay.com | KEY_ID, KEY_SECRET, 2 monthly Plans (Starter, Growth), webhook secret |
| Resend (verify domain) | resend.com | RESEND_API_KEY |
| Meta (Business Verification, Tech Provider, app) | developers.facebook.com | FB_APP_ID, FB_APP_SECRET, WA_CONFIG_ID, verify token |

Meta steps in detail: `META_APPROVAL.md` and `GO_LIVE.md`. Meta approval takes days to weeks and is decided by Meta. Launch order that avoids waiting: go live with billing + demo mode + manual WhatsApp token connect, switch on one-click connect when Meta approves.

## 2. Deploy (30 minutes)
```
git clone <repo> && cd twwios-app
cp .env.example .env              # set DOMAIN
cp api/.env.example api/.env      # fill every value (table below)
docker compose up -d --build
sh scripts/smoke.sh https://DOMAIN
```
The API refuses to start in production if AUTH_SECRET, ENC_KEY, MONGODB_URI, PULSE_ADMIN_KEY, PUBLIC_URL or WA_APP_SECRET/FB_APP_SECRET are missing. Generate secrets with `openssl rand -hex 32`. Never change ENC_KEY after customers connect WhatsApp (their tokens are encrypted with it).

## 3. api/.env values
| Variable | Meaning |
|---|---|
| AUTH_SECRET, ENC_KEY | random 64 hex chars each |
| PULSE_ADMIN_KEY | password for /admin (16+ chars) |
| FB_APP_ID, FB_APP_SECRET, WA_CONFIG_ID, WA_APP_SECRET, WA_VERIFY_TOKEN | Meta app (WA_APP_SECRET = FB_APP_SECRET) |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PLAN_STARTER, RAZORPAY_PLAN_GROWTH | billing |
| PRICE_STARTER, PRICE_GROWTH | shown price in rupees (must equal Razorpay plan amount) |
| RESEND_API_KEY, MAIL_FROM | email |
| ANTHROPIC_API_KEY, SAATHI_MODEL | Mira AI |
| RAZORPAY_PLAN_SAATHI_STARTER, RAZORPAY_PLAN_SAATHI_GROWTH, PRICE_SAATHI_STARTER, PRICE_SAATHI_GROWTH | Mira billing |

## 4. Webhooks to register
- Meta, WhatsApp: callback `https://DOMAIN/api/pulse/webhook`, subscribe `messages`.
- Meta, Instagram and Page: callback `https://DOMAIN/api/pulse/social/webhook`. Instagram `comments`, `messages`. Page `feed`, `messages`.
- Razorpay: `https://DOMAIN/api/pulse/billing/webhook`, events `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`.
Plan prices: Razorpay plan amount is the source of truth. GST: enable invoices in Razorpay, and set the plan amount with or without GST as your accountant decides.

## 5. Operate
- Admin: `https://DOMAIN/admin`, enter PULSE_ADMIN_KEY. Lists customers, usage, billing details, lets you set plan for 30 days (cash/bank-transfer customers).
- Backups: cron `0 2 * * * /path/scripts/backup.sh`. Copy `backups/` off the server.
- Logs: `docker compose logs -f api`.
- Update: `git pull && docker compose up -d --build`.
- Tests (run on a dev machine with Node 20): `cd api && node pulsetest.mjs && node billtest.mjs && node socialtest.mjs && node authtest.mjs` (each starts its own mock servers on ports 4400-4404/4900-4904).

## 6. Before the first paying customer
1. Fill the blanks in Terms, Privacy, Data deletion (`web/lib/pages.json`: address, email, grievance officer) and get them reviewed by a lawyer.
2. Run `scripts/smoke.sh`, then do a real run: sign up, pay Rs 1 test plan in Razorpay test mode, check the plan activates, switch to live keys.
3. Real WhatsApp test with your own number and 10 contacts who agreed.
4. Put a support email/WhatsApp number in the footer (`web/lib/company.json`).

## 7. Known limits
- Meta approval, Razorpay KYC and the lawyer review cannot be done in code.
- Instagram/Facebook automations for other people's accounts work only after Meta app review (Advanced Access). Until then they work for admins/testers of the Meta app.
- Mira: no PDF upload (customer pastes text or uploads Excel/CSV/TXT), no booking calendar sync, no voice. Test chats are capped at 60 a day per business.
- No refunds UI (do it in Razorpay). One user per company (no team seats yet). No follow-up sequences yet.
