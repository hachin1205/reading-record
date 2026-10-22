import { motion } from "framer-motion";
import { DefaultCover } from "./default-cover";
import { Check, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/sample-data";

const platformColor = {
  playstation: "bg-[#1b5fc1]",
  nintendo: "bg-[#d82727]",
  xbox: "bg-[#27733d]",
  pc: "bg-[#303036]",
} as const;

// Every object on a shelf shares one height so rows line up evenly.
const SHELF_HEIGHT = 128;
const COMPACT_HEIGHT = 100;
const objectHeight = (compact: boolean) => (compact ? COMPACT_HEIGHT : SHELF_HEIGHT);

function CoverArt({ item, plain = false }: { item: MediaItem; plain?: boolean }) {
  const style = {
    "--fallback-a": item.coverTone[0],
    "--fallback-b": item.coverTone[1],
  } as React.CSSProperties;

  return (
    <div className="cover-fallback absolute inset-0 overflow-hidden" style={style}>
      {item.coverUrl ? (
        <img alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" src={item.coverUrl} />
      ) : plain ? null : (
        <DefaultCover item={item} />
      )}
    </div>
  );
}

export function MediaObject({
  item,
  compact = false,
  playing = false,
  progress = 0,
  shelfIndex = 0,
  expanded = false,
  bookFacing,
  videoFacing,
  gameFacing,
  onPlay,
}: {
  item: MediaItem;
  compact?: boolean;
  playing?: boolean;
  progress?: number;
  shelfIndex?: number;
  expanded?: boolean;
  bookFacing?: boolean;
  videoFacing?: boolean;
  gameFacing?: boolean;
  onPlay?: () => void;
}) {
  if (item.type === "book") {
    return <BookObject item={item} compact={compact} facing={bookFacing} />;
  }
  if (item.type === "video") {
    return (
      <DiscCase
        item={item}
        compact={compact}
        playing={playing}
        progress={progress}
        spine={!playing && (videoFacing === undefined ? shelfIndex >= 3 && !item.favorite && !expanded : !videoFacing)}
        onPlay={onPlay}
      />
    );
  }
  if (item.type === "game") {
    return (
      <GameCase
        item={item}
        compact={compact}
        spine={gameFacing === undefined ? shelfIndex >= 3 && !item.favorite : !gameFacing}
      />
    );
  }
  return <WritingObject item={item} compact={compact} />;
}

function BookObject({
  item,
  compact,
  facing,
}: {
  item: MediaItem;
  compact: boolean;
  facing?: boolean;
}) {
  const pageCount = item.pageCount ?? 260;
  // Spine thickness follows page count, but stays slim so a closed book reads as a spine.
  // On the short "Currently Enjoying" shelf a long title needs room for two columns,
  // so the spine is at least as wide as a disc case there.
  const longTitle = [...item.title].length > 3;
  const width = compact
    ? Math.max(longTitle ? 28 : 20, Math.min(32, Math.round(18 + pageCount / 60)))
    : Math.max(22, Math.min(40, Math.round(20 + pageCount / 45)));
  const height = objectHeight(compact);
  const isFacing = facing ?? (item.favorite || item.status === "in_progress");

  if (isFacing) {
    const coverWidth = compact ? 68 : 86;
    const coverHeight = height;
    const facingWidth = coverWidth + 4;
    const facingHeight = coverHeight + 8;

    return (
      <motion.div
        className="group relative grid place-items-end"
        layout
        style={{ width: facingWidth, height: facingHeight }}
      >
        <div
          className="object-shadow relative overflow-hidden rounded-[3px] border border-black/10 bg-panel transition duration-200 group-hover:-translate-y-2"
          style={{ width: coverWidth, height: coverHeight }}
        >
          <CoverArt item={item} />
          <div className="absolute inset-y-0 left-[5px] w-px bg-black/15" />
        </div>
        <ObjectBadges item={item} />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="group relative flex items-end"
      layout
      style={{ width: width + "px", height: height + 8 + "px" }}
    >
      <div
        className="object-shadow relative w-full overflow-hidden rounded-[3px] transition duration-200 group-hover:-translate-y-2"
        style={{ height: height + "px" }}
      >
        <SpineBackground item={item} />
        <SpineSheen />
        <SpineBands />
        <SpineTitle height={objectHeight(compact)} title={item.title} top={compact ? 17 : 19} bottom={compact ? 31 : 34} serif author={spineAuthor(item.creator)} />
      </div>
      <ObjectBadges item={item} spine />
    </motion.div>
  );
}

function ThemeButton({
  item,
  playing,
  progress,
  onPlay,
  small = false,
}: {
  item: MediaItem;
  playing: boolean;
  progress: number;
  onPlay?: () => void;
  small?: boolean;
}) {
  if (!item.themeYoutubeId) return null;
  const size = small ? 22 : 26;
  return (
    <button
      aria-label={`${playing ? "Pause" : "Play"} ${item.title} theme`}
      className={cn(
        "absolute z-20 grid touch-manipulation place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/85",
        small ? "bottom-7 left-1/2 -translate-x-1/2" : "bottom-2 right-2",
      )}
      style={{ width: size, height: size }}
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onPlay?.();
      }}
    >
      {playing ? (
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 28 28" aria-hidden="true" style={{ width: size, height: size }}>
          <circle cx="14" cy="14" r="12.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <circle
            cx="14"
            cy="14"
            r="12.5"
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeLinecap="round"
            strokeWidth="1.5"
            strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 78.5} 78.5`}
          />
        </svg>
      ) : null}
      <span className="relative text-[9px] leading-none">{playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

function DiscCase({
  item,
  compact,
  playing,
  progress,
  spine,
  onPlay,
}: {
  item: MediaItem;
  compact: boolean;
  playing: boolean;
  progress: number;
  spine: boolean;
  onPlay?: () => void;
}) {
  if (spine) return <DiscSpine item={item} compact={compact} playing={playing} progress={progress} onPlay={onPlay} />;

  const height = objectHeight(compact);
  const width = compact ? 68 : 86;

  return (
    <div className="group relative grid place-items-end" style={{ width: width + 4, height: height + 8 }}>
      {/* A video case rather than a book: dark plastic frame, a label strip on top
          (like the matching spine), the cover under a glossy sleeve. */}
      <div
        className="object-shadow relative overflow-hidden rounded-[5px] bg-[#141414] p-[3px] pt-0 transition duration-200 group-hover:-translate-y-2"
        style={{ width, height }}
      >
        <div className="grid h-[13px] place-items-center">
          <span className="text-[6.5px] font-bold tracking-[0.14em] text-white/85">{videoSpineLabel(item)}</span>
        </div>
        <div className="relative overflow-hidden rounded-[2px]" style={{ height: height - 16 }}>
          <CoverArt item={item} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.05)_28%,transparent_42%,transparent_70%,rgba(255,255,255,0.08)_100%)]" />
        </div>
        <div className="pointer-events-none absolute inset-y-[14px] left-[1px] w-[2px] rounded-full bg-white/10" />
        <ThemeButton item={item} playing={playing} progress={progress} onPlay={onPlay} />
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

function DiscSpine({
  item,
  compact,
  playing,
  progress,
  onPlay,
}: {
  item: MediaItem;
  compact: boolean;
  playing: boolean;
  progress: number;
  onPlay?: () => void;
}) {
  const height = objectHeight(compact);
  return (
    <div className="group relative flex w-[28px] items-end" style={{ height: height + 8 }}>
      <div
        style={{ height }}
        className="object-shadow relative w-full overflow-hidden rounded-[3px] transition duration-200 group-hover:-translate-y-2"
      >
        <SpineBackground item={item} />
        <SpineSheen />
        <div className="absolute inset-x-0 top-0 grid h-[15px] place-items-center bg-[#151515]">
          <span className="text-[6.5px] font-bold tracking-[0.08em] text-white/85">{videoSpineLabel(item)}</span>
        </div>
        <SpineTitle height={objectHeight(compact)} title={item.title} top={19} bottom={item.themeYoutubeId ? 52 : item.status === "finished" || item.status === "in_progress" ? 24 : 6} />
        <ThemeButton item={item} playing={playing} progress={progress} onPlay={onPlay} small />
      </div>
      <ObjectBadges item={item} spine />
    </div>
  );
}

function SpineBackground({ item, vivid = false }: { item: MediaItem; vivid?: boolean }) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${item.coverTone[0]}, ${item.coverTone[1]})` }}
      />
      {item.coverUrl ? (
        <div
          aria-hidden="true"
          data-spine-wash=""
          className="absolute -inset-3 bg-cover bg-center"
          style={{
            backgroundImage: `url("${item.coverUrl}")`,
            filter: vivid ? "blur(14px) saturate(2.1) brightness(1.08)" : "blur(16px) saturate(1.3)",
            transform: "scale(2.2)",
          }}
        />
      ) : null}
      <div className={cn("absolute inset-0", vivid ? "bg-black/[0.14]" : "bg-black/30")} />
    </>
  );
}

