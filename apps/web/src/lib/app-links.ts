/** In-app hrefs for skills and knowledge files (never raw `knowledge/` as a browser path). */

export function knowledgeHref(rel: string): string {
  return `/knowledge?path=${encodeURIComponent(rel)}`;
}

export function skillMapHref(slug: string): string {
  return `/map?skill=${encodeURIComponent(slug)}`;
}

export function isKnowledgePath(url: string): boolean {
  return url.replace(/^\/+/, "").startsWith("knowledge/");
}
