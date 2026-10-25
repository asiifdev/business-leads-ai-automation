/** Where a campaign can look for leads. "csv_import" is not here: an import is something you do to a campaign, not a search. */
export const SOURCE_IDS = ["google_maps", "osm", "overture"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
export const DEFAULT_SOURCES: SourceId[] = ["google_maps"];
