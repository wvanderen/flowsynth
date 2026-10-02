// PROTOTYPE — throwaway artifact for wayfinder ticket #218 (map #212).
// Never merge to main. Lives on the prototype/chord-library-218 branch.
//
// QUESTION: what browsable chord library makes known and undiscovered
// chords understandable — glyphs with notes labeled at corners, unlocked
// vs undiscovered entries, discovery triggers, and whether a small
// permanent discovery bonus supports exploration? And what does
// discovery even key on: the chord class, its root, the voicing, or the
// concrete formation? Each variant answers that differently.
//
//   A "Atlas" — class × root grid. Discovery keys on (class, root):
//     first time a C-root Major triad forms, the C cell under Major
//     triad lights. Twelve roots per class, one grid.
//   B "Field guide" — class-only cards. Discovery keys on the class:
//     any Major triad anywhere names "Major triad" once and forever;
//     roots-heard is a secondary meter, not a discovery axis.
//   C "Anthology" — your formations. Discovery keys on the concrete
//     formation (class + root), each entry carrying its voicing
//     history; a compact class reference rides beside it.
//
// Shared, so the human reacts to the differences that matter:
//   - One glyph language everywhere: the board's hexagon with the
//     chord's notes as corner dots, labeled (recipe labels R/3/5 for a
//     class view, real note names C/E/G for a root view; "?" while the
//     class is unheard).
//   - A probe strip: toggle pitch classes, watch the matcher answer.
//     Live classes discover; proposed candidates answer "unnamed
//     sonority — tension only" (the #217 handoff) so the human can
//     react to which candidates should enter the vocabulary.
//   - The discovery bonus as a bar toggle: every entry gains or loses
//     its "+1% / discovery" line and the total. The mechanic is on
//     trial, not the number (numbers are tuning per the map).
//   - Persistence is stated per variant (save shape), since "how it
//     persists" is part of the question.
//
// All state is mock and in-memory; the game behind the overlay is
// untouched and saving is unaffected (the prototype never writes game
// state). Numbers everywhere are provisional tuning.
//
// Run: `npm run dev`, open `/?variant=a` (also b, c — the bottom bar
// cycles; ← → keys work). Without `?variant=` nothing arms.

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

interface ChordDef {
  id: string;
  name: string;
  intervals: number[];
  bonus: number;
  status: "live" | "proposed";
}

const LIVE: ChordDef[] = [
  { id: "octave", name: "Octave", intervals: [0, 0], bonus: 0.15, status: "live" },
  { id: "fifth", name: "Fifth", intervals: [0, 7], bonus: 0.3, status: "live" },
  { id: "flat7", name: "Flat seventh", intervals: [0, 10], bonus: 0.45, status: "live" },
  { id: "minor", name: "Minor triad", intervals: [0, 3, 7], bonus: 0.6, status: "live" },
  { id: "major", name: "Major triad", intervals: [0, 4, 7], bonus: 0.75, status: "live" },
];

// The #217 handoff: unnamed chromatic content bears tension only until
// named — these candidates are on trial here, not committed.
const PROPOSED: ChordDef[] = [
  { id: "sus4", name: "Suspended fourth", intervals: [0, 5, 7], bonus: 0.55, status: "proposed" },
  { id: "dim", name: "Diminished triad", intervals: [0, 3, 6], bonus: 0.65, status: "proposed" },
  { id: "aug", name: "Augmented triad", intervals: [0, 4, 8], bonus: 0.65, status: "proposed" },
  { id: "min7", name: "Minor seventh", intervals: [0, 3, 7, 10], bonus: 0.9, status: "proposed" },
  { id: "dom7", name: "Dominant seventh", intervals: [0, 4, 7, 10], bonus: 0.95, status: "proposed" },
  { id: "maj7", name: "Major seventh", intervals: [0, 4, 7, 11], bonus: 1.05, status: "proposed" },
];

