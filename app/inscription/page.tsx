"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { PASSWORD_MIN, ROUTES } from "@/lib/config";
import { AUTH, FORM, TRADER } from "@/lib/design";
import { Btn, Field } from "@/components/ui";
import { LangSelect } from "@/components/LangSelect";
import { useLang } from "@/lib/lang-context";

export default function InscriptionPage() {
  const { register, user, loading } = useAuth();
  const { t } = useLang();
  const router = useRouter();

  // Déjà connecté : pas besoin de recréer un compte.
  useEffect(() => {
    if (!loading && user) router.replace(ROUTES.trader);
  }, [loading, user, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), password);
      router.replace(ROUTES.trader);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Inscription impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={AUTH.shell}>
      <div className={AUTH.brandRow}>
        <span className={AUTH.brandMark}>
          <span className={AUTH.brandUp}>▲</span>
          <span className={AUTH.brandDown}>▼</span>
        </span>
        <span className={AUTH.brandName}>TradeFacile</span>
      </div>

      <h1 className={AUTH.title}>{t("Crée ton compte")}</h1>
      <p className={AUTH.sub}>
        {t("Crée ton compte, puis touche « Ajouter » dans ton profil pour recharger ton solde.")}
      </p>

      <form onSubmit={submit} className={AUTH.form}>
        <Field label={t("E-mail")}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            className={FORM.input}
          />
        </Field>
        <Field label={t("Mot de passe ({min} caractères minimum)", { min: PASSWORD_MIN })}>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Choisis un mot de passe")}
            className={FORM.input}
          />
        </Field>

        {error && (
          <p role="alert" className={TRADER.error}>
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? t("Création…") : t("Créer mon compte")}
        </Btn>
      </form>

      <p className={AUTH.foot}>
        {t("Déjà un compte ?")}{" "}
        <Link href={ROUTES.login} className={AUTH.link}>
          {t("Se connecter")}
        </Link>
      </p>
      <div className={AUTH.langRow}>
        <LangSelect className={AUTH.langSelect} />
      </div>
    </div>
  );
}
