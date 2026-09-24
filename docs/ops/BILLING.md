# Billing gate

Live Stripe is not implemented.

Credit balances stay in the local `CreditLedger`. `STRIPE_BILLING_ENABLED` is `false`. `stripeBillingGate()` explains that charges wait until credit accounting and reconciliation are production-ready and tested.

Do not add a Stripe secret, webhook handler, or Checkout session until that reconciliation exists. A production config that sets `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` fails the readiness check on purpose.
