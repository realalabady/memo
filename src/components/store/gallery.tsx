"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { expo } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <div className="rounded-[2.25rem] bg-ink/[0.03] p-2 ring-1 ring-ink/[0.06]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2.25rem-0.5rem)] bg-sand">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: expo }}
            >
              {images[active] && <Image src={images[active]} alt={title} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              className={cn("relative size-20 overflow-hidden rounded-2xl ring-2 transition", i === active ? "ring-ink" : "ring-transparent opacity-60 hover:opacity-100")}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
