# Getting Meta approval for TWWIOS Relay (WhatsApp)

Meta decides approval. Nothing in this repo can guarantee it. This kit gets you review-ready so it is not rejected for avoidable reasons.

## What you are applying for
**Tech Provider**: a company whose software lets business customers send WhatsApp messages. You need:
1. A **verified business** (TWWIOS Technologies Private Limited) in Meta Business Manager.
2. A **Meta app** (type: Business) with the WhatsApp product added.
3. **App Review** passed for two permissions at Advanced access: `whatsapp_business_messaging` and `whatsapp_business_management`.
4. **Embedded Signup** configured, so customers connect their own WhatsApp account inside your product.
(Source: Meta "Get started for Tech Providers" documentation.)

## Step 0. Before you open the Meta dashboard
| Need | Notes |
|---|---|
| Public website on your own domain | Must show the company name that matches your registration |
| Privacy Policy URL | `https://YOUR-DOMAIN/privacy` (built in this repo; fill in the [ ] items first) |
| Terms of Service URL | `https://YOUR-DOMAIN/terms` |
| Data deletion URL | `https://YOUR-DOMAIN/data-deletion` (and the in-product Delete account button works) |
| App icon | 1024x1024 PNG |
| Business documents | Certificate of incorporation, GST certificate or PAN, a recent utility/bank document showing the registered address. Name and address must match everywhere |
| Business email on your domain | Used for verification and review contact |

## Step 1. Business verification
Meta Business Settings > Security Center > Start verification. Use the exact legal name and address from your incorporation documents. Most delays come from mismatched names or addresses.

## Step 2. Create the app
developers.facebook.com > Create app > Business. Add the **WhatsApp** product and **Facebook Login for Business**. App settings: add icon, privacy, terms and data deletion URLs, category (Business and pages). Add your site domain under allowed domains for the JavaScript SDK.

## Step 3. Embedded Signup
In the app dashboard open WhatsApp > Embedded Signup Builder, create a configuration, copy the **App ID** and **Configuration ID**. Then set on the API server:
```
FB_APP_ID=...      FB_APP_SECRET=...      WA_CONFIG_ID=...
WA_APP_SECRET=...  (same as FB_APP_SECRET)  WA_VERIFY_TOKEN=...
```
The "Connect WhatsApp" button appears in the product (Settings) once these are set. Webhook: set callback `https://YOUR-API/api/pulse/webhook`, your verify token, subscribe to **messages** and **phone_number_quality_update**.
Check the exact token-exchange, `subscribed_apps` and `register` calls against the builder's generated code; the server implements the standard flow (`api/pulse/wa.js`).

## Step 4. App Review: what to submit
Request Advanced access for both permissions. Meta asks for use-case text and screen recordings.

**Use-case text (paste and adapt)**
> TWWIOS Relay lets businesses send WhatsApp messages to customers who have opted in. Businesses connect their own WhatsApp Business Account through Embedded Signup. They upload opted-in contacts with the source of consent, choose an approved message template, and send campaigns. The product enforces opt-outs (STOP), per-customer frequency limits and WhatsApp messaging limits, shows delivery status, and lets the business reply to customers. `whatsapp_business_messaging` is used to send template and reply messages and receive delivery and reply events. `whatsapp_business_management` is used to read the customer's phone number quality and limits and to list and create message templates.

**Video 1: message sent from the app and received on WhatsApp** (screen record, 1 to 2 minutes, narrate in English)
1. Sign in to the product. Settings > Connect WhatsApp (Embedded Signup) with a test business number.
2. Contacts > upload a sheet with your own test number, choose opt-in source, tick consent, Import.
3. Campaigns > choose an approved template, Shield check, Start campaign.
4. Show the message arriving on a real phone's WhatsApp (record the phone screen too).
5. Reply STOP from the phone; show the confirmation and the contact marked Opted out.

**Video 2: creating a message template in the app**
1. Templates > New template: type name, category, body with {{1}}.
2. Show the built-in checker warnings, fix them, Submit for approval.
3. Show the template appearing in the list with its status from Meta.

Meta also accepts a cURL recording as alternative evidence; the product recording is stronger.

## Step 5. Test before you submit
- Use Meta's test number or a spare real number. Send to your own phone.
- Run a campaign of 3 contacts end to end and confirm statuses arrive via the webhook.
- Confirm webhooks verify (signature check) and STOP works.
- Make the app **Live** (not Development) before review.
- Give reviewers a **test login** to the product in the submission notes, with some sample data loaded.

## Common reasons for rejection, and how this product avoids them
| Reason | What to do |
|---|---|
| Video does not show the permission in use | Follow the two scripts above exactly |
| Privacy policy missing, generic or unreachable | Fill in and publish the pages in this repo |
| Business name mismatch | Same legal name on site, policy, verification and app |
| Login not available to reviewers | Provide working test credentials |
| App looks like spam tooling | The product requires consent attestation, honours STOP, caps frequency; mention this in the use-case text |
| App in Development mode | Switch to Live |

## After approval
- New customers connect with one click. Until then customers can paste their own token (Settings).
- Meta prices messages per delivered template. India billing moves to INR by 31 Dec 2026; set this up with your finance team.
- Watch quality ratings. Relay pauses campaigns on red quality or spam-rate errors; do not override that.

## What is not done in this repo
- Billing and payments (Razorpay) are not connected; plans are enforced as limits.
- Legal pages are drafts with [ ] blanks. Have a lawyer review them.
- Nothing has been tested against Meta's live servers, only against a mock. Test with a real number first.
