// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { writeNote } from "../engine/notes";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { createAppFixture } from "./testing/app-fixture";

// The notes modal (issue #332, amending ADR-0050's shared anchored frame):
// a centered modal composition opening on CAPTURE, LOGGED retained, the
// live tag chip riding the composer in flow, and stream rows led by the
// mono stamp and habit chip. The dialog blocks the board, manages its own
// focus ring, and hands focus back to the door on dismissal. It carries no
// generator documentation — that lives on the module itself.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const DAY = new Date(2026, 8, 18, 12).getTime();
const backdrop = () => document.getElementById("modal")!;
const sheet = () => document.getElementById("modal-content")!;

function openNotes(): HTMLElement {
  app.openApp("notes");
  return sheet();
}

function openLogged(): HTMLElement {
  sheet().querySelector<HTMLButtonElement>('[data-notes-face="logged"]')!.click();
  return sheet();
}

describe("the notes modal's frame and faces", () => {
  it("opens as a centered modal on CAPTURE, independent of the clock or door; the tabs are radio-like", () => {
    const frame = openNotes();
    // The modal layer owns it: backdrop standing, dialog semantics, and
    // nothing anchored under the clock or in the door's slot.
    expect(backdrop().hidden).toBe(false);
    expect(backdrop().getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById("app-popover")).toBeNull();
    expect(document.getElementById("console-session")!.querySelector(".app-popover")).toBeNull();
    // CAPTURE leads: pressed, with the composer standing, no stream below.
    expect(frame.querySelector('[data-notes-face="capture"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(frame.querySelector("#note-composer")).not.toBeNull();
    expect(frame.querySelector(".note-entry")).toBeNull();
    // LOGGED carries the stream; the dialog never closes across faces.
    openLogged();
    expect(app.ui.modal).toBe("notes");
    expect(sheet().querySelector('[data-notes-face="logged"]')!.getAttribute("aria-pressed")).toBe("true");
    // A re-press of the standing face does nothing.
    sheet().querySelector<HTMLButtonElement>('[data-notes-face="logged"]')!.click();
    expect(app.ui.notesFace).toBe("logged");
    app.closeModal();
  });

  it("the modal opens on CAPTURE again after any departure", () => {
    openNotes();
    openLogged();
    expect(app.ui.notesFace).toBe("logged");
    app.closeModal();
    // A close puts the tab back.
    openNotes();
    expect(app.ui.notesFace).toBe("capture");
    // So does another surface standing first.
    openLogged();
    app.openApp("habit");
    expect(app.ui.app).toBe("habit");
    openNotes();
    expect(app.ui.notesFace).toBe("capture");
    expect(sheet().querySelector('[data-notes-face="capture"]')!.getAttribute("aria-pressed")).toBe("true");
    app.closeModal();
  });

  it("the head names the modal and the session a flow capture tags to", () => {
    expect(openNotes().querySelector("#modal-title")!.textContent).toBe("NOTES");
    expect(sheet().querySelector(".notes-modal-state")!.textContent).toBe("stream");
    startSession(app.state, null, DAY);
    advance(app.state, 30);
    app.render();
    expect(sheet().querySelector(".notes-modal-state")!.textContent).toBe("session 1");
    app.closeModal();
  });

  it("the door toggles: a second press puts the modal away", () => {
    document.getElementById("app-tile-notes")!.click();
    expect(app.ui.modal).toBe("notes");
    document.getElementById("app-tile-notes")!.click();
    expect(app.ui.modal).toBeNull();
    expect(backdrop().hidden).toBe(true);
  });

  it("✕, Escape (even from the composer), and a backdrop click dismiss; focus returns to the door", () => {
    const door = () => document.getElementById("app-tile-notes")!;
    door().focus();
    openNotes();
    expect(document.activeElement).toBe(document.getElementById("note-composer"));
    // Escape from the composer — the modal's keyboard exit works while typing.
    const composer = document.getElementById("note-composer") as HTMLTextAreaElement;
    composer.value = "A draft";
    composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(app.ui.modal).toBeNull();
    expect(backdrop().hidden).toBe(true);
    expect(document.activeElement).toBe(door());
    // Escape from a button.
    openNotes();
    sheet().querySelector<HTMLButtonElement>('[data-notes-face="logged"]')!.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(door());
    // The ✕ control.
    openNotes();
    sheet().querySelector<HTMLButtonElement>("#close-modal")!.click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(door());
    // A backdrop click — outside the dialog.
    openNotes();
    backdrop().click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(door());
    // A door the render replaced falls back to the fresh one.
    openNotes();
    app.render();
    sheet().querySelector<HTMLButtonElement>("#close-modal")!.click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(door());
  });

  it("keyboard focus stays managed inside the dialog: Tab wraps both ways", () => {
    openNotes();
    const content = sheet();
    const tab = (shift: boolean): void => {
      content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true }));
    };
    const focusables = (): HTMLElement[] =>
      [...content.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])")];
    const ring = focusables();
    const [first, last] = [ring[0]!, ring[ring.length - 1]!];
    // Forward from the last control wraps to the first.
    last.focus();
    tab(false);
    expect(document.activeElement).toBe(first);
    // Backward from the first wraps to the last.
    first.focus();
    tab(true);
    expect(document.activeElement).toBe(last);
    app.closeModal();
  });
});

