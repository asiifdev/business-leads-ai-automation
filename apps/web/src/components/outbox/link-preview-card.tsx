"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface LinkPreviewData { url: string; title: string; description: string; thumbnail?: string }

export const firstUrl = (text: string): string | null => {
  const m = text.match(/https?:\/\/[^\s<>"')\]]{3,300}/i);
  return m ? m[0].replace(/[.,!?;:]+$/, "") : null;
};

/** The card as WhatsApp draws it under a message. */
export function LinkPreviewCard({ card, className }: { card: LinkPreviewData; className?: string }) {
  let host = card.url;
  try { host = new URL(card.url).host; } catch { /* keep the raw address */ }
  return (
    <div className={`mt-2 flex max-w-sm overflow-hidden rounded-lg border bg-background/60 ${className ?? ""}`}>
      {card.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`data:image/jpeg;base64,${card.thumbnail}`} alt="" className="h-20 w-20 shrink-0 object-cover" />}
      <div className="min-w-0 p-2 text-xs">
        <p className="line-clamp-2 font-medium text-foreground">{card.title}</p>
        {card.description && <p className="line-clamp-2 text-muted-foreground">{card.description}</p>}
        <p className="truncate text-muted-foreground/80">{host}</p>
      </div>
    </div>
  );
}

/** A switch for "show a card under the link", with the live card below it so the owner sees what will be sent. */
export function LinkPreviewControl({ body, enabled, onEnabled, disabledReason }: { body: string; enabled: boolean; onEnabled: (on: boolean) => void; disabledReason?: string }) {
  const { t } = useI18n();
  const url = firstUrl(body);
  const [card, setCard] = useState<LinkPreviewData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!enabled || !url || disabledReason) { setCard(null); setState("idle"); return; }
    let alive = true;
    setState("loading");
    const h = setTimeout(() => {
      api.post<LinkPreviewData>("/messaging/link-preview", { url })
        .then((c) => { if (alive) { setCard(c); setState("idle"); } })
        .catch((e: Error) => { if (alive) { setCard(null); setReason(e.message); setState("failed"); } });
    }, 500);
    return () => { alive = false; clearTimeout(h); };
  }, [enabled, url, disabledReason]);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={enabled} disabled={!!disabledReason} onChange={(e) => onEnabled(e.target.checked)} />
        {t("wa.preview.toggle")}
      </label>
      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
      {enabled && !url && !disabledReason && <p className="text-xs text-muted-foreground">{t("wa.preview.none")}</p>}
      {state === "loading" && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t("wa.preview.loading")}</p>}
      {state === "failed" && <p className="text-xs text-warning">{t("wa.preview.failed", { reason })}</p>}
      {card && <LinkPreviewCard card={card} />}
    </div>
  );
}
