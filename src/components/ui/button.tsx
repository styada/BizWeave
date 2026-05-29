import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-6 text-sm",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent-primary)] text-[#0a0b0f] hover:bg-[var(--accent-glow)] shadow-[var(--shadow-glow)]",
        secondary:
          "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-white/10 hover:bg-[var(--bg-muted)]",
        ghost:
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5",
        danger:
          "border border-[var(--error)]/50 text-[var(--error)] hover:bg-[var(--error)]/10",
      },
      size: {
        sm: "min-h-[36px] px-4 text-xs",
        md: "min-h-[44px] px-6",
        lg: "min-h-[52px] px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
