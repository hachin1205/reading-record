import { motion } from "framer-motion";
import { Check, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/sample-data";

const platformColor = {
  playstation: "bg-[#1b5fc1]",
  nintendo: "bg-[#d82727]",
  xbox: "bg-[#27733d]",
  pc: "bg-[#303036]",
} as const;

function CoverArt({ item }: { item: MediaItem }) {
  const style = {
    "--fallback-a": item.coverTone[0],
    "--fallback-b": item.coverTone[1],
  } as React.CSSProperties;

  return (
    <div className="cover-fallback absolute inset-0 overflow-hidden" style={style}>
      {item.coverUrl ? (
        <img alt="" className="absolute inset-0 h-full w-full object-cover" src={item.coverUrl} />
      ) : (
        <>
          <div className="absolute left-[14%] top-[16%] h-10 w-10 rounded-full bg-white/18" />
          <div className="absolute bottom-[16%] left-[14%] h-1.5 w-1/2 rounded-full bg-white/36" />
          <div className="absolute bottom-[23%] left-[14%] h-1 w-2/3 rounded-full bg-white/22" />
          <span className="absolute left-[12%] top-[12%] max-w-[72%] text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-white/82">
            {item.title}
          </span>
        </>
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
  const width = Math.max(32, Math.min(78, Math.round(pageCount / 11)));
  const height = compact ? 100 : item.favorite || item.status === "in_progress" ? 140 : 126;
  const isFacing = facing ?? (item.favorite || item.status === "in_progress");

  if (isFacing) {
    const facingWidth = compact ? 74 : 92;
    const facingHeight = compact ? 108 : 144;
    const coverWidth = compact ? 70 : 88;
    const coverHeight = compact ? 100 : 134;

    return (
      <motion.div
        className="group relative grid place-items-end"
        layout
        style={{ width: facingWidth, height: facingHeight }}
      >
        <div
          className="object-shadow relative overflow-hidden rounded-[6px] border border-black/10 bg-panel transition duration-200 group-hover:-translate-y-2 group-hover:rotate-[-1deg]"
          style={{ width: coverWidth, height: coverHeight }}
        >
          <CoverArt item={item} />
          <div className="absolute inset-y-0 left-0 w-3 bg-black/16" />
          <div className="absolute inset-y-0 right-0 w-2 bg-white/18" />
        </div>
        <ObjectBadges item={item} />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="group relative flex items-end"
      layout
      style={{ width: width + "px", height: height + "px" }}
    >
      <div
        className="object-shadow relative w-full overflow-hidden rounded-[5px] border border-black/10 transition duration-200 group-hover:-translate-y-2"
        style={{ height: height - 8 + "px" }}
      >
        <CoverArt item={item} />
        <div className="absolute inset-y-0 left-0 w-[5px] bg-black/18" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-black/10" />
        <span className="absolute inset-x-1 bottom-2 line-clamp-3 text-center text-[9px] font-semibold leading-tight text-white/82 [writing-mode:vertical-rl]">
          {item.title}
        </span>
      </div>
      <ObjectBadges item={item} />
    </motion.div>
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
  if (spine) return <DiscSpine item={item} onPlay={onPlay} />;

  const size = compact ? 92 : item.favorite ? 128 : 118;
  return (
    <div className="group relative grid place-items-end" style={{ width: size, height: size + 8 }}>
      <div
        className="object-shadow relative overflow-hidden rounded-[8px] border border-white/45 bg-white/22 p-[7px] backdrop-blur transition duration-200 group-hover:-translate-y-1"
        style={{ width: size, height: size }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-black/10">
          <CoverArt item={item} />
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/10">
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" />
          </div>
        </div>
        <div className="absolute inset-y-0 left-2 w-px bg-white/55" />
        <div className="absolute inset-x-0 top-0 h-6 bg-white/18" />
        {item.themeYoutubeId ? (
          <button aria-label={`${playing ? "Pause" : "Play"} ${item.title}`} className="absolute bottom-0 left-0 z-20 grid h-11 w-11 touch-manipulation place-items-center text-[10px] font-bold text-white" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPlay?.(); }}>
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-black/75 shadow-sm">
            {playing ? (
              <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 28 28" aria-hidden="true">
                <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
                <circle
                  cx="14"
                  cy="14"
                  r="12"
                  fill="none"
                  stroke="rgba(255,255,255,0.9)"
                  strokeLinecap="round"
                  strokeWidth="2"
                  strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 75.4} 75.4`}
                />
              </svg>
            ) : null}
            <span className="relative">{playing ? "Ⅱ" : "▶"}</span>
            </span>
          </button>
        ) : null}
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

function DiscSpine({ item, onPlay }: { item: MediaItem; onPlay?: () => void }) {
  return (
    <div className="group relative flex h-[118px] w-[34px] items-end">
      <div className="object-shadow relative h-[112px] w-full overflow-hidden rounded-[5px] border border-white/40 bg-white/22 p-[4px] backdrop-blur transition duration-200 group-hover:-translate-y-1">
        <div
          className="cover-fallback absolute inset-[4px] rounded-[3px]"
          style={
            {
              "--fallback-a": item.coverTone[0],
              "--fallback-b": item.coverTone[1],
            } as React.CSSProperties
          }
        />
        <div className="absolute inset-y-0 left-1 w-px bg-white/50" />
        {item.themeYoutubeId ? (
          <button
            aria-label={"Play " + item.title}
            className="absolute bottom-1 left-1/2 z-20 grid h-8 w-8 -translate-x-1/2 touch-manipulation place-items-center rounded-full border border-white/30 bg-black/55 text-[9px] text-white"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onPlay?.(); }}
          >
            ▶
          </button>
        ) : (
          <div className="absolute bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border border-white/30 bg-white/10" />
        )}
        <span className="absolute inset-x-1 top-2 line-clamp-3 text-center text-[8px] font-semibold uppercase leading-tight text-white/82 [writing-mode:vertical-rl]">
          {item.title}
        </span>
      </div>
      <ObjectBadges item={item} />
    </div>
  );
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

  const width = compact ? 78 : 92;
  const height = compact ? 116 : 138;
  const strip = platformColor[item.platformFamily ?? "playstation"];

  return (
    <div className="group relative grid place-items-end" style={{ width, height: height + 8 }}>
      <div
        className="object-shadow relative h-full w-full overflow-hidden rounded-[7px] border border-black/10 bg-black/10 p-[6px] transition duration-200 group-hover:-translate-y-2"
      >
        <div className={cn("absolute inset-x-0 top-0 h-4", strip)} />
        <div className="relative mt-3 h-[calc(100%-12px)] overflow-hidden rounded-[4px]">
          <CoverArt item={item} />
        </div>
        <div className="absolute inset-y-1 left-1 w-1.5 rounded-sm bg-white/14" />
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

function GameSpine({ item, compact }: { item: MediaItem; compact: boolean }) {
  const strip = platformColor[item.platformFamily ?? "playstation"];

  return (
    <div
      className="group relative flex h-[146px] items-end justify-end"
      style={{ width: compact ? 54 : 36 }}
    >
      <div
        className="object-shadow relative h-[138px] w-[36px] overflow-hidden rounded-[6px] border border-black/10 bg-black/10 transition duration-200 group-hover:-translate-y-1"
      >
        <div className={cn("absolute inset-y-1 left-1 w-2 rounded-sm", strip)} />
        <div className="cover-fallback absolute inset-y-[6px] left-[11px] right-[4px] rounded-[3px]" style={
          {
            "--fallback-a": item.coverTone[0],
            "--fallback-b": item.coverTone[1],
          } as React.CSSProperties
        } />
        <div className="absolute inset-y-[6px] left-[11px] right-[4px] rounded-[3px] bg-black/18" />
        <span className="absolute inset-y-3 left-[13px] right-[5px] overflow-hidden text-center text-[8px] font-semibold uppercase leading-tight text-white [writing-mode:vertical-rl]">
          {item.title}
        </span>
      </div>
      <ObjectBadges item={item} />
    </div>
  );
}

function WritingObject({ item, compact }: { item: MediaItem; compact: boolean }) {
  const width = compact ? 76 : 92;
  const height = compact ? 104 : 124;
  const tilt = ((hashString(item.id) % 7) - 3) * 1.4;

  return (
    <div className="group relative grid place-items-end" style={{ width, height: height + 8 }}>
      <div
        className="object-shadow relative h-full w-full overflow-hidden rounded-[4px] border border-line bg-[#f8f2e4] transition duration-200 group-hover:-translate-y-2"
        style={{ transform: `rotate(${tilt}deg)` }}
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

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function ObjectBadges({ item }: { item: MediaItem }) {
  return (
    <>
      {item.type === "book" && (item.status === "in_progress" || item.status === "finished") ? (
        <span
          aria-label={item.status === "in_progress" ? "In progress" : "Finished"}
          className={cn(
            "absolute bottom-1 left-1 z-20 grid h-4 w-4 place-items-center rounded-full border border-white/35 text-white shadow-sm",
            item.status === "in_progress" ? "bg-[#2f7181]" : "bg-[#315d45]",
          )}
          title={item.status === "in_progress" ? "In progress" : "Finished"}
        >
          {item.status === "in_progress" ? <Ellipsis size={10} strokeWidth={2.5} /> : <Check size={10} strokeWidth={2.5} />}
        </span>
      ) : null}
      {item.favorite ? (
        <span className="absolute -right-1 top-2 h-5 w-3 rounded-b-full bg-[#d5a640] shadow-sm" />
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
      <div className="flex h-16 w-2.5 items-start justify-center rounded-t-[2px] border border-[#c6a967]/70 bg-[#ead28e] pt-1 text-[8px] font-bold text-[#6a5228] shadow-sm">
        {label}
      </div>
    </div>
  );
}

export function YearShelfTag({ label }: { label: string }) {
  const digits = /^\d{4}$/.test(label) ? label.split("") : ["N", "/", "D"];

  return (
    <div className="relative flex h-[150px] w-7 shrink-0 items-end justify-center pb-2" aria-label={label}>
      <div className="absolute bottom-2 top-1 left-1/2 w-px -translate-x-1/2 bg-[#b9a98d]/65" />
      <div className="relative flex w-5 flex-col items-center rounded-[3px] border border-[#d8ceb8] bg-[#fffaf0] py-1.5 font-serif text-[9px] font-bold leading-[11px] text-[#4c3620] shadow-[0_1px_2px_rgba(0,0,0,0.14),inset_0_1px_rgba(255,255,255,0.9)]">
        {digits.map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
      </div>
    </div>
  );
}
