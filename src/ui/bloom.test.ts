// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BLOOM_HEIGHT, BLOOM_WIDTH, bloomLayout } from "./bloom";

// The expanded face's geometry (§5): a fixed regular hexagon that sits
// centered above the selected module — bottom tip at the cell's top edge —
// presenting below only when the frame's top leaves no room, capped to the
// available width and clamped inside the board wrap.

const VIEW = { x: 0, y: 0, width: 1000, height: 800 };
const BOX = { width: 1000, height: 800 };

describe("bloomLayout", () => {
  it("presents above by default: bottom tip at the cell's top edge, centered", () => {
    // scale 1: cell (500, 400) maps to screen (500, 400).
    const layout = bloomLayout([500, 400], 61, VIEW, BOX);
    expect(layout.below).toBe(false);
    expect(layout.width).toBe(BLOOM_WIDTH);
    expect(layout.height).toBe(BLOOM_HEIGHT);
    expect(layout.top).toBe(400 - 61 - BLOOM_HEIGHT);
    expect(layout.left).toBe(500 - BLOOM_WIDTH / 2);
  });

  it("maps through the viewBox meet scaling, not raw svg units", () => {
    // viewBox twice the box: scale 0.5; cell (400, 600) → screen (200, 300).
    const layout = bloomLayout([400, 600], 61, { x: 0, y: 0, width: 2000, height: 1600 }, BOX);
    expect(layout.top).toBe(300 - 61 * 0.5 - BLOOM_HEIGHT);
    expect(layout.left).toBe(200 - BLOOM_WIDTH / 2);
  });

  it("honors the viewBox offset: a shifted origin moves the anchor", () => {
    const layout = bloomLayout([200, 400], 61, { x: -100, y: -50, width: 1000, height: 800 }, BOX);
    // screen anchor (300, 450), unclamped.
    expect(layout.left).toBe(300 - BLOOM_WIDTH / 2);
    expect(layout.top).toBe(450 - 61 - BLOOM_HEIGHT);
  });

  it("presents below only when the frame's top leaves no room", () => {
    // Cell's top edge at y=100: the bloom above would reach −182 — no room.
    const layout = bloomLayout([500, 161], 61, VIEW, BOX);
    expect(layout.below).toBe(true);
    expect(layout.top).toBe(161 + 61);
    // Exactly enough room above stays above.
    const fits = bloomLayout([500, 61 + BLOOM_HEIGHT], 61, VIEW, BOX);
    expect(fits.below).toBe(false);
    expect(fits.top).toBe(0);
  });

  it("clamps horizontally inside the board wrap", () => {
    const nearLeft = bloomLayout([50, 500], 61, VIEW, BOX);
    expect(nearLeft.left).toBe(0);
    const nearRight = bloomLayout([950, 500], 61, VIEW, BOX);
    expect(nearRight.left).toBe(BOX.width - BLOOM_WIDTH);
    expect(nearRight.left + nearRight.width).toBe(BOX.width);
  });

  it("caps the expansion to the available width and rescales the height", () => {
    const layout = bloomLayout([500, 500], 61, VIEW, { width: 150, height: 800 });
    expect(layout.width).toBe(150);
    expect(layout.height).toBe(Math.round((150 / BLOOM_WIDTH) * BLOOM_HEIGHT));
    expect(layout.left).toBe(0);
  });

  it("degrades to unit scale when the box has no layout yet", () => {
    const layout = bloomLayout([500, 400], 61, VIEW, { width: 0, height: 0 });
    expect(layout.width).toBe(BLOOM_WIDTH);
    expect(layout.height).toBe(BLOOM_HEIGHT);
    expect(layout.below).toBe(false);
    expect(layout.top).toBe(400 - 61 - BLOOM_HEIGHT);
  });
});
