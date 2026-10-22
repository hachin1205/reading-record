"use client";

import { Sparkle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NoteBody } from "./note-body";

type Change = { before: string; after: string; why: string };
type Turn = { role: "user" | "assistant"; content: string };

/**
 * Claude inside the note box.
 *  - Fix grammar: checks the selected text (or the whole note) and lets you apply the fixes.
 *  - Ask: talk through a part of the book / film / game you didn't get.
 */
export function ClaudeHelper({
  getText,
  onApply,
  onInsert,
  context,
  allowAsk = true,
}: {
  allowAsk?: boolean;
  /** Selected text if any, otherwise the whole note, plus whether it was a selection. */
  getText: () => { text: string; selection: boolean; whole: string };
  /** Replace what was checked with the corrected version. */
  onApply: (corrected: string, selection: boolean) => void;
  /** Add Claude's explanation to the note. */
  onInsert: (text: string) => void;
  context: { title: string; creator?: string; kind?: string };
}) {
  const [panel, setPanel] = useState<"grammar" | "ask" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grammar, setGrammar] = useState<{ corrected: string; changes: Change[]; selection: boolean } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const abort = useRef<AbortController | null>(null);
  const [provider, setProvider] = useState<"claude" | "gemini">("claude");
  useEffect(() => {
    fetch("/api/claude", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { provider?: "claude" | "gemini" } } | null) => {
        if (payload?.data?.provider) setProvider(payload.data.provider);
      })
      .catch(() => {});
  }, []);
  const assistant = provider === "gemini" ? "Gemini" : "Claude";

  async function fixGrammar() {
    const { text, selection } = getText();
    setPanel("grammar");
    setError(null);
    setGrammar(null);
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "grammar", text }),
      });
      const payload = (await response.json()) as { data?: { corrected: string; changes: Change[] }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? `${assistant} couldn't check this.`);
      setGrammar({ ...payload.data, selection });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${assistant} couldn't check this.`);
    } finally {
      setBusy(false);
    }
  }

  async function ask(event?: React.FormEvent) {
    event?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setQuestion("");
    const history = turns;
    setTurns([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({ mode: "ask", question: q, history, text: getText().whole, context }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `${assistant} couldn't answer.`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const current = answer;
        setTurns((list) => [...list.slice(0, -1), { role: "assistant", content: current }]);
      }
    } catch (reason) {
      if ((reason as Error)?.name !== "AbortError") {
        setError(reason instanceof Error ? reason.message : `${assistant} couldn't answer.`);
        setTurns((list) => (list.at(-1)?.content ? list : list.slice(0, -2)));
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function close() {
    abort.current?.abort();
    setPanel(null);
    setError(null);
    setGrammar(null);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="inline-flex items-center gap-1 text-muted">
          {provider === "gemini" ? (
            <Sparkle size={13} aria-hidden="true" className="text-[#4f7be8]" />
          ) : (
            <Sparkles size={13} aria-hidden="true" />
          )}{" "}
          {assistant}
        </span>
        <button
          type="button"
          disabled={busy}
          title="Checks the selected text, or the whole note if nothing is selected"
          className={cn(
            "rounded-full border px-3 py-1 transition-colors disabled:opacity-50",
            panel === "grammar" ? "border-ink text-ink" : "border-line text-muted hover:border-ink/40 hover:text-ink",
          )}
          onClick={() => void fixGrammar()}
        >
          Fix grammar
        </button>
        {allowAsk ? (
        <button
          type="button"
          className={cn(
            "rounded-full border px-3 py-1 transition-colors",
            panel === "ask" ? "border-ink text-ink" : "border-line text-muted hover:border-ink/40 hover:text-ink",
          )}
          onClick={() => {
            setPanel("ask");
            setError(null);
          }}
        >
          Ask about a part I didn&rsquo;t get
        </button>
        ) : null}
      </div>

      {panel ? (
        <div className="relative mt-3 rounded-[8px] border border-line bg-paper/70 p-4">
          <button
            type="button"
            aria-label={`Close ${assistant}`}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:text-ink"
            onClick={close}
          >
            <X size={14} />
          </button>

          {panel === "grammar" ? (
            <div className="pr-6 text-[13px]">
              {busy ? <p className="text-muted">Checking…</p> : null}
              {grammar && grammar.changes.length === 0 ? <p className="text-muted">Looks good — nothing to fix.</p> : null}
              {grammar && grammar.changes.length ? (
                <>
                  <p className="text-muted">
                    {grammar.changes.length} fix{grammar.changes.length === 1 ? "" : "es"}
                    {grammar.selection ? " in the selected text" : ""}:
                  </p>
                  <ul className="mt-2 grid gap-2">
                    {grammar.changes.map((change, index) => (
                      <li key={index} className="leading-relaxed">
                        <span className="text-muted line-through decoration-accent/60">{change.before}</span>
                        <span className="mx-1.5 text-muted">→</span>
                        <span className="text-ink">{change.after}</span>
                        {change.why ? <span className="block text-[11.5px] text-muted">{change.why}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      className="rounded-full bg-ink px-3.5 py-1 text-[12.5px] font-medium text-paper"
                      onClick={() => {
                        onApply(grammar.corrected, grammar.selection);
                        close();
                      }}
                    >
                      Apply all
                    </button>
                    <button type="button" className="text-[12.5px] text-muted hover:text-ink" onClick={close}>
                      Keep mine
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="pr-6">
              {turns.length === 0 ? (
                <p className="text-[13px] text-muted">
                  Tell {assistant} which part of <span className="text-ink">{context.title}</span> you didn&rsquo;t get — it can see this note.
                </p>
              ) : (
                <div className="grid max-h-[22rem] gap-3 overflow-y-auto">
                  {turns.map((turn, index) =>
                    turn.role === "user" ? (
                      <p key={index} className="justify-self-end rounded-[10px] bg-ink/[0.06] px-3 py-1.5 text-[13.5px] text-ink">
                        {turn.content}
                      </p>
                    ) : (
                      <div key={index} className="text-[14px]">
                        {turn.content ? <NoteBody body={turn.content} className="!text-[14px]" /> : <p className="text-muted">Thinking…</p>}
                        {turn.content && !(busy && index === turns.length - 1) ? (
                          <button
                            type="button"
                            className="mt-1.5 text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
                            onClick={() => onInsert(turn.content)}
                          >
                            Add to my note
                          </button>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              )}
              <form className="mt-3 flex items-center gap-2" onSubmit={(event) => void ask(event)}>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={turns.length ? "Ask a follow-up…" : "e.g. Why does she leave at the end of chapter 5?"}
                  className="h-9 min-w-0 flex-1 border-0 border-b border-line bg-transparent text-[14px] outline-none placeholder:text-muted/70 focus:border-ink"
                />
                <button
                  type="submit"
                  disabled={busy || !question.trim()}
                  className="rounded-full bg-ink px-3.5 py-1 text-[12.5px] font-medium text-paper disabled:opacity-35"
                >
                  {busy ? "…" : "Ask"}
                </button>
              </form>
            </div>
          )}

          {error ? <p className="mt-2 text-[12.5px] text-accent">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
