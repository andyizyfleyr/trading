"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { NEXT_PARAM, ROUTES } from "@/lib/config";
import { AUTH, FORM, TRADER } from "@/lib/design";
import { Btn, Field } from "@/components/ui";
import { LangSelect } from "@/components/LangSelect";
import { useLang } from "@/lib/lang-context";

function ConnexionForm() {
  const { login, user, loading, sessionExpired } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get(NEXT_PARAM) || ROUTES.trader;
  // Session expirée (30 jours) : on le dit au lieu d'expulser en silence.
  const expired = sessionExpired || searchParams.get("expired") === "1";

  // Déjà connecté (session revalidée après une coupure) : on repart.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Connexion impossible."));
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

      <h1 className={AUTH.title}>{t("Bon retour !")}</h1>
      <p className={AUTH.sub}>
        {expired
          ? t("Ta session a expiré après 30 jours : reconnecte-toi pour continuer.")
          : t("Connecte-toi pour continuer à jouer.")}
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
        <Field label={t("Mot de passe")}>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Ton mot de passe")}
            className={FORM.input}
          />
        </Field>

        {error && (
          <p role="alert" className={TRADER.error}>
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? t("Connexion…") : t("Se connecter")}
        </Btn>
      </form>

      <p className={AUTH.foot}>
        {t("Pas encore de compte ?")}{" "}
        <Link href={ROUTES.signup} className={AUTH.link}>
          {t("Créer un compte")}
        </Link>
      </p>
      <p className={AUTH.foot}>
        <Link href={ROUTES.welcome} className={AUTH.link}>
          {t("Découvrir l'app en 3 écrans")}
        </Link>
      </p>
      <div className={AUTH.langRow}>
        <LangSelect className={AUTH.langSelect} />
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionForm />
    </Suspense>
  );
}
