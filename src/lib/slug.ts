const RESERVED = new Set(["tag", "tags"]);

export function slugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([a-z0-9][a-z0-9-]*)(?:\/|$)/i);
  if (!match) return null;
  const slug = match[1]?.toLowerCase() ?? "";
  if (!slug || RESERVED.has(slug)) return null;
  return slug;
}

export function isProblemPath(pathname: string): boolean {
  return slugFromPath(pathname) !== null && !isContestPath(pathname);
}

export function isContestPath(pathname: string): boolean {
  return pathname === "/contest" || pathname.startsWith("/contest/");
}
