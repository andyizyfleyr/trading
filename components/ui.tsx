"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { XIcon } from "./Icons";

/* ---------- Bouton ---------- */

type BtnVariant = "primary" | "green" | "red" | "ghost" | "card";

const btnStyles: Record<BtnVariant, string> = {
  primary: "bg-action text-white active:bg-blue-600",
  green: "bg-hausse text-[#06240f] active:bg-green-400",
  red: "bg-baisse text-white active:bg-red-500",
  ghost: "bg-transparent text-texte border border-ligne active:bg-carte",
  card: "bg-carte text-texte border border-ligne active:bg-ligne",
};

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...rest}
      className={`min-h-[48px] rounded-xl px-4 text-base font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${btnStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Carte ---------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-ligne bg-carte p-4 ${className}`}>{children}</div>
  );
}

/* ---------- Chargement (skeleton) ---------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

/* ---------- État vide (compact) ---------- */

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ligne bg-carte px-5 py-6 text-center">
      <div className="text-doux">{icon}</div>
      <p className="text-base font-bold">{title}</p>
      <p className="text-sm text-doux">{text}</p>
      {action}
    </div>
  );
}

/* ---------- État d'erreur ---------- */

export function ErrorState({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-baisse/40 bg-carte px-5 py-6 text-center">
      <p className="text-base">{text}</p>
      {retry && (
        <Btn variant="ghost" onClick={retry} className="min-h-[48px]">
          Réessayer
        </Btn>
      )}
    </div>
  );
}

/* ---------- Bottom sheet (panneau coulissant depuis le bas) ---------- */

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:flex lg:items-center lg:justify-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-fond/70" onClick={onClose} />
      <div className="sheet-in absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-ligne bg-carte px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 lg:relative lg:inset-auto lg:mx-0 lg:max-h-[85vh] lg:max-w-md lg:rounded-3xl lg:border lg:pb-4 lg:pt-3 lg:shadow-2xl">
        <div className="mx-auto mb-1 h-1.5 w-12 shrink-0 rounded-full bg-ligne lg:hidden" aria-hidden="true" />
        <div className="flex min-h-[48px] shrink-0 items-center justify-between gap-2">
          <p className="text-lg font-extrabold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-fond text-doux active:text-texte"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 overflow-y-auto pb-1">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Bulle d'aide "?" (ouvre un panneau) ---------- */

export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex">
      <button
        type="button"
        aria-label={`Aide : ${label}`}
        onClick={() => setOpen(true)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-ligne bg-fond text-xs font-bold text-doux active:text-texte"
      >
        ?
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <p className="pb-2 text-base leading-relaxed">{text}</p>
      </BottomSheet>
    </span>
  );
}

/* ---------- Champ ---------- */

export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-base font-medium text-doux">
        {label}
      </span>
      {children}
    </label>
  );
}
