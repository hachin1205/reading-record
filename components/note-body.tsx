import { cn } from "@/lib/utils";

/** Guess the writing language so CJK text gets a matching font (Chinese vs Japanese glyphs). */
export function textLang(text: string) {
  const han = text.match(/[一-鿿]/g)?.length ?? 0;
  // kana, ignoring "・" and "ー" which also turn up in Chinese text
  const kana = text.match(/[぀-ゟ゠-ヺヽ-ヿ]/g)?.length ?? 0;
  if (!han && !kana) return undefined;
  // Mostly-Chinese notes that quote a few Japanese terms should still read as Chinese.
  return kana >= Math.max(2, (han + kana) * 0.08) ? "ja" : "zh";
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "paragraph"; text: string };

const HEADING = /^(#{1,4}\s+|[一二三四五六七八九十]+、|第[一二三四五六七八九十\d]+[章节部分])/;

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*•・]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)、．]\s*(.*)$/);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const text = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(text);
      else blocks.push({ kind: "list", ordered, items: [text] });
      continue;
    }
    if (HEADING.test(line) && line.length <= 40) {
      flush();
      blocks.push({ kind: "heading", text: line.replace(/^#{1,4}\s+/, "") });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      blocks.push({ kind: "quote", text: line.replace(/^>\s?/, "") });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Comfortable reading layout for a note: real paragraphs, headings and lists at a calm size. */
export function NoteBody({ body, className }: { body: string; className?: string }) {
  const lang = textLang(body);
  return (
    <div lang={lang} className={cn("note-body", lang && "note-body-cjk", className)}>
      {parse(body).map((block, index) => {
        if (block.kind === "heading") return <h5 key={index}>{block.text}</h5>;
        if (block.kind === "quote") return <blockquote key={index}>{block.text}</blockquote>;
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
