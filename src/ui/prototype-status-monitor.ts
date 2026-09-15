// PROTOTYPE — wayfinder ticket #27 (map #9). Throwaway; never merge to main.
//
// Three variants of the status monitor (the formula-bar area becoming the grid
// machine's scoring-and-progression readout), switchable via ?variant= on the
// main route. Hard cap of three elements, per the pinned scope:
//   formula (now) · Forge meter (this stretch) · Arete accumulator (the era)
// While a variant is active the grid overview panel is dissolved (its stats
// dispositioned per #27) and the static formula explainer is replaced by
// progressive disclosure on the formula itself.
//   A — Faceplate rail: three cells in one strip, era widest
//   B — Readout stack: labeled NOW / STRETCH / ERA rows
//   C — Horizon rail: the accumulator is the monitor; the rest docks onto it
// The 100k horizon, all hues, and the term mapping are provisional.
import { computeRates } from "../engine/economy";
import { forgeThreshold } from "../engine/rolls";
import type { App } from "./app";
import { moduleIcon } from "./icons";
import { fmt } from "./meta";
import "./prototype-status-monitor.css";

export type StatusVariant = "A" | "B" | "C";

const VARIANTS: StatusVariant[] = ["A", "B", "C"];
const VARIANT_NAMES: Record<StatusVariant, string> = {
  A: "Faceplate rail",
  B: "Readout stack",
  C: "Horizon rail",
};

// Provisional accumulator scale: lifetime ν from a 10 ν log floor up to the
// first prestige threshold (the horizon). Graduations are inert decade marks.
const LOG_START = 10;
const HORIZON = 100_000;
const GRADUATIONS = [100, 1_000, 10_000];

export function prototypeVariant(): StatusVariant | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("variant");
  if (raw === null) return null;
  const v = raw.toUpperCase();
  return (VARIANTS as string[]).includes(v) ? (v as StatusVariant) : "A";
}

interface MonitorData {
  carrier: number;
  harmonics: number;
  chord: number;
  empowerment: number;
  rate: number;
  forgeProgress: number;
  forgeThreshold: number;
  total: number;
  fill: number;
  nextValue: number;
  sessions: number;
}

function monitorData(app: App): MonitorData {
  const { state } = app;
  const snap = computeRates(state, state.mode === "upgrade" ? false : undefined);
  const sumBy = (type: string) => {
    let total = 0;
    for (const c of snap.contributions.values()) if (c.type === type) total += c.value;
    return total;
  };
  const total = state.totalEarned;
  const logPos = (v: number) =>
    (Math.log10(Math.max(v, LOG_START)) - Math.log10(LOG_START)) / (Math.log10(HORIZON) - Math.log10(LOG_START));
  const nextValue = GRADUATIONS.find((g) => g > total) ?? HORIZON;
  return {
    carrier: sumBy("enter"),
    harmonics: sumBy("additive"),
    chord: 1 + sumBy("conditional"),
    empowerment: 1 + sumBy("time"),
    rate: snap.rate,
    forgeProgress: Math.max(0, state.forge.progress),
    forgeThreshold: forgeThreshold(state.forge.earned),
    total,
    fill: Math.min(1, Math.max(0, logPos(total))),
    nextValue,
    sessions: state.sessionsCompleted,
  };
}

function kfmt(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1_000) return `${v / 1_000}k`;
  return String(v);
}

function beatReadout(d: MonitorData): string {
  if (d.total >= HORIZON) return "Arete minted — the horizon is behind you";
  const label = d.nextValue === HORIZON ? "the horizon" : kfmt(d.nextValue);
  if (d.rate <= 0) return `next mark ${label} · waits for practice`;
  const seconds = (d.nextValue - d.total) / d.rate;
  const span =
    seconds < 5400
      ? `${Math.max(1, Math.round(seconds / 60))}m`
      : seconds < 3600 * 48
        ? `${Math.round(seconds / 3600)}h`
        : `${Math.round(seconds / 86400)}d`;
  return `next mark ${label} · ≈${span} of practice at this rate`;
}

function term(type: "enter" | "additive", value: number, name: string): string {
  return `<span class="sm-term" title="${name}"><svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>${fmt(value)}</span>`;
}

