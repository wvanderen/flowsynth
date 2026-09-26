// The expanded face's placement (board-redesign spec §5, ADR-0024): pure
// geometry, so the bloom's decided behavior is testable without a live
// layout. The grid svg maps its viewBox onto the board wrap with the
// default xMidYMid meet scaling; the bloom is a fixed regular hexagon
// (prototype 224×258: tuning) nested onto the selected module — presenting
// below, mirrored, only when the frame's top leaves no room — capped to
// the available width and clamped inside the wrap.
//
// The bloom is the module's own face enlarged — it only pops when it would
// actually enlarge the module. Early on, few cells fill the wrap and each
// on-screen module already dwarfs the fixed bloom; past that size the
// upgrade affordances ride the closed face itself and nothing pops out.

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Box {
  width: number;
  height: number;
}

// The svg viewBox and the board wrap's css-pixel size, one frame: every
// placement question is asked of both together, never one alone.
export interface ViewFrame {
  view: ViewBox;
  box: Box;
}

export interface BloomLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  below: boolean;
}

export const BLOOM_WIDTH = 256;
export const BLOOM_HEIGHT = 296;

// Whether the board has a layout at all: the wrap measured and the viewBox
// set. Until it does, every mapping degrades to unit scale.
export function viewLaid(frame: ViewFrame): boolean {
  return frame.box.width > 0 && frame.box.height > 0 && frame.view.width > 0 && frame.view.height > 0;
}

// The meet scale the svg's viewBox maps onto the board wrap with; unit
// scale when the wrap has no layout yet (hidden or unmeasured).
export function viewMeet(frame: ViewFrame): number {
  return viewLaid(frame) ? Math.min(frame.box.width / frame.view.width, frame.box.height / frame.view.height) : 1;
}

// One svg-unit point mapped to wrap-local css pixels.
export function viewPoint(cell: readonly [number, number], frame: ViewFrame): readonly [number, number] {
  const meet = viewMeet(frame);
  const laid = viewLaid(frame);
  const offsetX = laid ? (frame.box.width - frame.view.width * meet) / 2 - frame.view.x * meet : -frame.view.x;
  const offsetY = laid ? (frame.box.height - frame.view.height * meet) / 2 - frame.view.y * meet : -frame.view.y;
  return [cell[0] * meet + offsetX, cell[1] * meet + offsetY];
}

// The bloom's width capped to the wrap, and its left clamped inside it —
// one clamp shared by the popped plate and the riding card.
export function bloomSpan(cx: number, frame: ViewFrame): { left: number; width: number } {
  const width = frame.box.width > 0 ? Math.min(BLOOM_WIDTH, frame.box.width) : BLOOM_WIDTH;
  const left = Math.min(Math.max(cx - width / 2, 0), Math.max(0, frame.box.width - width));
  return { left, width };
}

// Whether the expansion enlarges the module at all: the fixed bloom must
// out-size the on-screen hex (a pointy-top regular hexagon is √3·radius
// wide) for the pop-out to make sense.
export function bloomPops(meet: number, cellRadius: number): boolean {
  return BLOOM_WIDTH > Math.sqrt(3) * cellRadius * meet;
}

// Screen position for one bloom over one cell. `cell` is the cell center in
// svg units, `cellRadius` the hex radius in the same units, and `frame`
// the svg viewBox plus the board wrap's css-pixel size.
//
// The bloom nests onto the module rather than kissing its tip (ADR-0024):
// its center sits one module-radius above the module's center, which brings
// the bloom's two bottom corners to rest exactly on the module's upper
// edges — both bottom corners touching, whatever the module's on-screen
// size. Presenting below mirrors the nest onto the module's lower edges.
export function bloomLayout(cell: readonly [number, number], cellRadius: number, frame: ViewFrame): BloomLayout {
  const meet = viewMeet(frame);
  const [cx, cy] = viewPoint(cell, frame);
  const { left, width } = bloomSpan(cx, frame);
  // The height follows the regular hexagon's proportions.
  const height = Math.round((width / BLOOM_WIDTH) * BLOOM_HEIGHT);
  const moduleRadius = cellRadius * meet;
  let top = cy - moduleRadius - height / 2;
  const below = top < 0 && frame.box.height > 0;
  if (below) top = cy + moduleRadius - height / 2;
  if (frame.box.height > 0) top = Math.min(top, Math.max(0, frame.box.height - height));
  return { left, top, width, height, below };
}
