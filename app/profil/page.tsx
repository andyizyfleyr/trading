"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/AppShell";
import { BottomSheet, Btn } from "@/components/ui";
import { LogoutIcon, MinusIcon, PlusIcon, RefreshIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiDeposit, apiReset, apiWithdraw, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { vibrate } from "@/lib/vibrate";

const CALM_KEY = "tf_calme";

export default function ProfilPage() {
  const { user, setBalance, logout } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    try {
      setCalm(window.localStorage.getItem(CALM_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // La confirmation « Recommencer » s'annule au bout de 5 secondes :
  // sans cela, un second toucher accidentel, même bien plus tard,
  // remettrait le solde à 10 000 par surprise.
  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 5000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  const toggleCalm = () => {
    const next = !calm;
    setCalm(next);
    try {
      window.localStorage.setItem(CALM_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("calme", next);
  };

  const run = async (fn: () => Promise<{ user: { balance: number } }>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const { user: updated } = await fn();
      setBalance(updated.balance);
      vibrate(15);
      setSheet(null);
      setMessage({ kind: "ok", text: okText });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof ApiError ? err.message : "Opération impossible pour le moment.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace("/connexion");
  };

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <RequireAuth>
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
        <h1 className="text-lg font-extrabold lg:col-span-2">Profil</h1>

        {/* Identité + solde */}
        <div className="flex items-center gap-2.5 rounded-xl border border-ligne bg-carte p-2.5 lg:col-span-2">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.email}</p>
            <p className="text-xl font-extrabold tabular-nums">
              {user ? fmtMoney(user.balance) : "…"}
            </p>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={`anim-in rounded-xl px-3 py-1.5 text-center text-sm font-medium lg:col-span-2 ${
              message.kind === "ok" ? "bg-hausse/10 text-hausse" : "bg-baisse/10 text-baisse"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Ajouter / Retirer : ouvrent un panneau */}
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="card" onClick={() => setSheet("deposit")} className="flex min-h-[52px] items-center justify-center gap-1.5 text-base">
            <PlusIcon className="h-5 w-5 text-hausse" />
            Ajouter
          </Btn>
          <Btn variant="card" onClick={() => setSheet("withdraw")} className="flex min-h-[52px] items-center justify-center gap-1.5 text-base">
            <MinusIcon className="h-5 w-5 text-baisse" />
            Retirer
          </Btn>
        </div>

        {/* Recommencer */}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            setConfirmReset(false);
            run(() => apiReset(), "Solde remis à 10 000.");
          }}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors duration-200 disabled:opacity-50 ${
            confirmReset
              ? "border-baisse text-baisse"
              : "border-ligne bg-carte text-texte active:bg-ligne"
          }`}
        >
          <RefreshIcon className="h-4 w-4" />
          {confirmReset ? "Toucher encore pour confirmer" : "Recommencer à 10 000"}
        </button>

        {/* Préférences */}
        <button
          type="button"
          role="switch"
          aria-checked={calm}
          onClick={toggleCalm}
          className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-ligne bg-carte px-3 text-left"
        >
          <span className="text-sm font-medium">Réduire les animations</span>
          <span
            className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${
              calm ? "justify-end bg-hausse" : "justify-start bg-ligne"
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white" />
          </span>
        </button>

        {/* Déconnexion */}
        <Btn
          variant="ghost"
          onClick={handleLogout}
          className="flex min-h-[48px] items-center justify-center gap-2 border-baisse/50 text-sm text-baisse"
        >
          <LogoutIcon className="h-4 w-4" />
          Se déconnecter
        </Btn>
      </div>

      {/* Panneau : ajouter au solde (aucun paiement réel) */}
      <BottomSheet open={sheet === "deposit"} onClose={() => setSheet(null)} title="Ajouter au solde">
        <div className="flex flex-col gap-2 pb-2">
          {[1000, 5000, 10000].map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onClick={() => run(() => apiDeposit(v), `+${fmtMoney(v)} ajoutés.`)}
              className="flex items-center justify-center gap-1.5 tabular-nums"
            >
              <PlusIcon className="h-5 w-5 text-hausse" />
              {fmtMoney(v)}
            </Btn>
          ))}
          <p className="text-center text-xs text-doux">Fonds d&apos;entraînement. Aucun paiement réel, jamais.</p>
        </div>
      </BottomSheet>

      {/* Panneau : retirer du solde */}
      <BottomSheet open={sheet === "withdraw"} onClose={() => setSheet(null)} title="Retirer du solde">
        <div className="flex flex-col gap-2 pb-2">
          {[1000, 5000].map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onClick={() => run(() => apiWithdraw(v), `-${fmtMoney(v)} retirés.`)}
              className="flex items-center justify-center gap-1.5 tabular-nums"
            >
              <MinusIcon className="h-5 w-5 text-baisse" />
              {fmtMoney(v)}
            </Btn>
          ))}
          <p className="text-center text-xs text-doux">Pour te fixer une limite de jeu.</p>
        </div>
      </BottomSheet>
    </RequireAuth>
  );
}
