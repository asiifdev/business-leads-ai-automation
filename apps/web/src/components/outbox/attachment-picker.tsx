"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface Attachment { id: string; fileName: string; mimeType: string; sizeBytes: number }

export const formatSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function AttachmentIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (mime.startsWith("video/")) return <Video className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

/** Pick one of the uploaded files, upload a new one, or take it off. The file goes out with the message text as its caption. */
export function AttachmentPicker({ value, onChange, disabled }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => { api.get<Attachment[]>("/messaging/attachments").then(setFiles).catch(() => undefined); }, []);
  useEffect(load, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const saved = await api.upload<Attachment>("/messaging/attachments", form);
      setFiles((f) => [saved, ...f]);
      onChange(saved.id);
      toast.success(t("wa.attach.uploaded"));
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); if (input.current) input.current.value = ""; }
  };

  const remove = async () => {
    if (!value) return;
    try { await api.delete(`/messaging/attachments/${value}`); setFiles((f) => f.filter((x) => x.id !== value)); onChange(null); } catch (e) { toast.error((e as Error).message); }
  };

  const chosen = files.find((f) => f.id === value);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />{t("wa.attach.title")}</span>
        <select aria-label={t("wa.attach.title")} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-8 max-w-[16rem] rounded-md border bg-background px-2 text-xs">
          <option value="">{t("wa.attach.none")}</option>
          {files.map((f) => <option key={f.id} value={f.id}>{f.fileName} ({formatSize(f.sizeBytes)})</option>)}
        </select>
        <input ref={input} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.docx,.xlsx,.pptx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <Button type="button" size="sm" variant="outline" disabled={disabled || uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1.5 h-3.5 w-3.5" />}{uploading ? t("wa.attach.uploading") : t("wa.attach.upload")}
        </Button>
        {chosen && (
          <>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(null)} aria-label={t("wa.attach.remove")}><X className="h-3.5 w-3.5" /></Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={remove} aria-label={t("wa.attach.delete")} title={t("wa.attach.delete")}><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("wa.attach.hint")}</p>
    </div>
  );
}
