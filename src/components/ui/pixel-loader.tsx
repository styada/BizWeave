import { cn } from "@/lib/utils";

/* ── Pixel Loading Bar ── */
export function PixelLoadingBar({ className }: { className?: string }) {
  return <div className={cn("pixel-loading-bar", className)} />;
}

/* ── Pixel Spinner ── */
export function PixelSpinner({ className }: { className?: string }) {
  return <div className={cn("pixel-spinner", className)} />;
}

/* ── Pixel Loading Dots (typing indicator) ── */
export function PixelLoadingDots({
  text = "Loading",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs text-text-muted", className)}>
      {text}
      <span className="inline-flex">
        <span className="animate-pixel-blink" style={{ animationDelay: "0ms" }}>.</span>
        <span className="animate-pixel-blink" style={{ animationDelay: "200ms" }}>.</span>
        <span className="animate-pixel-blink" style={{ animationDelay: "400ms" }}>.</span>
      </span>
    </span>
  );
}

/* ── Pixel Scanline Overlay ── */
export function PixelScanline({ className }: { className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 pixel-scanline", className)} />;
}

/* ── CRT Frame ── */
export function CrtFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-white/10 bg-bg-elevated crt-glow", className)}>
      <PixelScanline />
      {children}
    </div>
  );
}

/* ── Level Up Burst ── */
export function LevelUpBurst({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center">
      <span className="absolute h-full w-full animate-level-up rounded-full bg-accent-primary/30" />
      <span className="text-[10px] text-accent-primary">✦</span>
    </span>
  );
}

/* ── Pixel Button ── */
export function PixelButton({
  children,
  onClick,
  disabled,
  active,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative font-mono font-semibold uppercase tracking-wider transition-all duration-150",
        "border-2 border-accent-primary bg-accent-primary/10 text-accent-primary",
        "hover:bg-accent-primary hover:text-bg-base hover:shadow-glow",
        "active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-40",
        "pixel-border",
        sizes[size],
        active && "bg-accent-primary text-bg-base shadow-glow",
        className
      )}
    >
      {children}
    </button>
  );
}
