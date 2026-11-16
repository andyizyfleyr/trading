"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOnline } from "@/hooks/useOnline";
import { apiSettle } from "@/lib/api";
import { useMoney } from "@/hooks/useMoney";
import { CLOCK_SYNC_MS, NEXT_PARAM, ROUTES } from "@/lib/config";
import { HEADER, SHELL } from "@/lib/design";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { WalletIcon } from "./Icons";

const CHROMELESS = [ROUTES.login, ROUTES.signup, ROUTES.welcome];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirection dans un effet : en plein rendu, React se plaint
  // (« Cannot update a component while rendering ») et peut boucler.
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`${ROUTES.login}?${NEXT_PARAM}=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (!loading && !user) {
    return (
      <div className={SHELL.loadBox}>
        <div className={SHELL.loadBig} />
        <div className={SHELL.loadSmall} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SHELL.loadBox} aria-label={t("Chargement...")}>
        <div className={SHELL.loadBig} />
        <div className={SHELL.loadSmall} />
        <div className={SHELL.loadSmall} />
      </div>
    );
  }

  return <>{children}</>;
}

function Header() {
  const { t } = useLang();
  const { money } = useMoney();
  const { user } = useAuth();
  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <header className={HEADER.bar}>
      <div className={HEADER.wrap}>
        <Link href={ROUTES.trader} className={HEADER.logo} aria-label={t("Accueil Trader")}>
          <span className={HEADER.mark} aria-hidden="true">
            <span className={HEADER.markUp}>▲</span>
            <span className={HEADER.markDown}>▼</span>
          </span>
          <span className={HEADER.name}>TradeFacile</span>
        </Link>
        <div className={HEADER.side}>
          <Link
            href={ROUTES.profile}
            className={HEADER.pill}
            aria-label={t("Mon solde : {x}. Aller au profil.", {
              x: user ? money(user.balance, user.balanceExact) : "...",
            })}
          >
            <WalletIcon className={HEADER.pillIcon} />
            {user ? money(user.balance, user.balanceExact) : "…"}
          </Link>
          <Link
            href={ROUTES.profile}
            aria-label={t("Mon profil")}
            className={HEADER.avatar}
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
        if (!stopped) setBalance(res.balance, res.balanceExact);
      } catch {
        /* hors ligne ou erreur : on garde le dernier solde connu */
      } finally {
        running = false;
      }
    };

    sync();
    const timer = setInterval(sync, CLOCK_SYNC_MS);
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

/** Bandeau « Hors ligne » sur toutes les pages (sinon les boutons semblent morts). */
function OfflineBanner() {
  const { t } = useLang();
  const online = useOnline();
  if (online) return null;
  return (
    <p role="alert" className={SHELL.offline}>
      {t("Hors ligne : reconnecte-toi, tes actions sont en pause.")}
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = CHROMELESS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) {
    return (
      <div className={SHELL.bare}>
        <OfflineBanner />
        {children}
      </div>
    );
  }

  return (
    <div className={`${SHELL.root} ${SHELL.desktop}`}>
      <BalanceSync />
      <Sidebar />
      <Header />
      <OfflineBanner />
      <main className={SHELL.main}>{children}</main>
      <BottomNav />
    </div>
  );
}
