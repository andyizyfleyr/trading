"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { Btn, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { TrophyIcon } from "@/components/Icons";
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold tabular-nums ${style}`}
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold">Classement</h1>
          <Btn variant="ghost" onClick={load} className="min-h-[48px] px-4">
            Actualiser
          </Btn>
        </div>

        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon className="h-10 w-10" />}
            title="Pas encore de classement"
            text="Sois le premier à faire une prédiction pour apparaître ici."
          />
        ) : (
          <>
            {/* Ma position */}
            {me && (
              <Card className="border-action">
                <div className="flex items-center gap-3">
                  <RankBadge rank={me.rank} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold">
                      Toi <span className="font-medium text-doux">({user?.email})</span>
                    </p>
                    <p className="text-sm text-doux">Ton rang : {me.rank}</p>
                  </div>
                  <p className="text-lg font-extrabold tabular-nums">{fmtMoney(me.balance)}</p>
                </div>
              </Card>
            )}

            <h2 className="text-lg font-extrabold">Les 20 meilleurs soldes</h2>
            <Card className="flex flex-col gap-1 p-2">
              {entries.map((e) => (
                <div
                  key={e.userId}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                    e.isMe ? "bg-action/15" : ""
                  }`}
                >
                  <RankBadge rank={e.rank} />
                  <p className="min-w-0 flex-1 truncate text-base font-bold">
                    {e.isMe ? "Toi" : e.label}
                  </p>
                  <p className="text-base font-extrabold tabular-nums">{fmtMoney(e.balance)}</p>
                </div>
              ))}
            </Card>
            <p className="pb-2 text-center text-sm text-doux">
              Le classement compare les soldes. Prédis juste et gère bien tes mises pour monter.
            </p>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
