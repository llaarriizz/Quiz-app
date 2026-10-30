import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router-dom";

export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-dark active:translate-y-px",
  secondary:
    "border border-ink/15 bg-white text-ink shadow-sm shadow-ink/5 hover:border-ink/30 hover:bg-paper",
  ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink",
  danger:
    "border border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
};

const BASE =
  "inline-flex select-none items-center justify-center rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50";

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

interface LinkButtonProps
  extends Omit<LinkProps, "className">,
    Pick<ButtonProps, "variant" | "size"> {
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

type BadgeTone = "neutral" | "brand" | "amber" | "rose" | "white";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink/5 text-ink-soft",
  brand: "bg-brand-soft text-brand-dark",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  white: "border border-ink/10 bg-white text-ink-soft",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-ink/10 bg-white shadow-[0_1px_0_rgba(29,42,37,0.03),0_24px_48px_-32px_rgba(29,42,37,0.35)]",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
      {...props}
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-ink-soft">
      <Spinner className="h-7 w-7 text-brand" />
      <p className="text-sm font-medium">{label}</p>
    </Container>
  );
}

export function ErrorPanel({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Panel className="border-rose-200 bg-rose-50/60 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-rose-900">{title}</p>
          <p className="mt-1 text-sm text-rose-800/80">{message}</p>
          {onRetry && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 border-rose-200 text-rose-800 hover:bg-rose-100"
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
        {icon}
      </span>
      <h3 className="mt-5 font-serif text-2xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </Panel>
  );
}
