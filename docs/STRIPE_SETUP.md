# Stripe integration checklist

1. In **Stripe Test Mode**, create a monthly EUR 9.90 price. Do not use a live `price_` ID with a test key.
2. Set Supabase Edge Function secrets: `STRIPE_SECRET_KEY` (test key), `STRIPE_PRICE_ID` (matching test mode Price ID) and `STRIPE_WEBHOOK_SECRET` (signing secret after endpoint creation). Do not commit keys or share them in chat.
3. Register Stripe webhook endpoint: `https://gcfyaaqqsqrjwujpymjz.supabase.co/functions/v1/stripe-webhook`.
4. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. Enable Stripe Customer Portal to allow subscription cancellation, payment method updates and invoice history.
6. Verify Checkout with Stripe test card, 3-day trial, promotion codes and subsequent payment.
7. Test expired cards, cancellation during trial, cancellation after payment, webhook retry/idempotency and out-of-order events. Do not activate live mode before all cases pass.

**Trial:** Payment method is collected in Stripe Checkout; the first three days are free. On future subscriptions for an account whose trial was already consumed, Stripe bills immediately. Subscription state (not a local clock) grants or denies download access. When a trial ends without a valid payment, Stripe will update status and access is revoked by the entitlement RPC.

**Security:** Never enter Stripe secret keys in the extension; store them using Supabase function secrets only. Use a dedicated test webhook signing secret, distinct from live.
