"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import type { BriefContent } from "./types";

type Edit = { content: BriefContent; onChange: (c: BriefContent) => void } | undefined;

/** Clone, change, hand back: the page owns the state. */
const update = (edit: NonNullable<Edit>, fn: (c: BriefContent) => void) => {
  const next = structuredClone(edit.content);
  fn(next);
  edit.onChange(next);
};

function Field({ label, value, edit, onValue }: { label: MessageKey; value: string | string[]; edit?: boolean; onValue?: (v: string | string[]) => void }) {
  const { t } = useI18n();
  const list = Array.isArray(value) ? value : null;
  const empty = list ? list.length === 0 : !value;
  if (edit && onValue) {
    return (
      <div className="min-w-0 space-y-1">
        <label className="text-xs text-muted-foreground">{t(label)}{list && <span className="ml-1">({t("mkt.brief.onePerLine")})</span>}
          <Textarea className="mt-1 resize-y text-sm" rows={list ? Math.max(2, list.length + 1) : 2} value={list ? list.join("\n") : value}
            onChange={(e) => onValue(list ? e.target.value.split("\n") : e.target.value)} />
        </label>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{t(label)}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed">
        {empty ? <span className="text-muted-foreground">{t("mkt.brief.notFound")}</span>
          : list ? <ul className="list-disc space-y-0.5 pl-4">{list.map((v) => <li key={v}>{v}</li>)}</ul>
          : <p className="whitespace-pre-wrap">{value}</p>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: MessageKey; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold">{t(title)}</h3>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** The structured brief. Read-only by default; with `edit` every part becomes a field (lists: one item per line). */
export function BriefSections({ content, edit }: { content: BriefContent; edit?: Edit }) {
  const { t } = useI18n();
  const c = edit ? edit.content : content;
  const on = !!edit;
  const lines = (v: string | string[]) => (Array.isArray(v) ? v.map((x) => x.trimEnd()) : v);
  // helper to wire a field to a path
  const f = <K extends keyof BriefContent>(section: K, key: string) => (v: string | string[]) =>
    update(edit!, (n) => { ((n[section] as unknown) as Record<string, unknown>)[key] = lines(v); });

  return (
    <div className="space-y-4">
      {c.gaps.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/10 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold">{t("mkt.sec.gaps")}</h3>
          <ul className="space-y-1 text-sm">
            {c.gaps.map((g, i) => (
              <li key={`${i}-${g}`} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" aria-hidden />
                <span className="flex-1">{g.replace(/^\[NEED:\s*/i, "").replace(/\]$/, "")}</span>
                {on && (
                  <button type="button" onClick={() => update(edit!, (n) => { n.gaps.splice(i, 1); })} aria-label={t("mkt.brief.removeGap")}
                    className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Section title="mkt.sec.overview">
        <Field label="mkt.f.oneLiner" value={c.overview.oneLiner} edit={on} onValue={f("overview", "oneLiner")} />
        <Field label="mkt.f.category" value={c.overview.category} edit={on} onValue={f("overview", "category")} />
        <Field label="mkt.f.whatItDoes" value={c.overview.whatItDoes} edit={on} onValue={f("overview", "whatItDoes")} />
        <Field label="mkt.f.businessModel" value={c.overview.businessModel} edit={on} onValue={f("overview", "businessModel")} />
      </Section>
      <Section title="mkt.sec.audience">
        <Field label="mkt.f.targetCustomers" value={c.audience.targetCustomers} edit={on} onValue={f("audience", "targetCustomers")} />
        <Field label="mkt.f.decisionMakers" value={c.audience.decisionMakers} edit={on} onValue={f("audience", "decisionMakers")} />
        <Field label="mkt.f.primaryUseCase" value={c.audience.primaryUseCase} edit={on} onValue={f("audience", "primaryUseCase")} />
        <Field label="mkt.f.jobsToBeDone" value={c.audience.jobsToBeDone} edit={on} onValue={f("audience", "jobsToBeDone")} />
      </Section>
      <Section title="mkt.sec.problems">
        <Field label="mkt.f.coreProblem" value={c.problems.coreProblem} edit={on} onValue={f("problems", "coreProblem")} />
        <Field label="mkt.f.cost" value={c.problems.cost} edit={on} onValue={f("problems", "cost")} />
        <Field label="mkt.f.whyAlternativesFallShort" value={c.problems.whyAlternativesFallShort} edit={on} onValue={f("problems", "whyAlternativesFallShort")} />
      </Section>
      <Section title="mkt.sec.differentiation">
        <Field label="mkt.f.keyDifferentiators" value={c.differentiation.keyDifferentiators} edit={on} onValue={f("differentiation", "keyDifferentiators")} />
        <Field label="mkt.f.whyBetter" value={c.differentiation.whyBetter} edit={on} onValue={f("differentiation", "whyBetter")} />
      </Section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-semibold">{t("mkt.sec.angles")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("mkt.brief.angleNote")}</p>
        {c.angles.length === 0 ? <p className="text-sm text-muted-foreground">{t("mkt.brief.notFound")}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {c.angles.map((a, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                {on ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={a.segment} aria-label={t("mkt.f.segment")} onChange={(e) => update(edit!, (n) => { n.angles[i].segment = e.target.value; })} />
                      <button type="button" onClick={() => update(edit!, (n) => { n.angles.splice(i, 1); })} aria-label={t("mkt.brief.removeGap")} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {(["pain", "hook", "benefit"] as const).map((k) => (
                      <label key={k} className="block text-xs text-muted-foreground">{t(`mkt.f.${k}` as MessageKey)}
                        <Textarea className="mt-1 resize-y text-sm" rows={2} value={a[k]} onChange={(e) => update(edit!, (n) => { n.angles[i][k] = e.target.value; })} />
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{a.segment}</div>
                    <dl className="mt-2 space-y-1.5">
                      <div><dt className="text-xs text-muted-foreground">{t("mkt.f.pain")}</dt><dd>{a.pain}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t("mkt.f.hook")}</dt><dd>{a.hook}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t("mkt.f.benefit")}</dt><dd>{a.benefit}</dd></div>
                    </dl>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">{t("mkt.sec.objections")}</h3>
        {c.objections.length === 0 ? <p className="text-sm text-muted-foreground">{t("mkt.brief.notFound")}</p> : (
          <ul className="space-y-3">{c.objections.map((o, i) => (
            <li key={i} className="text-sm">
              {on ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input value={o.objection} onChange={(e) => update(edit!, (n) => { n.objections[i].objection = e.target.value; })} />
                    <button type="button" onClick={() => update(edit!, (n) => { n.objections.splice(i, 1); })} aria-label={t("mkt.brief.removeGap")} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <Textarea className="resize-y text-sm" rows={2} value={o.response} onChange={(e) => update(edit!, (n) => { n.objections[i].response = e.target.value; })} />
                </div>
              ) : (<><div className="font-medium">{o.objection}</div><p className="text-muted-foreground">{o.response}</p></>)}
            </li>
          ))}</ul>
        )}
      </section>

      <Section title="mkt.sec.proof">
        <Field label="mkt.f.metrics" value={c.proof.metrics} edit={on} onValue={f("proof", "metrics")} />
        <Field label="mkt.f.customers" value={c.proof.customers} edit={on} onValue={f("proof", "customers")} />
        <Field label="mkt.f.testimonials" value={c.proof.testimonials} edit={on} onValue={f("proof", "testimonials")} />
      </Section>
      <Section title="mkt.sec.offer">
        <Field label="mkt.f.pricing" value={c.offer.pricing} edit={on} onValue={f("offer", "pricing")} />
        <Field label="mkt.f.callToAction" value={c.offer.callToAction} edit={on} onValue={f("offer", "callToAction")} />
      </Section>
      <Section title="mkt.sec.voice">
        <Field label="mkt.f.tone" value={c.voice.tone} edit={on} onValue={f("voice", "tone")} />
        <Field label="mkt.f.wordsToUse" value={c.voice.wordsToUse} edit={on} onValue={f("voice", "wordsToUse")} />
        <Field label="mkt.f.wordsToAvoid" value={c.voice.wordsToAvoid} edit={on} onValue={f("voice", "wordsToAvoid")} />
      </Section>
    </div>
  );
}
