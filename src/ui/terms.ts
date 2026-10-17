// The hoverable domain terms (the disclosure doctrine): a term defined in
// CONTEXT.md renders hoverable wherever copy uses it, and its hover opens
// the glossary meaning — description prose never grows around it. The
// meanings here are the glossary's own, distilled to the one-line ceiling.
// The union keeps the map closed: only glossary terms may render hoverable.
export type CatalogTerm = "Oscillator" | "Generator" | "Booster" | "Silent voice" | "Spacer" | "Forge" | "Charge conduit" | "RITUAL" | "merge tier" | "Harmonic capacity" | "memorized" | "Arete" | "Poly Expander" | "Expansion Bays" | "Chord Catalysts" | "Warp Beam" | "Headroom" | "nous" | "charge" | "pitch" | "chords" | "module rolls" | "mutator rolls" | "habit build" | "goals";
const CATALOG_TERMS: Record<CatalogTerm, string> = {
  Oscillator: "Pitched module contributing production",
  Generator: "Produces charge from practice",
  Booster: "Improves eligible adjacent modules",
  "Silent voice": "Silent pitch that forms and strengthens chords",
  Spacer: "Silent wire conducting chord adjacency",
  Forge: "Received charge accumulates toward draft thresholds",
  "Charge conduit": "Routes received charge onward without producing it",
  RITUAL: "Received charge amplifies the active habit’s build effects",
  "merge tier": "Matching copies combine to raise authored strengths",
  "Harmonic capacity": "Whole-chord budget per voice",
  memorized: "Persists through arete reset",
  Arete: "The resource banked when an era ends",
  "Poly Expander": "Re-earned after arete reset",
  "Expansion Bays": "Ceiling purchases persist through arete reset",
  "Chord Catalysts": "Discount purchases persist through arete reset",
  "Warp Beam": "Cap purchases persist through arete reset",
  Headroom: "Extra earnings scale the payout logarithmically",
  nous: "Main progression resource spent on upgrades",
  charge: "Generator output that powers other modules",
  pitch: "The absolute note sounded by a board cell",
  chords: "Connected pitch sets multiply their member oscillators",
  "module rolls": "Choose one module from three candidates",
  "mutator rolls": "Choose one mutator from two candidates",
  "habit build": "Equipped build nodes apply during that habit’s sessions",
  goals: "Practice targets credited by flow sessions",
};
let catalogTermSeq = 0;
export function termTipHtml(term: CatalogTerm, label: string = term): string {
  const id = `catalog-term-${catalogTermSeq++}`;
  return `<span class="inst-tip term-tip"><button class="inst-tip-trigger term-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${term} — what it means">${label}</button><span class="inst-tip-body" id="${id}" role="tooltip">${CATALOG_TERMS[term]}</span></span>`;
}

