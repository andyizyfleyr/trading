"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { ROUTES } from "@/lib/config";
import { HEADER, ICON, SIDE } from "@/lib/design";
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

/** Barre latérale desktop (écrans larges uniquement) : navigation + déconnexion. */
export function Sidebar() {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  if (!isDesktop) return null;

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
