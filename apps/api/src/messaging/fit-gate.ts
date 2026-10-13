/**
 * The AI already judges how well each business fits the offer (high, medium, low) and says why. A first message to a
 * business that is not what the offer is for (a camera shop that sells, offered a rental system) is wasted at best.
 * So: low never gets a draft, medium only when the person asks for it, high and "not judged" do.
 */
export type FitLevel = "high" | "medium" | "low";

export function fitLevel(aiAnalysis: unknown): FitLevel | null {
  const f = (aiAnalysis as { fit?: { fit?: unknown } } | null)?.fit?.fit;
  return f === "high" || f === "medium" || f === "low" ? f : null;
}

export function fitAllowed(level: FitLevel | null, includeMedium: boolean): boolean {
  if (level === null || level === "high") return true;
  return level === "medium" && includeMedium;
}
