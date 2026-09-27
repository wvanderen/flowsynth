// The app container's responsive gates (§7): the two breakpoints every TS
// gate quotes, and the one reader they share. The numbers must match the
// stylesheet's @container literals — those rules respond to #app's inline
// size, and so does this reader, so a gate and its CSS always agree.
export const PHONE_MAX_PX = 600;
export const FORMULA_BREAKPOINT_PX = 760;

// The #app container's inline size — the same number the stylesheet's
// @container rules respond to. In a measured document #app is the
// container; a zero reading (a layout-less test DOM) falls through to the
// viewport.
export function containerWidth(): number {
  const width = document.getElementById("app")?.clientWidth ?? 0;
  return width > 0 ? width : typeof window !== "undefined" ? window.innerWidth : 0;
}

// The portrait-phone gate (§7): below it the console re-docks to the thumb
// bar, the ledger dissolves into the game-info strip, and the bloom
// presents as a bottom sheet.
export function isPhoneWidth(): boolean {
  return containerWidth() > 0 && containerWidth() < PHONE_MAX_PX;
}