function formulaHtml(d: MonitorData): string {
  return `<div class="sm-formula" tabindex="0" aria-label="Live nous formula — focus for the breakdown">
    <span class="sm-equation mono">
      <span class="op">(</span>${term("enter", d.carrier, "Carrier")}<span class="op">+</span>${term("additive", d.harmonics, "Harmonics")}<span class="op">)</span>
      <span class="op">×${fmt(d.chord, 2)}</span>
      <span class="op">×${fmt(d.empowerment, 2)}</span>
      <span class="op">=</span><strong>${fmt(d.rate)} ν/s</strong>
    </span>
    <span class="sm-hint" aria-hidden="true">ⓘ</span>
    <div class="sm-breakdown" role="tooltip">
      <div class="sm-breakdown-row"><span class="sm-bk-name">Carrier</span><span class="mono">+${fmt(d.carrier)} ν/s</span><span class="sm-bk-note">the origin synth's fundamental</span></div>
      <div class="sm-breakdown-row"><span class="sm-bk-name">Harmonics</span><span class="mono">+${fmt(d.harmonics)} ν/s</span><span class="sm-bk-note">every other synth on the board</span></div>
      <div class="sm-breakdown-row"><span class="sm-bk-name">Chord</span><span class="mono">×${fmt(d.chord, 2)}</span><span class="sm-bk-note">consecutive-pitch pairs sounding together</span></div>
      <div class="sm-breakdown-row"><span class="sm-bk-name">Empowerment</span><span class="mono">×${fmt(d.empowerment, 2)}</span><span class="sm-bk-note">charge and infusor uplift</span></div>
      <div class="sm-breakdown-row total"><span class="sm-bk-name">Rate</span><span class="mono">${fmt(d.rate)} ν/s</span><span class="sm-bk-note">composite × empowerment</span></div>
    </div>
  </div>`;
}

function forgeHtml(d: MonitorData): string {
  const frac = Math.min(1, d.forgeProgress / d.forgeThreshold);
  return `<div class="sm-forge">
    <div class="sm-forge-bar" role="img" aria-label="Forge progress"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
    <span class="sm-forge-val mono">${fmt(d.forgeProgress, 1)} / ${fmt(d.forgeThreshold, 0)}</span>
  </div>`;
}

// The Arete accumulator: log-scale fill on lifetime ν with inert decade
// graduations, a horizon cap, the paced-beat readout, and the secondaries.
function accumulatorHtml(d: MonitorData, opts: { head?: boolean } = {}): string {
  const grads = GRADUATIONS.map((g) => `<i class="am-grad" style="left:${(monitorFill(g) * 100).toFixed(2)}%"><b>${kfmt(g)}</b></i>`).join("");
  const head =
    opts.head && d.total < HORIZON
      ? `<span class="am-head${d.fill > 0.68 ? " flip" : ""}" style="left:${(d.fill * 100).toFixed(2)}%">${beatReadout(d)}</span>`
      : "";
  const beat = opts.head && d.total < HORIZON ? "" : `<span class="am-beat">${beatReadout(d)}</span>`;
  const arete = d.total >= HORIZON ? `<span class="am-arete">Arete minted</span>` : `<span class="am-arete">Arete 0</span>`;
  return `<div class="am-accumulator">
    <div class="am-track" role="img" aria-label="Arete accumulator: ${fmt(d.total)} of ${kfmt(HORIZON)} lifetime ν (log scale)">
      <i class="am-fill" style="width:${(d.fill * 100).toFixed(2)}%"></i>${grads}<i class="am-horizon"></i>${head}
    </div>
    <div class="am-under">
      ${beat}
      <span class="am-secondary mono">${d.sessions} sessions · ${arete}</span>
    </div>
  </div>`;
}

function monitorFill(v: number): number {
  return Math.min(1, Math.max(0, (Math.log10(Math.max(v, LOG_START)) - Math.log10(LOG_START)) / (Math.log10(HORIZON) - Math.log10(LOG_START))));
}

// ── Variant A — Faceplate rail ────────────────────────────────────────────
// Three cells of one instrument strip; the era takes the most width.
function variantA(app: App): string {
  const d = monitorData(app);
  return `<div class="sm-variant sm-a">
    <section class="sm-cell now"><header><span class="sm-when">now</span><span class="sm-what">nous</span></header>${formulaHtml(d)}</section>
    <section class="sm-cell stretch"><header><span class="sm-when">this stretch</span><span class="sm-what">Forge</span></header>${forgeHtml(d)}</section>
    <section class="sm-cell era"><header><span class="sm-when">the era</span><span class="sm-what">Arete</span></header>${accumulatorHtml(d)}</section>
  </div>`;
}

