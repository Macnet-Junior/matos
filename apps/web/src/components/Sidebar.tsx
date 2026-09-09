"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const workspace = [
  { href: "/home", label: "Home" },
  { href: "/brief", label: "Company brief" },
  { href: "/map", label: "Company map" },
  { href: "/workbook", label: "Workbook" },
  { href: "/repository", label: "Repository" },
];

const build = [
  { href: "/workflows", label: "Workflows" },
  { href: "/skills", label: "Skills" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/activity", label: "Activity" },
];

const library = [
  { href: "/library", label: "Library" },
  { href: "/library/encoding-guide", label: "Encoding guide" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
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

export function Sidebar() {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-5 border-r border-matos-soft bg-matos-elev px-3.5 py-[18px]">
      <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
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

      <div>
        <div className="px-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
          Workspace
        </div>
        <nav className="flex flex-col gap-0.5">
          {workspace.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </div>

      <div>
        <div className="px-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
          Build &amp; Operate
        </div>
        <nav className="flex flex-col gap-0.5">
          {build.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </div>

      <div>
        <div className="px-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
          Library
        </div>
        <nav className="flex flex-col gap-0.5">
          {library.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto p-2">
        <div className="rounded-[10px] border border-matos-border bg-matos-panel p-3">
          <h4 className="mb-2 text-[11px] font-medium text-matos-muted">
            Accent · Citron Volt
          </h4>
          <div className="grid h-9 place-items-center rounded-lg bg-matos-citron text-[12px] font-bold tracking-wide text-[#0b0c0e]">
            PRIMARY ACTION
          </div>
          <div className="mt-2 text-center font-mono text-[11px] text-matos-muted">
            #D6F31F
          </div>
        </div>
      </div>
    </aside>
  );
}
