import { GRADE_WORDS, profileAxesOf, temporalTimingOf, type ProfileAxisRead } from "../engine/profiles";
import type { ModuleType } from "../engine/types";
import { formatNumber } from "./format";

/* ── The profile-grades line (issue #370) ─────────────
   The reusable presentation contract for authored profiles: one chip per
   comparable axis — the axis's short name and its fixed aptitude grade —
   with the exact coefficient in the tooltip layer's disclosure body. The
   letter is the state: no color carries it, and the line renders nowhere
   a live output belongs — the board readouts own actual production, this
   line owns authored aptitude. Types without authored profiles render
   nothing.
   Temporal profiles (issue #372) join the line with their timing said
   directly — one plain figure line beside the chips, never an aptitude
   grade, because grades summarize comparable coefficients and a timing
   rule is not one. */

// The chips' short axis names — the full labels live in the disclosure
// bodies and aria-labels.
const SHORT_AXIS: Record<ProfileAxisRead["id"], string> = {
  base: "base",
  booster: "boost",
  chord: "chord",
  charge: "charge",
};

let gradeTipSeq = 0;

function axisHtml(axis: ProfileAxisRead): string {
  const id = `profile-axis-tip-${gradeTipSeq++}`;
  const exact = axis.coefficient === null ? "" : ` ×${formatNumber(axis.coefficient)}`;
  return `<span class="inst-tip profile-axis"><button type="button" class="inst-tip-trigger profile-grade" data-grade="${axis.grade}" aria-describedby="${id}" aria-label="${axis.label}: ${axis.grade}, ${GRADE_WORDS[axis.grade]}">${SHORT_AXIS[axis.id]} <b class="mono">${axis.grade}</b></button><span class="inst-tip-body" role="tooltip" id="${id}">${axis.label}${exact} · ${GRADE_WORDS[axis.grade]}</span></span>`;
}

// The type's grade line — empty for every type without authored profile
// axes (non-oscillators until their waves land). A temporal profile's
// timing rides beside the chips as its own plain line.
export function profileGradesHtml(type: ModuleType): string {
  const axes = profileAxesOf(type);
  const timing = temporalTimingOf(type);
  if (axes.length === 0 && !timing) return "";
  const chips = axes.length > 0 ? `<span class="profile-grades">${axes.map(axisHtml).join("")}</span>` : "";
  const timingLine = timing ? `<span class="profile-timing">${timing.timing}</span>` : "";
  return `${chips}${timingLine}`;
}