// The spacer ladder (ADR-0021 geometry): ♭7 one wire, m3/M6 two,
// M3/m6 three. Proposed classes show "—" — counts are tuning.
const WIRES: Record<string, number> = { octave: 0, fifth: 0, flat7: 1, minor: 2, major: 3 };

const INTERVAL_LABEL: Record<number, string> = {
  0: "R", 1: "♭2", 2: "2", 3: "m3", 4: "M3", 5: "P4", 6: "♭5", 7: "P5", 8: "♯5", 9: "6", 10: "♭7", 11: "M7",
};

function noteOf(pitchClass: number): string {
  return NOTE_NAMES[((pitchClass % 12) + 12) % 12]!;
}

// ── Mock discovery state (in-memory only) ───────────────────────────

interface ClassDiscovery {
  roots: Set<number>;
  formed: number;
  firstAt: string;
}

interface FormationEvent {
  id: number;
  chordId: string;
  root: number;
  voicing: string;
  session: number;
}

const state = {
  variant: "a" as "a" | "b" | "c",
  closed: false,
  bonusOn: true,
  discovered: new Map<string, ClassDiscovery>(),
  log: [] as FormationEvent[],
  voicings: new Map<string, Set<string>>(),
  probe: new Set<number>(),
  register: 4,
  nextEventId: 1,
  flash: null as string | null,
};

function seed(): void {
  const discover = (id: string, roots: number[], formed: number, firstAt: string) =>
    state.discovered.set(id, { roots: new Set(roots), formed, firstAt });
  discover("octave", [0, 2], 9, "session 4");
  discover("fifth", [0, 7, 2, 9], 14, "session 3");
  discover("flat7", [0], 3, "session 11");
  discover("minor", [9, 4], 6, "session 8");
  discover("major", [0, 7], 11, "session 5");
  state.log = [
    { id: 4, chordId: "major", root: 0, voicing: "C4 E4 G4", session: 12 },
    { id: 3, chordId: "minor", root: 9, voicing: "A3 C4 E4", session: 11 },
    { id: 2, chordId: "fifth", root: 7, voicing: "G3 D4", session: 9 },
    { id: 1, chordId: "octave", root: 2, voicing: "D4 D5", session: 4 },
  ];
  state.voicings.set("major|0", new Set(["C4 E4 G4", "C3 E4 G5"]));
  state.voicings.set("minor|9", new Set(["A3 C4 E4"]));
  state.voicings.set("fifth|7", new Set(["G3 D4"]));
  state.voicings.set("octave|2", new Set(["D4 D5"]));
}

seed();

function rootsHeard(def: ChordDef): ClassDiscovery {
  return state.discovered.get(def.id) ?? { roots: new Set(), formed: 0, firstAt: "" };
}

const classKnown = (def: ChordDef): boolean => rootsHeard(def).roots.size > 0;
const discoveryCount = (): number => {
  let n = 0;
  for (const d of state.discovered.values()) n += d.roots.size;
  return n;
};

// ── The probe matcher (pitch content only — the probe has no board) ─

interface Match {
  def: ChordDef;
  root: number;
}

function matchProbe(classes: ChordDef[]): Match[] {
  const classes2 = [...state.probe].sort((a, b) => a - b);
  const out: Match[] = [];
  for (const def of classes) {
    // The Octave needs two voices of one class; the probe holds one voice
    // per pitch class, so it can never match here — skip it honestly.
    if (def.id === "octave") continue;
    const uniq = [...new Set(def.intervals)];
    for (let root = 0; root < 12; root++) {
      if (uniq.every((i) => classes2.includes((root + i) % 12))) {
        if (def.intervals.length === 1 || classes2.length >= uniq.length) out.push({ def, root });
      }
    }
  }
  return out;
}

