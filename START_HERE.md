# TWWIOS: start here

Stack: Next.js (web/), Node.js + Express (api/), MongoDB.

## Run on your computer
1. `cp api/.env.example api/.env` and fill in MONGODB_URI (a free MongoDB Atlas URI works).
2. `cd api && npm install && npm start` (port 4000)
3. `cd web && npm install && npm run dev` (port 3000), then open http://localhost:3000

## Run on a server
`docker compose up -d --build` (see docs/GO_LIVE.md).

## Edit company details
`web/lib/company-details.js`: add address, email, phone, GSTIN.

## Inquiries and chatbot
- Website form and chat leads are saved in MongoDB (Inquiry collection).
- Read them: GET /api/admin/inquiries with header `x-admin-key: <PULSE_ADMIN_KEY>`.
- Set INQUIRY_TO in api/.env to get an email for each inquiry.
- Set ANTHROPIC_API_KEY to let the chatbot answer open questions.

## Scribe live demo (visitors upload their own invoice)
Needs ANTHROPIC_API_KEY in api/.env. Limits: 4 MB per file, SCRIBE_DEMO_PER_IP tries per visitor per day (default 3), SCRIBE_DEMO_DAILY_CAP reads per day across everyone (default 150). Files are read in memory and never stored. Each read costs a small API fee, so keep the cap at a number you are happy to pay for.

## The five products
- Relay (messaging) and Mira (AI assistant): full apps with sign-up, at /solutions/whatsapp and /solutions/saathi. Need Meta approval for real WhatsApp/Instagram/Facebook sending (docs/META_APPROVAL.md) and Razorpay for billing.
- Settle, Scribe, Vox: free trial apps at /try/settle, /try/scribe, /try/vox (no sign-up; the browser keeps a workspace). Code: api/suite.js, api/scribe.js, web/public/tools.js.
  - Without ANTHROPIC_API_KEY: Settle uses message templates, Vox uses a simple scripted conversation, Scribe cannot read files. WITH the key all three are fully AI-powered. Set it before launch.
  - Trial Settle prepares reminders for the user to copy; it does not send them (prevents spam abuse). Real sending belongs in a signed-in account.
  - Vox runs in the browser (microphone + typing). A real phone line needs a Twilio number: set its voice webhook to POST /api/suite/vox/twilio?b=Business&c=Customer&g=payment (written, not tested without a Twilio account).

## Before going public
Confirm the case studies, counters and community programmes (they are illustrative), run trademark checks on Relay, Mira, Settle, Scribe and Vox, and finish Meta and Razorpay approvals (docs/META_APPROVAL.md).
