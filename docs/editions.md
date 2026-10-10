# Editions

Prospex ships in two editions from the same code base. This page says what differs, why, and what is and is not built.

## Community (default)

`EDITION=community`. Open source under AGPL-3.0-or-later. Everything in [features.md](features.md) works, including WhatsApp through a **linked device** (Baileys, QR code). You run it, you bring your own AI provider.

## Hosted (alatpintar.id subscription)

`EDITION=hosted`. Runs on alatpintar.id for subscribers. Plans are `starter`, `pro` and `business`. Hosted adds features that depend on third-party accounts and review processes that only the operator can hold:

| Feature key | What it is | Status |
|-------------|------------|--------|
| `whatsapp.cloud_api` | Official WhatsApp Business Cloud API as the sending channel | **Not built.** The routing, the entitlement check and the settings screen exist; the connector itself does not |
| `ai.managed` | AI calls through the platform's key instead of your own | **Not built.** Per-workspace keys are also not built yet |

## How the restriction works

There are two layers, and only one of them is a real barrier.

1. **Entitlement check (code).** `EntitlementsService` decides per workspace whether a feature is on. A request to switch a workspace to the official API without the entitlement fails with `402 UPGRADE_REQUIRED`, and the sender skips such messages. `GET /entitlements` reports what is available. This keeps honest installs consistent. **It is not a security boundary:** the code is open source and anyone can edit a check out of their own copy.
2. **Separate connector (the real boundary).** The official-API sender is meant to live in a private package, `@alatpintar/whatsapp-cloud`, that is not published with this repository. The server loads it only when `WHATSAPP_CLOUD_PLUGIN` names it, and it must export `createProvider(deps)`. Without the package there is nothing to enable. Even on a hosted install the settings screen says so if the connector is missing.

Messages are routed per workspace by `WhatsappAccount.provider` (`baileys` or `cloud_api`) through `RoutedWhatsappProvider`. The approval flow, pacing, opt-out and inbound handling are the same for both.

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
