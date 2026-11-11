import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-5xl font-extrabold text-doux">404</p>
      <h1 className="text-xl font-extrabold">Page introuvable</h1>
      <p className="text-base text-doux">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link
        href="/"
        className="mt-2 flex min-h-[48px] items-center rounded-xl bg-primary px-6 text-base font-semibold text-white"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
