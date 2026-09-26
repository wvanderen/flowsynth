// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BLOOM_HEIGHT, BLOOM_WIDTH, bloomLayout, bloomPops, bloomSpan, viewLaid, viewMeet, viewPoint } from "./bloom";

// The expanded face's geometry (§5, ADR-0024): a fixed regular hexagon that
// nests onto the selected module — its center one module-radius above the
// module's center, so both of the bloom's bottom corners rest on the
// module's upper edges — presenting below, mirrored, only when the frame's
// top leaves no room, capped to the available width and clamped inside the
// board wrap.

const VIEW = { x: 0, y: 0, width: 1000, height: 800 };
const BOX = { width: 1000, height: 800 };
const FRAME = { view: VIEW, box: BOX };

describe("bloomLayout", () => {
  it("nests above by default: both bottom corners on the module's upper edges", () => {
    // scale 1: cell (500, 400) maps to screen (500, 400); the bloom's
    // center sits one module-radius (61) above the cell's center.
    const layout = bloomLayout([500, 400], 61, FRAME);
    expect(layout.below).toBe(false);
    expect(layout.width).toBe(BLOOM_WIDTH);
    expect(layout.height).toBe(BLOOM_HEIGHT);
    expect(layout.top).toBe(400 - 61 - BLOOM_HEIGHT / 2);
    expect(layout.left).toBe(500 - BLOOM_WIDTH / 2);
    // The bloom's lower corners (±width/2, top + ¾ height) land on the
    // module's upper edges: at horizontal offset ±width/2, the edge line
    // through the top vertex rises width/2 × ½/ (√3/2) above… here, below
    // the vertex line by 73.9px.
    const cornerY = layout.top + (BLOOM_HEIGHT * 3) / 4;
    expect(cornerY).toBeCloseTo(400 - 61 + (BLOOM_WIDTH / 2) * (0.5 / (Math.sqrt(3) / 2)), 0);
  });

  it("maps through the viewBox meet scaling, not raw svg units", () => {
    // viewBox twice the box: scale 0.5; cell (400, 600) → screen (200, 300).
    const layout = bloomLayout([400, 600], 61, { view: { x: 0, y: 0, width: 2000, height: 1600 }, box: BOX });
    expect(layout.top).toBe(300 - 61 * 0.5 - BLOOM_HEIGHT / 2);
    expect(layout.left).toBe(200 - BLOOM_WIDTH / 2);
  });

  it("honors the viewBox offset: a shifted origin moves the anchor", () => {
    const layout = bloomLayout([200, 400], 61, { view: { x: -100, y: -50, width: 1000, height: 800 }, box: BOX });
    // screen anchor (300, 450), unclamped.
    expect(layout.left).toBe(300 - BLOOM_WIDTH / 2);
    expect(layout.top).toBe(450 - 61 - BLOOM_HEIGHT / 2);
  });

  it("presents below, mirrored, only when the frame's top leaves no room", () => {
    // The bloom's top would reach 400 − 61 − 148 = 191 ≥ 0: above.
    const fits = bloomLayout([500, 400], 61, FRAME);
    expect(fits.below).toBe(false);
    // A cell close to the top: the nest mirrors onto the lower edges.
    const layout = bloomLayout([500, 161], 61, FRAME);
    expect(layout.below).toBe(true);
    expect(layout.top).toBe(161 + 61 - BLOOM_HEIGHT / 2);
  });

  it("clamps horizontally inside the board wrap", () => {
    const nearLeft = bloomLayout([50, 500], 61, FRAME);
    expect(nearLeft.left).toBe(0);
    const nearRight = bloomLayout([950, 500], 61, FRAME);
    expect(nearRight.left).toBe(BOX.width - BLOOM_WIDTH);
    expect(nearRight.left + nearRight.width).toBe(BOX.width);
  });

  it("caps the expansion to the available width and rescales the height", () => {
    const layout = bloomLayout([500, 500], 61, { view: VIEW, box: { width: 150, height: 800 } });
    expect(layout.width).toBe(150);
    expect(layout.height).toBe(Math.round((150 / BLOOM_WIDTH) * BLOOM_HEIGHT));
    expect(layout.left).toBe(0);
  });

  it("degrades to unit scale when the box has no layout yet", () => {
    const layout = bloomLayout([500, 400], 61, { view: VIEW, box: { width: 0, height: 0 } });
    expect(layout.width).toBe(BLOOM_WIDTH);
    expect(layout.height).toBe(BLOOM_HEIGHT);
    expect(layout.below).toBe(false);
    expect(layout.top).toBe(400 - 61 - BLOOM_HEIGHT / 2);
  });
});

describe("the pop-or-ride threshold", () => {
  it("the bloom only pops when it would enlarge the on-screen module", () => {
    // A pointy-top regular hexagon is √3·radius wide: at meet 1 the module
    // is ~106px — smaller than the bloom, so the expansion enlarges.
    expect(bloomPops(1, 61)).toBe(true);
    // Zoomed far in (few cells, huge modules): the module already out-sizes
    // the fixed bloom — the affordances ride the closed face instead.
    expect(bloomPops(3, 61)).toBe(false);
    expect(bloomPops(2.45, 61)).toBe(false);
    // Just under the threshold still enlarges.
    expect(bloomPops(2.4, 61)).toBe(true);
  });

  it("viewLaid is the one layout guard: no measured wrap, no mapping", () => {
    expect(viewLaid(FRAME)).toBe(true);
    expect(viewLaid({ view: VIEW, box: { width: 0, height: 0 } })).toBe(false);
    expect(viewLaid({ view: { x: 0, y: 0, width: 0, height: 0 }, box: BOX })).toBe(false);
  });

  it("viewMeet mirrors the svg's meet scaling", () => {
    expect(viewMeet({ view: { x: 0, y: 0, width: 2000, height: 1600 }, box: { width: 1000, height: 800 } })).toBe(0.5);
    expect(viewMeet({ view: { x: 0, y: 0, width: 100, height: 50 }, box: { width: 100, height: 100 } })).toBe(1);
    // No layout yet: unit scale.
    expect(viewMeet({ view: { x: 0, y: 0, width: 100, height: 100 }, box: { width: 0, height: 0 } })).toBe(1);
  });

  it("viewPoint maps svg units to wrap-local pixels", () => {
    expect(viewPoint([100, 50], { view: { x: 0, y: 0, width: 200, height: 100 }, box: { width: 200, height: 100 } })).toEqual([100, 50]);
    // The wrap letterboxes: centered content shifts by the margins.
    const [x, y] = viewPoint([0, 0], { view: { x: -100, y: -50, width: 1000, height: 800 }, box: { width: 1000, height: 800 } });
    expect(x).toBe(100);
    expect(y).toBe(50);
  });
});

describe("bloomSpan", () => {
  it("one clamp for the popped plate and the riding card: centered, capped, inside", () => {
    expect(bloomSpan(500, FRAME)).toEqual({ left: 500 - BLOOM_WIDTH / 2, width: BLOOM_WIDTH });
    // Near the edges the clamp pulls the bloom inside the wrap.
    expect(bloomSpan(50, FRAME).left).toBe(0);
    expect(bloomSpan(950, FRAME).left).toBe(BOX.width - BLOOM_WIDTH);
    // The cap resizes before the clamp binds.
    expect(bloomSpan(75, { view: VIEW, box: { width: 100, height: 800 } })).toEqual({ left: 0, width: 100 });
  });
});
