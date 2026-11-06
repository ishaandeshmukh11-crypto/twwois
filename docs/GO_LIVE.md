# Relay by TWWIOS: go-live and selling guide

## How a customer's day looks (this is the product)
1. Customer opens your site, clicks Relay, **signs up** (company, email, password). They get a free trial in demo mode.
2. Overview shows **Get live** with one button: **Connect WhatsApp** (Facebook popup, picks or creates their WhatsApp Business account and number). No tokens, no developer account, nothing to copy.
3. They upload their **Excel/CSV**, tick the consent confirmation, write or pick a message, press send. Shield does the safe sending.
4. Settings, **Your plan**: Starter or Growth, pays monthly by UPI/card through Razorpay. Plan activates by itself after payment. If they stop paying, sending stops after the paid period (2 days grace). Contacts and history stay.

## What YOU do once (TWWIOS, as Tech Provider)
Meta approval belongs to TWWIOS, not to each customer. Do it once, then every customer connects with one click.
1. Facebook Business Manager for TWWIOS Technologies Private Limited, complete **Business Verification** (needs registration documents).
2. developers.facebook.com, create a Business app, add WhatsApp, apply to become a **Tech Provider**, request advanced permissions `whatsapp_business_management` and `whatsapp_business_messaging` (record the 2 review videos, scripts are in `META_APPROVAL.md`).
3. Create the **Embedded Signup configuration**, copy `WA_CONFIG_ID`. Put these on the server: `FB_APP_ID`, `FB_APP_SECRET`, `WA_CONFIG_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`.
4. In the app's WhatsApp webhook settings: callback `https://YOUR-DOMAIN/api/pulse/webhook`, verify token = `WA_VERIFY_TOKEN`, subscribe to `messages`.
5. Test once with your own number, then onboard a first friendly customer.
Until step 2 is approved, customers can still connect manually (Settings, advanced) with their own Meta token, and everyone can use demo mode.

## Billing (Razorpay)
1. Razorpay dashboard, Subscriptions, create 2 monthly **Plans** (Starter, Growth). Copy their plan ids.
2. Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_GROWTH`, `PRICE_STARTER`, `PRICE_GROWTH` (display only, the real price is the Razorpay plan).
3. Razorpay webhook: URL `https://YOUR-DOMAIN/api/pulse/billing/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`.
4. Without Razorpay keys the Pay buttons say "contact TWWIOS" and you can still activate manually with `POST /api/pulse/admin/plan`.

## Deploy
Any server with Docker: `cp api/.env.example api/.env`, fill it (set long random `AUTH_SECRET`, `ENC_KEY`, `PULSE_ADMIN_KEY`), set `PUBLIC_URL`, run `docker compose up -d --build`, put HTTPS (Caddy/Cloudflare) in front of port 3000. Back up the Mongo volume daily.

## Before the first paying customer
- Lawyer reviews Terms, Privacy, Data deletion pages and fills the blanks (address, grievance officer).
- Add GST invoicing (Razorpay can issue invoices) and a support email/WhatsApp number.
- Test with a real number and a small real list (20 contacts who agreed).
- Password reset and email confirmation are built: create a Resend account, verify your domain, set RESEND_API_KEY, MAIL_FROM, PUBLIC_URL.

## Instagram and Facebook (same plan, same Meta app)
Customers connect from Relay, Instagram & Facebook tab: Facebook login, pick their Page (their Instagram Business account must be linked to that Page). Comment-to-DM, DM keyword replies, welcome replies, public replies and an inbox are included. Monthly automated-message cap per plan: Trial 100, Starter 2,000, Growth 20,000.
In your Meta app (the same one used for WhatsApp):
1. Add the **Messenger** and **Instagram** products. Webhook callback `https://YOUR-DOMAIN/api/pulse/social/webhook`, verify token `WA_VERIFY_TOKEN` (or `SOCIAL_VERIFY_TOKEN`). Instagram fields: `comments`, `messages`. Page fields: `feed`, `messages`.
2. Request **Advanced Access** in App Review for: `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `business_management`. Record a short video per use case (comment on a post, customer gets a DM; customer messages, gets a reply).
3. Meta rules Relay follows: a private reply is sent once per comment, replies to DMs only within 24 hours of the person's last message, STOP is honoured, no cold DMs to people who never interacted. Do not add bulk cold DM features: they get apps banned.
Without approval, only people with a role on your Meta app (admins, developers, testers) can be automated, which is enough to demo and record the review videos.
