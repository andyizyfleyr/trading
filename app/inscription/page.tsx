"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { PASSWORD_MIN, ROUTES } from "@/lib/config";
import { AUTH, FORM, TRADER } from "@/lib/design";
import { fmtMoney } from "@/lib/format";
import { RULES } from "@/lib/symbols";
import { Btn, Field } from "@/components/ui";

export default function InscriptionPage() {
  const { register } = useAuth();
  const router = useRouter();

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
      setError(err instanceof ApiError ? err.message : "Inscription impossible.");
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

      <h1 className={AUTH.title}>Crée ton compte</h1>
      <p className={AUTH.sub}>
        {`Tu commences avec un solde de ${fmtMoney(RULES.START_BALANCE)} pour t'entraîner.`}
      </p>

      <form onSubmit={submit} className={AUTH.form}>
        <Field label="E-mail">
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
        <Field label={`Mot de passe (${PASSWORD_MIN} caractères minimum)`}>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choisis un mot de passe"
            className={FORM.input}
          />
        </Field>

        {error && (
          <p role="alert" className={TRADER.error}>
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? "Création…" : "Créer mon compte"}
        </Btn>
      </form>

      <p className={AUTH.foot}>
        Déjà un compte ?{" "}
        <Link href={ROUTES.login} className={AUTH.link}>
          Se connecter
        </Link>
      </p>
    </div>
  );
}
