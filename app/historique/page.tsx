"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { ComboCard } from "@/components/ComboSheet";
import { ErrorState, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useServerOffset } from "@/hooks/useServerOffset";
import { apiMyCombos, apiMyStats, apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import { COPIED_MS, CSV, HISTORY_LIMIT, SETTLE_RETRY_MS, SETTLE_TICK_MS } from "@/lib/config";
import { HISTORY, STACK } from "@/lib/design";
import { fmtDateTime, fmtDay, fmtGamePrice, fmtRemainShort, fmtTime } from "@/lib/format";
import { useLang } from "@/lib/lang-context";
import { useMoney } from "@/hooks/useMoney";
import { SYMBOLS, durationLabel, symbolDisplay } from "@/lib/symbols";
import type { ApiCombo, ApiExactMoney, ApiStats, ApiTrade } from "@/lib/types";
import { addExact, decimalFraction, fraction, subtractExact } from "@/lib/exact-money";

type Filter = "all" | "open" | "settled" | "combos";

const FILTERS: Filter[] = ["all", "open", "settled", "combos"];

/** Ligne compacte : sens + jeu + mise + prix, résultat + heure à droite. */
function TradeRow({ trade, now }: { trade: ApiTrade; now: number }) {
  const { money } = useMoney();
  const { t, lang } = useLang();
  const isUp = trade.direction === "UP";
  const open = trade.status === "OPEN";
  const won = trade.result === "WIN";
  const lost = trade.result === "LOSS";
  // Gagné : ce qu'on a touché (mise + bénéfice, 100 → 185).
  const gain = won ? (trade.payout ?? 0) : 0;
  const right = open
    ? t("Fin {x}", { x: fmtRemainShort(new Date(trade.closesAt).getTime() - now) })
    : won
      ? `+${money(gain, trade.payoutExact)}`
      : lost
        ? `−${money(trade.amount, trade.amountExact)}`
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
          {t("Mise")} {money(trade.amount, trade.amountExact)} · {fmtGamePrice(trade.symbol, trade.openPrice, lang)} →{" "}
          {trade.closePrice != null ? fmtGamePrice(trade.symbol, trade.closePrice, lang) : "…"}
        </p>
      </div>
      <p
        className={`${HISTORY.hright} ${open ? HISTORY.hrightRun : won ? HISTORY.hrightWin : lost ? HISTORY.hrightLoss : ""}`}
      >
        {right}
        <small className={HISTORY.htime}>{fmtTime(trade.openedAt, lang)}</small>
      </p>
    </div>
  );
}

