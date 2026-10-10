/**
 * What the sources row should call itself.
 *
 * A YouTube address is a YouTube source even when the title is a custom name.
 * "Pasted transcript" is only the origin stored for a real transcript paste.
 * Other desk sources (an article, a file path) keep their own title and origin.
 */
export function sourceKindLabel(origin: string): "YouTube" | "Pasted transcript" | null {
  if (origin === "Pasted transcript") return "Pasted transcript";
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    return "YouTube";
  }
  return null;
}
