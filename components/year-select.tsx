"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact pill dropdown ("All years ▾", "All tags ▾"). */
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  className,
  compact = false,
}: {
  compact?: boolean;
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "max-w-[11rem] cursor-pointer appearance-none [&_option]:bg-paper [&_option]:text-ink truncate rounded-full border border-line bg-panel py-0 tabular-nums text-ink outline-none transition-colors hover:border-ink/40 focus:border-ink",
          compact ? "h-7 pl-3 pr-7 text-[12.5px]" : "h-8 pl-3.5 pr-8 text-[13px]",
          value !== "all" ? "border-ink/70 text-ink" : "text-ink/75",
        )}
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={compact ? 12 : 14}
        className={cn("pointer-events-none absolute", compact ? "right-2.5" : "right-3", "text-muted")}
        aria-hidden="true"
      />
    </label>
  );
}

export function YearSelect({
  label,
  years,
  value,
  onChange,
  className,
  compact,
}: {
  compact?: boolean;
  label: string;
  years: string[];
  value: string;
  onChange: (year: string) => void;
  className?: string;
}) {
  return (
    <FilterSelect
      label={label}
      allLabel="All years"
      options={years.map((year) => ({ value: year, label: year }))}
      value={value}
      onChange={onChange}
      className={className}
      compact={compact}
    />
  );
}
