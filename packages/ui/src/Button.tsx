import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const styles: Record<ButtonVariant, string> = {
  primary:
    "bg-matos-citron text-[#0b0c0e] font-bold border-transparent hover:bg-matos-citron-hover active:bg-matos-citron-pressed",
  secondary:
    "bg-matos-panel text-matos-text border-matos-border hover:border-matos-citron hover:text-matos-text",
  ghost:
    "bg-transparent text-matos-muted border-transparent hover:bg-[#1a1d27] hover:text-matos-text",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
