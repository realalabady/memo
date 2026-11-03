import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Brand board" };

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const palette = [
  { name: "Paper", hex: "#FBF8F2", cls: "bg-paper text-ink" },
  { name: "Cream", hex: "#F3EDE2", cls: "bg-cream text-ink" },
  { name: "Sand", hex: "#E8DFD0", cls: "bg-sand text-ink" },
  { name: "Sage", hex: "#8E9B7E", cls: "bg-sage text-paper" },
  { name: "Ember", hex: "#E0532F", cls: "bg-ember text-paper" },
  { name: "Ink", hex: "#17130F", cls: "bg-ink text-paper ring-1 ring-white/10" },
];

/** One board panel: page number + label in the corners, content centred. */
function Panel({ n, label, className = "bg-cream text-ink", children }: { n: number; label: string; className?: string; children: ReactNode }) {
  return (
    <section className={`relative flex aspect-[4/3] flex-col overflow-hidden rounded-[1.4rem] ${className}`}>
      <div className="pointer-events-none absolute inset-x-5 top-4 z-10 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] opacity-50">
        <span>{label}</span>
        <span>0{n}</span>
      </div>
      {children}
    </section>
  );
}

/** Quarter ring filled to `paid` of 4 — the installment motif. */
function Ring({ paid, className = "size-10" }: { paid: number; className?: string }) {
  const d = ["M15 15V3A12 12 0 0 0 3 15Z", "M17 15V3a12 12 0 0 1 12 12Z", "M17 17h12a12 12 0 0 1-12 12Z", "M15 17H3a12 12 0 0 0 12 12Z"];
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {d.map((p, i) => (
        <path key={p} d={p} className={i < paid ? (i === 0 ? "fill-ember" : "fill-ink") : "fill-ink/10"} />
      ))}
    </svg>
  );
}

