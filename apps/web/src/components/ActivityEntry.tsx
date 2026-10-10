import Link from "next/link";

/**
 * One activity row. A target renders as a link. No target stays plain text,
 * with the action written in words rather than a dotted code.
 */
export function ActivityEntry({
  summary,
  actionLabel,
  href,
  when,
  actorEmail,
  variant = "card",
}: {
  summary: string;
  actionLabel: string;
  href: string | null;
  when?: string | null;
  actorEmail?: string | null;
  variant?: "compact" | "card";
}) {
  const compact = variant === "compact";
  const className = compact
    ? `block rounded-lg border border-matos-soft bg-matos-elev px-2.5 py-2 ${
        href ? "hover:border-matos-citron" : ""
      }`
    : `block rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3 ${
        href ? "hover:border-matos-citron" : ""
      }`;

  const body = (
    <>
      <div className={compact ? undefined : "flex items-start justify-between gap-3"}>
        <div className="min-w-0">
          {compact ? (
            <p className="text-xs font-medium">{summary}</p>
          ) : (
            <h2 className="text-xs font-semibold tracking-tight">{summary}</h2>
          )}
          <p
            className={`mt-1 text-matos-muted2 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {actionLabel}
          </p>
        </div>
        {when ? (
          <time className="shrink-0 text-[11px] text-matos-muted2">{when}</time>
        ) : null}
      </div>
      {actorEmail ? (
        <p className="mt-2 text-[11px] text-matos-muted">{actorEmail}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
