"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { apiMyStats } from "@/lib/api";
import { ROUTES, STATS_REFRESH_MS } from "@/lib/config";
import { HEADER, ICON, SIDE, TRADE } from "@/lib/design";
import { fmtMoney, fmtSigned } from "@/lib/format";
import type { ApiStats } from "@/lib/types";
import {
  ChartIcon,
  HistoryIcon,
  LogoutIcon,
  UserIcon,
} from "./Icons";

const ITEMS = [
  { href: ROUTES.trader, label: "Trader", Icon: ChartIcon },
  { href: ROUTES.history, label: "Historique", Icon: HistoryIcon },
  { href: ROUTES.profile, label: "Profil", Icon: UserIcon },
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
    const timer = setInterval(load, STATS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isDesktop, user, pathname, load]);

  if (!isDesktop) return null;

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.login);
  };

  return (
    <aside className={SIDE.bar}>
      <Link href={ROUTES.trader} className={SIDE.logo} aria-label="Accueil Trader">
        <span className={SIDE.logoMark} aria-hidden="true">
          <span className={HEADER.markUp}>▲</span>
          <span className={HEADER.markDown}>▼</span>
        </span>
        <span className={SIDE.logoName}>TradeFacile</span>
      </Link>

      <nav aria-label="Navigation principale" className={SIDE.nav}>
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === ROUTES.trader ? pathname === ROUTES.trader : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={active ? SIDE.linkOn : SIDE.linkOff}
            >
              <Icon className={SIDE.linkIcon} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mon compte : données en direct */}
      <div className={SIDE.card}>
        <p className={SIDE.cardTitle}>Mon compte</p>
        <div className={SIDE.acctRow}>
          <span className={SIDE.acctAvatar}>
            {initial}
          </span>
          <div className={SIDE.acctMain}>
            <p className={SIDE.acctMail}>{user?.email ?? "…"}</p>
            <p className={SIDE.acctBal}>
              {user ? fmtMoney(user.balance) : "…"}
            </p>
          </div>
        </div>
      </div>

      {/* Mes stats : vraies données du serveur */}
      <div className={SIDE.card}>
        <p className={SIDE.cardTitle}>Mes stats</p>
        {stats ? (
          <div className={SIDE.statsWrap}>
            <div className={SIDE.statsGrid}>
              <div className={SIDE.statTile}>
                <p className={SIDE.statNum}>{stats.settled}</p>
                <p className={SIDE.statLabel}>parties</p>
              </div>
              <div className={SIDE.statTile}>
                <p className={SIDE.statNum}>{stats.winRate} %</p>
                <p className={SIDE.statLabel}>réussite</p>
              </div>
              <div className={SIDE.statTile}>
                <p className={`${SIDE.statNum} ${TRADE.statUp}`}>
                  ▲ {stats.wins}
                </p>
                <p className={SIDE.statLabel}>victoires</p>
              </div>
              <div className={SIDE.statTile}>
                <p className={`${SIDE.statNum} ${TRADE.statDown}`}>
                  ▼ {stats.losses}
                </p>
                <p className={SIDE.statLabel}>défaites</p>
              </div>
            </div>
            <div className={SIDE.pnlRow}>
              <p className={SIDE.pnlLabel}>Gains nets</p>
              <p
                className={`${SIDE.pnlVal} ${
                  stats.pnl > 0 ? TRADE.statUp : stats.pnl < 0 ? TRADE.statDown : ""
                }`}
              >
                {fmtSigned(stats.pnl)}
              </p>
            </div>
          </div>
        ) : (
          <div className={SIDE.skelGrid} aria-label="Chargement des stats...">
            <div className={SIDE.skel} />
            <div className={SIDE.skel} />
            <div className={SIDE.skel} />
            <div className={SIDE.skel} />
          </div>
        )}
      </div>

      <div className={SIDE.spacer} />

      <button
        type="button"
        onClick={handleLogout}
        className={SIDE.logout}
      >
        <LogoutIcon className={ICON.md} />
        Se déconnecter
      </button>
    </aside>
  );
}
