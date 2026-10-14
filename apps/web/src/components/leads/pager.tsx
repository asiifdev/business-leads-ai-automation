"use client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const LEADS_PAGE_SIZE = 50;

/** Previous / next under a list that is cut into pages, so no list silently stops at its first page. */
export function Pager({ page, total, pageSize = LEADS_PAGE_SIZE, loading, onPage }: { page: number; total: number; pageSize?: number; loading?: boolean; onPage: (page: number) => void }) {
  const { t } = useI18n();
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-muted-foreground">{t("leads.list.page", { page, pages })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>{t("leads.list.prev")}</Button>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>{t("leads.list.next")}</Button>
      </div>
    </div>
  );
}
