"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { RefreshIcon, TrophyIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { apiLeaderboard, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? "bg-yellow-400/20 text-yellow-300"
      : rank === 2
        ? "bg-gray-300/20 text-gray-200"
        : rank === 3
          ? "bg-amber-600/25 text-amber-400"
          : "bg-fond text-doux";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ${style}`}
    >
      {rank}
    </span>
  );
}

export default function ClassementPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<{ rank: number; balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiLeaderboard();
      setEntries(res.entries);
      setMe(res.me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Classement indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <RequireAuth>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold">Classement</h1>
          <button
            type="button"
            onClick={load}
            aria-label="Actualiser"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-ligne bg-carte text-doux active:text-texte"
          >
            <RefreshIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <>
            <Skeleton className="h-14" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon className="h-8 w-8" />}
            title="Pas encore de classement"
            text="Fais une prédiction pour apparaître ici."
          />
        ) : (
          <>
            {/* Ma position */}
            {me && (
              <div className="flex items-center gap-2.5 rounded-xl border border-action bg-carte p-2.5">
                <RankBadge rank={me.rank} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    Toi <span className="font-medium text-doux">· rang {me.rank}</span>
                  </p>
                  <p className="truncate text-xs text-doux">{user?.email}</p>
                </div>
                <p className="text-base font-extrabold tabular-nums">{fmtMoney(me.balance)}</p>
              </div>
            )}

            <div className="flex flex-col gap-0.5 rounded-xl border border-ligne bg-carte p-1.5">
              {entries.map((e) => (
                <div
                  key={e.userId}
                  className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${
                    e.isMe ? "bg-action/15" : ""
                  }`}
                >
                  <RankBadge rank={e.rank} />
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">
                    {e.isMe ? "Toi" : e.label}
                  </p>
                  <p className="text-sm font-extrabold tabular-nums">{fmtMoney(e.balance)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
