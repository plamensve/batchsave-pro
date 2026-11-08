# BatchSave Pro — product direction

The primary purpose is to download **real attached files and substantive photographs**, not the page's icons, logos and UI assets.

### Implemented in prototype 0.4.0
- Default "Relevant files" shows actual document/file URLs and meaningful photos.
- "Attachments" detects explicit HTML download links, including links without an extension.
- "Photos" hides small inline images (<240x180); users can opt in to all page assets.
- The browser keeps explicit `download` filenames when provided.

### Priority integration: Gmail
Gmail attachment URLs are not ordinary link URLs. The extension **does not currently download Gmail attachments**. The official Gmail API and explicit Google OAuth are required; do not scrape Gmail's private API or cookies.

1. Assign a **stable Chrome extension ID** through Chrome Web Store.
2. Set up Google Cloud Console app, enable Gmail API, configure OAuth consent.
3. Create Chrome Extension OAuth client matching the extension ID.
4. Use Chrome `identity` OAuth flow with only `gmail.readonly` when needed.
5. List message parts through the official Gmail API; fetch attachments via `users.messages.attachments.get`; download or ZIP locally, without uploading content to our server.
6. Test personal and Google Workspace accounts, paginated threads and message parts; prepare OAuth verification for restricted Gmail scope.

Sources: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get and https://developers.google.com/workspace/gmail/api/auth/scopes

**Do not promise Gmail attachment support until authorization and download are tested.**

## Gmail implementation status

The Gmail API attachment listing and local file/ZIP downloader are implemented in a dedicated full-page extension manager. Google OAuth setup, verification and real-account integration tests remain pending. Gmail access requires explicit Google consent and is not active with the placeholder OAuth client ID.
