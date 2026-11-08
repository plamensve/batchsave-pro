# Delivery roadmap

## Implemented
- Manifest V3 popup, scanner, filters and batch downloads through Chrome Downloads API.
- Email/password authentication using Supabase Auth.
- Stripe subscription-controlled 72-hour trial, RLS isolation and server-verified entitlement at download.
- Account status and Checkout / Manage Billing buttons (server endpoints must be configured).

## Pending
- Deploy and configure Stripe Edge Functions with **test-mode** secrets, webhook signature verification and test-mode recurring Price ID.
- Enable Stripe Checkout promotion-code entry.
- Configure customer portal, test trial cancellation/payment failures/refunds and replayed webhook events.
- ZIP built locally with a 100 MB/150-file cap, permission prompt for selected origins. Additional QA required for authenticated sites and memory usage.\n- File previews, file size filters, international marketing copy.
- Email delivery setup, account/privacy/terms pages, Chrome Store publishing assets and automated browser E2E tests.

## Security
- Publishable Supabase key is intended for browser use; never ship secret/service-role keys.
- Stripe webhook signing secret must only live in Supabase function secrets.
- The extension cannot bypass DRM, CAPTCHAs, private files or website restrictions.
- A Chromium extension running on users' devices cannot provide tamper-proof local DRM.
- This prototype is not ready to accept production payments or for public launch.

## Priority: real email attachments and photos

Gmail attachment downloads are not implemented. They require a stable Chrome extension ID, Google Cloud OAuth client, Gmail API and restricted-scope verification. Generic HTML download links and substantive photos are prioritized now. Do not claim Gmail download support until its API integration works end-to-end.
