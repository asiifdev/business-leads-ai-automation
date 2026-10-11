# Editions

Prospex ships in two editions from the same code base. This page says what differs, why, and what is and is not built.

## Community (default)

`EDITION=community`. Open source under AGPL-3.0-or-later. Everything in [features.md](features.md) works, including WhatsApp through a **linked device** (Baileys, QR code). You run it, you bring your own AI provider.

## Hosted (alatpintar.id subscription)

`EDITION=hosted`. Runs on alatpintar.id for subscribers. Which plans exist, what they cost and what they include is decided by a separate private package (see "Plans and limits" below), not by this repository. Hosted adds features that depend on third-party accounts and review processes that only the operator can hold:

| Feature key | What it is | Status |
|-------------|------------|--------|
| `whatsapp.cloud_api` | Official WhatsApp Business Cloud API as the sending channel | **Not built.** The routing, the entitlement check and the settings screen exist; the connector itself does not |
| `ai.managed` | AI calls through the platform's key instead of your own | **Not built.** Per-workspace keys are built (a workspace saves its own provider in Settings); metering and quotas for a platform-managed key are not |

## How the restriction works

There are two layers, and only one of them is a real barrier.

1. **Entitlement check (code).** `EntitlementsService` decides per workspace whether a feature is on. A request to switch a workspace to the official API without the entitlement fails with `402 UPGRADE_REQUIRED`, and the sender skips such messages. `GET /entitlements` reports what is available. This keeps honest installs consistent. **It is not a security boundary:** the code is open source and anyone can edit a check out of their own copy.
2. **Separate connector (the real boundary).** The official-API sender is meant to live in a private package, `@alatpintar/whatsapp-cloud`, that is not published with this repository. The server loads it only when `WHATSAPP_CLOUD_PLUGIN` names it, and it must export `createProvider(deps)`. Without the package there is nothing to enable. Even on a hosted install the settings screen says so if the connector is missing.

Messages are routed per workspace by `WhatsappAccount.provider` (`baileys` or `cloud_api`) through `RoutedWhatsappProvider`. The approval flow, pacing, opt-out and inbound handling are the same for both.

## Plans and limits (commercial package)

Plans, prices, trials, subscriptions, payments and licence keys are **not in this repository**. This repository only knows the vocabulary (feature keys `whatsapp.cloud_api`, `ai.managed`; limits for workspaces, members per workspace and AI drafts per month) and asks an *entitlement provider* what the workspace owner may do (`apps/api/src/entitlements/provider.ts`).

- **No package installed (default):** the Community provider answers "everything in this repository, no limits". Nothing is counted against a plan and nothing calls home.
- **Package installed:** `ALATPINTAR_CLOUD_PLUGIN` (default `@alatpintar/cloud`) must export `createProvider(deps)` and may export `createRouter(deps, provider)` for HTTP routes (mounted at `/api/billing`: checkout, payment webhooks, admin). It runs on `EDITION=hosted` only. Self-hosted installs use the licence client below.
- **What the host does with the answer:** `LimitsService` refuses new AI drafts, scrapes, workspaces and members past the plan's limits (402 `LIMIT_REACHED`) or when the account is read-only (402 `SUBSCRIPTION_INACTIVE`). Messages already approved still send and data stays readable. Usage counters (`usage_counters`) and per-call AI token usage (`usage_events`) are stored here because they are useful to any install.
- **The dashboard** shows a Billing page from `GET /entitlements`; the price list appears only if the package serves `GET /api/billing/plans`.

## Licence keys (self-hosted)

A self-hosted install is unlimited. A licence key unlocks premium features (official WhatsApp, managed AI) the way a subscription does on the hosted service. There is no premium code in this repository: the features themselves are delivered by services and packages that only alatpintar.id holds.

- **Enter a key:** Billing page, or `ALATPINTAR_LICENSE_KEY`. `PUT /api/license {key}` (owner/admin), `DELETE /api/license`, `GET /api/license`. A free *registered* key can be requested by email (`POST /api/license/register`); the licence server emails it.
- **How it works:** the install sends the key, a random install id and the app version to the licence server (`ALATPINTAR_LICENSE_SERVER`, default `https://api.alatpintar.id`) and receives an **Ed25519-signed document** bound to that install id. The public key is in `entitlements/license-public-key.ts`; verification is offline and nothing in this repository is secret. Nothing is sent unless a key is set. No content or data leaves the install.
- **Validity:** a document is fresh for 48 hours (the install refreshes daily), is tolerated offline for 14 days, and never outlives the licence's own expiry. After that the install falls back to Community; nothing is deleted. A key the server refuses (revoked, expired) switches features off at the next refresh.
- **Limits:** a copied document is worthless on another install (bound to the install id) and a forged one fails the signature. Anyone can still edit their own copy of the AGPL code, so the protection that matters is that premium features rely on things only the operator holds.

## Licensing

The community code is AGPL-3.0-or-later; a commercial license is offered for those who cannot comply with it. The private connector is separate work and is not covered by the AGPL grant. Keep the interface between them (`WhatsappProvider`, `createProvider(deps)`) small and documented.

## What the official channel will require (for whoever builds the connector)

These come from Meta's process, not from Prospex, and should be checked against Meta's current documentation before building:

- A verified Meta business and a WhatsApp Business Account with a registered number.
- Embedded Signup if subscribers connect their own number.
- Message templates approved by Meta for any business-initiated message; free-form text only inside the customer-service window after a reply.
- A webhook for delivery status and inbound messages.

Because of the template rule, the official channel changes the product: the AI drafts the template variables rather than free text for first contact. That needs its own design.

## Configuration

| Variable | Meaning |
|----------|---------|
| `EDITION` | `community` (default) or `hosted` |
| `WHATSAPP_CLOUD_PLUGIN` | Module name of the private connector. Empty in community |
| `ALATPINTAR_CLOUD_PLUGIN` | Module name or path of the private entitlement package. Empty means `@alatpintar/cloud`; not installed means Community |
| `ALATPINTAR_LICENSE_KEY` | Self-hosted licence key (or enter it on the Billing page) |
| `ALATPINTAR_LICENSE_SERVER` | Licence server URL. Default `https://api.alatpintar.id` |
| `PLATFORM_ADMIN_USER_IDS` | Operator user ids allowed on the package's admin routes |