export default function BrandBoard() {
  return (
    <main className="min-h-[100dvh] bg-[#1a1714] p-4 md:p-8">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 01 — Logo cover */}
        <Panel n={1} label="memo / identity" className="bg-paper text-ink">
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <LogoMark className="size-24" />
            <span className="font-display text-7xl italic leading-none">memo</span>
          </div>
          <p className="pb-5 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Buy now · pay in four</p>
        </Panel>

        {/* 02 — Construction */}
        <Panel n={2} label="Mark construction" className="bg-cream text-ink">
          <div className="flex flex-1 items-center justify-center">
            <svg viewBox="-8 -8 64 50" className="h-[80%] w-[88%]">
              {Array.from({ length: 9 }).map((_, i) => (
                <g key={i} className="stroke-ink/10" strokeWidth="0.15">
                  <line x1={-6 + i * 5.5} x2={-6 + i * 5.5} y1="-6" y2="38" />
                  <line y1={-6 + i * 5.5} y2={-6 + i * 5.5} x1="-6" x2="38" />
                </g>
              ))}
              <circle cx="16" cy="16" r="12" fill="none" className="stroke-ember" strokeWidth="0.2" strokeDasharray="0.8 0.6" />
              <circle cx="16" cy="16" r="17" fill="none" className="stroke-ink/25" strokeWidth="0.15" />
              <line x1="16" x2="16" y1="-4" y2="36" className="stroke-ink/30" strokeWidth="0.15" />
              <line y1="16" y2="16" x1="-4" x2="36" className="stroke-ink/30" strokeWidth="0.15" />
              <path d="M15 15V3A12 12 0 0 0 3 15Z" className="fill-ink" />
              <path d="M17 15V3a12 12 0 0 1 12 12Z" className="fill-ink" />
              <path d="M15 17H3a12 12 0 0 0 12 12Z" className="fill-ink" />
              <path d="M17 17h12a12 12 0 0 1-12 12Z" transform="translate(1.4 1.4)" className="fill-ember" />
              {[
                [8, 10.5, "1"],
                [23, 10.5, "2"],
                [8, 25, "4"],
                [24.4, 26.4, "3"],
              ].map(([x, y, t]) => (
                <text key={t} x={x} y={y} className="fill-paper font-mono" fontSize="2.6" textAnchor="middle">
                  {t}
                </text>
              ))}
              <path d="M31 31 l3.5 3.5 M34.5 31.8 v2.7 h-2.7" fill="none" className="stroke-ember" strokeWidth="0.35" />
              <text x="37" y="33" className="fill-ink/60 font-mono" fontSize="1.9">
                <tspan x="37">offset 1.4u</tspan>
                <tspan x="37" dy="2.8">“the rest, later”</tspan>
              </text>
            </svg>
          </div>
        </Panel>

        {/* 03 — Digital application */}
        <Panel n={3} label="Digital" className="bg-sand text-ink">
          <div className="flex flex-1 items-center justify-center px-8 pt-8">
            <div className="w-full max-w-[92%] overflow-hidden rounded-2xl bg-paper shadow-[var(--shadow-float)]">
              <div className="flex items-center gap-2 border-b border-ink/[0.06] px-3 py-2">
                <span className="size-2 rounded-full bg-ink/15" />
                <span className="size-2 rounded-full bg-ink/15" />
                <span className="size-2 rounded-full bg-ink/15" />
                <span className="ml-3 flex-1 rounded-full bg-cream px-3 py-0.5 text-center font-mono text-[10px] text-muted">memo.sa/product/oud-noir</span>
              </div>
              <div className="flex gap-3 p-3">
                <div className="relative aspect-[4/5] w-2/5 overflow-hidden rounded-xl bg-sand">
                  <Image src={img("1770048792339-d8f8d8d2dbeb", 500)} alt="" fill priority sizes="240px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col py-1">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <LogoMark className="size-3" /> Dar Al Oud
                  </span>
                  <p className="font-display mt-2 text-2xl leading-none">Oud Noir Extrait</p>
                  <p className="mt-2 text-sm tabular-nums">SAR 890</p>
                  <div className="mt-auto rounded-xl bg-cream p-2">
                    <p className="text-[11px]">4 × <span className="font-medium">SAR 222.50</span></p>
                    <p className="text-[9px] text-muted">interest-free</p>
                  </div>
                  <span className="mt-2 rounded-full bg-ink py-1.5 text-center text-[10px] text-paper">Add to bag</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* 04 — Essence */}
        <Panel n={4} label="Brand essence" className="bg-ink text-paper">
          <div className="flex flex-1 flex-col justify-end p-8">
            <p className="font-display text-6xl leading-[0.92]">
              Buy it today.
              <br />
              Own it in <span className="italic text-ember">four.</span>
            </p>
          </div>
        </Panel>

        {/* 05 — Colour */}
        <Panel n={5} label="Colour" className="bg-paper text-ink">
          <div className="grid flex-1 grid-cols-6 gap-2 px-5 pb-5 pt-12">
            {palette.map((c, i) => (
              <div key={c.hex} className={`flex flex-col justify-between rounded-2xl p-2.5 ${c.cls} ${i === 0 ? "ring-1 ring-ink/10" : ""}`}>
                <span className="text-[11px] font-medium">{c.name}</span>
                <span className="font-mono text-[9px] opacity-70">{c.hex}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* 06 — Typography */}
        <Panel n={6} label="Typography" className="bg-cream text-ink">
          <div className="grid flex-1 grid-cols-2 gap-4 px-6 pb-6 pt-12">
            <div className="flex flex-col justify-between rounded-2xl bg-paper p-4">
              <span className="font-display text-8xl italic leading-none">Aa</span>
              <div>
                <p className="text-[11px] font-medium">Instrument Serif</p>
                <p className="font-display text-sm italic text-muted">Headlines & voice</p>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-2xl bg-ink p-4 text-paper">
              <span className="text-8xl font-medium leading-none tracking-tight">Aa</span>
              <div>
                <p className="text-[11px] font-medium">Geist</p>
                <p className="font-mono text-[10px] text-paper/50">Interface · 0123456789</p>
              </div>
            </div>
          </div>
        </Panel>

        {/* 07 — Physical */}
        <Panel n={7} label="Packaging" className="bg-sage text-paper">
          <div className="relative flex flex-1 items-end justify-center gap-5 pb-10">
            {/* tissue box */}
            <div className="relative h-[34%] w-[34%] -rotate-3 rounded-lg bg-paper shadow-[0_30px_40px_-20px_rgba(23,19,15,0.45)]">
              <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 bg-ember" />
              <LogoMark className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper p-1 text-ink" />
            </div>
            {/* bag */}
            <div className="relative h-[62%] w-[38%] rounded-b-lg rounded-t-sm bg-cream shadow-[0_40px_50px_-24px_rgba(23,19,15,0.5)]">
              <div className="absolute -top-7 left-1/2 h-12 w-1/2 -translate-x-1/2 rounded-t-full border-[3px] border-b-0 border-ink/70" />
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink">
                <LogoMark className="size-10" />
                <span className="font-display text-2xl italic">memo</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* 08 — Image direction */}
        <Panel n={8} label="Image direction" className="bg-ink text-paper">
          <div className="absolute inset-0 grid grid-cols-5 gap-1.5 p-1.5 pt-11">
            <div className="relative col-span-3 overflow-hidden rounded-[1.1rem]">
              <Image src={img("1617038220319-276d3cfab638")} alt="" fill priority sizes="400px" className="object-cover" />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <div className="relative overflow-hidden rounded-[1.1rem]">
                <Image src={img("1610701596007-11502861dcfa", 500)} alt="" fill priority sizes="260px" className="object-cover" />
              </div>
              <div className="relative overflow-hidden rounded-[1.1rem]">
                <Image src={img("1586023492125-27b2c045efd7", 500)} alt="" fill priority sizes="260px" className="object-cover" />
              </div>
            </div>
          </div>
          <p className="absolute bottom-4 left-5 rounded-full bg-ink/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">Warm light · one object · real texture</p>
        </Panel>

        {/* 09 — System detail */}
        <Panel n={9} label="System" className="bg-paper text-ink">
          <div className="flex flex-1 flex-col justify-center gap-7 px-8 pt-6">
            <div className="grid grid-cols-4 gap-3">
              {["Today", "Month 1", "Month 2", "Month 3"].map((l, i) => (
                <div key={l} className="flex flex-col items-center gap-2">
                  <Ring paid={i + 1} className="size-12" />
                  <span className="text-[11px] tabular-nums">SAR 222.50</span>
                  <span className="text-[10px] text-muted">{l}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-ink/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70">
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-ember align-middle" />
                Pay in 4
              </span>
              <span className="rounded-full bg-sage-soft px-3 py-1 text-[11px] text-[#4c5a3f]">Paid</span>
              <span className="rounded-full bg-ember-soft px-3 py-1 text-[11px] text-[#8f321a]">Payout due</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-ink py-1 pl-4 pr-1 text-[11px] text-paper">
                Checkout <span className="flex size-6 items-center justify-center rounded-full bg-white/10">↗</span>
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