// Short author name for a spine: surname for Western names, full name for CJK names.
function spineAuthor(creator: string) {
  const name = creator.trim();
  if (!name || name === "Unknown") return undefined;
  if (CJK.test(name)) return name.replace(/\s+/g, "");
  const parts = name.split(/\s+/);
  return parts[parts.length - 1];
}

function SpineBands() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[9px] h-[2px] bg-[#d9b56a]/80" />
      <div className="pointer-events-none absolute inset-x-0 top-[13px] h-px bg-[#d9b56a]/55" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[28px] h-px bg-[#d9b56a]/55" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[24px] h-[2px] bg-[#d9b56a]/80" />
    </>
  );
}

function SpineSheen() {
  return <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-black/10" />;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

/**
 * What fits on a narrow spine: drop format labels that real spines leave off
 * (「小説」, 「新装版」, 「上下巻セット」…) and the gaps around them, so
 * 「小説　機動戦士ガンダム 逆襲のシャア　新装版」 reads 「機動戦士ガンダム逆襲のシャア」.
 */
function spineLabel(title: string) {
  const cleaned = title
    .replace(/^(小説|漫画|コミックス?|文庫|新書|ノベライズ|Novel)[\s\u3000:：・]+/i, "")
    .replace(/[\s\u3000]*[(（]?(新装版|完全版|愛蔵版|決定版|文庫版|特装版|限定版|上下巻セット|全\d+巻セット|\d+巻セット)[)）]?$/, "")
    .replace(/[\u3000]+/g, " ")
    .trim();
  const label = cleaned || title;
  return CJK.test(label) ? label.replace(/\s+/g, "") : label;
}

function SpineTitle({
  title: fullTitle,
  top,
  bottom,
  serif = false,
  author,
  height = SHELF_HEIGHT,
}: {
  title: string;
  top: number;
  bottom: number;
  serif?: boolean;
  author?: string;
  /** Height of the spine (shorter on the "Currently Enjoying" shelf). */
  height?: number;
}) {
  const title = spineLabel(fullTitle);
  // Japanese/Chinese spines: upright characters with airy spacing, like a real 背表紙.
  const cjk = CJK.test(title);
  const authorCjk = author ? CJK.test(author) : false;
  // Rough fit check (vertical text): only show the author if the whole name fits under the title.
  const available = height - top - bottom;
  const titleLength = [...title].length * (cjk ? 15.3 : serif ? 6.6 : 6);
  // Too long for one column (e.g. a short spine): set it in two narrower columns, like a
  // real spine with a long title, instead of cutting it after two characters.
  const twoColumns = titleLength > available;
  const authorLength = author ? [...author].length * (authorCjk ? 11.2 : 5.4) + 10 : 0;
  const showAuthor = !twoColumns && Boolean(author) && titleLength + authorLength <= available;
  return (
    <span
      className="absolute inset-x-[2px] flex flex-col items-center justify-start overflow-hidden"
      style={{ top, bottom }}
    >
      <span
        className={cn(
          "min-h-0 shrink-0 max-h-full overflow-hidden text-white [text-orientation:mixed] [writing-mode:vertical-rl]",
          twoColumns
            ? "max-w-[calc(100%-8px)] whitespace-normal break-all leading-[1.1]"
            : "whitespace-nowrap leading-none [text-overflow:ellipsis]",
          serif || cjk ? "font-serif font-medium" : "font-medium",
          twoColumns
            ? cjk
              ? "text-[9.5px] tracking-[0.02em]"
              : "text-[8px] tracking-normal"
            : cjk
              ? "text-[12.5px] tracking-[0.22em]"
              : serif
                ? "text-[11.5px] tracking-[0.02em]"
                : "text-[10px] tracking-[0.02em]",
        )}
        style={{ maxHeight: Math.max(0, available) }}
      >
        {title}
      </span>
      {showAuthor ? (
        <span
          className={cn(
            "mt-2.5 min-h-0 shrink overflow-hidden whitespace-nowrap font-serif leading-none text-white/80 [text-overflow:clip] [text-orientation:mixed] [writing-mode:vertical-rl]",
            authorCjk ? "max-h-[60px] text-[9.5px] tracking-[0.18em]" : "max-h-[46px] text-[8.5px] tracking-[0.04em]",
          )}
        >
          {author}
        </span>
      ) : null}
    </span>
  );
}

function videoSpineLabel(item: MediaItem) {
  if (item.subtype === "anime") return "ANIME";
  if (item.subtype === "us_tv" || item.subtype === "j_drama" || item.subtype === "k_drama") return "TV";
  if (item.subtype === "documentary") return "DOC";
  return "FILM";
}

function GameCase({
  item,
  compact,
  spine,
}: {
  item: MediaItem;
  compact: boolean;
  spine: boolean;
}) {
  if (spine) return <GameSpine item={item} compact={compact} />;

  const height = objectHeight(compact);
  const width = compact ? 78 : 100;
  const strip = platformColor[item.platformFamily ?? "playstation"];

  return (
    <div className="group relative grid place-items-end" style={{ width: width + 4, height: height + 8 }}>
      <div
        className="object-shadow relative overflow-hidden rounded-[4px] bg-panel transition duration-200 group-hover:-translate-y-2"
        style={{ width, height }}
      >
        <CoverArt item={item} />
        <div className={cn("absolute inset-x-0 top-0 h-[3px]", strip)} />
        <div className="pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset ring-black/10" />
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

const platformLabel = {
  playstation: "PS",
  nintendo: "NS",
  xbox: "XB",
  pc: "PC",
} as const;

function GameSpine({ item, compact }: { item: MediaItem; compact: boolean }) {
  const platform = item.platformFamily ?? "playstation";
  const height = objectHeight(compact);

  return (
    <div className="group relative flex w-[28px] items-end" style={{ height: height + 8 }}>
      <div
        style={{ height }}
        className="object-shadow relative w-full overflow-hidden rounded-[3px] transition duration-200 group-hover:-translate-y-2"
      >
        <SpineBackground item={item} vivid />
        <SpineSheen />
        <div className={cn("absolute inset-x-0 top-0 grid h-[17px] place-items-center", platformColor[platform])}>
          <span className="text-[7px] font-extrabold tracking-[0.04em] text-white">{platformLabel[platform]}</span>
        </div>
        <div className={cn("absolute inset-x-0 bottom-0 h-[6px]", platformColor[platform])} />
        <SpineTitle height={objectHeight(compact)} title={item.title} top={21} bottom={item.status === "finished" || item.status === "in_progress" ? 24 : 6} />
      </div>
      <ObjectBadges item={item} spine />
    </div>
  );
}

function WritingObject({ item, compact }: { item: MediaItem; compact: boolean }) {
  const width = compact ? 72 : 92;
  const height = objectHeight(compact);

  return (
    <div className="group relative grid place-items-end" style={{ width: width + 4, height: height + 8 }}>
      <div
        className="object-shadow relative w-full overflow-hidden rounded-[4px] border border-line bg-[#f8f2e4] transition duration-200 group-hover:-translate-y-2"
        style={{ height }}
      >
        <div className="absolute -right-2 top-2 h-[88%] w-[88%] rounded-[3px] border border-[#d9ccb1] bg-[#efe4cf]" />
        <div className="absolute inset-2 rounded-[3px] border border-[#dacdb3] bg-[#fbf7ed]" />
        <div className="absolute left-4 right-4 top-5 h-1.5 rounded-full bg-[#8a6f45]/45" />
        <div className="absolute left-4 top-8 h-1 w-1/2 rounded-full bg-[#8a6f45]/25" />
        <div className="absolute inset-x-4 top-12 space-y-1.5">
          <div className="h-px bg-[#8a6f45]/28" />
          <div className="h-px bg-[#8a6f45]/20" />
          <div className="h-px bg-[#8a6f45]/24" />
          <div className="h-px w-3/4 bg-[#8a6f45]/18" />
        </div>
        <span className="absolute bottom-4 left-4 right-4 line-clamp-2 text-[9px] font-semibold leading-tight text-[#5d4b31]">
          {item.title}
        </span>
        <div className="absolute left-0 top-0 h-full w-2 bg-[#d8c49f]" />
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

function ObjectBadges({ item, spine = false }: { item: MediaItem; spine?: boolean }) {
  return (
    <>
      {item.type !== "writing" && (item.status === "in_progress" || item.status === "finished") ? (
        <span
          aria-label={item.status === "in_progress" ? "In progress" : "Finished"}
          className={cn(
            "absolute z-20 grid place-items-center rounded-full text-white ring-1 ring-white/80",
            spine ? "bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2" : "bottom-1.5 left-1.5 h-4 w-4",
            item.status === "in_progress" ? "bg-[#2f7181]" : "bg-[#2f7d4f]",
          )}
          title={item.status === "in_progress" ? "In progress" : "Finished"}
        >
          {item.status === "in_progress" ? <Ellipsis size={spine ? 8 : 10} strokeWidth={2.5} /> : <Check size={spine ? 8 : 10} strokeWidth={2.75} />}
        </span>
      ) : null}
      {item.favorite ? (
        <span className="absolute -right-1 top-2 h-5 w-3 rounded-b-full bg-[#d5a640]" />
      ) : null}
      {item.completionCount && item.completionCount > 1 ? (
        <span className="absolute -right-2 -top-1 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper">
          x{item.completionCount}
        </span>
      ) : null}
    </>
  );
}

export function AuthorBookmark({ label }: { label: string }) {
  return (
    <div className="-mx-0.5 flex h-[150px] w-2 items-end justify-center pb-2">
      <div className="flex h-16 w-2.5 items-start justify-center rounded-t-[2px] border border-line bg-panel pt-1 text-[8px] font-bold text-muted">
        {label}
      </div>
    </div>
  );
}

export function YearShelfTag({ label }: { label: string }) {
  const digits = /^\d{4}$/.test(label) ? label.split("") : ["N", "/", "D"];

  return (
    <div className="relative flex h-[150px] w-7 shrink-0 items-end justify-center pb-2" aria-label={label}>
      <div className="absolute bottom-2 top-1 left-1/2 w-px -translate-x-1/2 bg-line" />
      <div className="relative flex w-5 flex-col items-center rounded-[2px] border border-line bg-panel py-1.5 font-serif text-[9px] font-semibold leading-[11px] text-ink">
        {digits.map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
      </div>
    </div>
  );
}
