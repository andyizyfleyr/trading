/** Vibration légère (Android principalement), silencieuse si indisponible. */
export function vibrate(pattern: number | number[] = 15) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* non supporté */
  }
}