function probeDiscover(): void {
  for (const match of matchProbe(LIVE)) {
    let d = state.discovered.get(match.def.id);
    if (!d) {
      d = { roots: new Set(), formed: 0, firstAt: `session —` };
      state.discovered.set(match.def.id, d);
    }
    if (!d.roots.has(match.root)) {
      d.roots.add(match.root);
      state.flash = `${match.def.name} · ${noteOf(match.root)}`;
    }
    d.formed += 1;
    const key = `${match.def.id}|${match.root}`;
    let v = state.voicings.get(key);
    if (!v) {
      v = new Set();
      state.voicings.set(key, v);
    }
    const pitches = [...state.probe].sort((a, b) => a - b).map((pc) => `${noteOf(pc)}${state.register}`);
    v.add(pitches.join(" "));
    state.log.unshift({ id: state.nextEventId++, chordId: match.def.id, root: match.root, voicing: pitches.join(" "), session: 13 });
  }
}

// ── Glyphs: the board's hexagon, notes as labeled corner dots ───────

function glyphSvg(def: ChordDef, size: number, labels: "recipe" | "root" | "hidden", root = 0, hue?: string): string {
  const stroke = hue ?? "var(--line-strong)";
  const fill = hue ? `color-mix(in srgb, ${hue} 16%, var(--panel))` : "var(--hex-face)";
  const heard = classKnown(def);
  const labelColor = labels === "hidden" || !heard ? "var(--muted)" : "var(--ink)";
  // Corner anchors (pointy-top hexagon), evenly spread over the used count.
  const n = def.intervals.length;
  const corners = [0, 1, 2, 3].slice(0, Math.max(n, 2));
  const angle = (i: number): number => -90 + (360 / Math.max(n, 2)) * i;
  const cx = size / 2;
  const hexR = size / 2 - 14;
  const hexPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = ((-90 + 60 * i) * Math.PI) / 180;
      pts.push(`${(cx + hexR * Math.cos(a)).toFixed(1)},${(cx + hexR * Math.sin(a)).toFixed(1)}`);
    }
    return `M${pts.join(" L")} Z`;
  })();
  const dots = def.intervals
    .map((interval, i) => {
      const a = (angle(corners[i]!) * Math.PI) / 180;
      const dx = cx + (hexR + 9) * Math.cos(a);
      const dy = cx + (hexR + 9) * Math.sin(a);
      const dotX = cx + hexR * Math.cos(a);
      const dotY = cx + hexR * Math.sin(a);
      const pc = labels === "root" ? (root + interval) % 12 : interval;
      const text =
        labels === "hidden" || (!heard && labels === "root")
          ? "?"
          : labels === "root"
            ? noteOf(pc)
            : def.id === "octave" && i === 1
              ? "R·8"
              : INTERVAL_LABEL[interval] ?? "?";
      const anchor = dx < cx - 2 ? "end" : dx > cx + 2 ? "start" : "middle";
      const lx = dx < cx - 2 ? dx - 4 : dx > cx + 2 ? dx + 4 : dx;
      return `<circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="3.4" fill="${heard || labels === "recipe" ? stroke : "var(--line)"}" />
        <text x="${lx.toFixed(1)}" y="${(dy + 3).toFixed(1)}" text-anchor="${anchor}" fill="${labelColor}" font-size="10.5" font-family="var(--mono)">${text}</text>`;
    })
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <path d="${hexPath}" fill="${fill}" stroke="${heard || labels === "recipe" ? stroke : "var(--line)"}" stroke-width="1.4" ${heard ? "" : 'stroke-dasharray="4 3"'} />
    ${dots}
  </svg>`;
}

// ── Per-variant rendering ───────────────────────────────────────────

const pct = (bonus: number): string => `×${(1 + bonus).toFixed(2)}`;
const bonusLine = (roots: number): string =>
  state.bonusOn ? `<span class="p218-disc">+${(roots * 1).toFixed(0)}% discovery</span>` : "";

function renderAtlas(): string {
  const sections = LIVE.map((def) => {
    const heard = rootsHeard(def);
    const known = classKnown(def);
    const cells = NOTE_NAMES.map((name, root) => {
      const on = heard.roots.has(root);
      return `<button class="p218-root ${on ? "on" : ""}" data-probe="${[def.intervals.map((i) => (root + i) % 12).join(",")]}">
        <span class="p218-root-letter">${name}</span>
        <span class="p218-root-state">${on ? "●" : "·"}</span>
      </button>`;
    }).join("");
    return `<section class="p218-class">
      <div class="p218-class-head">
        ${glyphSvg(def, 64, "recipe")}
        <div>
          <h3>${known ? def.name : "Undiscovered"}</h3>
          <p class="p218-recipe">${def.intervals.map((i) => (def.id === "octave" && i === 0 ? "R" : INTERVAL_LABEL[i]!)).join(" · ")}
          · ${def.intervals.length} voices · ${WIRES[def.id] ?? "—"} ${WIRES[def.id] === 1 ? "wire" : "wires"}</p>
          <p class="p218-bonus">${pct(def.bonus)} while it sings ${bonusLine(heard.roots.size)}</p>
        </div>
        <div class="p218-progress">${known ? `${heard.roots.size}/12 roots heard` : "no root heard yet"}</div>
      </div>
      <div class="p218-roots">${cells}</div>
    </section>`;
  }).join("");
  return `
    <p class="p218-vp">Discovery keys on <strong>(class, root)</strong>: a C-root Major triad and a G-root one are two discoveries. The save holds <code>class → roots[], formed, firstFormedAt</code> — it survives prestige like the feats ledger. The class header teaches the recipe; the twelve cells below it are the hunting ground. Tap a cell to load that chord's pitches into the probe.</p>
    <div class="p218-stack">${sections}</div>
    ${renderCandidates("cards")}
  `;
}

function renderFieldGuide(): string {
  const card = (def: ChordDef): string => {
    const heard = rootsHeard(def);
    const known = classKnown(def);
    return `<article class="p218-guide-card ${known ? "" : "locked"}">
      ${glyphSvg(def, 92, known ? "recipe" : "hidden")}
      <div class="p218-guide-body">
        <h3>${known ? def.name : "· · ·"}</h3>
        <p class="p218-recipe">${def.intervals.length} voices · ${WIRES[def.id] ?? "—"} ${WIRES[def.id] === 1 ? "wire" : "wires"}${known ? ` · first heard ${heard.firstAt}` : " · recipe unconfirmed"}</p>
        <p class="p218-bonus">${known ? `${pct(def.bonus)} while it sings` : "value unheard"} ${known ? bonusLine(heard.roots.size) : ""}</p>
        <div class="p218-meter"><i style="width:${(heard.roots.size / 12) * 100}%"></i></div>
        <p class="p218-meter-read">${heard.roots.size}/12 roots heard · formed ${heard.formed}×</p>
      </div>
    </article>`;
  };
  return `
    <p class="p218-vp">Discovery keys on the <strong>class</strong> alone: one Major triad anywhere names it forever. Roots and voicings are texture — the roots-heard meter and formed count record exploration without gating anything. The save holds <code>class → { formed, firstFormedAt, rootsHeard }</code>. The naming moment is the card's payoff: dashed and grey until heard, then name, value, and history.</p>
    <div class="p218-guide">${LIVE.map(card).join("")}</div>
    ${renderCandidates("cards")}
  `;
}

function renderAnthology(): string {
  const rows = state.log
    .slice(0, 14)
    .map((event) => {
      const def = LIVE.find((d) => d.id === event.chordId)!;
      const vCount = state.voicings.get(`${event.chordId}|${event.root}`)?.size ?? 1;
      return `<article class="p218-entry">
        ${glyphSvg(def, 56, "root", event.root)}
        <div>
          <h3>${def.name} · ${noteOf(event.root)}</h3>
          <p class="p218-recipe">first formed session #${event.session} · ${vCount} voicing${vCount === 1 ? "" : "s"}</p>
          <p class="p218-voicings">${[...(state.voicings.get(`${event.chordId}|${event.root}`) ?? [])].map((v) => `<code>${v}</code>`).join(" ")}</p>
        </div>
      </article>`;
    })
    .join("");
  const rail = LIVE.map((def) => {
    const heard = rootsHeard(def);
    const known = classKnown(def);
    return `<div class="p218-rail-row ${known ? "" : "locked"}">
      <span class="p218-rail-dot" style="background:${known ? "var(--ink)" : "var(--line)"}"></span>
      <span>${known ? def.name : "· · ·"}</span>
      <span class="p218-rail-count">${heard.roots.size}/12</span>
    </div>`;
  }).join("");
  return `
    <p class="p218-vp">Discovery keys on the <strong>formation</strong>: the library is the anthology of chords you actually formed, newest first, each entry keeping its voicing history (the register you sang it in is the texture). A compact class reference rides beside it; the save holds an append-only <code>formation log</code> like the session records. Watch the probe below write new pages into it.</p>
    <div class="p218-anthology">
      <div class="p218-log">${rows}</div>
      <aside class="p218-rail">
        <h4>Class reference</h4>
        ${rail}
        <h4>Unnamed — candidates</h4>
        ${PROPOSED.map((d) => `<div class="p218-rail-row locked"><span class="p218-rail-dot" style="background:var(--line)"></span><span>${d.name}</span><span class="p218-rail-count">—</span></div>`).join("")}
      </aside>
    </div>
    ${renderCandidates("none")}
  `;
}

function renderCandidates(mode: "cards" | "none"): string {
  if (mode === "none") return "";
  const cards = PROPOSED.map(
    (def) => `<article class="p218-guide-card proposed">
      ${glyphSvg(def, 84, "recipe")}
      <div class="p218-guide-body">
        <h3>${def.name} <span class="p218-stamp">candidate</span></h3>
        <p class="p218-recipe">${def.intervals.map((i) => INTERVAL_LABEL[i]!).join(" · ")} · ${def.intervals.length} voices</p>
        <p class="p218-bonus">would pay ${pct(def.bonus)} · today: tension only</p>
      </div>
    </article>`,
  ).join("");
  return `<section class="p218-candidates">
    <h2>Not yet in the vocabulary</h2>
    <p>These match in the probe and answer <em>unnamed sonority — tension, no named value</em>. Naming any of them is this ticket's vocabulary decision (the #217 handoff).</p>
    <div class="p218-guide">${cards}</div>
  </section>`;
}

// ── The probe strip (shared) ────────────────────────────────────────

function renderProbe(): string {
  const chips = NOTE_NAMES.map((name, pc) => {
    const on = state.probe.has(pc);
    return `<button class="p218-chip ${on ? "on" : ""}" data-pc="${pc}">${name}</button>`;
  }).join("");
  const matches = matchProbe(LIVE);
  const proposedMatches = matchProbe(PROPOSED);
  const read = matches
    .map((m) => `<span class="p218-match" data-goto="${m.def.id}|${m.root}">${m.def.name} · ${noteOf(m.root)} ${pct(m.def.bonus)}</span>`)
    .join(" ");
  const unnamed = proposedMatches.length
    ? `<span class="p218-unnamed">unnamed sonority — tension only (${proposedMatches.map((m) => `${m.def.name} · ${noteOf(m.root)}`).join(", ")}?)</span>`
    : "";
  const nothing = state.probe.size < 2 ? `<span class="p218-hint">toggle at least two pitch classes — adjacency alone is chordless</span>` : "";
  return `<div class="p218-probe">
    <div class="p218-probe-head">
      <span class="eyebrow">Probe cluster</span>
      <span class="p218-hint">pitch content only — the probe has no board, wires, or placement, and never doubles a class (no Octave)</span>
      <label class="p218-reg">root register <select id="p218-register">${[3, 4, 5, 6].map((r) => `<option ${r === state.register ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    </div>
    <div class="p218-chips">${chips}</div>
    <p class="p218-read">${nothing}${read} ${unnamed}</p>
  </div>`;
}

// ── Frame: header, bar, mount ───────────────────────────────────────

const VARIANT_LABEL = { a: "A · Atlas — class × root grid", b: "B · Field guide — class-only cards", c: "C · Anthology — formations first" } as const;

function renderOverlay(): string {
  const body = state.variant === "a" ? renderAtlas() : state.variant === "b" ? renderFieldGuide() : renderAnthology();
  const total = discoveryCount();
  return `
    <div class="p218-frame">
      <header class="p218-head">
        <div>
          <span class="eyebrow">Prototype · ticket #218 · throwaway</span>
          <h1>Chord library</h1>
        </div>
        <div class="p218-head-right">
          ${state.bonusOn ? `<span class="p218-total">${total} discoveries · +${total}% (provisional)</span>` : `<span class="p218-total">${total} discoveries</span>`}
          <button id="p218-close" aria-label="Close">✕</button>
        </div>
      </header>
      <div class="p218-scroll">
        ${renderProbe()}
        ${body}
        <p class="p218-foot">Every number is provisional tuning. The game behind this overlay is untouched; nothing here saves.</p>
      </div>
      <footer class="p218-bar">
        <button id="p218-prev" aria-label="Previous variant">◀</button>
        <span class="p218-bar-label">${VARIANT_LABEL[state.variant]}</span>
        <button id="p218-next" aria-label="Next variant">▶</button>
        <label class="p218-bar-toggle"><input type="checkbox" id="p218-bonus" ${state.bonusOn ? "checked" : ""}/> discovery bonus</label>
        <button id="p218-reset">reset discoveries</button>
      </footer>
    </div>`;
}

function renderReopen(): string {
  return `<button class="p218-reopen" id="p218-reopen">Chord library — reopen prototype</button>`;
}

function mount(): void {
  document.getElementById("p218-root")?.remove();
  const root = document.createElement("div");
  root.id = "p218-root";
  document.body.appendChild(root);
  draw();
}

function draw(): void {
  const root = document.getElementById("p218-root");
  if (!root) return;
  root.innerHTML = state.closed ? renderReopen() : renderOverlay();
  if (state.flash) {
    const flash = state.flash;
    state.flash = null;
    const target = root.querySelector(".p218-total");
    if (target) {
      target.classList.add("p218-flash");
      const old = target.textContent;
      target.textContent = `Discovered: ${flash}`;
      window.setTimeout(() => {
        target.classList.remove("p218-flash");
        target.textContent = old;
      }, 1600);
    }
  }
  wire(root);
}

function wire(root: HTMLElement): void {
  root.querySelector("#p218-close")?.addEventListener("click", () => {
    state.closed = true;
    draw();
  });
  root.querySelector("#p218-reopen")?.addEventListener("click", () => {
    state.closed = false;
    draw();
  });
  root.querySelector("#p218-prev")?.addEventListener("click", () => cycle(-1));
  root.querySelector("#p218-next")?.addEventListener("click", () => cycle(1));
  root.querySelector("#p218-bonus")?.addEventListener("change", (event) => {
    state.bonusOn = (event.target as HTMLInputElement).checked;
    draw();
  });
  root.querySelector("#p218-reset")?.addEventListener("click", () => {
    state.discovered = new Map();
    state.log = [];
    state.voicings = new Map();
    for (const pc of state.probe) state.probe.delete(pc);
    seed();
    draw();
  });
  root.querySelector("#p218-register")?.addEventListener("change", (event) => {
    state.register = Number((event.target as HTMLSelectElement).value);
  });
  root.querySelectorAll<HTMLElement>("[data-pc]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const pc = Number(chip.dataset.pc);
      if (state.probe.has(pc)) state.probe.delete(pc);
      else state.probe.add(pc);
      probeDiscover();
      draw();
    }),
  );
  root.querySelectorAll<HTMLElement>("[data-probe]").forEach((cell) =>
    cell.addEventListener("click", () => {
      state.probe = new Set((cell.dataset.probe ?? "").split(",").map(Number));
      probeDiscover();
      draw();
    }),
  );
  root.querySelectorAll<HTMLElement>("[data-goto]").forEach((match) =>
    match.addEventListener("click", () => {
      const [chordId, rootStr] = (match.dataset.goto ?? "").split("|");
      const def = LIVE.find((d) => d.id === chordId);
      if (!def) return;
      const pitches = def.intervals.map((i) => (Number(rootStr) + i) % 12);
      state.probe = new Set(pitches);
      probeDiscover();
      draw();
    }),
  );
}

