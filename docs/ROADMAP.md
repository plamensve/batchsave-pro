# Roadmap and safeguards

## Milestone 1 — local downloader (implemented)
- Detect visible image elements and direct document links in the active tab.
- Filter by image, PDF, or other supported direct file links.
- Multi-select, bulk browser downloads, safe filenames, duplicate removal.
- Does not bypass DRM, authentication, CAPTCHA, or protected downloads.
- Some blob URLs, CSS background images, dynamic JS assets and CORS-limited resources are unsupported.

## Milestone 2 — premium product (pending dedicated Supabase project)
- Supabase Auth with authenticated email or OAuth login.
- Server-controlled 72-hour trial from account creation (not local storage).
- Server-signed entitlement check and enforced gating **before** download action.
- Stripe Checkout subscription at €9.90 monthly with 3-day trial and promotion codes.
- Verified Stripe webhooks for subscriptions, failed payments and cancellations.
- Customer billing portal and privacy/terms pages.
- No payment keys committed to the extension; keys stored as Supabase Edge Function secrets.
- Test/Live Stripe modes must use separate price IDs.
- If browser is offline, fail closed for premium operations.

## Milestone 3
- ZIP archive and configurable filename patterns.
- Optional image previews and dimensions/size filters.
- Localization and Chrome Web Store submission.

Note: no subscription gate is active in the current 0.1.0 prototype. Do not publish this build as a paid product.
