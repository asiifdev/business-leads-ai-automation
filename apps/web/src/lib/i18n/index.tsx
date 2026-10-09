"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { en, type MessageKey } from "./en";
import { id } from "./id";
import { LANG_COOKIE, type Lang } from "./lang";

export type { Lang };

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, id };

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

/** Initial language comes from the cookie on the server, so first paint already matches (no flash). */
export function I18nProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
    } catch { /* cookies blocked: the choice only lasts for this session */ }
  }, []);

  const t = useCallback<I18n["t"]>(
    (key, vars) => {
      let s = dictionaries[lang][key] ?? en[key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