function cycle(delta: number): void {
  const order = ["a", "b", "c"] as const;
  const index = order.indexOf(state.variant);
  state.variant = order[(index + delta + order.length) % order.length]!;
  history.replaceState(null, "", `/?variant=${state.variant}`);
  draw();
}

function onKey(event: KeyboardEvent): void {
  if (state.closed) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable)) return;
  if (event.key === "ArrowLeft") cycle(-1);
  if (event.key === "ArrowRight") cycle(1);
}

const STYLE = `
#p218-root, #p218-root * { box-sizing: border-box; }
#p218-root { position: fixed; inset: 0; z-index: 9000; }
.p218-frame { position: absolute; inset: 0; background: var(--scrim); backdrop-filter: blur(3px); display: flex; flex-direction: column; }
.p218-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; border-bottom: 1px solid var(--line); background: var(--panel-deep); }
.p218-head h1 { font: 20px var(--mono); margin: 2px 0 0; }
.p218-head-right { display: flex; align-items: center; gap: 14px; }
.p218-total { font: 12px var(--mono); color: var(--muted); }
.p218-total.p218-flash { color: var(--accent-bright); font-weight: 700; }
.p218-head button { background: var(--panel); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; width: 30px; height: 30px; cursor: pointer; }
.p218-scroll { flex: 1; overflow-y: auto; padding: 18px 22px 90px; max-width: 1080px; margin: 0 auto; width: 100%; }
.p218-vp { font: 13px/1.55 var(--mono); color: var(--muted); border: 1px dashed var(--line-strong); border-radius: 8px; padding: 10px 14px; margin: 0 0 16px; }
.p218-vp strong, .p218-vp code { color: var(--ink); }
.p218-foot { font: 11px var(--mono); color: var(--muted); text-align: center; margin-top: 26px; }
/* probe */
.p218-probe { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: var(--panel-soft); margin-bottom: 18px; }
.p218-probe-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.p218-hint { font: 11px var(--mono); color: var(--muted); }
.p218-reg { margin-left: auto; font: 11px var(--mono); color: var(--muted); }
.p218-reg select { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 4px; }
.p218-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.p218-chip { font: 12px var(--mono); padding: 5px 9px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel); color: var(--muted); cursor: pointer; }
.p218-chip.on { border-color: var(--accent); color: var(--accent-ink); background: var(--accent); font-weight: 700; }
.p218-read { font: 12px var(--mono); margin: 10px 0 0; color: var(--ink); }
.p218-match { display: inline-block; border: 1px solid var(--line-strong); border-radius: 6px; padding: 2px 7px; margin-right: 6px; cursor: pointer; background: var(--accent-faint); }
.p218-unnamed { color: var(--muted); font-style: italic; }
/* atlas */
.p218-stack { display: flex; flex-direction: column; gap: 14px; }
.p218-class { border: 1px solid var(--line); border-radius: 10px; background: var(--panel-soft); padding: 14px; }
.p218-class-head { display: flex; gap: 14px; align-items: center; margin-bottom: 12px; }
.p218-class-head h3 { margin: 0 0 4px; font: 15px var(--mono); }
.p218-recipe, .p218-bonus { font: 11.5px var(--mono); color: var(--muted); margin: 2px 0; }
.p218-bonus { color: var(--ink); }
.p218-disc { color: var(--forge-glow); }
.p218-progress { margin-left: auto; font: 11px var(--mono); color: var(--muted); white-space: nowrap; }
.p218-roots { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; }
.p218-root { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 0 5px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; }
.p218-root-letter { font: 12.5px var(--mono); color: var(--muted); }
.p218-root-state { font-size: 9px; color: var(--line-strong); }
.p218-root.on { border-color: var(--accent); background: var(--accent-faint); }
.p218-root.on .p218-root-letter { color: var(--ink); }
.p218-root.on .p218-root-state { color: var(--accent); }
/* field guide + cards */
.p218-guide { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.p218-guide-card { display: flex; gap: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-soft); padding: 14px; }
.p218-guide-card.locked { border-style: dashed; opacity: 0.75; }
.p218-guide-card.proposed { border-style: dashed; background: transparent; }
.p218-guide-body h3 { margin: 0 0 4px; font: 15px var(--mono); }
.p218-stamp { font: 9.5px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--line-strong); border-radius: 4px; padding: 1px 5px; color: var(--muted); vertical-align: 2px; }
.p218-meter { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; margin: 8px 0 4px; }
.p218-meter i { display: block; height: 100%; background: var(--meter-fill); }
.p218-meter-read { font: 10.5px var(--mono); color: var(--muted); margin: 0; }
/* anthology */
.p218-anthology { display: grid; grid-template-columns: 1fr 250px; gap: 14px; align-items: start; }
.p218-log { display: flex; flex-direction: column; gap: 10px; }
.p218-entry { display: flex; gap: 12px; align-items: center; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-soft); padding: 10px 14px; }
.p218-entry h3 { margin: 0 0 2px; font: 14px var(--mono); }
.p218-voicings code { font: 11px var(--mono); color: var(--muted); background: var(--panel); border: 1px solid var(--line-soft); border-radius: 4px; padding: 1px 5px; margin-right: 5px; }
.p218-rail { border: 1px solid var(--line); border-radius: 10px; background: var(--panel-soft); padding: 12px 14px; position: sticky; top: 0; }
.p218-rail h4 { font: 10px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin: 10px 0 8px; }
.p218-rail-row { display: flex; align-items: center; gap: 8px; font: 12px var(--mono); padding: 3px 0; }
.p218-rail-row.locked { color: var(--muted); }
.p218-rail-dot { width: 7px; height: 7px; border-radius: 50%; }
.p218-rail-count { margin-left: auto; color: var(--muted); }
/* candidates */
.p218-candidates { margin-top: 22px; border-top: 1px dashed var(--line-strong); padding-top: 14px; }
.p218-candidates h2 { font: 13px var(--mono); margin: 0 0 4px; }
.p218-candidates p { font: 12px/1.5 var(--mono); color: var(--muted); margin: 0 0 12px; }
/* bottom bar */
.p218-bar { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; background: var(--panel-deep); border: 1px solid var(--line-strong); border-radius: 999px; padding: 8px 16px; box-shadow: 0 8px 30px var(--shadow); }
.p218-bar button { background: var(--panel); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 4px 10px; cursor: pointer; font: 12px var(--mono); }
.p218-bar-label { font: 12px var(--mono); color: var(--ink); min-width: 250px; text-align: center; }
.p218-bar-toggle { display: flex; align-items: center; gap: 5px; font: 11px var(--mono); color: var(--muted); }
.p218-bar-toggle input { accent-color: var(--accent); }
.p218-reopen { position: fixed; right: 18px; top: 18px; z-index: 9000; font: 12px var(--mono); background: var(--panel-deep); border: 1px solid var(--line-strong); color: var(--ink); border-radius: 999px; padding: 8px 14px; cursor: pointer; box-shadow: 0 8px 30px var(--shadow); }
`;

export function armChordLibraryPrototype(): void {
  const variant = new URLSearchParams(location.search).get("variant");
  if (!variant || !["a", "b", "c"].includes(variant)) return;
  state.variant = variant as "a" | "b" | "c";
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);
  document.addEventListener("keydown", onKey);
  mount();
}
