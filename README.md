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

## Product direction

The default filter now prioritizes real file links and substantial photos instead of icons and website graphics. HTML `download` links are recognized even when their URLs have no extension. Gmail attachments still require the official Gmail API and explicit Google OAuth consent; page scanning cannot fetch Gmail attachments. See [Product Direction](docs/PRODUCT_DIRECTION.md).

## Gmail attachment downloader

Chrome popup → **Open Gmail attachments** opens the full-page Gmail attachment manager. The code uses the official Gmail API with Chrome Identity, lists emails matching Gmail search syntax, retrieves real file parts and exports individual files or local ZIP archives. **A Google Cloud OAuth client is required to activate the Gmail connection.** See [Gmail OAuth Setup](docs/GMAIL_SETUP.md). Google has not approved this OAuth application for public users yet. No Gmail data is uploaded to Supabase.

## Main-popup Gmail workflow (0.6.0)

Open Gmail, open the regular BatchSave popup, then select **Scan this page**. The extension uses the official Gmail API to list real email attachments (the first 35 matching messages, default search `has:attachment`). Select files and choose **Download files** or **Download ZIP**. It does not automatically isolate the single Gmail message currently open. To activate the feature, configure the real Chrome Extension Google OAuth client ID in `manifest.json` as documented in [Gmail Setup](docs/GMAIL_SETUP.md). Until OAuth is configured, the popup displays a setup link.

When Sign in reports invalid credentials, use **Reset password** and follow the recovery email. The `account-recovery` redirect must be allowlisted in Supabase Auth. See [Auth Setup](docs/AUTH_SETUP.md).
