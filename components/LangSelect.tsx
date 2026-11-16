"use client";

import { useLang } from "@/lib/lang-context";
import { LANGS, isLang } from "@/lib/i18n";

/** Sélecteur de langue (profil + pages publiques). */
export function LangSelect({ className }: { className: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <select
      value={lang}
      onChange={(e) => {
        if (isLang(e.target.value)) setLang(e.target.value);
      }}
      aria-label={t("Langue")}
      className={className}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
