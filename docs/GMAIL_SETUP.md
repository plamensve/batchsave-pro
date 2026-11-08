# Gmail integration — required one-time Google Cloud configuration

The browser extension includes production-shaped Gmail API code, but **Google OAuth consent cannot work until you configure a real OAuth client ID**. Do not ship the placeholder ID.

## Developer setup

1. Open https://console.cloud.google.com/ and select/create a project for BatchSave Pro.
2. Enable **Gmail API** under APIs & Services > Library.
3. Configure Google Auth Platform branding and audience, add your own email as a test user while in Testing.
4. Under Google Auth Platform > Clients, create an **OAuth client ID** of type **Chrome Extension**.
5. The Gmail manager includes a **Copy extension ID** button; use the copied 32-character value as Google Cloud **Item ID**. Chrome requires a **stable extension ID**. The easiest approach is to upload an unpacked draft to Chrome Web Store (do not publish) and use its generated extension ID, then add that ID to the Google OAuth client. If testing only locally, generate/retain a consistent extension key; do not commit sensitive private keys.
6. Replace `000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com` in `manifest.json` > `oauth2.client_id` with the new Chrome Extension OAuth client ID.
7. Reload the extension in `chrome://extensions`.
8. Press **Connect Gmail**. Google will request explicit read-only consent.
9. Test by opening Gmail, choosing **Find Gmail attachments**, selecting files, and downloading/ZIP-exporting.

OAuth scope: `https://www.googleapis.com/auth/gmail.readonly` (restricted). For public distribution, Google's OAuth verification may be required and a security assessment could apply if restricted user data is stored/transmitted to servers. BatchSave Pro handles Gmail data locally and does not upload email content or attachment bytes to Supabase.

The Gmail API lists messages using Gmail search syntax (default `has:attachment`) and downloads parts using their official attachment IDs; it **does not** scrape private Gmail endpoints.

**Limitations:** Gmail results are mailbox search results, not guaranteed to correspond to whichever message is currently highlighted. BatchSave Pro remains subscription-gated, so an active trial or manual tester license is required to download. The popup must remain open while files download; large exports are limited to 100 MB in the ZIP.

References:
- https://developer.chrome.com/docs/extensions/reference/api/identity
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get
- https://developers.google.com/workspace/gmail/api/auth/scopes
