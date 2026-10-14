// The app container's responsive gates (§7): the two breakpoints every TS
// gate quotes, and the one reader they share. The numbers must match the
// stylesheet's @container literals — those rules respond to #app's inline
// size, and so does this reader, so a gate and its CSS always agree.
export const PHONE_MAX_PX = 600;
export const RATE_DETAILS_BREAKPOINT_PX = 760;

// One layout read per render pass (#349): the pass opens with its reads —
// widths and retained scroll positions — and every gate inside the
// pass reads the batch, so a pass never interleaves a layout read between
// board writes (the read/write/read sandwich that forces a reflow
// mid-pass). Outside a pass — event handlers, gestures, tests — the
// readers read fresh.
interface LayoutBatch {
  container: number;
  viewport: number;
  scrollPositions: Map<Element, number>;
}

let batch: LayoutBatch | null = null;

// The one raw read both the pass-opener and the out-of-pass reader share,
// so the fallback can never drift between them.
function readContainerWidth(): number {
  const width = document.getElementById("app")?.clientWidth ?? 0;
  return width > 0 ? width : typeof window !== "undefined" ? window.innerWidth : 0;
}

export function beginLayoutPass(): void {
  const scrollPositions = new Map<Element, number>();
  document.querySelectorAll<HTMLElement>("#hex-detail .hex-detail-grid, #dev-board, .app-popover").forEach((element) => {
    scrollPositions.set(element, element.scrollTop);
  });
  batch = {
    scrollPositions,
    container: readContainerWidth(),
    viewport: typeof window !== "undefined" ? window.innerWidth : 0,
  };
}

export function endLayoutPass(): void {
  batch = null;
}

// The #app container's inline size — the same number the stylesheet's
// @container rules respond to. In a measured document #app is the
// container; a zero reading (a layout-less test DOM) falls through to the
// viewport.
export function containerWidth(): number {
  if (batch) return batch.container;
  return readContainerWidth();
}

// The viewport's inline size — the media-query side of the sheet gates
// (the modal layer sits at body level, outside #app).
export function viewportWidth(): number {
  if (batch) return batch.viewport;
  return typeof window !== "undefined" ? window.innerWidth : 0;
}

// The portrait-phone gate (§7): below it the console re-docks to the thumb
// bar, the ledger dissolves into the game-info strip, and the bloom
// presents as a bottom sheet.
export function isPhoneWidth(): boolean {
  return containerWidth() > 0 && containerWidth() < PHONE_MAX_PX;
}

// Newly mounted scroll containers start at zero; existing ones use the
// position captured before any surface writes in this render pass.
export function scrollTopOf(element: HTMLElement | null): number {
  if (!element) return 0;
  return batch ? batch.scrollPositions.get(element) ?? 0 : element.scrollTop;
}
