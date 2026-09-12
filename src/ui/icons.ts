import type { ModuleType } from "../engine/types";

const PATHS: Record<ModuleType, string> = {
  enter: '<path d="M0-12V1M-8-8a12 12 0 1 0 16 0"/>',
  time: '<circle r="12"/><path d="M0-8V0l6 4"/>',
  additive: '<path d="M-12 0H12M0-12V12"/>',
  conditional: '<path d="m-9-9 18 18m0-18-18 18"/>',
  infusor: '<circle r="4"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6m-20-11 5 5m12 12 5 5m0-22-5 5M-6 6l-5 5"/>',
  forge: '<path d="m0-14 12 7v14L0 14-12 7V-7Zm0 0v28m-12-21 24 14m0-14L-12 7"/>',
  expander: '<path d="M-10 5V-10H5M10-5V10H-5M-3 3 10-10M3-10h7v7"/>',
  habit: '<path d="m0-13 12 13L0 13-12 0Z"/>',
  notes: '<path d="M-10-11H10M-10-3H10M-10 5H5M-10 13H8"/>',
  goals: '<circle r="12"/><circle r="6"/><circle r="1"/>',
  tasks: '<path d="m-11 0 7 7 16-16"/>',
};

export function moduleIcon(type: ModuleType): string {
  return PATHS[type];
}

export function moduleSymbol(type: ModuleType): string {
  const symbols: Record<ModuleType, string> = {
    enter: "◉",
    time: "◷",
    additive: "+",
    conditional: "×",
    infusor: "✳",
    forge: "⬡",
    expander: "↗",
    habit: "◇",
    notes: "≡",
    goals: "◎",
    tasks: "✓",
  };
  return symbols[type];
}
