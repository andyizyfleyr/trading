"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/AppShell";
import { Btn, Card, HelpTip } from "@/components/ui";
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    try {
      setCalm(window.localStorage.getItem(CALM_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

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
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">Profil</h1>

        {/* Identité + solde */}
        <Card className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action text-2xl font-extrabold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{user?.email}</p>
            <p className="text-sm text-doux">Solde disponible</p>
            <p className="text-2xl font-extrabold tabular-nums">
              {user ? fmtMoney(user.balance) : "…"}
            </p>
          </div>
        </Card>

        {message && (
          <p
            role="status"
            className={`anim-in rounded-xl px-3 py-2 text-center text-base font-medium ${
              message.kind === "ok" ? "bg-hausse/10 text-hausse" : "bg-baisse/10 text-baisse"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Dépôt fictif : ajout par incrément */}
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-base font-bold">
            Ajouter au solde
            <HelpTip
              label="Ajouter au solde"
              text="Ajoute des fonds d'entraînement à ton solde. Aucun paiement réel : c'est juste pour continuer à jouer et apprendre."
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1000, 5000, 10000].map((v) => (
              <Btn
                key={v}
                variant="card"
                disabled={busy}
                onClick={() => run(() => apiDeposit(v), `+${fmtMoney(v)} ajoutés au solde.`)}
                className="flex items-center justify-center gap-1 tabular-nums"
              >
                <PlusIcon className="h-5 w-5 text-hausse" />
                {fmtMoney(v)}
              </Btn>
            ))}
          </div>
          <p className="text-sm text-doux">Aucun paiement réel, jamais.</p>
        </Card>

        {/* Retrait fictif : retrait par décrément */}
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-base font-bold">
            Retirer du solde
            <HelpTip
              label="Retirer du solde"
              text="Retire des fonds d'entraînement de ton solde, par exemple pour te fixer une limite de jeu."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1000, 5000].map((v) => (
              <Btn
                key={v}
                variant="card"
                disabled={busy}
                onClick={() => run(() => apiWithdraw(v), `-${fmtMoney(v)} retirés du solde.`)}
                className="flex items-center justify-center gap-1 tabular-nums"
              >
                <MinusIcon className="h-5 w-5 text-baisse" />
                {fmtMoney(v)}
              </Btn>
            ))}
          </div>
        </Card>

        {/* Recommencer */}
        <Card className="flex flex-col gap-2">
          <p className="text-base font-bold">Recommencer à zéro</p>
          <p className="text-base text-doux">Remet ton solde à 10 000.</p>
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              setConfirmReset(false);
              run(() => apiReset(), "Solde remis à 10 000.");
            }}
            className={`flex items-center justify-center gap-2 ${confirmReset ? "border-baisse text-baisse" : ""}`}
          >
            <RefreshIcon className="h-5 w-5" />
            {confirmReset ? "Touche encore pour confirmer" : "Remettre à 10 000"}
          </Btn>
        </Card>

        {/* Préférences */}
        <Card className="flex flex-col gap-3">
          <p className="text-base font-bold">Préférences</p>
          <button
            type="button"
            role="switch"
            aria-checked={calm}
            onClick={toggleCalm}
            className="flex min-h-[48px] items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-base font-medium">Réduire les animations</span>
              <span className="block text-sm text-doux">Pour un affichage plus calme</span>
            </span>
            <span
              className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${
                calm ? "justify-end bg-hausse" : "justify-start bg-ligne"
              }`}
            >
              <span className="h-6 w-6 rounded-full bg-white" />
            </span>
          </button>
        </Card>

        {/* Déconnexion */}
        <Btn
          variant="ghost"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 border-baisse/50 text-baisse"
        >
          <LogoutIcon className="h-5 w-5" />
          Se déconnecter
        </Btn>

        <p className="pb-2 text-center text-sm text-doux">TradeFacile v1.0 · Jeu éducatif</p>
      </div>
    </RequireAuth>
  );
}
