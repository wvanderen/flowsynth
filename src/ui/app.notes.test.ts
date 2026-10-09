// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { writeNote } from "../engine/notes";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { createAppFixture } from "./testing/app-fixture";

// The notes sheet in the Focus frame (ADR-0050, issue #277): CAPTURE |
// LOGGED tabs opening on CAPTURE, the live tag chip riding the composer in
// flow, and stream rows led by the mono stamp and habit chip. The sheet
// carries no generator documentation — that lives on the module itself.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const DAY = new Date(2026, 8, 18, 12).getTime();
const sheet = () => document.getElementById("app-popover")!;

function openNotes(): HTMLElement {
  app.openApp("notes");
  return sheet();
}

function openLogged(): HTMLElement {
  sheet().querySelector<HTMLButtonElement>('[data-notes-face="logged"]')!.click();
  return sheet();
}

describe("the notes sheet's frame and faces", () => {
  it("opens on CAPTURE in the Focus frame under the clock; the tabs are radio-like", () => {
    const frame = openNotes();
    expect(frame.classList.contains("focus-sheet")).toBe(true);
    expect(document.getElementById("console-session")!.contains(frame)).toBe(true);
    // CAPTURE leads: pressed, with the composer standing, no stream below.
    expect(frame.querySelector('[data-notes-face="capture"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(frame.querySelector("#note-composer")).not.toBeNull();
    expect(frame.querySelector(".note-entry")).toBeNull();
    // LOGGED carries the stream; the frame never closes across faces.
    openLogged();
    expect(app.ui.app).toBe("notes");
    expect(sheet().querySelector('[data-notes-face="logged"]')!.getAttribute("aria-pressed")).toBe("true");
    // A re-press of the standing face does nothing.
    sheet().querySelector<HTMLButtonElement>('[data-notes-face="logged"]')!.click();
    expect(app.ui.notesFace).toBe("logged");
  });

  it("the sheet opens on CAPTURE again after any departure", () => {
    openNotes();
    openLogged();
    expect(app.ui.notesFace).toBe("logged");
    // Another app's face standing puts the tab back.
    app.openApp("habit");
    app.openApp("notes");
    expect(app.ui.notesFace).toBe("capture");
    expect(sheet().querySelector('[data-notes-face="capture"]')!.getAttribute("aria-pressed")).toBe("true");
    // So does a close.
    openLogged();
    app.closeApp();
    app.openApp("notes");
    expect(app.ui.notesFace).toBe("capture");
    app.closeApp();
  });

  it("the head names the sheet and the session a flow capture tags to", () => {
    expect(openNotes().querySelector(".focus-state")!.textContent).toBe("stream");
    startSession(app.state, null, DAY);
    advance(app.state, 30);
    app.render();
    expect(sheet().querySelector(".focus-state")!.textContent).toBe("session 1");
  });
});

describe("capturing from the sheet", () => {
  it("keeps the draft and editing position when the planned timer reaches its target", () => {
    startSession(app.state, 60, DAY);
    advance(app.state, 59);
    openNotes();
    const composer = document.getElementById("note-composer") as HTMLTextAreaElement;
    composer.value = "Still writing this thought";
    composer.focus();
    composer.setSelectionRange(6, 13, "backward");
    advance(app.state, 2);
    app.render();
    const fresh = document.getElementById("note-composer") as HTMLTextAreaElement;
    expect(fresh.value).toBe("Still writing this thought");
    expect([fresh.selectionStart, fresh.selectionEnd, fresh.selectionDirection]).toEqual([6, 13, "backward"]);
    expect(document.activeElement).toBe(fresh);
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes.map((n) => n.text)).toEqual(["Still writing this thought"]);
    expect((document.getElementById("note-composer") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps an unsaved draft across pause and resume without stealing control focus", () => {
    startSession(app.state, null, DAY);
    openNotes();
    (document.getElementById("note-composer") as HTMLTextAreaElement).value = "Pause this thought";
    for (const mode of ["paused", "flow"] as const) {
      const pause = document.getElementById("pause-flow") as HTMLButtonElement;
      pause.focus();
      pause.click();
      expect(app.state.mode).toBe(mode);
      expect((document.getElementById("note-composer") as HTMLTextAreaElement).value).toBe("Pause this thought");
      expect(document.activeElement?.id).not.toBe("note-composer");
    }
  });

  it("the button lands the note, keeps CAPTURE standing, and refocuses the fresh composer", () => {
    openNotes();
    const composer = document.getElementById("note-composer") as HTMLTextAreaElement;
    composer.value = "First thought";
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes.map((n) => n.text)).toEqual(["First thought"]);
    expect(app.ui.notesFace).toBe("capture");
    const fresh = document.getElementById("note-composer") as HTMLTextAreaElement;
    expect(fresh.value).toBe("");
    expect(document.activeElement).toBe(fresh);
    app.closeApp();
  });

  it("⌘/Ctrl+Enter captures from the composer", () => {
    openNotes();
    const composer = document.getElementById("note-composer") as HTMLTextAreaElement;
    composer.value = "Keyed in";
    composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true, cancelable: true }));
    expect(app.state.notes.map((n) => n.text)).toEqual(["Keyed in"]);
    app.closeApp();
  });

  it("an empty composer lands nothing", () => {
    openNotes();
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes).toHaveLength(0);
    expect(app.ui.app).toBe("notes");
    app.closeApp();
  });
});

