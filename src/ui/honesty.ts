// One voice for the honesty surfaces (§2, §8–9): the report's option labels
// and the summary's and history drill's factual event lines phrase each
// outcome the same way, so the report's promise and the record can never
// drift. Shared by the modals region and the history drill until the panels
// region extracts (which keeps importing from here, not from modals).
import type { HonestyEvent, HonestyOutcome } from "../engine/types";
import { secondsToMinutes } from "./format";

const OUTCOME_PHRASES: Record<HonestyOutcome, string> = {
  missed: "didn't practice",
  planned: "did what I planned",
  full: "practiced the whole time away",
};

export const outcomeLabel = (outcome: HonestyOutcome): string => {
  const phrase = OUTCOME_PHRASES[outcome];
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

// The honesty event's neutral factual line (§8–9), the history list's
// format: accounting, not judgment — "22 min away · didn't practice".
export function honestyEventLine(event: HonestyEvent): string {
  return `${secondsToMinutes(event.awaySeconds)} min away · ${OUTCOME_PHRASES[event.outcome]}`;
}
