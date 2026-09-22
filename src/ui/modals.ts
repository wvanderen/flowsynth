// The modals region: every dialog — settings, catalog, forge rolls,
// achievements, save export/import, reset, the honesty report, the enter
// prompt, and the session summary. One file, one renderKey vocabulary, one
// backdrop. Writes cross the seam only as intents; the enter prompt's
// scratch (kind, picked habit, typed name) and the catalog's
// show-acquired toggle are region-local state, reset where their surfaces
// open.
import { achievementName, ACHIEVEMENTS, type AchievementCategory, type AchievementContext, type AchievementDef } from "../engine/achievements";
import { cellCost, chargeDelivered, wholeNous } from "../engine/economy";
import { BALANCE, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE } from "../engine/constants";
import { forgeThreshold } from "../engine/rolls";
import { formatClock, formatDuration } from "../engine/clock";
import { formatInt, formatNumber, formatPracticeMinutes } from "./format";
import { META, RARITY_LABEL, SHELF_HINTS } from "./meta";
import { moduleFace } from "./face";
import { faceReadout, forgeWording } from "./lexicon";
import { honestyEventLine, outcomeLabel } from "./honesty";
import { byId, escapeHtml } from "./dom";
import { bindPlanControls, planControlsHtml } from "./plan";
import { projectedCountdown, type RenderContext } from "./context";
import type { ModalKind } from "./app";

// The enter prompt's kind-first selection (issue #95): the kind tab that
// holds, the habit the habit tab has picked, and the new-habit name as
// typed. Region-local scratch — reset every time the prompt opens.
export type EnterKind = "habit" | "new" | "unstructured";

interface EnterSelection {
  kind: EnterKind;
  habitId: string | null;
  newName: string;
}

const freshEnterSelection = (): EnterSelection => ({ kind: "habit", habitId: null, newName: "" });

let enterSelection = freshEnterSelection();

/** Called by App.startFlow: the kind-first selection starts fresh each open. */
export function resetEnterDraft(): void {
  enterSelection = freshEnterSelection();
}

// The catalog's show-acquired toggle — region-local view state, reset every
// time the catalog opens.
let storeShowAcquired = false;

/** Called by App.openModal: the toggle starts fresh each open. */
export function resetCatalogToggle(): void {
  storeShowAcquired = false;
}

/* ── Shell ──────────────────────────────────────────── */

// One definition per dialog: the identity that joins the render key (what
// structural change must force a rebuild) and the renderer itself.
const MODAL_DEFS: Record<NonNullable<ModalKind>, {
  identity(ctx: RenderContext): unknown;
  render(ctx: RenderContext, content: HTMLElement): void;
}> = {
  settings: { identity: () => null, render: renderSettingsModal },
  store: {
    identity: (ctx) => [
      storeShowAcquired,
      wholeNous(ctx.state),
      JSON.stringify(ctx.state.purchased),
      ctx.state.cellsBought,
      ctx.state.activatedApps.join("|"),
      // Module-upgrade rows reprice with levels, moves, and the roster.
      ctx.state.modules.map((m) => `${m.id}:${m.level}:${m.rarity}:${m.pos ? "d" : "i"}`).join("|"),
    ],
    render: renderStoreModal,
  },
  forge: { identity: (ctx) => ctx.state.bankedRolls.at(-1)?.id ?? null, render: renderForgeModal },
  achievements: {
    // Quantized progress: an open page refreshes when a bar visibly moves,
    // not on every clock tick.
    identity: (ctx) => achProgressKey(ctx),
    render: renderAchievementsModal,
  },
  export: { identity: () => null, render: renderExportModal },
  import: { identity: () => null, render: renderImportModal },
  reset: { identity: () => null, render: renderResetModal },
  honesty: {
    identity: (ctx) => [ctx.exitPending, ctx.state.session?.accounting.poolSeconds ?? 0, ctx.state.session?.accounting.bucketNous ?? 0],
    render: renderHonestyModal,
  },
  enter: {
    // The enter prompt's own selection state (issue #95): the plan and the
    // kind-first picks re-render the modal the moment they change — chips
    // highlight on pick, never a stale footer.
    identity: (ctx) => [ctx.ui.chosenTarget, enterSelection],
    render: renderEnterModal,
  },
  summary: {
    // The summary's identity: a fresh session's summary must never reuse the
    // previous one's already-rendered content.
    identity: (ctx) => [ctx.state.summary?.sessionNumber ?? null, ctx.state.summary?.earned ?? null],
    render: renderSummaryModal,
  },
};

