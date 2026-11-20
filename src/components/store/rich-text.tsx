import { parseBlocks } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Renders the legal-page text format (headings, bullets, paragraphs) as plain React elements. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-5 leading-relaxed text-ink/75", className)}>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "h2") return <h2 key={i} className="font-display pt-4 text-3xl text-ink">{b.text}</h2>;
        if (b.kind === "h3") return <h3 key={i} className="pt-2 text-lg font-medium text-ink">{b.text}</h3>;
        if (b.kind === "ul")
          return (
            <ul key={i} className="list-disc space-y-2 ps-5 marker:text-ember">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}
