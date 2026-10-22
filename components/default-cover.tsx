import type { MediaItem } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { isCustomSubtype } from "@/lib/subtypes";

function markFor(item: Pick<MediaItem, "type" | "subtype">) {
  if (isCustomSubtype(item.subtype)) return item.subtype as string;
  if (item.type === "book") return "Book";
  if (item.type === "game") return item.subtype === "visual_novel" ? "Visual novel" : "Game";
  if (item.type === "writing") return item.subtype === "short_story" ? "Short story" : item.subtype === "essay" ? "Essay" : "Writing";
  switch (item.subtype) {
    case "anime":
      return "Anime";
    case "j_drama":
      return "J-drama";
    case "k_drama":
      return "K-drama";
    case "us_tv":
      return "Series";
    case "documentary":
      return "Documentary";
    default:
      return "Film";
  }
}

/**
 * Cover shown when a record has no picture: a plain printed edition — a coloured band with the
 * title, a paper panel with the creator and a small type mark. It scales with its box: small
 * thumbnails show only the first character.
 */
export function DefaultCover({
  item,
  className,
}: {
  item: Pick<MediaItem, "title" | "creator" | "type" | "subtype"> & { coverTone?: MediaItem["coverTone"] };
  className?: string;
}) {
  const [a, b] = item.coverTone ?? ["#2f3a46", "#a9a18f"];
  const title = item.title.trim() || "Untitled";
  const initial = Array.from(title)[0] ?? "·";
  const writing = item.type === "writing";
  return (
    <span
      aria-hidden="true"
      className={cn("default-cover", writing && "default-cover-writing", className)}
      style={{ "--cover-a": a, "--cover-b": b } as React.CSSProperties}
    >
      <span className="default-cover-band">
        <span className="default-cover-title">{title}</span>
        <span className="default-cover-initial">{initial}</span>
      </span>
      <span className="default-cover-paper">
        {item.creator ? <span className="default-cover-creator">{item.creator}</span> : null}
        <span className="default-cover-mark">{markFor(item)}</span>
      </span>
    </span>
  );
}
