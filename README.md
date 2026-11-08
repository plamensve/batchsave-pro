# BatchSave Pro

A Manifest V3 Chrome extension for selecting and downloading page images and linked files in batches.

## Development

This repository is under active development. The first milestone focuses on local file discovery, selection, filters and browser downloads. Authentication and Stripe billing will be enabled once the dedicated Supabase project and secrets are provisioned.

## Business model

- Three-day free trial (72 hours)
- €9.90/month recurring Stripe subscription after trial
- Promotion codes supported by Stripe Checkout

**Security:** Never commit Stripe secret keys, Supabase secret/service-role keys, or webhook signing secrets. Checkout sessions and entitlements must be verified server-side.
