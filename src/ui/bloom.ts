// The expanded face's placement (board-redesign spec §5): pure geometry, so
// the bloom's decided behavior is testable without a live layout. The grid
// svg maps its viewBox onto the board wrap with the default xMidYMid meet
// scaling; the bloom is a fixed regular hexagon (prototype 224×258: tuning)
// whose bottom tip touches the selected cell's top edge — presenting below
// instead only when the frame's top leaves no room (the toward-camera
// metaphor) — capped to the available width and clamped inside the wrap.
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

export interface BloomLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  below: boolean;
}

export const BLOOM_WIDTH = 224;
export const BLOOM_HEIGHT = 258;

// The meet scale the svg's viewBox maps onto the board wrap with; unit
// scale when the wrap has no layout yet (hidden or unmeasured).
export function viewMeet(view: ViewBox, box: Box): number {
  const laid = box.width > 0 && box.height > 0 && view.width > 0 && view.height > 0;
  return laid ? Math.min(box.width / view.width, box.height / view.height) : 1;
}

// One svg-unit point mapped to wrap-local css pixels.
export function viewPoint(cell: readonly [number, number], view: ViewBox, box: Box): readonly [number, number] {
  const meet = viewMeet(view, box);
  const laid = box.width > 0 && box.height > 0 && view.width > 0 && view.height > 0;
  const offsetX = laid ? (box.width - view.width * meet) / 2 - view.x * meet : -view.x;
  const offsetY = laid ? (box.height - view.height * meet) / 2 - view.y * meet : -view.y;
  return [cell[0] * meet + offsetX, cell[1] * meet + offsetY];
}

// Whether the expansion enlarges the module at all: the fixed bloom must
// out-size the on-screen hex (a pointy-top regular hexagon is √3·radius
// wide) for the pop-out to make sense.
export function bloomPops(meet: number, cellRadius: number): boolean {
  return BLOOM_WIDTH > Math.sqrt(3) * cellRadius * meet;
}

// Screen position for one bloom over one cell. `cell` is the cell center in
// svg units, `cellRadius` the hex radius in the same units, `view` the svg's
// viewBox, and `box` the board wrap's css-pixel size.
export function bloomLayout(cell: readonly [number, number], cellRadius: number, view: ViewBox, box: Box): BloomLayout {
  const meet = viewMeet(view, box);
  const [cx, cy] = viewPoint(cell, view, box);
  // The expansion caps to the available width; the height follows the
  // regular hexagon's proportions.
  const width = box.width > 0 ? Math.min(BLOOM_WIDTH, box.width) : BLOOM_WIDTH;
  const height = Math.round((width / BLOOM_WIDTH) * BLOOM_HEIGHT);
  // Bottom tip at the cell's top edge; below only when the top leaves no
  // room, then the top tip touches the cell's bottom edge.
  const cellTop = cy - cellRadius * meet;
  const cellBottom = cy + cellRadius * meet;
  let top = cellTop - height;
  const below = top < 0 && box.height > 0;
  if (below) top = cellBottom;
  if (box.height > 0) top = Math.min(top, Math.max(0, box.height - height));
  const left = Math.min(Math.max(cx - width / 2, 0), Math.max(0, box.width - width));
  return { left, top, width, height, below };
}