export function renderModals(ctx: RenderContext): void {
  const backdrop = byId("modal");
  const content = byId("modal-content");
  if (!backdrop || !content) return;
  const kind = ctx.ui.modal;
  if (!kind) {
    backdrop.hidden = true;
    delete content.dataset.renderKey;
    return;
  }
  const def = MODAL_DEFS[kind];
  const renderKey = JSON.stringify([kind, ctx.ui.importError, ctx.state.session?.accounting.poolSeconds ?? 0, ctx.state.mode, def.identity(ctx)]);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) return;
  backdrop.hidden = false;
  content.dataset.renderKey = renderKey;
  def.render(ctx, content);
  const firstButton = content.querySelector("button:not([disabled])");
  (firstButton as HTMLElement | null)?.focus();
}

function modalTop(label: string): string {
  return `<div class="modal-top"><span class="eyebrow">${label}</span><button id="close-modal" aria-label="Close dialog">✕</button></div>`;
}

function wireClose(ctx: RenderContext): void {
  byId("close-modal")?.addEventListener("click", () => ctx.intents.closeModal());
}

/* ── Settings, catalog, forge ───────────────────────── */

function renderSettingsModal(ctx: RenderContext, content: HTMLElement): void {
  content.innerHTML = `${modalTop("PREFERENCES")}<h2 id="modal-title">Settings</h2>
    <p class="lead">Progress saves automatically on this device.</p>
    <div class="pref-row">
      <input type="checkbox" id="pref-mute" ${ctx.state.muted ? "checked" : ""} />
      <label for="pref-mute">Mute all sound</label>
      <small class="muted">silences every sound, the target chime included</small>
    </div>
    <div class="modal-actions"><button id="settings-export">Export save</button><button id="settings-import">Import save</button><button id="settings-reset">Reset progress</button></div>`;
  byId("pref-mute")?.addEventListener("change", (event) => {
    ctx.intents.setMuted((event.target as HTMLInputElement).checked);
  });
  for (const kind of ["export", "import", "reset"] as const) {
    byId(`settings-${kind}`)?.addEventListener("click", () => ctx.intents.openModal(kind));
  }
  wireClose(ctx);
}

