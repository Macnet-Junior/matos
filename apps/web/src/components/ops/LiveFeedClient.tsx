"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { moreFeedFilters, pinnedFeedFilters } from "@/lib/ui-choices";

type Event = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorEmail: string | null;
  createdAt: string;
};

export function LiveFeedClient({ initial }: { initial: Event[] }) {
  const [events, setEvents] = useState(initial);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const pinned = pinnedFeedFilters();
  const more = moreFeedFilters();
  const moreActive = more.find((item) => item.id === filter);

  const load = useCallback(async (type: string) => {
    try {
      const q = type ? `?type=${encodeURIComponent(type)}&limit=80` : "?limit=80";
      const res = await fetch(`/api/ops/feed${q}`);
      if (!res.ok) {
        setError(`Feed error ${res.status}`);
        return;
      }
      const data = (await res.json()) as { events: Event[] };
      setEvents(data.events);
      setError(null);
    } catch {
      setError("Feed poll failed");
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void load(filter), 4000);
    return () => window.clearInterval(id);
  }, [filter, load]);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-matos-soft px-[22px] py-3">
        <span className="sr-only" id="feed-filter-label">
          Filter the feed
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="feed-filter-label">
          {pinned.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                filter === item.id
                  ? "bg-matos-citron text-[#0b0c0e]"
                  : "bg-[#1c2030] text-matos-muted hover:text-matos-text"
              }`}
            >
              {item.label}
            </button>
          ))}
          <details ref={moreRef} className="relative">
            <summary
              className={`cursor-pointer list-none rounded-full px-2.5 py-1 text-[11px] font-semibold [&::-webkit-details-marker]:hidden ${
                moreActive
                  ? "bg-matos-citron text-[#0b0c0e]"
                  : "bg-[#1c2030] text-matos-muted hover:text-matos-text"
              }`}
            >
              {moreActive ? moreActive.label : "More"}
            </summary>
            <div className="absolute left-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-matos-border bg-matos-elev p-1 shadow-lg">
              {more.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-matos-text hover:bg-[#1a1d27]"
                  onClick={() => {
                    setFilter(item.id);
                    if (moreRef.current) moreRef.current.open = false;
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>
        </div>
        <span className="ml-auto self-center text-[10px] text-matos-muted2">
          Poll · 4s{error ? ` · ${error}` : ""}
        </span>
      </div>
      <div className="space-y-2 overflow-auto p-[22px]">
        {events.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No events for this filter.
          </div>
        ) : (
          events.map((e) => (
            <article
              key={e.id}
              className="rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold tracking-tight">{e.summary}</h2>
                  <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                    {e.action} · {e.entityType}/{e.entityId}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-matos-muted2">
                  {new Date(e.createdAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}
                </time>
              </div>
              {e.actorEmail ? (
                <p className="mt-2 text-[11px] text-matos-muted">{e.actorEmail}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
