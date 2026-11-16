"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { CandleChart, type ChartToast } from "@/components/CandleChart";
import { ComboCard, ComboSheet } from "@/components/ComboSheet";
import { ScheduledTrades, TradeForm, type ReplayOrder, type SignalHint } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { BottomSheet } from "@/components/ui";
import { CheckIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useServerOffset } from "@/hooks/useServerOffset";
import { apiCancelScheduled, apiMyCombos, apiMyTrades, apiSettle, ApiError, type ComboLegInput } from "@/lib/api";
import {
  DEFAULT_INTERVAL,
  FLOAT_TICK_MS,
  RESULTS_SHOWN,
  SCHEDULED_REFRESH_MS,
  SETTLE_TICK_MS,
  SIGNAL_FRESH_FUTURE_MS,
  SIGNAL_FRESH_PAST_MS,
  SIGNAL_LATE_MS,
  SIGNAL_PARAMS,
  STORE,
  TOAST_MS,
  TRADES_PAGE_LIMIT,
  TRADES_REFRESH_MS,
  VIBRATE,
} from "@/lib/config";
import { ENCOURS, SHEET, TRADER } from "@/lib/design";
import { fmtRemainShort } from "@/lib/format";
import { useLang } from "@/lib/lang-context";
import { useMoney } from "@/hooks/useMoney";
import { SYMBOLS, isDuration, symbolDisplay } from "@/lib/symbols";
import { vibrate } from "@/lib/vibrate";
import type { ApiCombo, ApiExactMoney, ApiTrade } from "@/lib/types";
import { addExact, decimalFraction, fraction } from "@/lib/exact-money";

function sumTradeAmounts(trades: ApiTrade[]): ApiExactMoney | undefined {
  let sum = decimalFraction("0");
  for (const trade of trades) {
    if (!trade.amountExact) return undefined;
    sum = addExact(sum, fraction(BigInt(trade.amountExact.numerator), BigInt(trade.amountExact.denominator)));
  }
  return { numerator: sum.numerator.toString(), denominator: sum.denominator.toString() };
}