describe("capturing from the modal", () => {
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
    app.closeModal();
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
      // The dialog never rebuilds on the mode flip: the draft survives
      // untouched behind the scrim, and focus is not stolen back to it.
      expect((document.getElementById("note-composer") as HTMLTextAreaElement).value).toBe("Pause this thought");
      expect(document.activeElement?.id).not.toBe("note-composer");
    }
    app.closeModal();
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
    app.closeModal();
  });

  it("⌘/Ctrl+Enter captures from the composer", () => {
    openNotes();
    const composer = document.getElementById("note-composer") as HTMLTextAreaElement;
    composer.value = "Keyed in";
    composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true, cancelable: true }));
    expect(app.state.notes.map((n) => n.text)).toEqual(["Keyed in"]);
    app.closeModal();
  });

  it("an empty composer lands nothing", () => {
    openNotes();
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes).toHaveLength(0);
    expect(app.ui.modal).toBe("notes");
    app.closeModal();
  });

  it("notes capture during flow while the modal blocks the board", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    advance(s, 30);
    openNotes();
    (document.getElementById("note-composer") as HTMLTextAreaElement).value = "mid-flow thought";
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes.map((n) => n.text)).toEqual(["mid-flow thought"]);
    // The dialog still stands over the running session.
    expect(app.ui.modal).toBe("notes");
    expect(s.mode).toBe("flow");
    app.closeModal();
    expect(document.activeElement!.id).toBe("app-tile-notes");
    endSession(s, DAY + 120_000);
  });
});

describe("the live tag chip rides the composer (§9, #277)", () => {
  it("flow wears the session habit's chip; unstructured flow and upgrade mode wear none", () => {
    const s = app.state;
    // Upgrade mode: notes go untagged, no chip.
    expect(openNotes().querySelector(".note-live-tag")).toBeNull();
    app.closeModal();
    // Flow with a habit: the chip names the tag the note will carry.
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    advance(s, 30);
    app.render();
    const chip = openNotes().querySelector(".note-live-tag")!;
    expect(chip.textContent).toBe("· PIANO");
    app.closeModal();
    endSession(s, DAY + 120_000);
    // Unstructured flow: nothing to tag, no chip — the selection clears
    // between sessions (the engine locks it in flow).
    selectHabit(s, null);
    startSession(s, null, DAY + 200_000);
    advance(s, 15);
    app.render();
    expect(openNotes().querySelector(".note-live-tag")).toBeNull();
    app.closeModal();
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
    app.closeModal();
    endSession(s, DAY + 120_000);
    app.render();
    openNotes();
    (document.getElementById("note-composer") as HTMLTextAreaElement).value = "between sessions";
    document.querySelector<HTMLButtonElement>("#note-save")!.click();
    expect(app.state.notes.map((n) => n.habitId)).toEqual([habit.id, null]);
    app.closeModal();
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
    app.closeModal();
  });

  it("an empty stream renders no furniture", () => {
    openNotes();
    const frame = openLogged();
    expect(frame.querySelector(".note-entry")).toBeNull();
    // Eyebrow, state word, tabs — and nothing else.
    expect(frame.querySelector("#modal-title")!.textContent).toBe("NOTES");
    expect(frame.querySelector(".notes-modal-state")!.textContent).toBe("stream");
    expect([...frame.querySelectorAll(".ftab")].map((t) => t.textContent)).toEqual(["CAPTURE", "LOGGED"]);
    app.closeModal();
  });
});

describe("the modal carries no generator documentation", () => {
  it("the Note Generator's mechanic lives on the module, never as modal furniture", () => {
    const frame = openNotes();
    // No tooltip trigger or body, and no prose naming the mechanic — the
    // capture row is chip and button alone (the forge readout documents
    // the credit).
    expect(frame.querySelector(".inst-tip")).toBeNull();
    expect(frame.textContent).not.toContain("Note Generator");
    const row = frame.querySelector(".note-capture-row")!;
    expect(row.querySelectorAll("button")).toHaveLength(1);
    expect(row.querySelector("#note-save")).not.toBeNull();
    app.closeModal();
  });
});
