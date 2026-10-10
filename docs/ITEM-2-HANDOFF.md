# Item 2 handoff — turning live publishing on

**Status:** the code is done and on `main` (`cc84b9d`). What is left is
configuration, and it is all yours to do manually.

The publishing layer has real clients behind a provider seam — Late.dev for
social, Etsy, WhatsApp, and native newsletter/blog — and none of them will
claim a live post unless a real provider confirmed it. Nothing publishes for
real today because **no credentials are set**, not because the code cannot.

> Before sending the user anything: this file describes env vars only. Do not
> paste real key values into chat or into this document.

## Where everything goes

The env file is `workspace/matos/.env` (see `.env.example` for the full list).
After editing it, restart the web app so the new values are picked up.

Use `superlisa_store_secret NAME VALUE` for each of these — it writes to
`workspace/.secrets/.env` and survives a container update. Do **not** hand-edit
`workspace/.secrets/.env` directly.

## Pick one, in this order of effort

### 1. Newsletter or blog — cheapest, no third-party account

The native publisher POSTs `{channel, idempotencyKey, state}` to a URL you
control and reads state back with `GET <url>?idempotencyKey=<id>` expecting
`{"status": "published" | "scheduled" | "pending" | "failed"}`.

Any endpoint that accepts a POST and answers a GET with that shape works — your
own server, a Cloudflare Worker, a Zapier catch hook, an n8n webhook.

```
NEWSLETTER_DELIVERY_URL=https://your-endpoint.example/deliver
BLOG_DELIVERY_URL=https://your-endpoint.example/deliver
```

Set `NEWSLETTER_DELIVERY_URL` and the newsletter channel goes live. Set
`BLOG_DELIVERY_URL` and blog goes live. These are independent.

**This is the one I'd do first.** It needs no account, it exercises the whole
read-back path I just built, and it proves the loop end to end before you spend
money on an API key.

### 2. Social (X, LinkedIn, Instagram, TikTok, Facebook, Threads, YouTube, Pinterest)

Late.dev is a paid scheduling API that fronts every social platform.

```
LATE_API_KEY=...
LATE_API_BASE=https://api.getlate.dev   # confirm the exact base URL in their docs
```

After setting the key, the channel does not go live until an account is
connected inside Late. The code calls `listAccounts()` and only uses a provider
that has an active account matching the channel. **No connected account =
still simulated, honestly reported.**

### 3. Etsy

```
ETSY_API_KEY=...
ETSY_SHARED_SECRET=...
ETSY_REDIRECT_URI=https://your-domain/api/integrations/etsy/oauth/callback
```

Etsy also needs the OAuth handshake to complete before listings go live — the
key alone publishes nothing. The callback path above is fixed by the route in
the app; only the domain changes.

### 4. WhatsApp

```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_GROUP_OR_TO=...
WHATSAPP_ALLOWED_TO=Career path|+237..., Shop|+237...
```

**Hard boundary:** the code will only message destinations on
`WHATSAPP_ALLOWED_TO` (comma-separated, optional `label|number`, cap 10).
`WHATSAPP_GROUP_OR_TO` still works as a one-item list and is the default when a
post does not name a destination. Anything else is rejected and not sent. There
is no wildcard. Do not add an anyone option.

## How to check it worked

Open **Settings → Channels** in the app. That page reads
`providerConfigHealth` and shows each provider as `live-configured` or
`simulated`. It reads env vars only — it never calls providers or shows secret
values, so it is safe to look at any time.

Until a provider shows `live-configured`, every Calendar item simulates and the
UI will say so. That is the intended behaviour, not a bug.

## What to send the agent when you're done

Tell it which provider you configured. It will verify the seam end to end with
a real post to a test destination and close the item. Nothing else is required
— the code side is complete.

## The exact things left undone, in plain terms

1. **No credentials** for any provider — this document.
2. **No newsletter sender chosen.** The code deliberately does not pick one;
   `NEWSLETTER_DELIVERY_URL` is the contract, and which mail service sits behind
   it is your decision and your account.
3. **The scheduler is not registered as a recurring job.** `runDueDeliveries`
   and `reconcileInFlightPublications` exist and are tested, but nothing calls
   them on a timer yet in this container. Registering that needs a `superlisa-svc`
   schedule, which is a **Pro-only** feature on this plan. On Free the schedule
   cannot be created — a delivery will only run when something calls it.
