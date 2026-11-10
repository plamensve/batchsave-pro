// Dedicated, optional marketing webhook. The billing webhook is deliberately untouched.
// Configure a SECOND Stripe event destination pointing to this function.
// Never use this endpoint to grant/revoke access, update profiles, or alter subscriptions.
import Stripe from "npm:stripe@20.0.0";
import {createClient} from "npm:@supabase/supabase-js@2.76.1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESULT = (message: string, status = 200) =>
  new Response(message, {status, headers: {"Cache-Control": "no-store"}});

function subscriptionId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value &&
      typeof (value as {id: unknown}).id === "string") return (value as {id: string}).id;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return RESULT("Method not allowed", 405);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_MARKETING_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey)
    return RESULT("Marketing tracking not configured", 503);

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return RESULT("Invalid signature", 400);
  }

  // Ignore all other Stripe event types and never touch billing state.
  if (!["checkout.session.completed", "invoice.paid"].includes(event.type))
    return RESULT("ignored");

  try {
    let id: string | null = null;
    let kind: "trial_started" | "first_paid";
    let amountCents: number | null = null;
    let currency: string | null = null;
    let timestamp = event.created;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return RESULT("ignored");
      id = subscriptionId(session.subscription);
      kind = "trial_started";
    } else {
      const invoice = event.data.object as Stripe.Invoice;
      // Stripe API versions expose the subscription under parent.subscription_details.
      const parent = invoice.parent as
        {subscription_details?: {subscription?: unknown}} | null;
      const legacy = invoice as unknown as {subscription?: unknown};
      id = subscriptionId(parent?.subscription_details?.subscription) ||
           subscriptionId(legacy.subscription);
      if (!id || (invoice.amount_paid ?? 0) <= 0) return RESULT("ignored");
      kind = "first_paid";
      amountCents = invoice.amount_paid;
      currency = invoice.currency || null;
    }

    if (!id) return RESULT("ignored");
    const subscription = await stripe.subscriptions.retrieve(id);
    const userId = subscription.metadata.batchsave_user_id;
    if (!userId || !UUID.test(userId)) return RESULT("unmapped");

    if (kind === "trial_started") {
      // Checkout may finish without a trial when a customer has already used one.
      if (!subscription.trial_start || !subscription.trial_end ||
          !(subscription.trial_start <= event.created &&
            event.created <= subscription.trial_end)) return RESULT("no trial");
      timestamp = subscription.trial_start;
    }

    const db = createClient(supabaseUrl, serviceKey);
    // Unique promotional CUSTOMER count is separate from Stripe's technical
    // redemption counter, which can increment twice for a single checkout.
    // One completed Checkout Session can record at most one entry per code/user.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const applied = session.discounts?.find((d) => !!d.promotion_code);
      const promoId = applied && (typeof applied.promotion_code === "string"
        ? applied.promotion_code : applied.promotion_code?.id);
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer : subscription.customer.id;
      if (promoId && customerId && session.id) {
        const {error:promoError} = await db.from("promotion_redemptions").insert({
          stripe_promotion_code_id: promoId,
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: id,
          stripe_checkout_session_id: session.id,
        });
        if (promoError && promoError.code !== "23505") throw promoError;
      }
    }
    const {error} = await db.from("marketing_conversion_events").insert({
      stripe_event_id: event.id,
      stripe_subscription_id: id,
      user_id: userId,
      conversion_kind: kind,
      event_time: new Date(timestamp * 1000).toISOString(),
      amount_cents: amountCents,
      currency,
    });
    // Unique event ID AND unique kind per subscription prevent retries,
    // duplicate webhooks, and monthly renewal invoices from double counting.
    if (error && error.code !== "23505") throw error;
    return RESULT(error ? "already recorded" : "recorded");
  } catch (error) {
    console.error("Independent marketing webhook failed", error);
    return RESULT("Marketing event retry", 500);
  }
});
