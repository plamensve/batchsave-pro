# Supabase Auth email confirmation

Supabase project: `gcfyaaqqsqrjwujpymjz`

## Dashboard configuration (required)

Visit: https://supabase.com/dashboard/project/gcfyaaqqsqrjwujpymjz/auth/url-configuration

Set **Site URL** to:

`https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/checkout-return?result=email-confirmed`

Under **Redirect URLs**, add the exact same URL:

`https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/checkout-return?result=email-confirmed`

Remove `http://localhost:3000` when no longer used as a development callback.

The Chrome extension already requests this redirect on `/auth/v1/signup`. The Edge Function `checkout-return` displays confirmation and instructs the user to return to BatchSave Pro and sign in with their email and password.

**Important:** Registration doesn't automatically authenticate the extension. The user must sign in after confirmation. No raw access tokens are shared with the public confirmation page.

## Verification

- Sign up with a new test email address.
- Verify the email in the inbox.
- The browser should land on the confirmation page rather than localhost.
- Reopen the Chrome extension; sign in with the same email and password.
- Check that the account panel shows the three-day Stripe trial CTA (payments are disabled until Stripe secrets are configured).

Existing confirmed users can sign in immediately without registering again.
