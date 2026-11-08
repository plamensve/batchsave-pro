# BatchSave Pro

A Chrome Manifest V3 extension for discovering and downloading linked files and images.

## Run locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the repository folder.
4. Sign in / register and verify email before using the 72-hour free trial.
5. Visit a standard website and scan for files.

## Subscription

Price: **€9.90 per month**; 72-hour trial begins when the customer starts a Stripe Checkout subscription with a card. Stripe automatically charges after the trial unless canceled. Each account is eligible for one trial. The Stripe integration will be configured through protected Supabase Edge Functions. Browser-only keys are publishable, never secret.

This is a developer build, **not ready for Chrome Web Store publication**. Stripe secret values have not been provisioned, and actual payments will remain unavailable until configured and tested.

Run local tests: `npm test`.

See [docs/ROADMAP.md](docs/ROADMAP.md).

## ZIP downloads

Select files and choose **Download ZIP**. The browser requests access to the selected download origins. ZIP creation is local, limited to 150 items / 100 MB, and requires the Chrome popup to remain open while fetching. Some sources block cross-site fetching, are behind authentication, or redirect to unsupported URLs; use individual downloads in those cases. ZIP uses the STORE method (no further compression).
