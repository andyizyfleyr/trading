"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/config";
import { NAV } from "@/lib/design";
import { ChartIcon, HistoryIcon, SignalIcon } from "./Icons";

const TABS = [
  { href: ROUTES.trader, label: "Trader", Icon: ChartIcon },
  { href: ROUTES.predictions, label: "Signaux", Icon: SignalIcon },
  { href: ROUTES.history, label: "Historique", Icon: HistoryIcon },
];

/** Barre du bas fixe, compacte : 3 onglets dans la zone du pouce. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className={NAV.bar}>
      <div className={NAV.grid}>
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === ROUTES.trader ? pathname === ROUTES.trader : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${NAV.tab} ${active ? NAV.on : NAV.off}`}
            >
              <Icon className={NAV.icon} />
              <span>{label}</span>
              {active && <span className={NAV.tick} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
