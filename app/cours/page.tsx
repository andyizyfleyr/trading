"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { Btn, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { BookIcon, CheckIcon } from "@/components/Icons";
import { apiLessonProgress, apiLessons, ApiError } from "@/lib/api";
import type { ApiLesson } from "@/lib/types";

function LessonCard({
  lesson,
  index,
  done,
  open,
  onToggle,
  onDone,
  saving,
}: {
  lesson: ApiLesson;
  index: number;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
  saving: boolean;
}) {
  return (
    <Card className={open ? "border-action" : ""}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center gap-3 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold ${
            done ? "bg-hausse text-[#06240f]" : "bg-fond text-doux"
          }`}
        >
          {done ? <CheckIcon className="h-5 w-5" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-extrabold">{lesson.title}</span>
          <span className="block truncate text-sm text-doux">
            {lesson.summary} · {lesson.minutes} min
          </span>
        </span>
        <span className={`text-xl text-doux transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="anim-in mt-3 flex flex-col gap-3 border-t border-ligne pt-3">
          {lesson.blocks.map((b, i) => (
            <div key={i}>
              {b.heading && <p className="text-base font-bold">{b.heading}</p>}
              <p className="text-base text-texte">{b.text}</p>
            </div>
          ))}
          <p className="rounded-xl bg-action/10 px-3 py-2 text-base">
            <span className="font-bold">À retenir : </span>
            {lesson.takeaway}
          </p>
          {done ? (
            <p className="flex items-center gap-2 text-base font-bold text-hausse">
              <CheckIcon className="h-5 w-5" /> Leçon terminée
            </p>
          ) : (
            <Btn onClick={onDone} disabled={saving}>
              {saving ? "…" : "Marquer comme terminée"}
            </Btn>
          )}
        </div>
      )}
    </Card>
  );
}

export default function CoursPage() {
  const [lessons, setLessons] = useState<ApiLesson[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiLessons();
      setLessons(res.lessons);
      setProgress(res.progress);
      const firstUndone = res.lessons.find((l) => !res.progress[l.id]);
      setOpenId((prev) => prev ?? firstUndone?.id ?? res.lessons[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Leçons indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = async (lessonId: string) => {
    setSavingId(lessonId);
    try {
      const res = await apiLessonProgress(lessonId, true);
      setProgress((p) => ({ ...p, [res.lessonId]: res.done }));
    } catch {
      /* reste ouvert : l'utilisateur peut réessayer */
    } finally {
      setSavingId(null);
    }
  };

  const doneCount = lessons.filter((l) => progress[l.id]).length;
  const pct = lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0;

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">Cours</h1>

        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : error ? (
          <ErrorState text={error} retry={load} />
        ) : lessons.length === 0 ? (
          <EmptyState
            icon={<BookIcon className="h-10 w-10" />}
            title="Aucune leçon pour l'instant"
            text="Reviens bientôt : de nouveaux cours arrivent."
          />
        ) : (
          <>
            <Card>
              <div className="flex items-center justify-between gap-2 text-base">
                <p className="font-bold">Ta progression</p>
                <p className="font-extrabold tabular-nums">
                  {doneCount}/{lessons.length}
                </p>
              </div>
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-fond"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${doneCount} leçons terminées sur ${lessons.length}`}
              >
                <div className="h-full rounded-full bg-hausse transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>
            </Card>

            {lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={i}
                done={!!progress[lesson.id]}
                open={openId === lesson.id}
                onToggle={() => setOpenId((prev) => (prev === lesson.id ? null : lesson.id))}
                onDone={() => markDone(lesson.id)}
                saving={savingId === lesson.id}
              />
            ))}
          </>
        )}
      </div>
    </RequireAuth>
  );
}
