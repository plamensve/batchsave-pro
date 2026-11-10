import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const handler = readFileSync(new URL("../supabase/functions/marketing-stripe-webhook/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202611101500_marketing_conversion_events.sql", import.meta.url), "utf8");
const configuration = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("marketing webhook uses a different Stripe signing secret", () => {
  assert.match(handler, /STRIPE_MARKETING_WEBHOOK_SECRET/);
  assert.match(handler, /constructEventAsync/);
  assert.doesNotMatch(handler, /Deno\.env\.get\("STRIPE_WEBHOOK_SECRET"\)/);
});

test("marketing webhook never writes to payment entitlement tables", () => {
  assert.doesNotMatch(handler, /\.from\("(?:subscriptions|profiles|stripe_webhook_events)"\)/);
  assert.match(handler, /\.from\("marketing_conversion_events"\)\.insert/);
});

test("only verified trial and paid invoice events can enter staging", () => {
  assert.match(handler, /checkout\.session\.completed/);
  assert.match(handler, /invoice\.paid/);
  assert.match(handler, /invoice\.amount_paid/);
  assert.match(handler, /subscription\.trial_start/);
  assert.match(migration, /unique \(stripe_event_id\)/);
  assert.match(migration, /unique \(stripe_subscription_id, conversion_kind\)/);
});

test("staging table is private and marketing endpoint checks Stripe signatures", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.marketing_conversion_events from anon, authenticated/);
  assert.match(configuration, /\[functions\.marketing-stripe-webhook\]\s*verify_jwt = false/);
});
