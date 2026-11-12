"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { NEXT_PARAM, ROUTES } from "@/lib/config";
import { AUTH, FORM, TRADER } from "@/lib/design";
import { Btn, Field } from "@/components/ui";

function ConnexionForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get(NEXT_PARAM) || ROUTES.trader;

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
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
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

      <h1 className={AUTH.title}>Bon retour !</h1>
      <p className={AUTH.sub}>Connecte-toi pour continuer à jouer.</p>

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
        <Field label="Mot de passe">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ton mot de passe"
            className={FORM.input}
          />
        </Field>

        {error && (
          <p role="alert" className={TRADER.error}>
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Btn>
      </form>

      <p className={AUTH.foot}>
        Pas encore de compte ?{" "}
        <Link href={ROUTES.signup} className={AUTH.link}>
          Créer un compte
        </Link>
      </p>
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
