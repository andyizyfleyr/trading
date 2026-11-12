"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiSettle } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { WalletIcon } from "./Icons";

const CHROMELESS = ["/connexion", "/inscription", "/bienvenue"];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!loading && !user) {
    router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    return (
      <div className="mx-auto flex max-w-xl flex-col lg:max-w-3xl gap-3 p-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col lg:max-w-3xl gap-3 p-4" aria-label="Chargement...">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  return <>{children}</>;
}

function Header() {
  const { user } = useAuth();
  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-ligne bg-fond/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-xl items-center justify-between gap-2 px-4 lg:max-w-6xl lg:px-6">
        <Link href="/" className="flex items-center gap-1.5" aria-label="Accueil Trader">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-carte text-sm font-extrabold">
            <span className="text-hausse">▲</span>
            <span className="text-baisse">▼</span>
          </span>
          <span className="text-base font-extrabold tracking-tight">TradeFacile</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/profil"
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-ligne bg-carte px-2.5 text-sm font-bold tabular-nums"
            aria-label={`Mon solde : ${user ? fmtMoney(user.balance) : "..."}. Aller au profil.`}
          >
            <WalletIcon className="h-4 w-4 text-action" />
            {user ? fmtMoney(user.balance) : "…"}
          </Link>
          <Link
            href="/profil"
            aria-label="Mon profil"
            className="hidden h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white lg:flex"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Garde le solde affiché toujours juste, sur toutes les pages :
 * clôture ce qui est arrivé à échéance puis met à jour le solde,
 * à chaque navigation, au retour sur l'app, et toutes les 30 secondes.
 * Sans cela, les pages qui ne clôturent pas (Historique, Profil)
 * afficheraient un solde périmé dès qu'une prédiction se termine ailleurs.
 */
function BalanceSync() {
  const { user, setBalance } = useAuth();
  const pathname = usePathname();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let running = false;

    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const res = await apiSettle();
        if (!stopped) setBalance(res.balance);
      } catch {
        /* hors ligne ou erreur : on garde le dernier solde connu */
      } finally {
        running = false;
      }
    };

    sync();
    const timer = setInterval(sync, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, [userId, pathname, setBalance]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = CHROMELESS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) {
    return <div className="min-h-dvh bg-fond text-texte">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-fond text-texte lg:pl-[280px]">
      <BalanceSync />
      <Sidebar />
      <Header />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-3 lg:max-w-6xl lg:px-6 lg:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
