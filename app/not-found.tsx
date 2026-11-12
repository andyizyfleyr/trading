import Link from "next/link";
import { ROUTES } from "@/lib/config";
import { BTN, ROW, SIGNAL, STATE, TEXT } from "@/lib/design";

export default function NotFound() {
  return (
    <div className={STATE.emptyBox}>
      <p className={SIGNAL.countdown}>404</p>
      <h1 className={TEXT.pageTitle}>Page introuvable</h1>
      <p className={TEXT.bodyMuted}>Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link href={ROUTES.trader} className={`${ROW.centerTight} ${BTN.base} ${BTN.primary}`}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
