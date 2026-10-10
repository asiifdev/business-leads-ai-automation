"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

/** Title and subtitle for server-rendered pages, translated on the client. Renders a fragment so the page's own layout is unchanged. */
export function PageHeading({ title, subtitle, small }: { title: MessageKey; subtitle: MessageKey; small?: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t(title)}</h1>
      <p className={small ? "text-muted-foreground text-sm" : "text-muted-foreground"}>{t(subtitle)}</p>
    </>
  );
}
