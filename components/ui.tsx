"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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

/* ---------- État vide ---------- */

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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ligne bg-carte px-6 py-10 text-center">
      <div className="text-doux">{icon}</div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-base text-doux">{text}</p>
      {action}
    </div>
  );
}

/* ---------- État d'erreur ---------- */

export function ErrorState({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-baisse/40 bg-carte px-6 py-8 text-center">
      <p className="text-base">{text}</p>
      {retry && (
        <Btn variant="ghost" onClick={retry} className="min-h-[48px]">
          Réessayer
        </Btn>
      )}
    </div>
  );
}

/* ---------- Bulle d'aide "?" ---------- */

export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open ]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Aide : ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-ligne bg-fond text-sm font-bold text-doux active:text-texte"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="anim-in absolute left-1/2 top-8 z-40 w-56 -translate-x-1/2 rounded-xl border border-ligne bg-fond p-3 text-left text-sm font-normal leading-snug shadow-xl"
        >
          <span className="mb-1 block font-semibold">{label}</span>
          {text}
        </span>
      )}
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
