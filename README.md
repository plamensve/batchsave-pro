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

## Gmail: scan current open message (prototype 0.7.0)

While viewing an open Gmail conversation, click **Scan this page** in the regular extension popup. BatchSave first looks for Gmail's visible attachment cards and shows their filenames **without Google OAuth**. Select files and click **Download files**; this triggers Gmail's own visible Download buttons. This is experimental because Gmail DOM classes and controls may change. It cannot scan the whole mailbox or build ZIPs from Gmail attachment data without the official Gmail API and Google OAuth. The full Gmail API mode continues to require setup in `docs/GMAIL_SETUP.md`.

Status and errors are shown directly below the Scan button; the user should not need to scroll to the bottom. The extension does not bypass Google authentication, access controls or Gmail's disabled downloads.

## Gmail quick test — v0.7.1

Open a Gmail message with a visible attachment card and press **Scan this page**. The popup hides the old `has:attachment` field for current-message scanning, lists the attachment with a decoded filename, and keeps **Download selected** visible in the popup footer. One discovered attachment is selected automatically. Click the button to trigger Gmail's own download control. The UI reports that the native click was triggered, not that the file was necessarily saved; confirm the actual download in Chrome.

A temporary owner tester license is available via Supabase entitlement, independent of Stripe billing. Gmail's page structure is not a stable public API: native-click scanning is best effort, while full reliable Gmail attachment retrieval still needs Google OAuth/Gmail API.
