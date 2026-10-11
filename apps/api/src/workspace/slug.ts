/** URL-safe workspace slug from a name, with a time suffix so two businesses with the same name never collide. */
export function makeWorkspaceSlug(name: string, now: number = Date.now(), salt: string = Math.random().toString(36).slice(2, 5)): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${base || "workspace"}-${now.toString(36)}${salt}`;
}

export const MAX_WORKSPACES_PER_USER = 50;
