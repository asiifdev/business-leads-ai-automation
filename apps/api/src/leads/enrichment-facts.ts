/** What the lead said about itself (its website or social page), as one short line for the draft writer. Null when nothing was found. */
export function aboutLine(enrichment: unknown): string | null {
  const about = enrichment && typeof enrichment === "object" ? (enrichment as { about?: unknown }).about : undefined;
  if (!about || typeof about !== "object") return null;
  const a = about as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const parts = [str(a.description, 300), str(a.type, 40) && `type: ${str(a.type, 40)}`, str(a.hours, 120) && `hours: ${str(a.hours, 120)}`].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}
