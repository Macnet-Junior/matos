"use client";

import Link from "next/link";
import { Badge } from "@matos/ui";
import type { DeskCalendarItemDTO } from "@/lib/desk";

export function DeskCalendar({ items }: { items: DeskCalendarItemDTO[] }) {
  const grouped = new Map<string, DeskCalendarItemDTO[]>();
  for (const item of items) {
    const day = new Date(item.scheduledAt).toISOString().slice(0, 10);
    const list = grouped.get(day) ?? [];
    list.push(item);
    grouped.set(day, list);
  }
  const days = [...grouped.keys()].sort();

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-auto p-[22px]">
      <p className="max-w-xl text-xs text-matos-muted">
        Scheduled Press packs from Clock-approved Desk jobs. A{" "}
        <span className="text-matos-text">simulated</span> badge is not a live
        publication. Live delivery still requires Desk approval.
      </p>
      {days.length === 0 ? (
        <div className="rounded-xl border border-matos-border bg-matos-panel p-6 text-sm text-matos-muted">
          No calendar items yet. Approve a job through Clock to place packs.
        </div>
      ) : (
        days.map((day) => (
          <section
            key={day}
            className="rounded-xl border border-matos-border bg-matos-elev"
          >
            <header className="border-b border-matos-soft px-4 py-2.5 text-[12px] font-medium">
              {new Date(day + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </header>
            <ul className="divide-y divide-matos-soft">
              {(grouped.get(day) ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="text-sm text-matos-text">{item.title}</div>
                    <div className="mt-1 text-[11px] text-matos-muted">
                      {item.channel}
                      {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                      {item.publicationStatus
                        ? ` · publication ${item.publicationStatus}`
                        : ""}
                    </div>
                    <p className="mt-1 max-w-xl text-[11px] text-matos-muted2">
                      {item.body}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.simulated ? "danger" : "muted"}>
                      {item.simulated ? "simulated — not live" : item.status}
                    </Badge>
                    <Link
                      href={`/desk/${item.jobId}`}
                      className="text-[11px] text-matos-citron"
                    >
                      Job →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
