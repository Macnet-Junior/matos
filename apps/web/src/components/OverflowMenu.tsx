"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "@matos/ui";

export type OverflowItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

/**
 * One button that discloses secondary actions. Arrow keys move inside the
 * menu; Escape closes it.
 */
export function OverflowMenu({
  label = "More",
  items,
}: {
  label?: string;
  items: OverflowItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const menu = rootRef.current?.querySelector<HTMLElement>('[role="menu"]');
    const first = menu?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (items.length === 0) return null;

  function onMenuKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const menu = event.currentTarget;
    const entries = [
      ...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    ];
    if (entries.length === 0) return;
    event.preventDefault();
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? entries[(index + 1 + entries.length) % entries.length]
        : entries[(index - 1 + entries.length) % entries.length];
    next?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-lg border border-matos-border bg-matos-elev p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-matos-text hover:bg-[#1a1d27] disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
