"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/AppShell";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HistoryIcon, RefreshIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import { fmtDateTime, fmtMoney, fmtPrice } from "@/lib/format";
import { SYMBOLS, durationLabel, isOtc, symbolDisplay } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";

type Filter = "all" | "open" | "settled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "open", label: "En cours" },
  { id: "settled", label: "Terminées" },
];

function ResultBadge({ trade }: { trade: ApiTrade }) {
  if (trade.status === "OPEN") {
    return (
      <span className="shrink-0 rounded-lg bg-action/15 px-2 py-1 text-sm font-extrabold tabular-nums text-action">
        En cours
      </span>
    );
  }
  if (trade.result === "WIN") {
    const net = (trade.payout ?? 0) - trade.amount;
    return (
      <span className="shrink-0 rounded-lg bg-hausse/15 px-2 py-1 text-sm font-extrabold tabular-nums text-hausse">
        ▲ +{fmtMoney(net)}
      </span>
    );
  }
  if (trade.result === "LOSS") {
    return (
      <span className="shrink-0 rounded-lg bg-baisse/15 px-2 py-1 text-sm font-extrabold tabular-nums text-baisse">
        ▼ -{fmtMoney(trade.amount)}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-lg bg-action/15 px-2 py-1 text-sm font-extrabold text-action">
      Rendue
    </span>
  );
}

/** Ligne compacte : une prédiction tient en deux lignes. */
function TradeRow({ trade }: { trade: ApiTrade }) {
  const isUp = trade.direction === "UP";
  return (
    <div className="rounded-xl border border-ligne bg-carte p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 rounded-lg px-1.5 py-0.5 text-sm font-extrabold ${
              isUp ? "bg-hausse/15 text-hausse" : "bg-baisse/15 text-baisse"
            }`}
          >
            {isUp ? "▲" : "▼"}
          </span>
          <p className="truncate text-sm font-bold">
            {symbolDisplay(trade.symbol)}{" "}
            <span className="font-medium text-doux">
              · {durationLabel(trade.durationSec)} · {fmtDateTime(trade.openedAt)}
            </span>
          </p>
          {isOtc(trade.symbol) && (
            <span className="shrink-0 rounded-lg bg-action/15 px-1.5 py-0.5 text-xs font-extrabold text-action">
              JEU
            </span>
          )}
        </div>
        <ResultBadge trade={trade} />
      </div>
      <p className="mt-0.5 truncate text-xs tabular-nums text-doux">
        Mise {fmtMoney(trade.amount)} · {fmtPrice(trade.openPrice)} →{" "}
        {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
        {trade.status === "OPEN" && (
          <>
            {" · "}
            <Link href="/" className="font-semibold text-action underline">
              Voir
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function HistoriquePage() {
  const { setBalance } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [asset, setAsset] = useState<string>("all");
  const [trades, setTrades] = useState<ApiTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Clôture d'abord ce qui est arrivé à échéance.
      try {
        const s = await apiSettle();
        setBalance(s.balance);
      } catch {
        /* on affiche quand même l'historique */
      }
      const { trades: list } = await apiMyTrades("all", 100);
      setTrades(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Historique indisponible.");
    } finally {
      setLoading(false);
    }
  }, [setBalance]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = trades.filter(
    (t) =>
      (filter === "all" ? true : filter === "open" ? t.status === "OPEN" : t.status === "SETTLED") &&
      (asset === "all" || t.symbol === asset)
  );

  // Exporte les prédictions affichées en CSV (ouvre dans Excel).
  const exportCsv = () => {
    const header = "date;actif;direction;duree;mise;depart;arrivee;resultat;gain_perte";
    const lines = visible.map((t) => {
      const pnl =
        t.result === "WIN"
          ? (t.payout ?? 0) - t.amount
          : t.result === "LOSS"
            ? -t.amount
            : 0;
      return [
        fmtDateTime(t.openedAt),
        symbolDisplay(t.symbol),
        t.direction === "UP" ? "ACHAT" : "VENTE",
        durationLabel(t.durationSec),
        String(t.amount).replace(".", ","),
        String(t.openPrice).replace(".", ","),
        t.closePrice != null ? String(t.closePrice).replace(".", ",") : "",
        t.status === "OPEN" ? "EN COURS" : (t.result ?? ""),
        String(Math.round(pnl * 100) / 100).replace(".", ","),
      ].join(";");
    });
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tradefacile-historique.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireAuth>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold">Historique</h1>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportCsv}
              disabled={visible.length === 0}
              className="flex min-h-[40px] items-center rounded-xl border border-ligne bg-carte px-3 text-sm font-bold text-doux active:text-texte disabled:opacity-50"
            >
              Exporter
            </button>
            <button
              type="button"
              onClick={load}
              aria-label="Actualiser"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-ligne bg-carte text-doux active:text-texte"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            aria-label="Filtrer par jeu"
            className="h-10 flex-1 rounded-xl border border-ligne bg-carte px-2 text-base font-bold outline-none focus:border-action lg:max-w-xs"
          >
            <option value="all">Tous les jeux</option>
            {SYMBOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {symbolDisplay(s.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-1.5 lg:max-w-md" role="group" aria-label="Filtrer l'historique">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`min-h-[40px] rounded-xl text-sm font-bold transition-colors duration-200 ${
                filter === f.id
                  ? "bg-primary text-white"
                  : "border border-ligne bg-carte text-doux active:text-texte"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-8 w-8" />}
            title="Rien ici pour l'instant"
            text="Tes prédictions apparaîtront ici."
            action={
              <Link href="/">
                <Btn className="min-h-[44px] text-sm">Aller trader</Btn>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {visible.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
