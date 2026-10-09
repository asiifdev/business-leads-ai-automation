"use client";

import { cn } from "@/lib/utils";
import { useI18n, type Lang } from "@/lib/i18n";

const options: { value: Lang; label: string; name: string }[] = [
  { value: "id", label: "ID", name: "Bahasa Indonesia" },
  { value: "en", label: "EN", name: "English" },
];

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("header.language")} className="flex items-center rounded-md border p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          title={o.name}
          className={cn(
            "rounded px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            lang === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
