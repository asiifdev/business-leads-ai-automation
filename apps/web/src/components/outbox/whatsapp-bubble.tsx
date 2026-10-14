import { WhatsappText, splitOptOut } from "@/lib/whatsapp-text";
import { AttachmentIcon, formatSize } from "./attachment-picker";
import { LinkPreviewCard, type LinkPreviewData } from "./link-preview-card";

/**
 * A message as it will look in WhatsApp: one bubble, the file or the link card on top, the text under it,
 * and the opt-out line the system adds as a small footnote.
 */
export function WhatsappBubble({ body, attachment, card, className }: { body: string; attachment?: { fileName: string; mimeType: string; sizeBytes: number } | null; card?: LinkPreviewData | null; className?: string }) {
  const { text, hint } = splitOptOut(body);
  return (
    <div className={`max-w-xl rounded-xl rounded-tl-sm bg-emerald-500/10 px-3.5 py-2.5 ${className ?? ""}`}>
      {attachment && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-background/60 px-2.5 py-2 text-xs">
          <AttachmentIcon mime={attachment.mimeType} />
          <span className="min-w-0 flex-1 truncate font-medium">{attachment.fileName}</span>
          <span className="shrink-0 text-muted-foreground">{formatSize(attachment.sizeBytes)}</span>
        </p>
      )}
      {!attachment && card && <LinkPreviewCard card={card} className="mb-2 mt-0 max-w-none" />}
      <WhatsappText text={text} className="space-y-1 text-[15px] leading-relaxed" />
      {hint && <p className="mt-2 border-t border-foreground/10 pt-1.5 text-[11px] italic text-muted-foreground">{hint}</p>}
    </div>
  );
}
