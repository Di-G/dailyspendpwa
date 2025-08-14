export function emitDataChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("dailyspend:data-changed"));
  } catch {
    // no-op in non-browser contexts
  }
}


