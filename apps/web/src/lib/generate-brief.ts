import { api } from "@/lib/api";

type Status<T> = { status: "idle" | "running" | "done" | "failed"; pass?: string; error?: string; brief?: T };

/** Starts the brief in the background and waits for it by asking every few seconds: no single request has to survive minutes. */
export async function generateBrief<T>(body: object, onPass?: (pass: string) => void, signal?: { cancelled: boolean }): Promise<T> {
  await api.post("/marketing/brief/generate", body);
  return waitForBrief<T>(onPass, signal);
}

/** True when a brief is being written right now (e.g. the person left the page and came back). */
export async function briefIsRunning(): Promise<boolean> {
  try {
    return (await api.get<Status<unknown>>("/marketing/brief/generate/status")).status === "running";
  } catch {
    return false;
  }
}

export async function waitForBrief<T>(onPass?: (pass: string) => void, signal?: { cancelled: boolean }): Promise<T> {
  const deadline = Date.now() + 20 * 60_000;
  let misses = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    if (signal?.cancelled) throw new Error("cancelled");
    let s: Status<T>;
    try {
      s = await api.get<Status<T>>("/marketing/brief/generate/status");
      misses = 0;
    } catch (e) {
      // the API restarting for a moment is not the end of the job's story, but it is of this one
      if (++misses >= 10) throw e;
      continue;
    }
    if (s.pass && onPass) onPass(s.pass);
    if (s.status === "done" && s.brief) return s.brief;
    if (s.status === "failed") throw new Error(s.error ?? "failed");
    if (s.status === "idle") throw new Error("The analysis was lost (the server restarted). Start it again.");
  }
  throw new Error("Timed out");
}