function loadSymbol(): string {
  if (typeof window === "undefined") return SYMBOLS[0].id;
  try {
    const saved = window.localStorage.getItem(STORE.symbol);
    if (saved && SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return SYMBOLS[0].id;
}

export default function TraderPage() {
  const { money } = useMoney();
  const { t } = useLang();
  const { user, setBalance } = useAuth();
  const [symbol, setSymbol] = useState<string>(() => loadSymbol());
  const [openTrades, setOpenTrades] = useState<ApiTrade[]>([]);
  const [openCombos, setOpenCombos] = useState<ApiCombo[]>([]);
  const [scheduled, setScheduled] = useState<ApiTrade[]>([]);
  const [results, setResults] = useState<ApiTrade[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [comboLegs, setComboLegs] = useState<ComboLegInput[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [signalDuration, setSignalDuration] = useState<number | undefined>(undefined);
  const [signal, setSignal] = useState<SignalHint | null>(null);
  const [progSlot, setProgSlot] = useState<number | null>(null);
  const [toast, setToast] = useState<ChartToast | null>(null);
  const [replay, setReplay] = useState<ReplayOrder | null>(null);

  const { price, tickCandle, online } = useLiveMarket(symbol, DEFAULT_INTERVAL);
  const settlingRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message bref sur le graphique (mise, gain, perte).
  const say = useCallback((msg: string, tone: ChartToast["tone"]) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => {
    setShowGuide(!hasSeenGuide());
    // Signal venant de la page Signaux (?jeu=&duree=&sens=&slot=) :
    // pré-remplit le jeu, la durée et le bouton conseillé.
    try {
      const q = new URLSearchParams(window.location.search);
      const jeu = q.get(SIGNAL_PARAMS.game);
      if (jeu && SYMBOLS.some((s) => s.id === jeu)) {
        setSymbol(jeu);
        window.localStorage.setItem(STORE.symbol, jeu);
      }
      const duree = Number(q.get(SIGNAL_PARAMS.duration));
      if (isDuration(duree)) setSignalDuration(duree);
      const sens = q.get(SIGNAL_PARAMS.sense);
      const atMs = Number(q.get(SIGNAL_PARAMS.slot)) * 1000;
      const fresh = atMs > Date.now() - SIGNAL_FRESH_PAST_MS && atMs < Date.now() + SIGNAL_FRESH_FUTURE_MS;
      if ((sens === SIGNAL_PARAMS.up || sens === SIGNAL_PARAMS.down) && Number.isFinite(atMs) && fresh) {
        setSignal({ direction: sens === SIGNAL_PARAMS.up ? "UP" : "DOWN", atMs });
      }
      // Créneau programmé d'avance (« Préparer ma mise ») : présélectionné
      // dans « Départ » (le panneau vérifie qu'il est encore à venir).
      const prog = Number(q.get(SIGNAL_PARAMS.prog));
      if (Number.isInteger(prog) && prog > 0) setProgSlot(prog);
    } catch {
      /* adresse illisible : trader normal */
    }
  }, []);

  // Horloge pour le compte à rebours du bouton flottant.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), FLOAT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Même heure serveur partout (pas l'horloge du téléphone, parfois fausse).
  const offsetMs = useServerOffset();
  const serverNow = now + (offsetMs ?? 0);

  // Signal raté : on l'efface après un délai (sinon « Trop tard » reste affiché).
  // Heure serveur partagée : effacé au même moment sur tous les écrans.
  useEffect(() => {
    if (!signal) return;
    const wait = signal.atMs + SIGNAL_LATE_MS - (Date.now() + (offsetMs ?? 0));
    if (wait <= 0) {
      setSignal(null);
      return;
    }
    const timer = setTimeout(() => setSignal(null), wait);
    return () => clearTimeout(timer);
  }, [signal, offsetMs]);

  const pickSymbol = (id: string) => {
    setSymbol(id);
    setAssetOpen(false);
    try {
      window.localStorage.setItem(STORE.symbol, id);
    } catch {
      /* ignore */
    }
  };

  // Prédictions connues comme en cours + résultats déjà montrés.
  // Servent à retrouver ici les résultats clôturés par une autre page
  // (la synchro globale clôture partout, pas seulement sur le Trader).
  const openIdsRef = useRef<Set<number>>(new Set());
  const shownRef = useRef<Set<number>>(new Set());

  // Charge les prédictions en cours (conservées même si l'app a été fermée).
  // Si certaines ont été clôturées ailleurs, leurs résultats sont affichés.
  const loadOpen = useCallback(async () => {
    try {
      const [{ trades }, comboRes] = await Promise.all([
        apiMyTrades("open", TRADES_PAGE_LIMIT),
        apiMyCombos(TRADES_PAGE_LIMIT).catch(() => ({ combos: [] as ApiCombo[] })),
      ]);
      setOpenTrades(trades);
      setOpenCombos(comboRes.combos.filter((c) => c.status === "OPEN"));
      const fresh = new Set(trades.map((t) => t.id));
      const vanished = [...openIdsRef.current].filter(
        (id) => !fresh.has(id) && !shownRef.current.has(id)
      );
      openIdsRef.current = fresh;
      if (vanished.length > 0) {
        try {
          const { trades: settled } = await apiMyTrades("settled", TRADES_PAGE_LIMIT);
          const found = settled.filter((t) => vanished.includes(t.id));
          if (found.length > 0) {
            found.forEach((t) => shownRef.current.add(t.id));
            setResults((prev) => {
              const known = new Set(prev.map((p) => p.id));
              return [...found.filter((t) => !known.has(t.id)), ...prev].slice(0, RESULTS_SHOWN);
            });
          }
        } catch {
          /* réessayé au prochain chargement */
        }
      }
    } catch {
      /* la bannière hors ligne informe déjà l'utilisateur */
    }
  }, []);

  useEffect(() => {
    loadOpen();
    const timer = setInterval(loadOpen, TRADES_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadOpen]);

  // Mises programmées sur le serveur (partent même appli fermée) :
  // affichées dans le panneau « En cours ».
  const loadScheduled = useCallback(async () => {
    try {
      const { trades } = await apiMyTrades("scheduled", TRADES_PAGE_LIMIT);
      setScheduled(trades);
    } catch {
      /* non connecté ou hors ligne : on garde la liste connue */
    }
  }, []);

  useEffect(() => {
    loadScheduled();
    const timer = setInterval(loadScheduled, SCHEDULED_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadScheduled]);

  const cancelScheduled = useCallback(
    async (id: number) => {
      try {
        const res = await apiCancelScheduled(id);
        setBalance(res.balance, res.balanceExact);
        loadScheduled();
      } catch (err) {
        say(err instanceof ApiError ? err.message : t("Annulation impossible pour le moment."), null);
      }
    },
    [loadScheduled, setBalance, say, t]
  );

  // Clôture automatique à la fin de chaque compte à rebours (simples + combinés).
  useEffect(() => {
    const timer = setInterval(async () => {
      if (settlingRef.current || !online) return;
      const current = Date.now();
      const due = openTrades.filter((tr) => new Date(tr.closesAt).getTime() <= current);
      const dueCombo = openCombos.some((c) =>
        c.legs.some((l) => l.status === "OPEN" && new Date(l.closesAt).getTime() <= current)
      );
      if (due.length === 0 && !dueCombo) return;
      settlingRef.current = true;
      try {
        const res = await apiSettle(due.length > 0 ? due.map((d) => d.id) : undefined);
        const settledCombos = res.combos ?? [];
        if (settledCombos.length > 0) {
          setOpenCombos((prev) =>
            prev.filter((p) => !settledCombos.some((sc) => sc.id === p.id))
          );
          setBalance(res.balance, res.balanceExact);
          vibrate(VIBRATE.settle);
          const sc = settledCombos[0];
          if (sc.result === "WIN") {
            say(t("Combiné gagné +{amt}", { amt: money(sc.payout ?? 0, sc.payoutExact) }), "win");
          } else if (sc.result === "LOSS") {
            say(t("Combiné perdu −{amt}", { amt: money(sc.amount, sc.amountExact) }), "loss");
          } else {
            say(t("Égalité : mise rendue"), null);
          }
        } else if (dueCombo) {
          // Une jambe s'est clôturée mais le combiné a encore d'autres jambes en cours : on rafraîchit.
          void apiMyCombos(TRADES_PAGE_LIMIT)
            .then((r) => setOpenCombos(r.combos.filter((c) => c.status === "OPEN")))
            .catch(() => {});
        }
        if (res.settled.length > 0) {
          res.settled.forEach((s) => shownRef.current.add(s.id));
          setOpenTrades((prev) =>
            prev.filter((p) => !res.settled.some((s) => s.id === p.id))
          );
          setResults((prev) => [...res.settled, ...prev].slice(0, RESULTS_SHOWN));
          setBalance(res.balance, res.balanceExact);
          vibrate(VIBRATE.settle);
          // Un seul message : en boucle, chaque appel écrase le précédent et
          // seul le dernier résultat s'affiche.
          if (res.settled.length === 1) {
            const s = res.settled[0];
            if (s.result === "WIN") say(t("Gagné +{amt}", { amt: money(s.payout ?? 0, s.payoutExact) }), "win");
            else if (s.result === "LOSS") say(t("Perdu −{amt}", { amt: money(s.amount, s.amountExact) }), "loss");
            else say(t("Égalité : mise rendue"), null);
          } else {
            const won = res.settled.filter((s) => s.result === "WIN").length;
            const lost = res.settled.filter((s) => s.result === "LOSS").length;
            say(
              t("{n} résultats : {w} · {l}", {
                n: res.settled.length,
                w: won > 1 ? t("{n} gagnés", { n: won }) : t("{n} gagné", { n: won }),
                l: lost > 1 ? t("{n} perdus", { n: lost }) : t("{n} perdu", { n: lost }),
              }),
              won > lost ? "win" : lost > won ? "loss" : null
            );
          }
        }
      } catch {
        // Nouvel essai automatique à la prochaine seconde.
      } finally {
        settlingRef.current = false;
      }
    }, SETTLE_TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, openCombos, online]);

  const handleComboPlaced = useCallback(
    (combo: ApiCombo, balance: number, balanceExact?: ApiCombo["amountExact"]) => {
      setOpenCombos((prev) => [combo, ...prev.filter((c) => c.id !== combo.id)]);
      setBalance(balance, balanceExact);
      setTradesOpen(true);
      say(t("Combiné placé ({n} jambes)", { n: combo.legs.length }), null);
    },
    [setBalance, say, t]
  );

  const handleOpened = useCallback(
    (trade: ApiTrade, balance: number, balanceExact?: ApiTrade["amountExact"]) => {
      openIdsRef.current.add(trade.id);
      setOpenTrades((prev) => [trade, ...prev]);
      setBalance(balance, balanceExact);
      setSignal(null); // Coup joué : le signal a servi, on l'efface.
      setTradesOpen(true); // Affiche aussitôt le compte à rebours.
      say(
        t("{dir} {amt} · {dur} s", {
          dir: trade.direction === "UP" ? t("Hausse") : t("Baisse"),
          amt: money(trade.amount, trade.amountExact),
          dur: trade.durationSec,
        }),
        null
      );
    },
    [setBalance, say, t, money]
  );

  const sortedOpen = [...openTrades].sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt));
  // Programmées encore à venir (l'horloge serveur les fait basculer vers « En cours »).
  const scheduledUp = scheduled.filter((t) => new Date(t.openedAt).getTime() > serverNow);
  const openTotalCount = sortedOpen.length + openCombos.length;
  const openDeadlines = [
    ...sortedOpen.map((t) => +new Date(t.closesAt)),
    ...openCombos.flatMap((c) =>
      c.legs.filter((l) => l.status === "OPEN").map((l) => +new Date(l.closesAt))
    ),
  ];
  const nearestMs =
    openDeadlines.length === 0
      ? 0
      : Math.max(0, Math.min(...openDeadlines) - serverNow);
  // Prochain départ programmé (pour l'en-tête « En cours »).
  const nextSchedMs =
    scheduledUp.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(...scheduledUp.map((t) => new Date(t.openedAt).getTime())) - serverNow
        );
  const totalStaked =
    sortedOpen.reduce((s, t) => s + t.amount, 0) +
    openCombos.reduce((s, c) => s + c.amount, 0);
  // Mises programmées : promises au départ, comptées à part.
  const scheduledStaked = scheduledUp.reduce((s, t) => s + t.amount, 0);
  const totalStakedExact =
    openCombos.length === 0 ? sumTradeAmounts(sortedOpen) : undefined;
  const scheduledStakedExact = sumTradeAmounts(scheduledUp);
  // Prix des autres jeux (trades ouverts ailleurs que sur le jeu affiché).
  const otherSymbols = useMemo(
    () => [...new Set(sortedOpen.map((t) => t.symbol))].filter((s) => s !== symbol),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTrades, symbol]
  );
  const otherPrices = useLivePrices(otherSymbols);
  const priceOf = (t: ApiTrade) =>
    t.symbol === symbol ? price : (otherPrices[t.symbol] ?? null);
  const isDesktop = useIsDesktop();
  // Le panneau se referme tout seul dès qu'il n'y a plus rien dedans.
  // Sur desktop, « En cours » est affiché dans la colonne de droite, pas en panneau.
  const encoursVisible =
    tradesOpen && (openTotalCount > 0 || scheduledUp.length > 0) && !isDesktop;

  return (
    <RequireAuth>
      {/* Vue unique : 100 % de la hauteur dispo, aucun scroll de page. */}
      <div className={TRADER.root}>
        {/* Graphique maison en bougies : prend toute la place restante */}
        <div id="guide-chart" className={TRADER.chartBox}>
          <CandleChart
            symbol={symbol}
            interval={DEFAULT_INTERVAL}
            tickCandle={tickCandle}
            livePrice={price}
            toast={toast}
            stake={sortedOpen.length > 0 ? sortedOpen[0].amount : null}
            stakeExact={sortedOpen.length > 0 ? sortedOpen[0].amountExact : null}
          />
          {/* Pastille « N en cours » en bas à gauche du graphique (maquette). */}
          {openTotalCount > 0 && (
            <button
              type="button"
              onClick={() => setTradesOpen(true)}
              aria-label={t("Voir les {n} prédictions en cours", { n: openTotalCount })}
              className={TRADER.pill}
            >
              <span className={TRADER.pillDot} aria-hidden="true" />
              {t("{n} en cours", { n: openTotalCount })}
            </button>
          )}
        </div>

        {/* Paris + En cours (colonne de droite sur desktop) */}
        <div className={TRADER.sideCol}>
          <div className={TRADER.formWrap}>
            <TradeForm
              balance={user?.balance ?? 0}
              symbol={symbol}
              online={online}
              onOpened={handleOpened}
              initialDuration={signalDuration}
              signal={signal}
              onBalance={setBalance}
              replay={replay}
              progSlot={progSlot}
              onScheduledChange={() => {
                void loadScheduled();
                setTradesOpen(true); // Montre aussitôt la mise programmée.
              }}
              onPickAsset={() => setAssetOpen(true)}
              comboCount={comboLegs.length}
              onOpenCombo={() => setComboOpen(true)}
            />
          </div>

          {/* En cours affiché directement sur desktop (panneau sur mobile). */}
          {(openTotalCount > 0 || scheduledUp.length > 0) && (
            <div className={TRADER.onlyDesktop}>
              <div className={TRADER.openPanel}>
                {(openTotalCount > 0 || scheduledUp.length > 0) && (
                  <>
                    <div className={TRADER.openHead}>
                      <p className={TRADER.openTitle}>
                        {openTotalCount > 0
                          ? t("En cours ({n})", { n: openTotalCount })
                          : t("Programmé(es) ({n})", { n: scheduledUp.length })}
                      </p>
                      <p className={TRADER.openSoon}>
                        {openTotalCount > 0
                          ? t("Fin dans {x}", { x: fmtRemainShort(nearestMs) })
                          : t("Départ dans {x}", { x: fmtRemainShort(nextSchedMs) })}
                      </p>
                    </div>
                    <p className={TRADER.openStaked}>
                      {openTotalCount > 0 && <>{t("Mises {amt}", { amt: money(totalStaked, totalStakedExact) })}</>}
                      {openTotalCount > 0 && scheduledUp.length > 0 && " · "}
                      {scheduledUp.length > 0 && (
                        <>{t("Programmé(es) {amt}", { amt: money(scheduledStaked, scheduledStakedExact) })}</>
                      )}
                    </p>
                    {sortedOpen.map((trade) => (
                      <ActiveTradeCard
                        key={trade.id}
                        trade={trade}
                        price={priceOf(trade)}
                      />
                    ))}
                    {openCombos.map((combo) => (
                      <ComboCard key={`combo-${combo.id}`} combo={combo} now={serverNow} />
                    ))}
                  </>
                )}
                <ScheduledTrades trades={scheduledUp} onCancel={cancelScheduled} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panneau : choix de l'actif */}
      <BottomSheet open={assetOpen} onClose={() => setAssetOpen(false)} title={t("Choisir un jeu")}>
        <div className={SHEET.list1}>
          {SYMBOLS.map((s) => {
            const active = s.id === symbol;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSymbol(s.id)}
                aria-pressed={active}
                className={`${SHEET.row} ${active ? SHEET.rowOn : ""}`}
              >
                <span
                  className={SHEET.dot}
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className={SHEET.rowName}>
                  {symbolDisplay(s.id)}
                </span>
                {s.kind === "otc" && (
                  <span className={TRADER.tag}>
                    {t("JEU")}
                  </span>
                )}
                {active && <CheckIcon className={SHEET.rowCheck} />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Panneau : prédictions en cours + programmées (résumé dans l'en-tête) */}
      <BottomSheet
        open={encoursVisible}
        onClose={() => setTradesOpen(false)}
        title={
          openTotalCount > 0
            ? t("En cours ({n})", { n: openTotalCount })
            : t("Programmé(es) ({n})", { n: scheduledUp.length })
        }
        header={
          <div className={ENCOURS.head}>
            <h2 className={ENCOURS.title}>
              {openTotalCount > 0 ? t("En cours") : t("Programmé(es)")}
            </h2>
            {(openTotalCount > 0 || scheduledUp.length > 0) && (
              <>
                <span className={ENCOURS.badge}>
                  {openTotalCount > 0 ? openTotalCount : scheduledUp.length}
                </span>
                <p className={ENCOURS.sum}>
                  {openTotalCount > 0 && (
                    <>
                      {t("Mises")} <b className={ENCOURS.sumB}>{money(totalStaked, totalStakedExact)}</b> · {t("Fin dans")}{" "}
                      <b className={ENCOURS.sumB}>{fmtRemainShort(nearestMs)}</b>
                    </>
                  )}
                  {openTotalCount > 0 && scheduledUp.length > 0 && " · "}
                  {scheduledUp.length > 0 && (
                    <>
                      {t("Programmé(es)")}{" "}
                      <b className={ENCOURS.sumB}>{money(scheduledStaked, scheduledStakedExact)}</b>
                      {openTotalCount === 0 && (
                        <>
                          {" "}· {t("Départ dans")}{" "}
                          <b className={ENCOURS.sumB}>{fmtRemainShort(nextSchedMs)}</b>
                        </>
                      )}
                    </>
                  )}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => setTradesOpen(false)}
              aria-label={t("Fermer")}
              className={ENCOURS.close}
            >
              ✕
            </button>
          </div>
        }
      >
        <div className={ENCOURS.list}>
          {sortedOpen.map((trade) => (
            <ActiveTradeCard
              key={trade.id}
              trade={trade}
              price={priceOf(trade)}
            />
          ))}
          {openCombos.map((combo) => (
            <ComboCard key={`combo-${combo.id}`} combo={combo} now={serverNow} />
          ))}
          <ScheduledTrades trades={scheduledUp} onCancel={cancelScheduled} />
          {openTotalCount === 0 && scheduledUp.length === 0 && (
            <p className={ENCOURS.empty}>{t("Aucun trade en cours")}</p>
          )}
        </div>
      </BottomSheet>

      <ComboSheet
        open={comboOpen}
        onClose={() => setComboOpen(false)}
        defaultSymbol={symbol}
        balance={user?.balance ?? 0}
        online={online}
        legs={comboLegs}
        onLegsChange={setComboLegs}
        onPlaced={handleComboPlaced}
      />

      {/* Panneau : résultat, un à la fois (maquette : solde + Rejouer) */}
      <BottomSheet
        open={results.length > 0}
        onClose={() => setResults((prev) => prev.slice(1))}
        title={t("Résultat")}
        header={
          <div className={ENCOURS.head}>
            <h2 className={ENCOURS.title}>{t("Résultat")}</h2>
            <p className={ENCOURS.sum}>
              {t("Solde")} <b className={ENCOURS.sumB}>{money(user?.balance ?? 0, user?.balanceExact)}</b>
            </p>
            <button
              type="button"
              onClick={() => setResults((prev) => prev.slice(1))}
              aria-label={t("Fermer")}
              className={ENCOURS.close}
            >
              ✕
            </button>
          </div>
        }
      >
        <div className={SHEET.list2}>
          {results.length > 1 && (
            <p className={TRADER.moreResults}>
              {results.length > 2
                ? t("+{n} autres résultats après celui-ci", { n: results.length - 1 })
                : t("+{n} autre résultat après celui-ci", { n: results.length - 1 })}
            </p>
          )}
          {results[0] && (
            <ResultCard
              trade={results[0]}
              onReplay={() => {
                const t = results[0];
                setResults((prev) => prev.slice(1));
                if (t.symbol !== symbol) pickSymbol(t.symbol);
                setReplay({
                  direction: t.direction,
                  amount: t.amount,
                  amountExact: t.amountExact,
                  durationSec: t.durationSec,
                  nonce: Date.now(),
                });
              }}
            />
          )}
        </div>
      </BottomSheet>

      {showGuide && <GuideBubbles onDone={() => setShowGuide(false)} />}
    </RequireAuth>
  );
}
