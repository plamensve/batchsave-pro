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

## Reset password

The main popup includes **Reset password**. Supabase sends a recovery email to the account's verified email address. Its link opens the `account-recovery` Edge Function, which performs a 302 redirect to the static BatchSave Pro recovery page at `https://plamensve.github.io/DS_ML_DL_PORTFOLIO/batchsave/account-recovery.html`. The recovery token stays in the browser URL fragment and the static page uses it to update the password; no password is sent to the browser extension until the user signs in again.

Add the following exact address under **Authentication → URL Configuration → Redirect URLs**:

`https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/account-recovery`

Without this allowlisted redirect, Supabase may fall back to the configured Site URL and the reset page will not receive the recovery token.


## Production email delivery

The Supabase built-in Auth email provider is for testing only and is limited to **2 Auth emails per hour for the entire project**. Signup confirmation and password-recovery emails share this quota.

For production, configure **custom SMTP** or a **Send Email Hook** in Supabase Authentication. Only after one of those is configured should the project email-sending rate limit be increased under **Authentication → Rate Limits**.

The extension also enforces a short local recovery cooldown so repeated clicks do not waste Auth requests. A Supabase `over_email_send_rate_limit` response is shown explicitly and does not clear or alter the user's login password.
