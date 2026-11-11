"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { apiMyStats } from "@/lib/api";
import { fmtMoney, fmtSigned } from "@/lib/format";
import type { ApiStats } from "@/lib/types";
import {
  BookIcon,
  ChartIcon,
  HistoryIcon,
  LogoutIcon,
  SignalIcon,
  TrophyIcon,
  UserIcon,
} from "./Icons";

const ITEMS = [
  { href: "/", label: "Trader", Icon: ChartIcon },
  { href: "/historique", label: "Historique", Icon: HistoryIcon },
  { href: "/classement", label: "Classement", Icon: TrophyIcon },
  { href: "/cours", label: "Cours", Icon: BookIcon },
  { href: "/predictions", label: "Signaux", Icon: SignalIcon },
  { href: "/profil", label: "Profil", Icon: UserIcon },
];

/**
 * Barre latérale desktop (écrans larges uniquement) : navigation
 * + vraies données de l'utilisateur (compte en direct, stats serveur).
 */
export function Sidebar() {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<ApiStats | null>(null);

  const load = useCallback(async () => {
    try {
      const { stats: fresh } = await apiMyStats();
      setStats(fresh);
    } catch {
      /* on garde les dernières stats connues */
    }
  }, []);

  useEffect(() => {
    if (!isDesktop || !user) return;
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [isDesktop, user, pathname, load]);

  if (!isDesktop) return null;

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace("/connexion");
  };

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[280px] flex-col gap-4 overflow-y-auto border-r border-ligne bg-fond p-4 lg:flex">
      <Link href="/" className="flex items-center gap-2 px-1" aria-label="Accueil Trader">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-carte text-base font-extrabold">
          <span className="text-hausse">▲</span>
          <span className="text-baisse">▼</span>
        </span>
        <span className="text-lg font-extrabold tracking-tight">TradeFacile</span>
      </Link>

      <nav aria-label="Navigation principale" className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-base font-bold transition-colors duration-200 ${
                active ? "bg-carte text-white" : "text-doux hover:bg-carte hover:text-texte"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mon compte : données en direct */}
      <div className="rounded-2xl border border-ligne bg-carte p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-doux">Mon compte</p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.email ?? "…"}</p>
            <p className="text-lg font-extrabold tabular-nums">
              {user ? fmtMoney(user.balance) : "…"}
            </p>
          </div>
        </div>
      </div>

      {/* Mes stats : vraies données du serveur */}
      <div className="rounded-2xl border border-ligne bg-carte p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-doux">Mes stats</p>
        {stats ? (
          <div className="mt-2 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-fond p-2">
                <p className="text-lg font-extrabold tabular-nums">#{stats.rank}</p>
                <p className="text-xs leading-tight text-doux">sur {stats.total}</p>
              </div>
              <div className="rounded-xl bg-fond p-2">
                <p className="text-lg font-extrabold tabular-nums">{stats.winRate} %</p>
                <p className="text-xs leading-tight text-doux">réussite</p>
              </div>
              <div className="rounded-xl bg-fond p-2">
                <p className="text-lg font-extrabold tabular-nums text-hausse">
                  ▲ {stats.wins}
                </p>
                <p className="text-xs leading-tight text-doux">victoires</p>
              </div>
              <div className="rounded-xl bg-fond p-2">
                <p className="text-lg font-extrabold tabular-nums text-baisse">
                  ▼ {stats.losses}
                </p>
                <p className="text-xs leading-tight text-doux">défaites</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-fond px-2.5 py-2">
              <p className="text-xs font-bold text-doux">Gains nets</p>
              <p
                className={`text-base font-extrabold tabular-nums ${
                  stats.pnl > 0 ? "text-hausse" : stats.pnl < 0 ? "text-baisse" : ""
                }`}
              >
                {fmtSigned(stats.pnl)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2" aria-label="Chargement des stats...">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={handleLogout}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-ligne bg-transparent text-sm font-bold text-doux transition-colors duration-200 hover:text-baisse"
      >
        <LogoutIcon className="h-4 w-4" />
        Se déconnecter
      </button>
    </aside>
  );
}
