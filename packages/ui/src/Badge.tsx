import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "citron" | "muted" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  citron: "bg-matos-citron text-[#0b0c0e] font-bold",
  muted: "bg-[#1c2030] text-matos-muted font-semibold",
  danger: "bg-[rgba(240,113,120,0.15)] text-matos-danger font-semibold",
};

export function Badge({
  tone = "citron",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-wide ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
