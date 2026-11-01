export function triggerHaptic(pattern: number | number[] = 25): void {
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration blocked by user agent or permission policy
  }
}
