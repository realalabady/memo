import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const sar = new Intl.NumberFormat("en-SA", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatSAR(value: number, opts: { decimals?: boolean } = {}) {
  const n = opts.decimals
    ? value.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : sar.format(value);
  return `SAR ${n}`;
}

/** Money is computed in halalas to avoid float drift, stored in SAR with 2 decimals */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function installment(total: number, parts = 4) {
  return round2(total / parts);
}

export function formatDate(ms: number, withTime = false) {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
