"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { ErrorState, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import { COPIED_MS, CSV, HISTORY_LIMIT, SETTLE_RETRY_MS, SETTLE_TICK_MS } from "@/lib/config";
import { HISTORY, STACK } from "@/lib/design";
import { fmtDay, fmtGain, fmtMoney, fmtPrice, fmtRemainShort, fmtTime } from "@/lib/format";
import { RULES, SYMBOLS, durationLabel, symbolDisplay } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";

type Filter = "all" | "open" | "settled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "open", label: "En cours" },
  { id: "settled", label: "Terminées" },
];

/** Ligne compacte : sens + jeu + mise + prix, résultat + heure à droite. */
function TradeRow({ trade, now }: { trade: ApiTrade; now: number }) {
  const isUp = trade.direction === "UP";
  const open = trade.status === "OPEN";
  const won = trade.result === "WIN";
  const lost = trade.result === "LOSS";
  const net = won ? (trade.payout ?? 0) - trade.amount : 0;
  const right = open
    ? `Fin ${fmtRemainShort(new Date(trade.closesAt).getTime() - now)}`
    : won
      ? `+${fmtGain(net)}`
      : lost
        ? `−${fmtMoney(trade.amount)}`
        : "±0";

  return (
    <div className={HISTORY.hrow}>
      <span
        className={`${HISTORY.hicon} ${won ? HISTORY.hiconWin : lost ? HISTORY.hiconLoss : ""}`}
        aria-hidden="true"
      >
        {isUp ? "▲" : "▼"}
      </span>
      <div className={HISTORY.hmid}>
        {symbolDisplay(trade.symbol)} <span className={HISTORY.hsub}>· {durationLabel(trade.durationSec)}</span>
        <p className={HISTORY.hmeta}>
          Mise {fmtMoney(trade.amount)} · {fmtPrice(trade.openPrice)} →{" "}
          {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
        </p>
      </div>
      <p
        className={`${HISTORY.hright} ${open ? HISTORY.hrightRun : won ? HISTORY.hrightWin : lost ? HISTORY.hrightLoss : ""}`}
      >
        {right}
        <small className={HISTORY.htime}>{fmtTime(trade.openedAt)}</small>
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
  const [now, setNow] = useState(() => Date.now());
  const [exportLabel, setExportLabel] = useState("Exporter");
  const loadingRef = useRef(false);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
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
      loadingRef.current = false;
      setLoading(false);
    }
  }, [setBalance]);

  useEffect(() => {
    load();
  }, [load]);

  // Horloge : fait défiler les « Fin dans … » des prédictions en cours.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), SETTLE_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Une prédiction en cours arrive à échéance : clôture + recharge aussitôt.
  // Anti-rafale : si le serveur n'a pas fini (horloge décalée, réseau lent),
  // on réessaie au bout de 5 s, pas chaque seconde.
  const retryRef = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    const openIds = new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.id));
    retryRef.current.forEach((_, id) => {
      if (!openIds.has(id)) retryRef.current.delete(id);
    });
    const due = trades.filter(
      (t) =>
        t.status === "OPEN" &&
        new Date(t.closesAt).getTime() <= now &&
        (retryRef.current.get(t.id) ?? 0) <= now
    );
    if (due.length === 0) return;
    due.forEach((t) => retryRef.current.set(t.id, now + SETTLE_RETRY_MS));
    let cancelled = false;
    (async () => {
      try {
        const res = await apiSettle(due.map((t) => t.id));
        if (!cancelled && res.settled.length > 0) load();
      } catch {
        /* nouvel essai au prochain délai */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [now, trades, load]);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  const visible = trades
    .filter(
      (t) =>
        (filter === "all" ? true : filter === "open" ? t.status === "OPEN" : t.status === "SETTLED") &&
        (asset === "all" || t.symbol === asset)
    )
    .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));

  // Statistiques sur les terminées (filtre jeu uniquement, maquette).
  const finished = trades.filter((t) => t.status === "SETTLED" && (asset === "all" || t.symbol === asset));
  const wins = finished.filter((t) => t.result === "WIN").length;
  const net = finished.reduce(
    (s, t) => s + (t.result === "WIN" ? t.amount * RULES.WIN_PAYOUT_RATIO : t.result === "LOSS" ? -t.amount : 0),
    0
  );

  // Exporte les terminées en CSV dans le presse-papiers (maquette).
  const exportCsv = async () => {
    const done = trades.filter((t) => t.status === "SETTLED");
    const lines = done.map((t) =>
      [
        symbolDisplay(t.symbol),
        durationLabel(t.durationSec),
        t.direction === "UP" ? "hausse" : "baisse",
        String(t.amount),
        String(t.openPrice),
        t.closePrice != null ? String(t.closePrice) : "",
        t.result === "WIN" ? "gagne" : t.result === "LOSS" ? "perdu" : "nul",
        fmtTime(t.openedAt),
      ].join(CSV.sep)
    );
    try {
      await navigator.clipboard.writeText([CSV.header, ...lines].join("\n"));
      setExportLabel("Copié ✓");
    } catch {
      setExportLabel("Erreur");
    }
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => setExportLabel("Exporter"), COPIED_MS);
  };

  // Lignes groupées par jour (« Aujourd'hui », « Hier », date).
  const groups: { day: string; rows: ApiTrade[] }[] = [];
  for (const t of visible) {
    const day = fmtDay(t.openedAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(t);
    else groups.push({ day, rows: [t] });
  }

  return (
    <RequireAuth>
      <div className={STACK.c2}>
        <div className={HISTORY.head}>
          <h1 className={HISTORY.title}>Historique</h1>
          <button
            type="button"
            onClick={exportCsv}
            disabled={finished.length === 0}
            className={HISTORY.exportBtn}
          >
            {exportLabel}
          </button>
          <button type="button" onClick={load} aria-label="Actualiser" className={HISTORY.iconBtn}>
            ↻
          </button>
        </div>

        <div className={HISTORY.stats}>
          <div className={HISTORY.stat}>
            <b className={HISTORY.statNum}>{finished.length}</b>
            <span className={HISTORY.statLabel}>Trades</span>
          </div>
          <div className={HISTORY.stat}>
            <b className={HISTORY.statNum}>
              {finished.length === 0 ? 0 : Math.round((wins / finished.length) * 100)} %
            </b>
            <span className={HISTORY.statLabel}>Réussite</span>
          </div>
          <div className={HISTORY.stat}>
            <b className={`${HISTORY.statNum} ${net >= 0 ? HISTORY.statUp : HISTORY.statDown}`}>
              {net > 0 ? `+${fmtGain(net)}` : net < 0 ? `−${fmtGain(Math.abs(net))}` : fmtGain(0)}
            </b>
            <span className={HISTORY.statLabel}>Net</span>
          </div>
        </div>

        <div className={HISTORY.filterRow}>
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
          <div className={HISTORY.chipsBox} role="group" aria-label="Filtrer l'historique">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={filter === f.id ? HISTORY.chipOn : HISTORY.chipOff}
              >
                {f.label}
              </button>
            ))}
          </div>
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
          <p className={HISTORY.empty}>Aucun trade</p>
        ) : (
          <div className={HISTORY.grid}>
            {groups.map((g) => (
              <div key={g.day} className={HISTORY.grid}>
                <p className={HISTORY.group}>{g.day}</p>
                {g.rows.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} now={now} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
