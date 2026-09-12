import type { Hex } from "./types";

export const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function hex(q: number, r: number): Hex {
  return { q, r };
}

export function sameHex(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function adjacent(a: Hex, b: Hex): boolean {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

export function neighbors(a: Hex): Hex[] {
  return DIRECTIONS.map(([dq, dr]) => hex(a.q + dq, a.r + dr));
}

export function isConnected(cells: Hex[]): boolean {
  if (cells.length === 0) return true;
  const key = (h: Hex) => `${h.q},${h.r}`;
  const seen = new Set([key(cells[0])]);
  const frontier = [cells[0]];
  while (frontier.length) {
    const current = frontier.pop()!;
    for (const n of neighbors(current)) {
      const k = key(n);
      if (seen.has(k)) continue;
      const match = cells.find((c) => sameHex(c, n));
      if (match) {
        seen.add(k);
        frontier.push(match);
      }
    }
  }
  return seen.size === cells.length;
}
