# Marketing conversion tracking — isolated Phase 1

**Status: code only; NOT activated.** This is a staging collector for Stripe-confirmed
trial starts and first non-zero paid invoices. It does **not** send Google Ads
conversions yet. It does not implement sign-up tracking.

## Safety boundaries
- The existing `create-checkout`, `stripe-webhook`, `billing-portal` and
  `checkout-return` functions are unchanged.
- A dedicated second Stripe webhook destination sends events to
  `/functions/v1/marketing-stripe-webhook`.
- Uses its **own** signing secret `STRIPE_MARKETING_WEBHOOK_SECRET`.
  Do not copy the existing billing webhook's signing secret.
- Invalid signatures are rejected before database access.
- Writes only to `marketing_conversion_events`; it cannot grant access
  or alter subscriptions. Deduplication uses Stripe event ID and
  (subscription ID, conversion kind).
- No emails, card details, or full Stripe payloads are stored.
- If marketing processing fails, ONLY the *second* webhook may retry.
  Subscription entitlements continue through the original webhook.
- There is no trigger on or migration of the existing billing tables.

## Deployment checklist (requires separate authorization and configuration)
1. Test with Stripe test-mode events in a nonproduction Supabase project.
2. Apply `202611101500_marketing_conversion_events.sql` and verify RLS/permissions.
3. Deploy **only** `marketing-stripe-webhook`, with JWT verification disabled
   as specified in `supabase/config.toml`. Do not redeploy billing functions.
4. In Stripe, create a **new**, independent event destination for
   `checkout.session.completed` and `invoice.paid`, pointing to that URL.
   Do not alter the existing billing destination.
5. Set its new `whsec_...` as the Supabase secret
   `STRIPE_MARKETING_WEBHOOK_SECRET`. Never commit the secret.
6. Test a fresh trial checkout, a paid invoice, repeated event delivery,
   and an invalid signature. Verify staging has no duplicate conversion
   kinds for a subscription. Confirm that the original `subscriptions`
   state is unaffected.
7. Only after identifying a reliable Google Ads click-to-user attribution
   bridge and the relevant data-sharing consent should we activate
   Google Ads Data Manager conversion imports.

## Event semantics
- `trial_started`: completed subscription Checkout where the Stripe
  subscription has a trial covering the Checkout event timestamp.
- `first_paid`: first observed positive `invoice.paid` per subscription;
  zero-value trial invoices are excluded. For subscriptions existing before
  activation, this event is the first **observed** positive invoice, not
  guaranteed to be their historical first payment. Do not advertise it
  as first-time customers without backfill or a campaign-start cutoff.
- The Supabase profile's own trial date is a separate concept; never count
  it as the Stripe trial.
- Google Ads `Sign-up` is not triggered by Stripe. Registration in the
  Chrome extension must be tracked separately, preserving attribution.

## Why not direct Google Ads upload?
A verified Stripe payment alone does not identify the originating ad click.
The current checkout associates a Supabase user ID with a Stripe subscription,
but does not store Google Ads click identifiers or consent. Sending conversion
events without linkage can lead to inaccurate attribution. New integrations
should use Google Ads Data Manager API, subject to Ads account configuration,
rather than assume the legacy Ads API upload endpoint is available.

## Tests
`node --test tests/marketing-isolation.test.js`

**Do not activate the second Stripe destination until database migration,
deployment, and test verification have been completed.**
