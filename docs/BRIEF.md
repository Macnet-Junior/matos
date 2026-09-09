# MatOS — Phase 0 Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 0 — scaffold, shell, company map  
**Accent:** Citron Volt `#D6F31F` (hover `#E8FF5A`, pressed `#B8D110`)

## Intent

Ship a production-minded monorepo that runs locally, matches the Citron Volt dark UI, and models the agency as an interactive company map. Phase 0 is the operating shell — not a chatbot skin.

## Departments (7)

1. Research Engine  
2. Script & Story  
3. Content Studio  
4. Calendar & Queue  
5. Publish & Channels  
6. Monetization  
7. Proof & Loop  

Center node: **MatOS Agency**.

## Skills (seed)

| Skill | Department | Status |
|---|---|---|
| `content-calendar` | Content Studio | Authored |
| `etsy-listing-lab` | Monetization | Authored |

Etsy remains a **stub** — no live marketplace API in Phase 0.

## Hosting

Host / deploy deferred. Local `pnpm dev` is the Phase 0 delivery surface.

## Non-goals

- Live social / Etsy / Stripe integrations  
- Workflow engine execution  
- Production OAuth providers  

## Success

Remote `main` runs with install → typecheck → test → `pnpm dev`, Citron aesthetic parity, and a usable company map after dev login.
