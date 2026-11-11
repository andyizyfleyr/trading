"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/AppShell";
import { Btn, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HistoryIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import { fmtDateTime, fmtMoney, fmtPrice, symbolBase } from "@/lib/format";
import { durationLabel } from "@/lib/symbols";
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
      <span className="rounded-lg bg-action/15 px-2.5 py-1 text-base font-extrabold text-action">
        En cours
      </span>
    );
  }
  if (trade.result === "WIN") {
    const net = (trade.payout ?? 0) - trade.amount;
    return (
      <span className="rounded-lg bg-hausse/15 px-2.5 py-1 text-base font-extrabold text-hausse">
        ▲ +{fmtMoney(net)}
      </span>
    );
  }
  if (trade.result === "LOSS") {
    return (
      <span className="rounded-lg bg-baisse/15 px-2.5 py-1 text-base font-extrabold text-baisse">
        ▼ -{fmtMoney(trade.amount)}
      </span>
    );
  }
  return (
    <span className="rounded-lg bg-action/15 px-2.5 py-1 text-base font-extrabold text-action">
      Mise rendue
    </span>
  );
}

function TradeRow({ trade }: { trade: ApiTrade }) {
  const isUp = trade.direction === "UP";
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2.5 py-1 text-base font-extrabold ${
              isUp ? "bg-hausse/15 text-hausse" : "bg-baisse/15 text-baisse"
            }`}
          >
            {isUp ? "ACHAT ▲" : "VENTE ▼"}
          </span>
          <span className="text-base font-bold">{symbolBase(trade.symbol)}/USDT</span>
        </div>
        <ResultBadge trade={trade} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-base tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="text-doux">Mise</dt>
          <dd className="font-bold">{fmtMoney(trade.amount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-doux">Durée</dt>
          <dd className="font-bold">{durationLabel(trade.durationSec)}</dd>
        </div>
        <div className="col-span-2 flex justify-between gap-2">
          <dt className="text-doux">Prix</dt>
          <dd className="font-bold">
            {fmtPrice(trade.openPrice)} →{" "}
            {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-sm text-doux">
        {trade.status === "OPEN" ? (
          <>
            Se termine à {fmtDateTime(trade.closesAt)} ·{" "}
            <Link href="/" className="font-semibold text-action underline">
              Voir le compte à rebours
            </Link>
          </>
        ) : (
          fmtDateTime(trade.openedAt)
        )}
      </p>
    </Card>
  );
}

export default function HistoriquePage() {
  const { setBalance } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
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

  const visible = trades.filter((t) =>
    filter === "all" ? true : filter === "open" ? t.status === "OPEN" : t.status === "SETTLED"
  );

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold">Historique</h1>
          <Btn variant="ghost" onClick={load} className="min-h-[48px] px-4" aria-label="Actualiser">
            Actualiser
          </Btn>
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtrer l'historique">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`min-h-[48px] rounded-xl text-base font-bold transition-colors duration-200 ${
                filter === f.id
                  ? "bg-action text-white"
                  : "border border-ligne bg-carte text-doux active:text-texte"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-10 w-10" />}
            title={
              filter === "open"
                ? "Aucune prédiction en cours"
                : filter === "settled"
                  ? "Aucune prédiction terminée"
                  : "Aucune prédiction pour l'instant"
            }
            text="Fais ta première prédiction : choisis un actif et prédis si son prix monte ou descend."
            action={
              <Link href="/">
                <Btn>Faire une prédiction</Btn>
              </Link>
            }
          />
        ) : (
          visible.map((trade) => <TradeRow key={trade.id} trade={trade} />)
        )}
      </div>
    </RequireAuth>
  );
}
