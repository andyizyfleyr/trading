import { VIBRATE } from "./config";

/** Vibration légère (Android principalement), silencieuse si indisponible. */
export function vibrate(pattern: number | number[] = VIBRATE.tap) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* non supporté */
  }
}
