import { BALANCE, typeRarityOf } from "../src/engine/constants";
import { boosterBonusOf, effectiveChordResponseOf, levelCost } from "../src/engine/economy";
import { chordResponseOf } from "../src/engine/profiles";
import type { ModuleType } from "../src/engine/types";

// Design experiment only. This is a fixed, already-acquired rig envelope,
// not a board allocator or a claim about acquisition/pacing. All participating
// modules share a level; supporting charge is saturated, tier and quality = 1.
// Summing waiting times to buy a whole rig level detects finite-time runaway.
// Real purchases happen between sessions, so this is a lower bound on time.
export type Curve = "shipped" | "chorus-bounded" | "responses-linear" | "responses-bounded";
export interface Rig {
  name: string;
  oscillator: "additive" | "tail" | "sideband";
  chords: number;
  chorus: boolean;
  exciter: boolean;
  amplitude: boolean;
  silentVoices: number;
}

export const RIGS: readonly Rig[] = [
  { name: "independent-sine", oscillator: "additive", chords: 0, chorus: false, exciter: false, amplitude: false, silentVoices: 0 },
  { name: "chorus-five-chords", oscillator: "additive", chords: 5, chorus: true, exciter: false, amplitude: false, silentVoices: 1 },
  { name: "exciter-tail", oscillator: "tail", chords: 0, chorus: false, exciter: true, amplitude: false, silentVoices: 0 },
  { name: "exciter-sideband-five-chords", oscillator: "sideband", chords: 5, chorus: false, exciter: true, amplitude: false, silentVoices: 1 },
  { name: "combined-support", oscillator: "sideband", chords: 5, chorus: true, exciter: true, amplitude: true, silentVoices: 1 },
];

function powerBase(type: ModuleType): number {
  return BALANCE.rarityPower[typeRarityOf(type)];
}

export function responsePower(level: number, type: "chorus" | "exciter", curve: Curve): number {
  if (curve === "responses-bounded" || curve === "chorus-bounded" && type === "chorus") {
    // Candidate: same level-zero strength, toward 4x at infinite levels.
    return 1 + 3 * level / (level + 20);
  }
  if (curve === "responses-linear") return 1 + 0.1 * level;
  return powerBase(type) ** level;
}

function log1pExp(logValue: number): number {
  return logValue > 0 ? logValue + Math.log1p(Math.exp(-logValue)) : Math.log1p(Math.exp(logValue));
}

export function logRigRate(rig: Rig, level: number, curve: Curve): number {
  const chorus = rig.chorus ? boosterBonusOf("chorus") * responsePower(level, "chorus", curve) * 2 : 0;
  const exciter = rig.exciter ? boosterBonusOf("exciter") * responsePower(level, "exciter", curve) * 2 : 0;
  // A major-triad-sized bonus is a synthetic per-seat input. Five seats
  // represents one intrinsic seat plus four purchased. No topology search
  // establishes that a particular rig realizes every modeled chord.
  const bonus = 1 + BALANCE.silentVoiceUpliftPerLevel * level * rig.silentVoices;
  const response = effectiveChordResponseOf(rig.oscillator, 1e12, chorus, exciter);
  const chord = rig.chords * Math.log1p(response * bonus);
  const amplitude = rig.amplitude
    ? log1pExp(Math.log(boosterBonusOf("spotlight") * 2) + level * Math.log(powerBase("spotlight")))
    : 0;
  // Mature Tail's base .5 and capped warmth x2 cancel. Sideband's base
  // .5 remains. Sine receives half amplitude support, but these rigs give
  // amplitude support only to Sideband, whose response is the standard 1.
  const base = rig.oscillator === "sideband" ? 0.5 : 1;
  const charge = rig.oscillator === "sideband" ? 1 : 2 + exciter;
  return Math.log(BALANCE.synthRate * base * charge) + level * Math.log(powerBase(rig.oscillator)) + chord + amplitude;
}

export function growthReport() {
  const costBase = Number(BALANCE.upgradeCostGrowthNumerator) / Number(BALANCE.upgradeCostGrowthDenominator);
  return {
    model: "fixed acquired rig, uniform levels, saturated charge, immediate reinvestment; not a 100-hour progression validation",
    costBase,
    responseCandidate: { bounded: "1 + 3L/(L+20)", linear: "1 + 0.1L" },
    rows: RIGS.flatMap((rig) => (["shipped", "chorus-bounded", "responses-linear", "responses-bounded"] as const).map((curve) => {
      const modules = 1 + Number(rig.chorus) + Number(rig.exciter) + Number(rig.amplitude) + rig.silentVoices;
      let seconds = 0;
      const milestones: { level: number; idealizedHours: number; log10Rate: number; nextWaitRatio: number }[] = [];
      for (let level = 0; level <= 1000; level++) {
        const logRate = logRigRate(rig, level, curve);
        if ([20, 100, 500, 1000].includes(level)) milestones.push({
          level,
          idealizedHours: seconds / 3600,
          log10Rate: logRate / Math.LN10,
          nextWaitRatio: costBase / Math.exp(logRigRate(rig, level + 1, curve) - logRate),
        });
        seconds += Math.exp(Math.log(modules) + Math.log(levelCost(level)) - logRate);
      }
      return { rig: rig.name, curve, modules, milestones };
    })),
    // A common amplitude booster and rare producer remain just below
    // prices after response grants cease contributing exponentials.
    boundedWorstExponentialBase: powerBase("sideband") * powerBase("spotlight"),
    authoredChordResponse: chordResponseOf("sideband"),
  };
}
