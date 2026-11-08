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
- ZIP downloads, file previews, file size filters, international marketing copy.
- Email delivery setup, account/privacy/terms pages, Chrome Store publishing assets and automated browser E2E tests.

## Security
- Publishable Supabase key is intended for browser use; never ship secret/service-role keys.
- Stripe webhook signing secret must only live in Supabase function secrets.
- The extension cannot bypass DRM, CAPTCHAs, private files or website restrictions.
- A Chromium extension running on users' devices cannot provide tamper-proof local DRM.
- This prototype is not ready to accept production payments or for public launch.
