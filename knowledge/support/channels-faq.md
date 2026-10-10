# Channels FAQ

## Late.dev / Zernio

Connect an API key on Channels. Without a key, publish paths stay simulated.

## Etsy

OAuth2 PKCE start/callback is scaffolded. Draft listings can be simulated until tokens exist.

## WhatsApp

Hard allowlist: only destinations in `WHATSAPP_ALLOWED_TO` (and the legacy `WHATSAPP_GROUP_OR_TO` default) may be messaged. Cap 10. Review gate required. No unrestricted auto-DM.

## Auto-response

Rules require Owner/Operator approval before enable. Spam growth bots are not allowed.