function renderStoreModal(ctx: RenderContext, content: HTMLElement): void {
  const { state } = ctx;
  const shelfTypes = Object.keys(BALANCE.shelfPrices) as (keyof typeof BALANCE.shelfPrices)[];

  // One-time shelf offers on top; acquired items demote below the checkbox.
  const openShelf = shelfTypes.filter((type) => !state.purchased[type]);
  const ownedShelf = shelfTypes.filter((type) => state.purchased[type]);

  // The activation ladder (ADR-0013) rests empty at launch, so the catalog
  // omits its activation section entirely (ADR-0019): no telegraph row, no
  // pricing — after session one the hinted generator pull is the only spend
  // path. The section returns with the ladder's first tenant, priced by
  // that tenant's effort; the rung markup is not preserved here.

  // Cells (ADR-0013): the permanent catalog row. The price is not quoted
  // here — it lives where the purchase commits, on the board's frontier.
  const cellPrice = cellCost(state.cellsBought);
  const cellAffordable = wholeNous(state) >= cellPrice;
  const cellCountdown = projectedCountdown(ctx, cellPrice);

  content.innerHTML = `
    ${modalTop("CATALOG")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">${formatInt(state.nous)} ν available.</p>
    ${openShelf.length > 0 ? `
      <h3 class="store-section-title">Starter shelf</h3>
      <div class="shop-list">${openShelf.map((type) => {
        const price = BALANCE.shelfPrices[type];
        const affordable = wholeNous(state) >= price;
        const countdown = projectedCountdown(ctx, price);
        const hint = SHELF_HINTS[type];
        const moduleMeta = META[SHELF_MODULE[type]];
        return `<div class="shop-item">
          <div><h3>${moduleMeta.name}</h3><small>${moduleMeta.role}</small>${hint ? `<em class="shop-hint">${hint}</em>` : ""}</div>
          <span class="shop-buy">
            <button class="primary" data-buy="${type}" ${affordable ? "" : "disabled"}>${formatInt(price)} ν</button>
            ${countdown ? `<small class="shop-countdown mono">${countdown}</small>` : ""}
          </span>
        </div>`;
      }).join("")}</div>` : ""}
    ${openShelf.length === 0 ? `<p class="empty-copy">The shelf is empty.</p>` : ""}
    <h3 class="store-section-title">Cells</h3>
    <div class="shop-list">
      <div class="shop-item">
        <div><h3>Board cell</h3><small>Empty hexes to place modules on — you choose where it touches the board.</small></div>
        <span class="shop-buy">
          <button class="primary" id="buy-cell" ${cellAffordable ? "" : "disabled"} title="${cellAffordable ? "Arm the purchase — pick a frontier hex on the board" : "Not enough nous"}">${formatInt(cellPrice)} ν</button>
          ${cellCountdown ? `<small class="shop-countdown mono">${cellCountdown}</small>` : ""}
        </span>
      </div>
    </div>
    <p class="small muted" style="margin:6px 0 0">Each purchase raises the next price.</p>
    <label class="store-toggle"><input type="checkbox" id="store-show-acquired" ${storeShowAcquired ? "checked" : ""}/> Show acquired (${ownedShelf.length}/${shelfTypes.length})</label>
    ${storeShowAcquired && ownedShelf.length > 0 ? `
      <h3 class="store-section-title">Acquired</h3>
      <div class="shop-list store-owned">
        ${ownedShelf.map((type) => `<div class="shop-item owned"><div><h3>${META[SHELF_MODULE[type]].name}</h3><small>${META[SHELF_MODULE[type]].role}</small></div><span class="activation-owned mono">in inventory</span></div>`).join("")}
      </div>` : ""}
    <p class="modal-note">Shelf offers hide once acquired; roll copies stay, as combination material.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      ctx.intents.buyShelf(button.getAttribute("data-buy") as keyof typeof BALANCE.shelfPrices);
    });
  });
  byId("buy-cell")?.addEventListener("click", () => ctx.intents.armCellPurchase());
  byId("store-show-acquired")?.addEventListener("change", (event) => {
    storeShowAcquired = (event.target as HTMLInputElement).checked;
    // Region-local view state changed: ask the shell for a fresh pass. The
    // modal's render key reads the toggle, so exactly this dialog rebuilds.
    ctx.intents.refreshView();
  });
  wireClose(ctx);
}

function renderForgeModal(ctx: RenderContext, content: HTMLElement): void {
  const { state } = ctx;
  const offer = state.bankedRolls[state.bankedRolls.length - 1];
  const banked = state.bankedRolls.length;
  content.innerHTML = `
    <div class="modal-top"><span class="eyebrow">FORGE</span><span class="small muted">${banked} banked</span></div>
    <h2 id="modal-title" class="sr-only">Forge choice</h2>
    ${offer ? `<div class="candidates">
      ${offer.candidates.map((candidate) => `
        <button class="candidate-tile" data-choice="${candidate.id}" data-offer="${offer.id}" data-rarity="${candidate.rarity}" data-type="${candidate.type}" title="Take the ${RARITY_LABEL[candidate.rarity]} ${META[candidate.type].name}">
          <svg viewBox="-70 -70 140 140" aria-hidden="true">
            ${moduleFace({ type: candidate.type, rarity: candidate.rarity, readout: faceReadout({ type: candidate.type, rarity: candidate.rarity, level: 0 }), level: 0 })}
          </svg>
          <span class="rarity">${RARITY_LABEL[candidate.rarity]}</span>
          <span class="candidate-scaling">+${formatNumber((BALANCE.rarityPower[candidate.rarity] - 1) * 100)}% / level · upgrades from 10 ν</span>
          <span class="candidate-effect">${forgeWording(candidate.type, forgeThreshold(state.forge.earned))}</span>
        </button>`).join("")}
    </div>` : `<p class="empty-copy">No Forge choices available.</p>`}`;
  content.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      ctx.intents.chooseCandidate(button.getAttribute("data-offer")!, button.getAttribute("data-choice")!);
    });
  });
}

/* ── Save export / import / reset ───────────────────── */

function renderExportModal(ctx: RenderContext, content: HTMLElement): void {
  const text = ctx.intents.exportText();
  content.innerHTML = `
    ${modalTop("EXPORT SAVE")}
    <h2 id="modal-title">Take your progress with you.</h2>
    <p class="lead">Copy, or download as a file.</p>
    <textarea class="save-textarea" id="export-text" readonly>${text}</textarea>
    <div class="modal-actions">
      <button id="export-copy">Copy to clipboard</button>
      <button id="export-download" class="primary">Download .json</button>
    </div>`;
  byId("export-copy")?.addEventListener("click", async () => {
    const textarea = byId("export-text") as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.select();
    try {
      await navigator.clipboard.writeText(textarea.value);
      ctx.intents.say("Save copied to the clipboard.");
    } catch {
      document.execCommand("copy");
      ctx.intents.say("Save selected — copy it with ⌘C / Ctrl+C.");
    }
  });
  byId("export-download")?.addEventListener("click", () => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flowsynth-save.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
  wireClose(ctx);
}

function renderImportModal(ctx: RenderContext, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("IMPORT SAVE")}
    <h2 id="modal-title">Bring progress back.</h2>
    <p class="lead">Replaces the current instrument.</p>
    <textarea class="save-textarea" id="import-text" placeholder='{"app":"flowsynth", ...}'></textarea>
    <div class="modal-actions">
      <input type="file" id="import-file" accept="application/json,.json" style="display:none" />
      <button id="import-browse">Choose file…</button>
      <button id="import-apply" class="primary">Import</button>
    </div>
    ${ctx.ui.importError ? `<p class="import-error">${ctx.ui.importError}</p>` : ""}`;
  const textarea = byId("import-text") as HTMLTextAreaElement | null;
  const file = byId("import-file") as HTMLInputElement | null;
  byId("import-browse")?.addEventListener("click", () => file?.click());
  file?.addEventListener("change", async () => {
    const fileItem = file.files?.[0];
    if (!fileItem || !textarea) return;
    textarea.value = await fileItem.text();
  });
  byId("import-apply")?.addEventListener("click", () => {
    if (textarea) ctx.intents.importText(textarea.value);
  });
  wireClose(ctx);
}

