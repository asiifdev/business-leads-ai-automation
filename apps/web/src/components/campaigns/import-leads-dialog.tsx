"use client";
import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELDS = ["name", "phone", "email", "website", "address", "category", "city", "lat", "lng"] as const;
type Field = (typeof FIELDS)[number];
type Mapping = Record<Field, number | null>;

interface Report { rows: number; leads: number; noName: number; merged: number; badPhone: number; badEmail: number; badWebsite: number; noContact: number }
interface Preview { format: "csv" | "xlsx"; columns: string[]; mapping: Mapping; sample: string[][]; rows: number; report: Report | null }

const NONE = "none";

/** Choose a CSV or .xlsx file, check which column is which, then add its businesses to the campaign. */
export function ImportLeadsDialog({ campaignId, open, onOpenChange, onDone }: { campaignId: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setFile(null); setPreview(null); setMapping(null); setError(null); setBusy(false); if (input.current) input.current.value = ""; };
  const form = (f: File, m?: Mapping) => { const d = new FormData(); d.append("file", f); if (m) d.append("mapping", JSON.stringify(m)); return d; };

  const read = async (f: File, m?: Mapping) => {
    setBusy(true);
    setError(null);
    try {
      const p = await api.upload<Preview>(`/scraper/campaigns/${campaignId}/import/preview`, form(f, m));
      setPreview(p);
      setMapping((prev) => prev ?? p.mapping);
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (f: File | null) => {
    setFile(f);
    setMapping(null);
    setPreview(null);
    if (f) void read(f);
  };

  const pick = (field: Field, v: string) => setMapping((m) => ({ ...(m ?? preview!.mapping), [field]: v === NONE ? null : Number(v) }));

  const submit = async () => {
    if (!file || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.upload<{ report: Report }>(`/scraper/campaigns/${campaignId}/import`, form(file, mapping));
      toast.success(t("camp.import.queued", { n: r.report.leads }));
      onDone();
      onOpenChange(false);
      reset();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const r = preview?.report;
  const warnings = r ? [
    r.noName ? t("camp.import.noName", { n: r.noName }) : "",
    r.merged ? t("camp.import.merged", { n: r.merged }) : "",
    r.badPhone || r.badEmail || r.badWebsite ? t("camp.import.bad", { phone: r.badPhone, email: r.badEmail, web: r.badWebsite }) : "",
    r.noContact ? t("camp.import.noContact", { n: r.noContact }) : "",
  ].filter(Boolean) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("camp.import.title")}</DialogTitle>
          <DialogDescription>{t("camp.import.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input ref={input} type="file" accept=".csv,.txt,.xlsx,text/csv" className="sr-only" id="import-file" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
              <FileUp className="mr-2 h-4 w-4" />{t("camp.import.choose")}
            </Button>
            <span className="min-w-0 truncate text-sm text-muted-foreground">{file ? file.name : t("camp.import.formats")}</span>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {preview && mapping && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">{t("camp.import.columns")}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FIELDS.map((f) => (
                    <div key={f} className="space-y-1">
                      <Label className="text-xs">{t(`camp.import.field.${f}` as MessageKey)}{f === "name" ? " *" : ""}</Label>
                      <Select value={mapping[f] === null ? NONE : String(mapping[f])} onValueChange={(v) => pick(f, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t("camp.import.noColumn")}</SelectItem>
                          {preview.columns.map((c, i) => <SelectItem key={i} value={String(i)}>{c || `#${i + 1}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2 text-xs" onClick={() => file && void read(file, mapping)} disabled={busy}>
                  {t("camp.import.recheck")}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr>{preview.columns.map((c, i) => <th key={i} className="px-2 py-1.5 text-left font-medium">{c || `#${i + 1}`}</th>)}</tr></thead>
                  <tbody>{preview.sample.map((row, i) => <tr key={i} className="border-t">{preview.columns.map((_, j) => <td key={j} className="max-w-[160px] truncate px-2 py-1">{row[j] ?? ""}</td>)}</tr>)}</tbody>
                </table>
              </div>

              {r ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{t("camp.import.willAdd", { n: r.leads, rows: r.rows })}</p>
                  {warnings.map((w) => <p key={w} className="text-xs text-muted-foreground">{w}</p>)}
                </div>
              ) : (
                <p className="text-sm text-warning-foreground">{t("camp.import.needName")}</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("camp.form.cancel")}</Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !preview || !mapping || mapping.name === null || !r || r.leads === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("camp.import.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