// ── Variant B — Readout stack ─────────────────────────────────────────────
// Labeled rows; the three timescales are named, the era row spans below.
function variantB(app: App): string {
  const d = monitorData(app);
  return `<div class="sm-variant sm-b">
    <div class="sm-row"><span class="sm-row-label">now</span><div class="sm-row-body">${formulaHtml(d)}</div></div>
    <div class="sm-row"><span class="sm-row-label">this stretch</span><div class="sm-row-body">${forgeHtml(d)}</div></div>
    <div class="sm-row era"><span class="sm-row-label">the era</span><div class="sm-row-body">${accumulatorHtml(d)}</div></div>
  </div>`;
}

// ── Variant C — Horizon rail ──────────────────────────────────────────────
// The accumulator is the monitor: one full-width rail, formula and Forge
// docked as chips on its top edge, the beat readout riding the fill head.
function variantC(app: App): string {
  const d = monitorData(app);
  return `<div class="sm-variant sm-c">
    <div class="sm-c-top">
      ${formulaHtml(d)}
      <div class="sm-c-chips">
        <div class="sm-chip forge"><span class="sm-chip-label">Forge</span>${forgeHtml(d)}</div>
        <div class="sm-chip era"><span class="sm-chip-label">Arete · ${kfmt(HORIZON)}</span></div>
      </div>
    </div>
    ${accumulatorHtml(d, { head: true })}
  </div>`;
}

let boundApp: App | null = null;

export function renderStatusMonitor(app: App): void {
  const variant = prototypeVariant();
  if (!variant) return;
  const host = document.getElementById("rate-formula");
  if (!host) return;
  host.style.overflow = "visible";
  const html = variant === "A" ? variantA(app) : variant === "B" ? variantB(app) : variantC(app);
  if (host.dataset.protoKey !== `${variant}:${html}`) {
    host.dataset.protoKey = `${variant}:${html}`;
    host.innerHTML = html;
  }
  ensureSwitcher(app, variant);
}

function cycle(app: App, dir: 1 | -1): void {
  const current = prototypeVariant() ?? "A";
  const next = VARIANTS[(VARIANTS.indexOf(current) + dir + VARIANTS.length) % VARIANTS.length]!;
  const params = new URLSearchParams(window.location.search);
  params.set("variant", next);
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  app.render();
}

function ensureSwitcher(app: App, variant: StatusVariant): void {
  boundApp = app;
  let bar = document.getElementById("proto-switcher");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "proto-switcher";
    bar.innerHTML = `
      <div class="proto-nav">
        <button data-dir="-1" aria-label="Previous variant">◀</button>
        <span class="proto-label mono"></span>
        <button data-dir="1" aria-label="Next variant">▶</button>
      </div>
      <div class="proto-sim">
        <span class="proto-sim-label">sim total ν</span>
        ${[350, 1_000, 10_000, 100_000, 1_000_000].map((v) => `<button data-sim="${v}">${kfmt(v)}</button>`).join("")}
      </div>`;
    bar.addEventListener("click", (event) => {
      const app2 = boundApp;
      if (!app2) return;
      const target = event.target as HTMLElement;
      const dir = target.closest("button")?.dataset.dir;
      const sim = target.closest("button")?.dataset.sim;
      if (dir === "1" || dir === "-1") cycle(app2, dir === "1" ? 1 : -1);
      if (sim) {
        app2.state.totalEarned = Number(sim);
        app2.render();
      }
    });
    window.addEventListener("keydown", (event) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      const app2 = boundApp;
      if (!app2) return;
      if (event.key === "ArrowLeft") cycle(app2, -1);
      if (event.key === "ArrowRight") cycle(app2, 1);
    });
    document.body.append(bar);
  }
  const label = bar.querySelector<HTMLElement>(".proto-label");
  if (label) label.textContent = `${variant} (${VARIANT_NAMES[variant]})`;
}

// The grid overview dissolves while prototyping; the inspector keeps only an
// empty state when nothing is selected.
export function renderDissolvedOverview(host: HTMLElement): void {
  host.innerHTML = `<div class="proto-dissolved">
    <p class="eyebrow">Inspector</p>
    <p class="small muted" style="margin-top:10px">Select a module to inspect it. Scoring and progression live on the status monitor beneath the grid.</p>
  </div>`;
}
