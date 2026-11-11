"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOnline } from "@/hooks/useOnline";
import { fmtMoney } from "@/lib/format";
import { BottomNav } from "./BottomNav";
import { WalletIcon, WifiOffIcon } from "./Icons";

const CHROMELESS = ["/connexion", "/inscription", "/bienvenue"];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!loading && !user) {
    router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-4" aria-label="Chargement...">
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
      <div className="mx-auto flex h-12 max-w-xl items-center justify-between gap-2 px-4">
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-action text-base font-extrabold text-white"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="alert"
      className="sticky top-12 z-30 flex items-center justify-center gap-2 bg-baisse/90 px-4 py-1.5 text-center text-sm font-semibold text-white"
    >
      <WifiOffIcon className="h-5 w-5" />
      Reconnexion… vos prédictions en cours sont gardées.
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = CHROMELESS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) {
    return <div className="min-h-dvh bg-fond text-texte">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-fond text-texte">
      <Header />
      <OfflineBanner />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-3">{children}</main>
      <BottomNav />
    </div>
  );
}
