import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/** Double-bezel: machined outer tray + inner core with concentric radius. */
export function Bezel({
  children,
  className,
  innerClassName,
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[2rem] p-1.5 ring-1",
        dark ? "bg-white/5 ring-white/10" : "bg-ink/[0.03] ring-ink/[0.06]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-[calc(2rem-0.375rem)]",
          dark
            ? "bg-ink-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
            : "bg-paper shadow-[var(--shadow-inset),var(--shadow-float)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Eyebrow({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em]",
        dark ? "bg-white/10 text-paper/80" : "bg-ink/[0.05] text-ink/70",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-ember" />
      {children}
    </span>
  );
}

type Variant = "ink" | "paper" | "ember" | "ghost";

const variants: Record<Variant, { btn: string; icon: string }> = {
  ink: { btn: "bg-ink text-paper hover:bg-ink-2", icon: "bg-white/10" },
  paper: { btn: "bg-paper text-ink ring-1 ring-ink/10 hover:bg-cream", icon: "bg-ink/5" },
  ember: { btn: "bg-ember text-paper hover:brightness-105", icon: "bg-black/10" },
  ghost: { btn: "bg-transparent text-ink hover:bg-ink/5", icon: "bg-ink/5" },
};

function buttonClasses(variant: Variant, size: "md" | "lg" | "sm", className?: string) {
  return cn(
    "group relative inline-flex items-center justify-center gap-3 rounded-full font-medium",
    "transition-all duration-500 ease-[var(--ease-fluid)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "lg" && "h-14 pl-7 pr-2 text-[15px]",
    size === "md" && "h-12 pl-6 pr-1.5 text-sm",
    size === "sm" && "h-9 px-4 text-[13px]",
    variants[variant].btn,
    className,
  );
}

/** Button-in-button: the trailing arrow lives in its own island. */
function TrailingIcon({ variant, icon }: { variant: Variant; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-9 items-center justify-center rounded-full transition-transform duration-500 ease-[var(--ease-fluid)]",
        "group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105",
        variants[variant].icon,
      )}
    >
      {icon ?? <ArrowUpRight weight="light" className="size-4" />}
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: "md" | "lg" | "sm";
  icon?: ReactNode;
  trailing?: boolean;
};

export function Button({ variant = "ink", size = "md", icon, trailing = true, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, cn(!trailing && size !== "sm" && "px-6", className))} {...rest}>
      {children}
      {trailing && size !== "sm" && <TrailingIcon variant={variant} icon={icon} />}
    </button>
  );
}

export function ButtonLink({
  variant = "ink",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "lg" | "sm"; icon?: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
      {size !== "sm" && <TrailingIcon variant={variant} icon={icon} />}
    </Link>
  );
}

export function Field({
  label,
  className,
  ...rest
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="block rounded-2xl bg-ink/[0.03] p-1 ring-1 ring-ink/[0.06] transition focus-within:ring-ink/25">
        <input
          className="h-11 w-full rounded-[0.8rem] bg-paper px-4 text-[15px] outline-none shadow-[var(--shadow-inset)] placeholder:text-muted/60"
          {...rest}
        />
      </span>
    </label>
  );
}

export function TextArea({ label, className, ...rest }: ComponentProps<"textarea"> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="block rounded-2xl bg-ink/[0.03] p-1 ring-1 ring-ink/[0.06] transition focus-within:ring-ink/25">
        <textarea
          className="min-h-28 w-full rounded-[0.8rem] bg-paper px-4 py-3 text-[15px] outline-none shadow-[var(--shadow-inset)] placeholder:text-muted/60"
          {...rest}
        />
      </span>
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="block rounded-2xl bg-ink/[0.03] p-1 ring-1 ring-ink/[0.06]">
        <select
          className="h-11 w-full rounded-[0.8rem] bg-paper px-3 text-[15px] outline-none shadow-[var(--shadow-inset)]"
          {...rest}
        >
          {children}
        </select>
      </span>
    </label>
  );
}

/** Provider chips — plain text marks, not the providers' logos. */
export function ProviderChip({ provider, className }: { provider: "tabby" | "tamara" | "demo"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        provider === "tabby" && "bg-tabby text-ink",
        provider === "tamara" && "bg-gradient-to-r from-[#f9c8a8] via-tamara to-[#d98fd0] text-ink",
        provider === "demo" && "bg-ink/10 text-ink",
        className,
      )}
    >
      {provider}
    </span>
  );
}

const tones: Record<string, string> = {
  captured: "bg-sage-soft text-[#4c5a3f]",
  paid: "bg-sage-soft text-[#4c5a3f]",
  approved: "bg-sage-soft text-[#4c5a3f]",
  delivered: "bg-sage-soft text-[#4c5a3f]",
  active: "bg-sage-soft text-[#4c5a3f]",
  pending: "bg-sand text-ink-2",
  unpaid: "bg-ember-soft text-[#8f321a]",
  shipped: "bg-[#e3e6f2] text-[#3d4673]",
  draft: "bg-sand text-ink-2",
  failed: "bg-ink/5 text-muted line-through",
  cancelled: "bg-ink/5 text-muted line-through",
  suspended: "bg-ink text-paper",
  on_hold: "bg-ink text-paper",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", tones[status] ?? "bg-ink/5")}>
      {status.replace("_", " ")}
    </span>
  );
}
