"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ChartIcon, HistoryIcon, TrophyIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Trader", Icon: ChartIcon },
  { href: "/historique", label: "Historique", Icon: HistoryIcon },
  { href: "/classement", label: "Classement", Icon: TrophyIcon },
  { href: "/cours", label: "Cours", Icon: BookIcon },
];

/** Barre du bas fixe, compacte : 4 onglets dans la zone du pouce. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ligne bg-fond/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors duration-200 ${
                active ? "text-white" : "text-doux active:text-texte"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              <span
                className={`h-1 w-6 rounded-full transition-colors duration-200 ${
                  active ? "bg-action" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
