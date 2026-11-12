"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/AppShell";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HistoryIcon, RefreshIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import { CSV, HISTORY_LIMIT, ROUTES } from "@/lib/config";
import { HISTORY, ICON, ROW, STACK, TEXT, TONE, TRADER } from "@/lib/design";
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
      <span className={TONE.badgeInfo}>
        En cours
      </span>
    );
  }
  if (trade.result === "WIN") {
    const net = (trade.payout ?? 0) - trade.amount;
    return (
      <span className={TONE.badgeUp}>
        ▲ +{fmtMoney(net)}
      </span>
    );
  }
  if (trade.result === "LOSS") {
    return (
      <span className={TONE.badgeDown}>
        ▼ -{fmtMoney(trade.amount)}
      </span>
    );
  }
  return (
    <span className={TONE.badgeInfo}>
      Rendue
    </span>
  );
}

/** Ligne compacte : une prédiction tient en deux lignes. */
function TradeRow({ trade }: { trade: ApiTrade }) {
  const isUp = trade.direction === "UP";
  return (
    <div className={HISTORY.row}>
      <div className={ROW.between}>
        <div className={HISTORY.rowMain}>
          <span className={isUp ? TONE.up : TONE.down}>
            {isUp ? "▲" : "▼"}
          </span>
          <p className={HISTORY.rowName}>
            {symbolDisplay(trade.symbol)}{" "}
            <span className={HISTORY.rowSub}>
              · {durationLabel(trade.durationSec)} · {fmtDateTime(trade.openedAt)}
            </span>
          </p>
          {isOtc(trade.symbol) && (
            <span className={TRADER.tag}>
              JEU
            </span>
          )}
        </div>
        <ResultBadge trade={trade} />
      </div>
      <p className={HISTORY.rowMeta}>
        Mise {fmtMoney(trade.amount)} · {fmtPrice(trade.openPrice)} →{" "}
        {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
        {trade.status === "OPEN" && (
          <>
            {" · "}
            <Link href={ROUTES.trader} className={HISTORY.rowLink}>
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
      const { trades: list } = await apiMyTrades("all", HISTORY_LIMIT);
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
      ].join(CSV.sep);
    });
    const blob = new Blob([CSV.bom + [CSV.header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = CSV.file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireAuth>
      <div className={STACK.c2}>
        <div className={HISTORY.head}>
          <h1 className={TEXT.pageTitle}>Historique</h1>
          <div className={HISTORY.tools}>
            <button
              type="button"
              onClick={exportCsv}
              disabled={visible.length === 0}
              className={HISTORY.exportBtn}
            >
              Exporter
            </button>
            <button
              type="button"
              onClick={load}
              aria-label="Actualiser"
              className={HISTORY.iconBtn}
            >
              <RefreshIcon className={ICON.lg} />
            </button>
          </div>
        </div>

        <div className={TRADER.goRow}>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            aria-label="Filtrer par jeu"
            className={HISTORY.select}
          >
            <option value="all">Tous les jeux</option>
            {SYMBOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {symbolDisplay(s.id)}
              </option>
            ))}
          </select>
        </div>

        <div className={HISTORY.filters} role="group" aria-label="Filtrer l'historique">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={filter === f.id ? HISTORY.filterOn : HISTORY.filterOff}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <Skeleton className={HISTORY.skel} />
            <Skeleton className={HISTORY.skel} />
            <Skeleton className={HISTORY.skel} />
            <Skeleton className={HISTORY.skel} />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className={ICON.xl} />}
            title="Rien ici pour l'instant"
            text="Tes prédictions apparaîtront ici."
            action={
              <Link href={ROUTES.trader}>
                <Btn>Aller trader</Btn>
              </Link>
            }
          />
        ) : (
          <div className={HISTORY.grid}>
            {visible.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
