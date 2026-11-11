"use client";

import { useEffect, useState } from "react";
import { apiGetPrice } from "@/lib/api";
import { useOnline } from "./useOnline";
import type { ApiCandle } from "@/lib/types";

/**
 * Prix en direct : WebSocket Binance (bougie 1m/5m/15m en formation),
 * avec secours par sondage de /api/price si le WebSocket échoue
 * (réseaux qui bloquent Binance, coupures, etc.).
 */
export function useLiveMarket(symbol: string, interval: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [tickCandle, setTickCandle] = useState<ApiCandle | null>(null);
  const [live, setLive] = useState(false);
  const online = useOnline();

  useEffect(() => {
    setPrice(null);
    setTickCandle(null);
    setLive(false);
    if (!online) return;

    let stopped = false;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let guardTimer: ReturnType<typeof setTimeout> | null = null;

    const pollOnce = async () => {
      try {
        const p = await apiGetPrice(symbol);
        if (stopped) return;
        setPrice(p);
        // En mode sondage, on met à jour la clôture de la bougie en cours.
        setTickCandle((prev) => {
          if (!prev) return prev;
          const high = Math.max(prev.high, p);
          const low = Math.min(prev.low, p);
          return prev.close === p && prev.high === high && prev.low === low
            ? prev
            : { ...prev, close: p, high, low };
        });
      } catch {
        /* on réessaiera au prochain tour */
      }
    };

    const startPoll = () => {
      if (pollTimer || stopped) return;
      setLive(false);
      pollOnce();
      pollTimer = setInterval(pollOnce, 4000);
    };
    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
      );
      // Sans message sous 6 s, on bascule sur le sondage.
      guardTimer = setTimeout(() => {
        if (stopped) return;
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
        startPoll();
      }, 6000);

      ws.onmessage = (ev) => {
        if (stopped) return;
        try {
          const k = JSON.parse(ev.data as string)?.k;
          if (!k) return;
          if (guardTimer) {
            clearTimeout(guardTimer);
            guardTimer = null;
          }
          stopPoll();
          setLive(true);
          const candle: ApiCandle = {
            time: Math.floor(Number(k.t) / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };
          if (!Number.isFinite(candle.close)) return;
          setTickCandle(candle);
          setPrice(candle.close);
        } catch {
          /* message ignoré */
        }
      };
      ws.onerror = () => {
        if (!stopped) startPoll();
      };
      ws.onclose = () => {
        if (!stopped) startPoll();
      };
    } catch {
      startPoll();
    }

    return () => {
      stopped = true;
      if (guardTimer) clearTimeout(guardTimer);
      stopPoll();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [symbol, interval, online]);

  return { price, tickCandle, live, online };
}
