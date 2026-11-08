# BatchSave Pro

A Chrome Manifest V3 extension for discovering and downloading linked files and images.

## Run locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the repository folder.
4. Sign in / register and verify email before using the 72-hour free trial.
5. Visit a standard website and scan for files.

## Subscription

Price: **€9.90 per month**; 72-hour trial begins on initial account creation, independent of billing setup. The Stripe integration will be configured through protected Supabase Edge Functions. Browser-only keys are publishable, never secret.

This is a developer build, **not ready for Chrome Web Store publication**. Stripe secret values have not been provisioned, and actual payments will remain unavailable until configured and tested.

Run local tests: `npm test`.

See [docs/ROADMAP.md](docs/ROADMAP.md).
