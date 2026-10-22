"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { MediaItem } from "@/lib/sample-data";
import { formatTagline, parseTagline } from "@/lib/tags";
import { PlanBuilder } from "./plan-builder";

async function patch(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/media/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { data?: MediaItem; error?: string };
  if (response.status === 401) throw new Error("You've been signed out — sign in again.");
  if (!response.ok || !payload.data) throw new Error(payload.error ?? "Couldn't save");
  return payload.data;
}

/** Editing a plan after it was started: rename it, take titles out, add more. */
export function PlanPanel({
  host,
  members,
  existing,
  canEdit,
  onItemsSaved,
  onHostSaved,
}: {
  host: MediaItem;
  members: MediaItem[];
  existing: MediaItem[];
  canEdit: boolean;
  onItemsSaved: (items: MediaItem[]) => void;
  onHostSaved: (host: MediaItem) => void;
}) {
  const [name, setName] = useState(host.title);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = members.filter((item) => item.status === "finished" || item.status === "dropped").length;

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  const rename = () =>
    run(async () => {
      const next = name.trim();
      if (!next || next === host.title) return;
      const saved: MediaItem[] = [];
      for (const item of members) {
        const tag = parseTagline(item.note);
        saved.push(await patch(item.id, { note: formatTagline(tag.text, tag.tags, next) }));
      }
      onItemsSaved(saved);
      onHostSaved(await patch(host.id, { title: next }));
    });

  const removeMember = (item: MediaItem) =>
    run(async () => {
      const tag = parseTagline(item.note);
      onItemsSaved([await patch(item.id, { note: formatTagline(tag.text, tag.tags) || null })]);
    });

  return (
    <section className="mt-6 border-t border-line pt-5" aria-label="Plan">
      {canEdit ? (
          <div className="mb-5 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="text-[12px] text-muted">Plan name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-0.5 h-8 w-full border-0 border-b border-line bg-transparent font-serif text-[15px] outline-none focus:border-ink"
            />
          </label>
          <button
            type="button"
            disabled={busy || !name.trim() || name.trim() === host.title}
            className="rounded-full bg-ink px-3.5 py-1 text-[12.5px] font-medium text-paper disabled:opacity-35"
            onClick={() => void rename()}
          >
            Rename
          </button>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">In this plan</h3>
        <span className="text-[12px] tabular-nums text-muted">
          {done}/{members.length} done
        </span>
      </div>
      <ul className="mt-3 grid gap-1.5">
        {members.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-[14px]">
            <span className={item.status === "finished" ? "text-muted line-through decoration-accent/50" : "text-ink"}>
              {item.title}
            </span>
            <span className="text-[11.5px] text-muted">{item.status === "finished" ? "done" : item.status === "in_progress" ? "on it" : ""}</span>
            {canEdit ? (
              <button
                type="button"
                disabled={busy}
                aria-label={`Take ${item.title} out of the plan`}
                title="Take out of the plan (the title stays in your library)"
                className="ml-auto grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-ink/10 hover:text-ink disabled:opacity-40"
                onClick={() => void removeMember(item)}
              >
                <X size={13} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <>
          <button
            type="button"
            className="mt-4 text-[13px] text-accent underline-offset-4 hover:underline"
            onClick={() => setAdding((open) => !open)}
          >
            {adding ? "Done adding" : "+ Add titles to this plan"}
          </button>
          {adding ? (
            <PlanBuilder
              fixedName={host.title}
              existing={existing}
              onSaved={(saved) => {
                onItemsSaved(saved);
                setAdding(false);
              }}
            />
          ) : null}
          {error ? <p className="mt-2 text-[12.5px] text-accent">{error}</p> : null}
        </>
      ) : null}
    </section>
  );
}
