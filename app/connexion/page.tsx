"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Btn, Field } from "@/components/ui";

function ConnexionForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-carte text-lg font-extrabold">
          <span className="text-hausse">▲</span>
          <span className="text-baisse">▼</span>
        </span>
        <span className="text-xl font-extrabold">TradeFacile</span>
      </div>

      <h1 className="text-2xl font-extrabold">Bon retour !</h1>
      <p className="mt-1 text-base text-doux">Connecte-toi pour continuer à jouer.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="E-mail">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            className="h-[52px] w-full rounded-xl border border-ligne bg-carte px-4 text-base outline-none placeholder:text-doux focus:border-action"
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
            className="h-[52px] w-full rounded-xl border border-ligne bg-carte px-4 text-base outline-none placeholder:text-doux focus:border-action"
          />
        </Field>

        {error && (
          <p role="alert" className="anim-in rounded-xl bg-baisse/10 px-3 py-2 text-center text-base font-medium text-baisse">
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Btn>
      </form>

      <p className="mt-6 text-center text-base text-doux">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-bold text-action underline">
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
