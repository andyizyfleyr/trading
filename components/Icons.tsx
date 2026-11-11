"use client";

/** Icônes SVG légères (pas d'emoji dans l'interface). */

function Svg({
  children,
  className = "h-6 w-6",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ChartIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3 3v18h18" />
    <path d="M7 15v3M12 10v8M17 6v12" />
  </Svg>
);

export const HistoryIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Svg>
);

export const TrophyIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
    <path d="M12 13v4M8 21h8M9 17h6" />
  </Svg>
);

export const BookIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13" />
  </Svg>
);

export const UserIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

export const PlusIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M5 12h14" />
  </Svg>
);

export const RefreshIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </Svg>
);

export const LogoutIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Svg>
);

export const WifiOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m2 2 20 20" />
    <path d="M8.5 11.5a5 5 0 0 1 7 0M5 8a10 10 0 0 1 4-2.4M19 8a10 10 0 0 0-4-2.4" />
    <path d="M12 19h.01" />
  </Svg>
);

export const ArrowUpIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 19V5m0 0-6 6m6-6 6 6" />
  </Svg>
);

export const ArrowDownIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
  </Svg>
);

export const WalletIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M20 7H4a2 2 0 0 1 0-4h14v4" />
    <path d="M20 7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5" />
    <path d="M18 14h.01" />
  </Svg>
);

export const BackIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);
