"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BTN, CARD, FORM, LAYOUT, SHEET, SKELETON, STATE } from "@/lib/design";
import { XIcon } from "./Icons";

/* ---------- Bouton ---------- */

type BtnVariant = "primary" | "green" | "red" | "ghost" | "card" | "danger";

const btnStyles: Record<BtnVariant, string> = {
  primary: BTN.primary,
  green: BTN.green,
  red: BTN.red,
  ghost: BTN.ghost,
  card: BTN.card,
  danger: BTN.danger,
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
      className={`${BTN.base} ${btnStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Carte ---------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CARD.base} ${className}`}>{children}</div>;
}

/* ---------- Chargement (skeleton) ---------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`${SKELETON.base} ${className}`} aria-hidden="true" />;
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
    <div className={STATE.emptyBox}>
      <div className={STATE.emptyIcon}>{icon}</div>
      <p className={STATE.emptyTitle}>{title}</p>
      <p className={STATE.emptyText}>{text}</p>
      {action}
    </div>
  );
}

/* ---------- État d'erreur ---------- */

export function ErrorState({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className={STATE.errorBox}>
      <p className={STATE.errorText}>{text}</p>
      {retry && (
        <Btn variant="ghost" onClick={retry}>
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
  hideTitle = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  hideTitle?: boolean;
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
    <div className={SHEET.root} role="dialog" aria-modal="true" aria-label={title}>
      <div className={SHEET.fade} onClick={onClose} />
      <div className={SHEET.box}>
        <div className={SHEET.handle} aria-hidden="true" />
        <div className={SHEET.head}>
          {hideTitle ? <span aria-hidden="true" /> : <p className={SHEET.title}>{title}</p>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={SHEET.close}
          >
            <XIcon className={SHEET.closeIcon} />
          </button>
        </div>
        <div className={SHEET.body}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Bulle d'aide "?" (ouvre un panneau) ---------- */

export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={LAYOUT.helpWrap}>
      <button
        type="button"
        aria-label={`Aide : ${label}`}
        onClick={() => setOpen(true)}
        className={SHEET.helpBtn}
      >
        <span className={SHEET.helpDot}>?</span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <p className={SHEET.helpText}>{text}</p>
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
    <label className={LAYOUT.field}>
      <span className={FORM.label}>{label}</span>
      {children}
    </label>
  );
}
