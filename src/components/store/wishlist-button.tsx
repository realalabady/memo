"use client";

import { Heart } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { useWishlist } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const t = useT().wishlist;
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t.remove : t.add}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          toast((await toggle(productId)) ? t.saved : t.removed);
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-paper/90 shadow-sm ring-1 ring-ink/[0.06] backdrop-blur transition duration-300 hover:scale-105 active:scale-95",
        saved ? "text-ember" : "text-ink/70 hover:text-ink",
        className,
      )}
    >
      <Heart weight={saved ? "fill" : "light"} className="size-[18px]" />
    </button>
  );
}
