"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { BTN, FORM, LAYOUT, SHEET, SKELETON, STATE } from "@/lib/design";
import { XIcon } from "./Icons";

/* ---------- Bouton ---------- */

type BtnVariant = "primary" | "ghost" | "card";

const btnStyles: Record<BtnVariant, string> = {
  primary: BTN.primary,
  ghost: BTN.ghost,
  card: BTN.card,
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

/** Nombre de panneaux ouverts (verrouille le scroll de la page). */
let sheetLocks = 0;

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  hideTitle = false,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  hideTitle?: boolean;
  /** En-tête sur mesure (remplace le titre + bouton fermer par défaut). */
  header?: ReactNode;
}) {
  // Panneaux empilés (Minuteur + « Choisir l'heure ») : un compteur, sinon
  // la fermeture du panneau du dessus rend le scroll alors que l'autre
  // est encore ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    sheetLocks += 1;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      sheetLocks = Math.max(0, sheetLocks - 1);
      if (sheetLocks === 0) document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={SHEET.root} role="dialog" aria-modal="true" aria-label={title}>
      <div className={SHEET.fade} onClick={onClose} />
      <div className={SHEET.box}>
        <div className={SHEET.handle} aria-hidden="true" />
        {header ?? (
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
        )}
        <div className={SHEET.body}>{children}</div>
      </div>
    </div>
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
