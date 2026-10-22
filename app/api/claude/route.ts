import { apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/server";

// Claude inside the note box: fix grammar, or talk through a part you didn't get.
// Needs ANTHROPIC_API_KEY in .env.local. Only works when signed in.

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TEXT = 12000;

type Turn = { role: "user" | "assistant"; content: string };
type Body = {
  mode: "grammar" | "ask";
  text?: string;
  question?: string;
  history?: Turn[];
  context?: { title?: string; creator?: string; kind?: string };
};

function model() {
  return process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
}

function describe(context: Body["context"]) {
  if (!context?.title) return "";
  return `${context.kind ? `${context.kind}: ` : ""}“${context.title}”${context.creator ? ` by ${context.creator}` : ""}`;
}

async function callClaude(body: Record<string, unknown>) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Claude isn't set up yet: add ANTHROPIC_API_KEY to .env.local and restart the site.");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: model(), ...body }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message = /credit balance/i.test(detail)
      ? "Your Anthropic API account has no credit yet — add some at console.anthropic.com (Settings → Billing), then try again."
      : response.status === 401
        ? "The Anthropic API key was rejected — check ANTHROPIC_API_KEY."
        : response.status === 429
          ? "Claude is busy or the API credit is used up — try again in a moment."
          : `Claude couldn't answer (${response.status}). ${detail.slice(0, 200)}`;
    throw new Error(message);
  }
  return response;
}

// ---- Gemini (free tier) — used instead of Claude whenever GEMINI_API_KEY is set ----
function geminiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function geminiUrl(method: "generateContent" | "streamGenerateContent") {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const sse = method === "streamGenerateContent" ? "alt=sse&" : "";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?${sse}key=${encodeURIComponent(process.env.GEMINI_API_KEY!.trim())}`;
}

function geminiBody(system: string, messages: Turn[], json = false) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
    ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });
}

/** Gemini's free tier is often briefly overloaded (503/429): wait a moment and try again, up to 3 times. */
async function geminiFetch(url: string, body: string) {
  let response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  for (let attempt = 1; attempt <= 3 && (response.status === 503 || response.status === 429); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  }
  return response;
}

async function geminiError(response: Response) {
  const detail = await response.text().catch(() => "");
  if (response.status === 400 && /API key/i.test(detail)) return "The Gemini API key was rejected — check GEMINI_API_KEY.";
  if (response.status === 429) return "Gemini's free limit is used up for now — try again later.";
  if (response.status === 503) return "Gemini is busy right now (lots of people using it) — try again in a minute.";
  return `Gemini couldn't answer (${response.status}). ${detail.slice(0, 200)}`;
}

async function geminiText(system: string, messages: Turn[], json = false) {
  const response = await geminiFetch(geminiUrl("generateContent"), geminiBody(system, messages, json));
  if (!response.ok) throw new Error(await geminiError(response));
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function geminiStream(system: string, messages: Turn[]) {
  const response = await geminiFetch(geminiUrl("streamGenerateContent"), geminiBody(system, messages));
  if (!response.ok) throw new Error(await geminiError(response));
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = response.body!.getReader();
  let buffer = "";
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const chunk = event.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
          if (chunk) controller.enqueue(encoder.encode(chunk));
        } catch {
          // partial line
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

/** Which assistant the note box is using, for its label. */
export async function GET() {
  return Response.json({ data: { provider: geminiEnabled() ? "gemini" : "claude" } });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = (await request.json()) as Body;
    const text = String(input.text ?? "").slice(0, MAX_TEXT);
    const about = describe(input.context);

    if (input.mode === "grammar") {
      if (!text.trim()) throw new Error("Write something first.");
      const grammarSystem =
          "You are a careful copy editor for a personal reading journal. The writer writes in Chinese, Japanese and English, sometimes mixed. " +
          "Fix only grammar, spelling, particles, word choice that is clearly wrong, and punctuation. Keep the writer's voice, tone, language, line breaks and meaning. " +
          "Do not rewrite style, do not translate, do not add content. " +
          'Reply with JSON only: {"corrected": string, "changes": [{"before": string, "after": string, "why": string}]}. ' +
          "Keep each 'why' under 15 words, written in English. If nothing needs fixing, return the text unchanged and an empty changes list.";
      let raw = "";
      if (geminiEnabled()) {
        raw = await geminiText(grammarSystem, [{ role: "user", content: text }], true);
      } else {
        const response = await callClaude({ max_tokens: 4000, system: grammarSystem, messages: [{ role: "user", content: text }] });
        const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        raw = payload.content?.find((block) => block.type === "text")?.text ?? "";
      }
      const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      try {
        const parsed = JSON.parse(json) as { corrected?: string; changes?: unknown[] };
        return Response.json({ data: { corrected: parsed.corrected ?? text, changes: parsed.changes ?? [] } });
      } catch {
        throw new Error("The answer couldn't be read — try again.");
      }
    }

    // mode "ask": a short conversation about a part of the work the writer didn't get. Streams plain text back.
    const question = String(input.question ?? "").trim();
    if (!question) throw new Error("Ask a question first.");
    const history = (input.history ?? [])
      .filter((turn) => (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
      .slice(-10);
    const askSystem =
        "You help someone think through a book, film, anime or game they are in the middle of, inside their personal journal. " +
        (about ? `They are currently on ${about}. ` : "") +
        "They will ask about a part they didn't understand. Explain clearly and concretely: what happened, why it matters, references or context they might be missing. " +
        "Avoid spoilers beyond what they describe unless they ask for them; say so when you'd need to spoil. If you're not sure about a detail of the work, say so instead of guessing. " +
        "Answer in the language of their question. Keep it to a few short paragraphs.";
    const messages: Turn[] = [
      ...history,
      {
        role: "user",
        content: (text.trim() && history.length === 0 ? `My notes so far:\n${text}\n\n` : "") + question,
      },
    ];
    if (geminiEnabled()) return geminiStream(askSystem, messages);
    const response = await callClaude({ max_tokens: 1500, stream: true, system: askSystem, messages });

    // Turn Anthropic's event stream into plain text chunks.
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = response.body!.getReader();
    let buffer = "";
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: { type?: string; text?: string } };
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          } catch {
            // ignore keep-alives and partial lines
          }
        }
      },
      cancel() {
        void reader.cancel();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
