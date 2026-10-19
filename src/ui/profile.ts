import { breatherRuleOf, profileAxesOf, temporalTimingOf, type ProfileAxisRead } from "../engine/profiles";
import type { ModuleType } from "../engine/types";
import { formatNumber } from "./format";

/* ── The profile-grades line (issue #370, re-spoken by ADR-0072) ──────
   The reusable presentation contract for authored profiles: one plain
   chip per comparable axis — the axis's short name and its authored
   multiplier with the fixed grade band in parentheses (`×1.05 (A)`;
   the absent mark stays bare). The chip is self-contained text: the
   figure is the fact, the letter the band it sits in, and the tooltip
   layer adds nothing a player would query (its disclosure retired
   2026-10-18). The letter is still the non-color state, and the line
   renders nowhere a live output belongs — the board readouts own actual
   production, this line owns authored aptitude. Types without authored
   profiles render nothing.
   Temporal profiles (issue #372) join the line with their timing said
   directly — one plain figure line beside the chips, never an aptitude
   grade, because grades summarize comparable coefficients and a timing
   rule is not one. */

// The chips' short axis names.
const SHORT_AXIS: Record<ProfileAxisRead["id"], string> = {
  base: "base",
  booster: "boost",
  chord: "chord",
  charge: "charge",
  breather: "breath",
};

// The chip's figure: the authored multiplier with the grade band beside it
// in parentheses; an axis with no comparable multiplier reads the bare
// absent mark.
function gradeFigureOf(axis: ProfileAxisRead): string {
  return axis.coefficient === null ? "—" : `×${formatNumber(axis.coefficient)} (${axis.grade})`;
}

function axisHtml(axis: ProfileAxisRead): string {
  return `<span class="profile-axis"><span class="profile-grade" data-grade="${axis.grade}">${SHORT_AXIS[axis.id]} <b class="mono">${gradeFigureOf(axis)}</b></span></span>`;
}

// The type's grade line — empty for every type without authored profile
// axes (non-oscillators until their waves land). A temporal profile's
// timing rides beside the chips as its own plain line, and the breather
// specialists' fact rules (issue #416) ride the same shape: the growth
// described directly, never given an aptitude grade.
export function profileGradesHtml(type: ModuleType): string {
  const axes = profileAxesOf(type);
  const timing = temporalTimingOf(type)?.timing ?? breatherRuleOf(type);
  if (axes.length === 0 && !timing) return "";
  const chips = axes.length > 0 ? `<span class="profile-grades">${axes.map(axisHtml).join("")}</span>` : "";
  const timingLine = timing ? `<span class="profile-timing">${timing}</span>` : "";
  return `${chips}${timingLine}`;
}