describe("the live tag chip rides the composer (§9, #277)", () => {
  it("flow wears the session habit's chip; unstructured flow and upgrade mode wear none", () => {
    const s = app.state;
    // Upgrade mode: notes go untagged, no chip.
    expect(openNotes().querySelector(".note-live-tag")).toBeNull();
    app.closeApp();
    // Flow with a habit: the chip names the tag the note will carry.
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    advance(s, 30);
    app.render();
    const chip = openNotes().querySelector(".note-live-tag")!;
    expect(chip.textContent).toBe("· PIANO");
    app.closeApp();
    endSession(s, DAY + 120_000);
    // Unstructured flow: nothing to tag, no chip — the selection clears
    // between sessions (the engine locks it in flow).
    selectHabit(s, null);
    startSession(s, null, DAY + 200_000);
    advance(s, 15);
    app.render();
    expect(openNotes().querySelector(".note-live-tag")).toBeNull();
    app.closeApp();
  });

  it("capturing tags follow the chip: flow notes wear the habit, upgrade notes wear none", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    advance(s, 30);
    openNotes();
    (document.getElementById("note-composer") as HTMLTextAreaElement).value = "in flow";
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    app.closeApp();
    endSession(s, DAY + 120_000);
    app.render();
    openNotes();
    (document.getElementById("note-composer") as HTMLTextAreaElement).value = "between sessions";
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes.map((n) => n.habitId)).toEqual([habit.id, null]);
    app.closeApp();
  });
});

describe("the LOGGED stream's rows (§9)", () => {
  it("rows lead with the mono stamp, then the habit chip, then the note", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    writeNote(s, "tagged", DAY + 1000);
    s.activeHabitId = null;
    writeNote(s, "untagged", DAY + 2000);
    endSession(s, DAY + 120_000);
    openNotes();
    const frame = openLogged();
    const rows = [...frame.querySelectorAll(".note-entry")];
    expect(rows).toHaveLength(2);
    // Newest first.
    expect(rows[0]!.querySelector("p")!.textContent).toBe("untagged");
    const [tagged] = [rows[1]!];
    const stamp = tagged.querySelector(".note-when")!;
    const chip = tagged.querySelector(".habit-chip")!;
    const text = tagged.querySelector("p")!;
    expect(stamp.classList.contains("mono")).toBe(true);
    expect(stamp.textContent).toContain("S1 ·");
    expect(chip.textContent).toBe("Piano");
    expect(stamp.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    app.closeApp();
  });

  it("an empty stream renders no furniture", () => {
    openNotes();
    const frame = openLogged();
    expect(frame.querySelector(".note-entry")).toBeNull();
    // Head, state word, tabs — and nothing else.
    expect(frame.querySelector(".inst-panel-face")!.textContent!.replace(/\s+/g, " ").trim()).toBe("NOTES stream CAPTURELOGGED");
    app.closeApp();
  });
});

describe("the sheet carries no generator documentation", () => {
  it("the Note Generator's mechanic lives on the module, never as sheet furniture", () => {
    const frame = openNotes();
    // No tooltip trigger or body, and no prose naming the mechanic — the
    // capture row is chip and button alone (the forge readout documents
    // the credit).
    expect(frame.querySelector(".inst-tip")).toBeNull();
    expect(frame.textContent).not.toContain("Note Generator");
    const row = frame.querySelector(".note-capture-row")!;
    expect(row.querySelectorAll("button")).toHaveLength(1);
    expect(row.querySelector("#note-save")).not.toBeNull();
    app.closeApp();
  });
});
