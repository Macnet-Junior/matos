"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  PINNED_NAV,
  WORKSPACE_NAV,
  navItemActive,
  visibleNavGroups,
  type NavGroup,
  type NavItem,
} from "@/lib/ui-choices";

function NavLink({ href, label }: NavItem) {
  const pathname = usePathname();
  const active = navItemActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
        active
          ? "bg-[rgba(214,243,31,0.14)] text-matos-text shadow-[inset_2px_0_0_#D6F31F]"
          : "text-matos-muted hover:bg-[#1a1d27] hover:text-matos-text"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-matos-citron shadow-[0_0_8px_rgba(214,243,31,0.35)]"
            : "bg-matos-muted2"
        }`}
      />
      {label}
    </Link>
  );
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const contains = group.items.some((item) => navItemActive(pathname, item.href));
  const [open, setOpen] = useState(contains);

  useEffect(() => {
    if (contains) setOpen(true);
  }, [contains]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2.5 py-2 text-[13px] text-matos-muted hover:bg-[#1a1d27] hover:text-matos-text [&::-webkit-details-marker]:hidden">
        <span>{group.title}</span>
        <span className="text-[10px] text-matos-muted2" aria-hidden="true">
          {open ? "–" : "+"}
        </span>
      </summary>
      <nav className="mt-0.5 flex flex-col gap-0.5 border-l border-matos-soft pl-2" aria-label={group.title}>
        {group.items.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </details>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data?.user as { role?: string } | undefined)?.role;
  const canViewOps = role === "Owner" || role === "Operator";
  const groups = visibleNavGroups(canViewOps);

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-matos-soft bg-matos-elev px-3.5 py-[18px]">
      <div className="flex items-center gap-2.5 px-2 pb-1 pt-1">
        <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-matos-citron text-[12px] font-extrabold tracking-tight text-[#0b0c0e]">
          M
        </div>
        <div>
          <strong className="block text-[15px] tracking-tight">MatOS</strong>
          <span className="block text-[11px] text-matos-muted2">
            Company operating layer
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <NavGroupSection group={WORKSPACE_NAV} pathname={pathname} />

        {/* The daily loop. Not a group, because a group is something you open
            occasionally and this is what the product is for. */}
        <nav aria-label="Main" className="mt-1 flex flex-col gap-0.5">
          {PINNED_NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {groups.map((group) => (
          <NavGroupSection key={group.id} group={group} pathname={pathname} />
        ))}
      </div>

      <div className="mt-auto">
        <details className="rounded-[10px] border border-matos-border bg-matos-panel">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-matos-muted [&::-webkit-details-marker]:hidden">
            Accent
          </summary>
          <div className="px-3 pb-3">
            <div
              aria-hidden="true"
              className="grid h-9 place-items-center rounded-lg bg-matos-citron text-[12px] font-bold tracking-wide text-[#0b0c0e]"
            >
              Citron
            </div>
            <p className="mt-2 text-center font-mono text-[11px] text-matos-muted">
              #D6F31F
            </p>
          </div>
        </details>
      </div>
    </aside>
  );
}
