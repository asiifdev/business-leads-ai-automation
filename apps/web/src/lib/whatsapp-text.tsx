import type { ReactNode } from "react";

/**
 * WhatsApp formatting shown the way WhatsApp shows it: *bold*, _italic_, ~strike~, `mono`, "- " lists, "> " quotes, links.
 * Built from React nodes (never HTML strings), so nothing in a message can inject markup.
 */
const INLINE = /(\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_|~[^\s~](?:[^~\n]*[^\s~])?~|`[^`\n]+`|https?:\/\/[^\s<>"')\]]+)/g;

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    const body = part.slice(1, -1);
    if (/^https?:\/\//.test(part)) return <a key={key} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-500 underline break-all">{part}</a>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <strong key={key}>{inline(body, key)}</strong>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={key}>{inline(body, key)}</em>;
    if (part.startsWith("~") && part.endsWith("~") && part.length > 2) return <s key={key}>{inline(body, key)}</s>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key} className="rounded bg-muted px-1 font-mono text-[0.9em]">{body}</code>;
    return part;
  });
}

export function WhatsappText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const { ordered, items } = list;
    const at = blocks.length;
    // marker in its own column and the text beside it, so wrapped lines hang under the text, not under the marker
    blocks.push(
      <div key={`l${at}`} className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums" aria-hidden>{ordered ? `${i + 1}.` : "•"}</span>
            <span className="min-w-0 flex-1">{inline(it, `li${at}-${i}`)}</span>
          </div>
        ))}
      </div>,
    );
    list = null;
  };
  lines.forEach((line, i) => {
    const bullet = line.match(/^- (.*)$/);
    const numbered = line.match(/^\d{1,2}\. (.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      return;
    }
    flush();
    const quote = line.match(/^> ?(.*)$/);
    if (quote) blocks.push(<blockquote key={`q${i}`} className="border-l-2 pl-2 text-muted-foreground">{inline(quote[1], `q${i}`)}</blockquote>);
    else if (line.trim() === "") blocks.push(<div key={`b${i}`} className="h-2" />);
    else blocks.push(<p key={`p${i}`}>{inline(line, `p${i}`)}</p>);
  });
  flush();
  return <div className={className}>{blocks}</div>;
}

const OPT_OUT = /\n*\s*(Kalau tidak berkenan, balas STOP\.|If you'd rather not hear from me, reply STOP\.)\s*$/;

/** Splits off the opt-out line the system adds, so it can be shown as a footnote and not as part of the message. */
export function splitOptOut(body: string): { text: string; hint: string | null } {
  const m = body.match(OPT_OUT);
  return m ? { text: body.slice(0, m.index).trimEnd(), hint: m[1] } : { text: body, hint: null };
}