export default function HistoriquePage() {
  const { money } = useMoney();
  const { t, lang } = useLang();
  const { setBalance } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [asset, setAsset] = useState<string>("all");
  const [trades, setTrades] = useState<ApiTrade[]>([]);
  const [combos, setCombos] = useState<ApiCombo[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [exported, setExported] = useState<"idle" | "copied" | "error">("idle");
  const loadingRef = useRef(false);
  // Recharge demandée pendant un chargement : rejouée après (sinon perdue).
  const queuedRef = useRef(false);
  // Dernier jeu choisi (lu dans load : un rattrapage prend le jeu actuel,
  // pas celui d'avant — sinon les stats affichent le mauvais jeu).
  const assetRef = useRef(asset);
  assetRef.current = asset;
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Même heure serveur partout (sinon « Fin dans » et clôtures décalées).
  const offsetMs = useServerOffset();
  const serverNow = now + (offsetMs ?? 0);

  const load = useCallback(async () => {
    // Changement de jeu éclair pendant un chargement : pas de données
    // jetées, on rejoue un tour avec le jeu actuel (sinon les stats
    // restent celles de l'ancien jeu pendant que la liste a changé).
    if (loadingRef.current) {
      queuedRef.current = true;
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      do {
        queuedRef.current = false;
        const scope = assetRef.current;
        // Clôture d'abord ce qui est arrivé à échéance.
        try {
          const s = await apiSettle();
          setBalance(s.balance, s.balanceExact);
        } catch {
          /* on affiche quand même l'historique */
        }
        const [{ trades: list }, comboRes] = await Promise.all([
          apiMyTrades("all", HISTORY_LIMIT),
          apiMyCombos(HISTORY_LIMIT).catch(() => ({ combos: [] as ApiCombo[] })),
        ]);
        setTrades(list);
        setCombos(comboRes.combos);
        // Statistiques réelles (tous les trades, jamais tronquées).
        // Ignorées si le jeu a changé pendant l'appel (le tour
        // rattrapé rapportera les bonnes).
        try {
          const { stats: full } = await apiMyStats(scope === "all" ? undefined : scope);
          if (scope === assetRef.current) setStats(full);
        } catch {
          if (scope === assetRef.current) setStats(null); // secours : lignes affichées
        }
      } while (queuedRef.current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Historique indisponible."));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [setBalance, t]);

  useEffect(() => {
    load();
  }, [load, asset]);

  // Retour sur la page (bouton retour, changement d'onglet) : recharge.
  // Sans cela, les stats restent figées à la visite précédente alors
  // qu'on a joué entre-temps (la page est restaurée telle quelle).
  useEffect(() => {
    const onFocus = () => load();
    const onVisible = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
        new Date(t.closesAt).getTime() <= serverNow &&
        (retryRef.current.get(t.id) ?? 0) <= serverNow
    );
    const dueCombo = combos.some(
      (c) =>
        c.status === "OPEN" &&
        c.legs.some((l) => l.status === "OPEN" && new Date(l.closesAt).getTime() <= serverNow) &&
        (retryRef.current.get(-c.id) ?? 0) <= serverNow
    );
    if (due.length === 0 && !dueCombo) return;
    due.forEach((t) => retryRef.current.set(t.id, serverNow + SETTLE_RETRY_MS));
    if (dueCombo) {
      combos
        .filter((c) => c.status === "OPEN")
        .forEach((c) => retryRef.current.set(-c.id, serverNow + SETTLE_RETRY_MS));
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiSettle(due.length > 0 ? due.map((t) => t.id) : undefined);
        if (!cancelled && (res.settled.length > 0 || (res.combos && res.combos.length > 0) || dueCombo)) {
          load();
        }
      } catch {
        /* nouvel essai au prochain délai */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverNow, trades, combos, load]);

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

  const visibleCombos = combos
    .filter((c) => asset === "all" || c.legs.some((l) => l.symbol === asset))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // Statistiques réelles (tous les trades) ; à défaut, calculées sur les lignes affichées.
  const finished = trades.filter((t) => t.status === "SETTLED" && (asset === "all" || t.symbol === asset));
  const localWins = finished.filter((t) => t.result === "WIN").length;
  const wonAmount = finished
    .filter((t) => t.result === "WIN")
    .reduce((s, t) => s + ((t.payout ?? 0) - t.amount), 0);
  const lostAmount = finished
    .filter((t) => t.result === "LOSS")
    .reduce((s, t) => s + ((t.payout ?? 0) - t.amount), 0);
  const settledCount = stats?.settled ?? finished.length;
  const winRate = stats ? stats.winRate : finished.length === 0 ? 0 : Math.round((localWins / finished.length) * 100);
  const net = stats?.pnl ?? (wonAmount + lostAmount);
  let fallbackExact = decimalFraction("0");
  let hasExact = true;
  for (const trade of finished) {
    if (trade.result !== "WIN" && trade.result !== "LOSS") continue;
    if (!trade.amountExact || !trade.payoutExact) { hasExact = false; break; }
    fallbackExact = addExact(fallbackExact, subtractExact(
      fraction(BigInt(trade.payoutExact.numerator), BigInt(trade.payoutExact.denominator)),
      fraction(BigInt(trade.amountExact.numerator), BigInt(trade.amountExact.denominator)),
    ));
  }
  const netExact: ApiExactMoney | undefined = stats?.pnlExact ?? (hasExact
    ? { numerator: fallbackExact.numerator.toString(), denominator: fallbackExact.denominator.toString() } : undefined);

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
        fmtDateTime(t.openedAt),
      ].join(CSV.sep)
    );
    try {
      await navigator.clipboard.writeText([CSV.header, ...lines].join("\n"));
      setExported("copied");
    } catch {
      setExported("error");
    }
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => setExported("idle"), COPIED_MS);
  };

  // Lignes groupées par jour (« Aujourd'hui », « Hier », date).
  const groups: { day: string; rows: ApiTrade[] }[] = [];
  for (const t of visible) {
    const day = fmtDay(t.openedAt, lang);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(t);
    else groups.push({ day, rows: [t] });
  }

  const comboGroups: { day: string; rows: ApiCombo[] }[] = [];
  for (const c of visibleCombos) {
    const day = fmtDay(c.createdAt, lang);
    const last = comboGroups[comboGroups.length - 1];
    if (last && last.day === day) last.rows.push(c);
    else comboGroups.push({ day, rows: [c] });
  }

  return (
    <RequireAuth>
      <div className={STACK.c2}>
        <div className={HISTORY.head}>
          <h1 className={HISTORY.title}>{t("Historique")}</h1>
          <button
            type="button"
            onClick={exportCsv}
            disabled={finished.length === 0}
            className={HISTORY.exportBtn}
          >
            {t(exported === "copied" ? "Copié ✓" : exported === "error" ? "Erreur" : "Exporter")}
          </button>
          <button type="button" onClick={load} aria-label={t("Actualiser")} className={HISTORY.iconBtn}>
            ↻
          </button>
        </div>

        <div className={HISTORY.stats}>
          <div className={HISTORY.stat}>
            <b className={HISTORY.statNum}>{settledCount}</b>
            <span className={HISTORY.statLabel}>{t("Terminés")}</span>
          </div>
          <div className={HISTORY.stat}>
            <b className={HISTORY.statNum}>{winRate} %</b>
            <span className={HISTORY.statLabel}>{t("Réussite")}</span>
          </div>
          <div className={HISTORY.stat}>
            <b className={`${HISTORY.statNum} ${net >= 0 ? HISTORY.statUp : HISTORY.statDown}`}>
              {net > 0 ? `+${money(net, netExact)}` : net < 0 ? `−${money(Math.abs(net), netExact ? { ...netExact, numerator: netExact.numerator.replace(/^-/, "") } : undefined)}` : money(0)}
            </b>
            <span className={HISTORY.statLabel}>{t("Net")}</span>
          </div>
        </div>

        <div className={HISTORY.filterRow}>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            aria-label={t("Filtrer par jeu")}
            className={HISTORY.select}
          >
            <option value="all">{t("Tous les jeux")}</option>
            {SYMBOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {symbolDisplay(s.id)}
              </option>
            ))}
          </select>
          <div className={HISTORY.chipsBox} role="group" aria-label={t("Filtrer l'historique")}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={filter === f ? HISTORY.chipOn : HISTORY.chipOff}
              >
                {t(
                  f === "all"
                    ? "Toutes"
                    : f === "open"
                      ? "En cours"
                      : f === "settled"
                        ? "Terminées"
                        : "Combinés"
                )}
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
        ) : filter === "combos" ? (
          visibleCombos.length === 0 ? (
            <p className={HISTORY.empty}>{t("Aucun combiné")}</p>
          ) : (
            <div className={HISTORY.grid}>
              {comboGroups.map((g) => (
                <div key={g.day} className={HISTORY.grid}>
                  <p className={HISTORY.group}>{g.day}</p>
                  {g.rows.map((combo) => (
                    <ComboCard key={`combo-${combo.id}`} combo={combo} now={serverNow} />
                  ))}
                </div>
              ))}
            </div>
          )
        ) : visible.length === 0 ? (
          <p className={HISTORY.empty}>{t("Aucun trade")}</p>
        ) : (
          <div className={HISTORY.grid}>
            {groups.map((g) => (
              <div key={g.day} className={HISTORY.grid}>
                <p className={HISTORY.group}>{g.day}</p>
                {g.rows.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} now={serverNow} />
                ))}
              </div>
            ))}
            {trades.length >= HISTORY_LIMIT && (
              <p className={HISTORY.capped}>
                {t("Les {n} derniers affichés : les statistiques, elles, comptent tout.", { n: HISTORY_LIMIT })}
              </p>
            )}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
