"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/AppShell";
import { BottomSheet, Btn } from "@/components/ui";
import { LogoutIcon, MinusIcon, PlusIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiDeposit, apiSetCurrency, apiWithdraw, ApiError } from "@/lib/api";
import { DEPOSIT_OPTIONS, ROUTES, STORE, VIBRATE, WITHDRAW_OPTIONS } from "@/lib/config";
import { ICON, PROFILE, SHEET, SIDE } from "@/lib/design";
import { useMoney } from "@/hooks/useMoney";
import { COUNTRIES, CURRENCIES, isCurrency } from "@/lib/money";
import { vibrate } from "@/lib/vibrate";

export default function ProfilPage() {
  const { money } = useMoney();
  const { user, setBalance, logout, refresh } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    try {
      setCalm(window.localStorage.getItem(STORE.calm) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCalm = () => {
    const next = !calm;
    setCalm(next);
    try {
      window.localStorage.setItem(STORE.calm, next ? "1" : "0");
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
      vibrate(VIBRATE.tap);
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
    router.replace(ROUTES.login);
  };

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <RequireAuth>
      <div className={PROFILE.root}>
        <h1 className={PROFILE.title}>Profil</h1>

        {/* Identité + solde */}
        <div className={PROFILE.idCard}>
          <span className={PROFILE.avatar}>
            {initial}
          </span>
          <div className={SIDE.acctMain}>
            <p className={PROFILE.mail}>{user?.email}</p>
            <p className={PROFILE.balance}>
              {user ? money(user.balance) : "…"}
            </p>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={message.kind === "ok" ? PROFILE.msgOk : PROFILE.msgErr}
          >
            {message.text}
          </p>
        )}

        {/* Ajouter / Retirer : ouvrent un panneau */}
        <div className={PROFILE.addRow}>
          <Btn variant="card" onClick={() => setSheet("deposit")} className={PROFILE.bigBtn}>
            <PlusIcon className={ICON.lg} />
            Ajouter
          </Btn>
          <Btn variant="card" onClick={() => setSheet("withdraw")} className={PROFILE.bigBtn}>
            <MinusIcon className={ICON.lg} />
            Retirer
          </Btn>
        </div>

        {/* Devise & pays : seul l'affichage change (tout est stocké en USD) */}
        <div className={PROFILE.curBox}>
          <label className={PROFILE.curLabel}>
            Pays
            <select
              value={user?.country ?? ""}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) {
                  run(
                    async () => {
                      const { user: updated } = await apiSetCurrency({ country: e.target.value });
                      await refresh();
                      return { user: updated };
                    },
                    "Pays et devise mis à jour."
                  );
                }
              }}
              aria-label="Pays"
              className={PROFILE.curSelect}
            >
              <option value="" disabled>
                Choisir…
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={PROFILE.curLabel}>
            Devise
            <select
              value={user && isCurrency(user.currency) ? user.currency : "USD"}
              disabled={busy}
              onChange={(e) =>
                run(
                  async () => {
                    const { user: updated } = await apiSetCurrency({ currency: e.target.value });
                    await refresh();
                    return { user: updated };
                  },
                  "Devise mise à jour."
                )
              }
              aria-label="Devise d'affichage"
              className={PROFILE.curSelect}
            >
              {(Object.keys(CURRENCIES) as (keyof typeof CURRENCIES)[]).map((code) => (
                <option key={code} value={code}>
                  {code} ({CURRENCIES[code].symbol}) · {CURRENCIES[code].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={PROFILE.sheetNote}>Solde, mises et gains s&apos;affichent dans cette devise.</p>

        {/* Préférences */}
        <button
          type="button"
          role="switch"
          aria-checked={calm}
          onClick={toggleCalm}
          className={PROFILE.prefRow}
        >
          <span className={PROFILE.prefLabel}>Réduire les animations</span>
          <span
            className={calm ? PROFILE.calmOn : PROFILE.calmOff}
          >
            <span className={PROFILE.calmKnob} />
          </span>
        </button>

        {/* Déconnexion */}
        <Btn
          variant="ghost"
          onClick={handleLogout}
          className={PROFILE.logout}
        >
          <LogoutIcon className={ICON.md} />
          Se déconnecter
        </Btn>
      </div>

      {/* Panneau : ajouter au solde (aucun paiement réel) */}
      <BottomSheet open={sheet === "deposit"} onClose={() => setSheet(null)} title="Ajouter au solde">
        <div className={SHEET.list2}>
          {DEPOSIT_OPTIONS.map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onClick={() => run(() => apiDeposit(v), `+${money(v)} ajoutés.`)}
              className={PROFILE.optBtn}
            >
              <PlusIcon className={ICON.lg} />
              {money(v)}
            </Btn>
          ))}
          <p className={PROFILE.sheetNote}>Fonds d&apos;entraînement. Aucun paiement réel, jamais.</p>
        </div>
      </BottomSheet>

      {/* Panneau : retirer du solde */}
      <BottomSheet open={sheet === "withdraw"} onClose={() => setSheet(null)} title="Retirer du solde">
        <div className={SHEET.list2}>
          {WITHDRAW_OPTIONS.map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onClick={() => run(() => apiWithdraw(v), `-${money(v)} retirés.`)}
              className={PROFILE.optBtn}
            >
              <MinusIcon className={ICON.lg} />
              {money(v)}
            </Btn>
          ))}
          <p className={PROFILE.sheetNote}>Pour te fixer une limite de jeu.</p>
        </div>
      </BottomSheet>
    </RequireAuth>
  );
}
