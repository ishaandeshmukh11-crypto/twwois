# Put it live (about 20 minutes)

You need three free accounts: GitHub, MongoDB Atlas, Render. Plus an Anthropic API key.

1. MongoDB Atlas: create a free cluster, add a database user, allow access from anywhere (0.0.0.0/0), copy the connection string.
2. GitHub: create a private repo and upload this folder (without node_modules).
3. Render: New > Blueprint > choose the repo. It reads render.yaml and creates two services.
4. Fill the values: MONGODB_URI, ANTHROPIC_API_KEY, API_URL (the API service URL), PUBLIC_URL and CORS_ORIGIN (the web service URL).
5. Open the web URL. Check /health on the API shows {"ok":true,"db":true}.
6. Send one test inquiry on /contact and try /try/settle, /try/scribe, /try/vox.
7. Add your domain in Render > Settings > Custom Domains.

Relay and Mira sending on real WhatsApp, Instagram and Facebook also needs Meta approval (docs/META_APPROVAL.md) and Razorpay for billing.
Prefer your own server? Run `docker compose up -d --build` (docs/GO_LIVE.md).
