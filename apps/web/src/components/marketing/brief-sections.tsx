"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import type { BriefContent } from "./types";

function Field({ label, value }: { label: MessageKey; value: string | string[] }) {
  const { t } = useI18n();
  const list = Array.isArray(value) ? value : null;
  const empty = list ? list.length === 0 : !value;
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

/** The structured brief, read-only. Missing parts say so instead of staying blank. */
export function BriefSections({ content }: { content: BriefContent }) {
  const { t } = useI18n();
  const c = content;
  return (
    <div className="space-y-4">
      {c.gaps.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/10 p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold">{t("mkt.sec.gaps")}</h3>
          <ul className="list-disc space-y-1 pl-4 text-sm">{c.gaps.map((g) => <li key={g}>{g.replace(/^\[NEED:\s*/i, "").replace(/\]$/, "")}</li>)}</ul>
        </section>
      )}
      <Section title="mkt.sec.overview">
        <Field label="mkt.f.oneLiner" value={c.overview.oneLiner} />
        <Field label="mkt.f.category" value={c.overview.category} />
        <Field label="mkt.f.whatItDoes" value={c.overview.whatItDoes} />
        <Field label="mkt.f.businessModel" value={c.overview.businessModel} />
      </Section>
      <Section title="mkt.sec.audience">
        <Field label="mkt.f.targetCustomers" value={c.audience.targetCustomers} />
        <Field label="mkt.f.decisionMakers" value={c.audience.decisionMakers} />
        <Field label="mkt.f.primaryUseCase" value={c.audience.primaryUseCase} />
        <Field label="mkt.f.jobsToBeDone" value={c.audience.jobsToBeDone} />
      </Section>
      <Section title="mkt.sec.problems">
        <Field label="mkt.f.coreProblem" value={c.problems.coreProblem} />
        <Field label="mkt.f.cost" value={c.problems.cost} />
        <Field label="mkt.f.whyAlternativesFallShort" value={c.problems.whyAlternativesFallShort} />
      </Section>
      <Section title="mkt.sec.differentiation">
        <Field label="mkt.f.keyDifferentiators" value={c.differentiation.keyDifferentiators} />
        <Field label="mkt.f.whyBetter" value={c.differentiation.whyBetter} />
      </Section>
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-semibold">{t("mkt.sec.angles")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("mkt.brief.angleNote")}</p>
        {c.angles.length === 0 ? <p className="text-sm text-muted-foreground">{t("mkt.brief.notFound")}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {c.angles.map((a) => (
              <li key={a.segment} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{a.segment}</div>
                <dl className="mt-2 space-y-1.5">
                  <div><dt className="text-xs text-muted-foreground">{t("mkt.f.pain")}</dt><dd>{a.pain}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t("mkt.f.hook")}</dt><dd>{a.hook}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t("mkt.f.benefit")}</dt><dd>{a.benefit}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">{t("mkt.sec.objections")}</h3>
        {c.objections.length === 0 ? <p className="text-sm text-muted-foreground">{t("mkt.brief.notFound")}</p> : (
          <ul className="space-y-3">{c.objections.map((o) => (
            <li key={o.objection} className="text-sm"><div className="font-medium">{o.objection}</div><p className="text-muted-foreground">{o.response}</p></li>
          ))}</ul>
        )}
      </section>
      <Section title="mkt.sec.proof">
        <Field label="mkt.f.metrics" value={c.proof.metrics} />
        <Field label="mkt.f.customers" value={c.proof.customers} />
        <Field label="mkt.f.testimonials" value={c.proof.testimonials} />
      </Section>
      <Section title="mkt.sec.offer">
        <Field label="mkt.f.pricing" value={c.offer.pricing} />
        <Field label="mkt.f.callToAction" value={c.offer.callToAction} />
      </Section>
      <Section title="mkt.sec.voice">
        <Field label="mkt.f.tone" value={c.voice.tone} />
        <Field label="mkt.f.wordsToUse" value={c.voice.wordsToUse} />
        <Field label="mkt.f.wordsToAvoid" value={c.voice.wordsToAvoid} />
      </Section>
    </div>
  );
}
