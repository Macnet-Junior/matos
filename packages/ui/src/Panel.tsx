import type { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className = "", ...rest }: PanelProps) {
  return (
    <div
      className={`rounded-xl border border-matos-border bg-matos-panel shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
