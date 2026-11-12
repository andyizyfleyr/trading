"use client";

import { useEffect, useState } from "react";
import { BREAKPOINT_LG } from "@/lib/config";

/** Vrai sur écran large (point de rupture `lg` de Tailwind : 1024 px). */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT_LG}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
