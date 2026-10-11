/**
 * Editions and plans.
 *
 * - **community**: the open-source, self-hosted edition (AGPL). Everything in this repository works. Features that
 *   depend on a commercial service are simply off, because that code is not part of this repository.
 * - **hosted**: alatpintar.id. The operator runs it with `EDITION=hosted`; an entitlement provider (a separate private
 *   package, see `plugin.ts`) decides which commercial features and limits each account has.
 *
 * A check in open code can be edited out by anyone who runs their own copy, so gating alone is not a barrier. The real
 * boundary is that commercial connectors (the official WhatsApp API adapter) live in a separate package that is not
 * published here and is loaded only if installed. The checks below make the hosted service enforce its plans and make
 * the community edition say clearly what it does not include.
 */
export type Edition = "community" | "hosted";

export const FEATURES = ["whatsapp.cloud_api", "ai.managed"] as const;
export type Feature = (typeof FEATURES)[number];

export function parseEdition(value: string | undefined | null): Edition {
  return value === "hosted" ? "hosted" : "community";
}
