"use client";

import { useEffect } from "react";

/**
 * Bloque le zoom par pincement et le double-tap sur iPhone/iPad, qui ignorent
 * la balise viewport. Complète le CSS (touch-action) pour les autres navigateurs.
 */
export function ZoomGuard() {
  useEffect(() => {
    // Pincement sur Safari iOS.
    const blockPinch = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", blockPinch);
    document.addEventListener("gesturechange", blockPinch);
    // Double-tap : deux touchers rapprochés = zoom, on bloque le second.
    let lastEnd = 0;
    const blockDoubleTap = (e: TouchEvent) => {
      const t = Date.now();
      if (t - lastEnd < 350) e.preventDefault();
      lastEnd = t;
    };
    document.addEventListener("touchend", blockDoubleTap, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", blockPinch);
      document.removeEventListener("gesturechange", blockPinch);
      document.removeEventListener("touchend", blockDoubleTap);
    };
  }, []);
  return null;
}
