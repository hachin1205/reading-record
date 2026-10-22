"use client";

import { useId } from "react";
import type { MediaType } from "@/lib/sample-data";
import { kindSuggestions } from "@/lib/subtypes";
import { cn } from "@/lib/utils";

/** "Kind" field: pick a suggestion or type your own (Paper, Lecture, Textbook…). */
export function KindInput({
  type,
  value,
  onChange,
  className,
  inputClassName,
}: {
  type: MediaType;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const listId = useId();
  return (
    <label className={cn("block", className)}>
      <span className="text-[12px] text-muted">Kind</span>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={kindSuggestions[type].slice(0, 3).join(", ") + "… or your own"}
        className={cn(
          "mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent text-[14px] outline-none placeholder:text-muted/60 focus:border-ink",
          inputClassName,
        )}
      />
      <datalist id={listId}>
        {kindSuggestions[type].map((kind) => (
          <option key={kind} value={kind} />
        ))}
      </datalist>
    </label>
  );
}