function renderResetModal(ctx: RenderContext, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("RESET")}
    <h2 id="modal-title">Start over?</h2>
    <p class="lead">Erases everything. Export first for a backup.</p>
    <div class="modal-actions">
      <button id="reset-cancel">Keep playing</button>
      <button id="reset-confirm" class="primary" style="background:var(--danger);border-color:var(--danger)">Erase everything</button>
    </div>`;
  byId("reset-cancel")?.addEventListener("click", () => ctx.intents.closeModal());
  byId("reset-confirm")?.addEventListener("click", () => ctx.intents.hardReset());
  wireClose(ctx);
}

/* ── Achievements page ─────────────────────────────── */

// The achievements page (ADR-0015): the always-visible full list — all
// seventeen feats with progress bars, none hidden, grouped by the launch
// buckets the ADR names. Spark's progress rides the charge preview; it
// reads zero between sessions, as charge does.
const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  practice: "Practice capstones",
  console: "Console encouragers",
  board: "Board & economy",
  formula: "Formula & horizon",
  ladder: "Counter ladder",
};

const ACHIEVEMENT_CATEGORY_ORDER: readonly AchievementCategory[] = ["practice", "console", "board", "formula", "ladder"];

function achievementContextOf(ctx: RenderContext): AchievementContext {
  return { chargeDelivered: ctx.state.mode === "flow" && chargeDelivered(ctx.memo.projected()) };
}

// The open page's refresh signature: each feat's progress quantized to a
// percent, so a rebuild only happens when a bar visibly moves.
function achProgressKey(ctx: RenderContext): string {
  const achievementCtx = achievementContextOf(ctx);
  return ACHIEVEMENTS.map((def) => {
    const { current, goal } = def.progress(ctx.state, achievementCtx);
    return String(Math.round((Math.min(1, goal > 0 ? current / goal : 1)) * 100));
  }).join(",");
}

function achRowHtml(ctx: RenderContext, def: AchievementDef, achievementCtx: AchievementContext): string {
  const unlockedAt = ctx.state.achievements[def.id];
  const { current, goal } = def.progress(ctx.state, achievementCtx);
  const fraction = Math.min(1, goal > 0 ? current / goal : 1);
  const readout = unlockedAt !== undefined ? "done" : `${formatNumber(current)} / ${formatNumber(goal)}`;
  return `<div class="ach-row${unlockedAt !== undefined ? " unlocked" : ""}">
    <div class="ach-head">
      <span class="ach-name">${def.name}</span>
      <span class="ach-readout mono">${readout}</span>
    </div>
    <p class="ach-desc">${def.description}</p>
    <div class="ach-track" aria-hidden="true"><i style="width:${(fraction * 100).toFixed(1)}%"></i></div>
  </div>`;
}

function renderAchievementsModal(ctx: RenderContext, content: HTMLElement): void {
  const achievementCtx = achievementContextOf(ctx);
  const count = Object.keys(ctx.state.achievements).length;
  const sections = ACHIEVEMENT_CATEGORY_ORDER.map((category) => {
    const feats = ACHIEVEMENTS.filter((def) => def.category === category);
    if (feats.length === 0) return "";
    return `<section class="ach-section">
      <h3 class="store-section-title">${ACHIEVEMENT_CATEGORY_LABEL[category]}</h3>
      <div class="ach-grid">${feats.map((def) => achRowHtml(ctx, def, achievementCtx)).join("")}</div>
    </section>`;
  }).join("");
  content.innerHTML = `
    ${modalTop("ACHIEVEMENTS")}
    <h2 id="modal-title">${count} of ${ACHIEVEMENTS.length} feats.</h2>
    <p class="lead">Every feat speeds the rate a little — they accelerate, never gate. Each one adds into the Achievements line of the live rate breakdown.</p>
    ${sections}`;
  wireClose(ctx);
}

/* ── Honesty report (§2) ────────────────────────────── */

// The honesty report (focus-tool spec §2): the mandatory adjudication when
// a session returns with provisional time outstanding. One surface, both
// uses — mid-session and at exit (framing copy differs) — never merged into
// the dismissible summary. The away minutes and the bucket are stated up
// top; each option carries its consequences inline as its label; the answer
// banks or drops the bucket in one move. Non-dismissible (ADR-0019): it
// settles, or the player leaves and the next return re-presents it,
// recalculated.
function renderHonestyModal(ctx: RenderContext, content: HTMLElement): void {
  const session = ctx.state.session;
  const pool = session?.accounting.poolSeconds ?? 0;
  const bucket = session?.accounting.bucketNous ?? 0;
  const target = session?.target ?? null;
  const planned = target !== null;
  const hold = `${formatNumber(bucket)} ν held in the bucket`;
  const head = planned
    ? `${formatDuration(pool)} away past your plan — ${hold}.`
    : `${formatDuration(pool)} away — ${hold}.`;
  const options: { outcome: "missed" | "planned" | "full"; label: string; consequence: string }[] = [
    {
      outcome: "missed",
      label: outcomeLabel("missed"),
      consequence: `the ${formatNumber(bucket)} ν drop; those minutes don't count`,
    },
    ...(planned
      ? [
          {
            outcome: "planned" as const,
            label: outcomeLabel("planned"),
            consequence: `credit rises to your ${formatClock(target)} plan; the ν banks`,
          },
        ]
      : []),
    {
      outcome: "full",
      label: outcomeLabel("full"),
      consequence: `all ${formatDuration(pool)} count; the ν banks`,
    },
  ];
  content.innerHTML = `
    <div class="modal-top"><span class="eyebrow">${ctx.exitPending ? "BEFORE YOU WRAP UP" : "HONESTY REPORT"}</span></div>
    <h2 id="modal-title">While you were away</h2>
    <p class="lead">${head}</p>
    <p class="small muted">Nothing is final until you answer${planned ? " — only the time past your plan is waiting" : ""}. What already banked stays banked.</p>
    <div class="honesty-choices">
      ${options
        .map(
          (option) => `<button class="honesty-choice" data-honesty="${option.outcome}">
        <span class="honesty-label">${option.label}</span>
        <small class="honesty-consequence">${option.consequence}</small>
      </button>`,
        )
        .join("")}
    </div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-honesty]").forEach((button) => {
    button.addEventListener("click", () => {
      ctx.intents.resolveHonesty(button.getAttribute("data-honesty") as "missed" | "planned" | "full");
    });
  });
}

/* ── Enter prompt (§5.5, issue #92) ─────────────────── */

// The enter prompt's decided shape (issue #92, built by #95): selection is
// kind-first — a segmented `A habit | New habit | Unstructured` control, a
// pane serving the picked kind, and a sticky footer band (Back / live
// summary / `Begin — {kind} · {duration}`) whose CTA arms per the kind's
// requirement: a habit picked, a name typed, or always for unstructured. It
// carries the duration affordances from the very first start (ADR-0019,
// §6–7) — preset chips + free 1–90 entry, open-ended resting, session-one's
// steer riding above — and the renderKey fix: the modal's key rides the plan
// and the selection state, so picks re-render immediately.
// The one resolution of the selection — the only place that switches on the
// kind. The kind's requirement (a habit picked, a name typed, or nothing for
// unstructured) decides whether the session may start, and resolves its
// target: the picked habit's id, or the trimmed new-habit name.
function enterTarget(ctx: RenderContext): { armed: boolean; habitId: string | null; newName: string } {
  const { state } = ctx;
  if (enterSelection.kind === "habit") {
    const habit = enterSelection.habitId === null ? undefined : state.habits.find((h) => h.id === enterSelection.habitId && !h.archived);
    return { armed: habit !== undefined, habitId: habit?.id ?? null, newName: "" };
  }
  if (enterSelection.kind === "new") {
    const newName = enterSelection.newName.trim();
    return { armed: newName !== "", habitId: null, newName };
  }
  return { armed: true, habitId: null, newName: "" };
}

interface EnterFootprint {
  armed: boolean;
  summary: string;
  cta: string;
}

// The footer band's current content, read off the shared resolution.
function enterFootprint(ctx: RenderContext): EnterFootprint {
  const duration = ctx.ui.chosenTarget === null ? "open-ended" : `${Math.round(ctx.ui.chosenTarget / 60)} min`;
  const target = enterTarget(ctx);
  if (!target.armed) {
    return enterSelection.kind === "new"
      ? { armed: false, summary: "name it to arm the start", cta: "Name your new habit" }
      : { armed: false, summary: "no habit picked yet", cta: "Select a habit" };
  }
  const what = target.newName
    ? target.newName
    : target.habitId === null
      ? "unstructured"
      : (ctx.state.habits.find((h) => h.id === target.habitId)?.name ?? "unstructured");
  return { armed: true, summary: `${what} · ${duration}`, cta: `Begin — ${what} · ${duration}` };
}

// The footprint's summary and CTA carry user-typed names; anything these
// strings feed as markup must escape them (the in-place footer refresh sets
// textContent, which must stay raw).
const escapeFootprint = (footprint: EnterFootprint): EnterFootprint => ({
  ...footprint,
  summary: escapeHtml(footprint.summary),
  cta: escapeHtml(footprint.cta),
});

function renderEnterModal(ctx: RenderContext, content: HTMLElement): void {
  const { state } = ctx;
  const enter = enterSelection;
  const habits = state.habits.filter((h) => !h.archived);
  const footprint = escapeFootprint(enterFootprint(ctx));
  const kindTab = (kind: EnterKind, label: string) =>
    `<button class="mode-tab${enter.kind === kind ? " active" : ""}" data-enter-kind="${kind}" aria-pressed="${enter.kind === kind}">${label}</button>`;
  let pane = "";
  if (enter.kind === "habit") {
    pane = habits.length === 0
      ? `<p class="mode-explain">No habits yet — the New habit tab names your first.</p>`
      : `<div class="enter-choices">
      ${habits
        .map(
          (habit) => `<button class="enter-choice${enter.habitId === habit.id ? " selected" : ""}" data-enter-habit="${habit.id}" aria-pressed="${enter.habitId === habit.id}">
        <span class="dot"></span>
        <span class="enter-choice-name">${escapeHtml(habit.name)}</span>
        <small class="mono">${formatDuration(habit.seconds)}</small>
      </button>`,
        )
        .join("")}
    </div>
    <p class="mode-explain">Pick the habit this session counts toward.</p>`;
  } else if (enter.kind === "new") {
    pane = `<div class="enter-create">
      <input type="text" id="enter-habit-name" placeholder="Name it (piano, cooking…)" maxlength="40" aria-label="Name a new habit and start the session with it" value="${escapeHtml(enter.newName)}" />
    </div>
    <p class="mode-explain">A brand-new habit starts its clock with this session.</p>`;
  } else {
    pane = `<p class="mode-explain">No habit attached — the session runs, and nous is unaffected.</p>`;
  }
  content.innerHTML = `
    ${modalTop("ENTER FLOW")}
    <div class="enter-body">
      <h2 id="modal-title">What are you practicing?</h2>
      <div class="mode-tabs" role="group" aria-label="What kind of session is this?">
        ${kindTab("habit", "A habit")}${kindTab("new", "New habit")}${kindTab("unstructured", "Unstructured")}
      </div>
      <div class="mode-pane">${pane}</div>
      ${state.sessionsCompleted === 0 ? `<p class="enter-steer small muted">A first try can be short — five minutes or so, then exit and see what the session banked.</p>` : ""}
      ${planControlsHtml(ctx)}
    </div>
    <div class="footer-band">
      <button id="enter-cancel" class="small">Back</button>
      <span class="cta-summary">${footprint.summary}</span>
      <button id="enter-begin" class="primary" ${footprint.armed ? "" : "disabled"}>${footprint.cta}</button>
    </div>`;
  bindPlanControls(ctx, content);
  // The same shared resolution arms the action: a typed name rides the
  // new-habit path; otherwise the target is the picked habit's id, with null
  // meaning unstructured rides beginFlow directly.
  const begin = () => {
    const target = enterTarget(ctx);
    if (!target.armed) return;
    if (target.newName) ctx.intents.beginFlowNewHabit(target.newName);
    else ctx.intents.beginFlow(target.habitId);
  };
  content.querySelectorAll<HTMLButtonElement>("[data-enter-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      enterSelection.kind = button.getAttribute("data-enter-kind") as EnterKind;
      ctx.intents.refreshView();
    });
  });
  content.querySelectorAll<HTMLElement>("[data-enter-habit]").forEach((button) => {
    button.addEventListener("click", () => {
      enterSelection.habitId = button.getAttribute("data-enter-habit");
      ctx.intents.refreshView();
    });
  });
  const nameInput = byId("enter-habit-name") as HTMLInputElement | null;
  // Typing never rebuilds the modal (nothing renders in the background while
  // the console sits in upgrade mode): the name rides the region's draft and
  // the footer refreshes in place, so the caret keeps its place while the
  // CTA arms. The next interaction that does render rebuilds with the name
  // kept.
  const refreshFootprint = () => {
    const next = enterFootprint(ctx);
    const summary = content.querySelector(".cta-summary");
    const beginButton = byId("enter-begin");
    if (summary) summary.textContent = next.summary;
    if (beginButton) {
      beginButton.textContent = next.cta;
      (beginButton as HTMLButtonElement).disabled = !next.armed;
    }
  };
  nameInput?.addEventListener("input", () => {
    enterSelection.newName = nameInput.value;
    refreshFootprint();
  });
  nameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      if (enterTarget(ctx).armed) begin();
    }
  });
  byId("enter-begin")?.addEventListener("click", begin);
  byId("enter-cancel")?.addEventListener("click", () => ctx.intents.closeModal());
  wireClose(ctx);
}

/* ── Session summary (§5.7, §8) ─────────────────────── */

// The loud summary (§5.7, §8): shown once per session end, however the
// session ended — final numbers only. The headline is banked nous; practice
// time shows credited minutes in the history list's format; the honesty
// events sit beneath as neutral factual lines, where a dropped bucket's
// drop is visible — and there is no raw wall-duration row. The reflection's
// reserved slot rides above dismissal: free text plus a five-position
// rough–great slider, end labels only, middle neutral and the default. It
// records as either field is touched and stays absent otherwise, so every
// dismissal path — Continue, ✕, backdrop, Esc — logs the same.
function renderSummaryModal(ctx: RenderContext, content: HTMLElement): void {
  const summary = ctx.state.summary;
  if (!summary) {
    content.innerHTML = `${modalTop("SESSION SUMMARY")}<h2 id="modal-title">No session to summarize.</h2>`;
    wireClose(ctx);
    return;
  }
  const carrierOnly = summary.harmonics === 0 && summary.chordMultiplier === 1 && summary.empowerment === 1;
  const breakdown = carrierOnly
    ? `the carrier term alone — ${formatNumber(summary.carrier)} ν/s is the whole formula`
    : [
        `carrier +${formatNumber(summary.carrier)} ν/s`,
        ...(summary.harmonics > 0 ? [`harmonics +${formatNumber(summary.harmonics)} ν/s`] : []),
        ...(summary.chordMultiplier > 1 ? [`chords ×${formatNumber(summary.chordMultiplier)}`] : []),
        ...(summary.empowerment > 1 ? [`empowerment ×${formatNumber(summary.empowerment)}`] : []),
      ].join(" · ");
  // The "unlocked this session" row (ADR-0015): in-session unlocks queue
  // here instead of toasting, whatever the exit path.
  const unlocked = (summary.achievements ?? []).map(achievementName);
  const unlockRow = unlocked.length > 0
    ? `<div class="summary-row unlock">
        <span class="summary-label">Unlocked this session</span>
        <strong>${unlocked.join(" · ")}</strong>
      </div>`
    : "";
  const events = (summary.honestyEvents ?? [])
    .map((event) => `<p class="summary-event">${honestyEventLine(event)}</p>`)
    .join("");
  const reflection = summary.reflection;
  content.innerHTML = `
    ${modalTop(`SESSION ${summary.sessionNumber} · SUMMARY`)}
    <h2 id="modal-title" class="summary-headline">This session earned <strong class="mono">${formatNumber(summary.earned)}</strong> nous</h2>
    <div class="summary-rows">
      <div class="summary-row">
        <span class="summary-label">Practice time</span>
        <strong class="mono">${formatPracticeMinutes(summary.seconds, summary.plannedTarget ?? null)}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">Rate achieved</span>
        <strong class="mono">${formatNumber(summary.ratePerMinute)} ν <small>per practice minute</small></strong>
        <small class="summary-note">${breakdown}</small>
      </div>
      ${unlockRow}
      ${summary.timeUnlocked
        ? `<div class="summary-row unlock">
        <span class="summary-label">New feature unlocked</span>
        <strong>Time your flow sessions</strong>
        <small class="summary-note">The Time app is live.</small>
      </div>`
        : ""}
    </div>
    ${events ? `<div class="summary-events">${events}</div>` : ""}
    <div class="summary-reflection">
      <span class="summary-label">How did it go?</span>
      <input type="text" id="summary-reflection-text" aria-label="Reflect on the session in words" value="${escapeHtml(reflection?.text ?? "")}" />
      <div class="reflection-slider">
        <span class="reflection-end">rough</span>
        <input type="range" id="summary-reflection-slider" min="1" max="${REFLECTION_SLIDER_POSITIONS}" step="1" value="${reflection?.slider ?? REFLECTION_SLIDER_NEUTRAL}" aria-label="How the session went, rough to great" />
        <span class="reflection-end">great</span>
      </div>
    </div>
    <div class="modal-actions"><button id="summary-continue" class="primary">Continue</button></div>`;
  byId("summary-reflection-text")?.addEventListener("input", (event) => {
    ctx.intents.recordReflectionText((event.target as HTMLInputElement).value);
  });
  byId("summary-reflection-slider")?.addEventListener("input", (event) => {
    ctx.intents.recordReflectionSlider(Number((event.target as HTMLInputElement).value));
  });
  byId("summary-continue")?.addEventListener("click", () => ctx.intents.dismissSummary());
  wireClose(ctx);
}
