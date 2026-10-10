"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";

/** Heading text for the login and register pages (server components), translated on the client. */
export function AuthHeading({ kind }: { kind: "login" | "register" }) {
  const { t } = useI18n();
  return kind === "login" ? (
    <>
      <h1 className="text-2xl font-bold text-white">{t("auth.page.loginTitle")}</h1>
      <p className="text-slate-400 mt-1">{t("auth.page.loginSubtitle")}</p>
    </>
  ) : (
    <>
      <h1 className="text-2xl font-bold text-white">{t("auth.page.registerTitle")}</h1>
      <p className="text-slate-400 mt-1 text-sm">{t("auth.page.registerSubtitle")}</p>
    </>
  );
}

export function RegisterFooter() {
  const { t } = useI18n();
  return (
    <p className="text-center text-sm text-slate-500 mt-4">
      {t("auth.page.haveAccount")}{" "}
      <Link href="/login" className="text-primary hover:text-primary/80 font-medium">{t("auth.page.signIn")}</Link>
    </p>
  );
}

/** Logged-out visitors need the language switch too. */
export function AuthLanguageToggle() {
  return (
    <div className="absolute top-4 right-4 z-10 text-slate-300 [&_button[aria-pressed=false]]:text-slate-400">
      <LanguageToggle />
    </div>
  );
}
