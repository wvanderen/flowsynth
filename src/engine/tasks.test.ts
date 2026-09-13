import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { buyCoreActivation, endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import {
  allowanceRate,
  completeTask,
  createTask,
  deleteTask,
  renameTask,
  settlePendingRewards,
  taskCost,
  taskReward,
  tasksActive,
} from "./tasks";
import { deserialize, serialize } from "./save";

function activated() {
  const s = fresh();
  s.timeActive = true;
  s.storeOpened = true;
  s.tasksActive = true;
  return s;
}

describe("task capture and completion", () => {
  it("activation is a store purchase; capture needs the module active", () => {
    const s = fresh();
    s.timeActive = true;
    s.storeOpened = true;
    expect(createTask(s, "tune metronome", "small").ok).toBe(false);
    s.nous = 25;
    expect(buyCoreActivation(s, "tasks").ok).toBe(true);
    expect(tasksActive(s)).toBe(true);
    expect(s.nous).toBeCloseTo(0, 6);
    expect(createTask(s, "tune metronome", "small").ok).toBe(true);
  });

  it("captures and completes during flow, paused, and between sessions", () => {
    const s = activated();
    startSession(s, 600);
    expect(createTask(s, "print sheet", "small").ok).toBe(true);
    s.mode = "paused";
    expect(createTask(s, "oil the keys", "medium").ok).toBe(true);
    expect(completeTask(s, s.tasks[0]!.id).ok).toBe(true);
    s.mode = "flow";
    endSession(s);
    expect(completeTask(s, s.tasks[1]!.id).ok).toBe(true);
  });

  it("rejects empty text, unknown tasks, and double completion", () => {
    const s = activated();
    expect(createTask(s, "   ", "small").ok).toBe(false);
    createTask(s, "a", "small");
    createTask(s, "b", "large");
    expect(completeTask(s, "nope").ok).toBe(false);
    expect(completeTask(s, s.tasks[0]!.id).ok).toBe(true);
    expect(completeTask(s, s.tasks[0]!.id).ok).toBe(false);
  });

  it("edits open tasks any time; completed tasks are history", () => {
    const s = activated();
    startSession(s, 600);
    createTask(s, "print sheat", "small");
    expect(renameTask(s, s.tasks[0]!.id, " print sheet 3 ")).toEqual({ ok: true });
    expect(s.tasks[0]!.text).toBe("print sheet 3");
    expect(renameTask(s, s.tasks[0]!.id, "  ").ok).toBe(false);
    completeTask(s, s.tasks[0]!.id);
    expect(renameTask(s, s.tasks[0]!.id, "rewrite history").ok).toBe(false);
  });

  it("deletes tasks any time; deleting a pending task forfeits its reward", () => {
    const s = activated();
    s.allowance = 0;
    createTask(s, "keep", "small");
    createTask(s, "drop", "large");
    completeTask(s, s.tasks[1]!.id); // pending, unfunded
    const baseline = s.nous;
    expect(deleteTask(s, s.tasks[1]!.id)).toEqual({ ok: true });
    expect(s.tasks).toHaveLength(1);
    s.allowance = 50;
    settlePendingRewards(s);
    expect(s.nous - baseline).toBeCloseTo(0, 6); // the deleted reward never pays
    expect(deleteTask(s, "nope").ok).toBe(false);
    startSession(s, 600);
    expect(deleteTask(s, s.tasks[0]!.id)).toEqual({ ok: true }); // works during flow too
  });
});

describe("allowance and payouts", () => {
  it("accrues from live flow time only", () => {
    const s = activated();
    startSession(s, 600);
    advance(s, 120); // 2 minutes → 2 points
    expect(s.allowance).toBeCloseTo(2, 6);
    s.mode = "paused";
    advance(s, 600);
    expect(s.allowance).toBeCloseTo(2, 6);
    s.mode = "flow";
    advance(s, 60);
    expect(s.allowance).toBeCloseTo(3, 6);
    endSession(s);
    advance(s, 60);
    expect(s.allowance).toBeCloseTo(3, 6);
  });

  it("manual practice logs earn no allowance", () => {
    const s = activated();
    const piano = createHabit(s, "Piano")!.habit!;
    selectHabit(s, piano.id);
    addPracticeLog(s, piano.id, 30);
    expect(s.allowance).toBe(0);
  });

  it("pays rewards fully in completion order; underfunded rewards wait", () => {
    const s = activated();
    s.allowance = 5;
    const baseline = s.nous;
    createTask(s, "first", "small"); // costs 3
    createTask(s, "second", "medium"); // costs 8
    createTask(s, "third", "small"); // costs 3
    expect(completeTask(s, s.tasks[0]!.id).paid).toBe(true); // 5-3=2 left
    expect(s.nous - baseline).toBeCloseTo(taskReward("small"), 6);
    expect(completeTask(s, s.tasks[1]!.id).paid).toBe(false); // needs 8, has 2
    expect(completeTask(s, s.tasks[2]!.id).paid).toBe(false); // ordered behind
    s.allowance += 6; // funding arrives from live practice
    expect(settlePendingRewards(s)).toBe(1); // t1 funds exactly, t2 still short
    expect(s.allowance).toBeCloseTo(0, 6);
    expect(s.nous - baseline).toBeCloseTo(taskReward("small") + taskReward("medium"), 6);
    expect(s.tasks[2]!.paid).toBe(false); // still waiting
    s.allowance += 3;
    expect(settlePendingRewards(s)).toBe(1);
    expect(s.tasks[2]!.paid).toBe(true);
    expect(s.nous - baseline).toBeCloseTo(taskReward("small") + taskReward("medium") + taskReward("small"), 6);
  });

  it("never pays partially and never goes negative", () => {
    const s = activated();
    s.allowance = 2;
    createTask(s, "big", "large");
    completeTask(s, s.tasks[0]!.id);
    expect(s.tasks[0]!.paid).toBe(false);
    expect(s.allowance).toBeCloseTo(2, 6);
    expect(s.nous).toBe(0);
  });

  it("the module's level scales the accrual rate", () => {
    const s = activated();
    s.modules.find((m) => m.type === "tasks")!.level = 1;
    expect(allowanceRate(s)).toBeCloseTo(1.2, 9);
    startSession(s, 600);
    advance(s, 60);
    expect(s.allowance).toBeCloseTo(1.2, 6);
  });

  it("tier costs and rewards are the small whole numbers intended", () => {
    expect([taskCost("small"), taskCost("medium"), taskCost("large")]).toEqual([3, 8, 15]);
    expect(taskReward("large")).toBe(15);
  });

  it("conserves: paid nous equals rewards and allowance only decreases by costs", () => {
    const s = activated();
    s.allowance = 10;
    const baseline = s.nous;
    createTask(s, "a", "medium"); // 8
    createTask(s, "b", "small"); // 3, only 2 left after a
    completeTask(s, s.tasks[0]!.id);
    completeTask(s, s.tasks[1]!.id); // pending
    s.allowance += 1; // exactly funds b
    settlePendingRewards(s);
    const paid = s.tasks.filter((t) => t.paid).reduce((sum, t) => sum + taskReward(t.size), 0);
    expect(paid).toBeCloseTo(s.nous - baseline, 6);
    expect(s.allowance).toBeCloseTo(0, 6);
    expect(settlePendingRewards(s)).toBe(0);
  });

  it("persists tasks, allowance, and pending payouts across saves", () => {
    const s = activated();
    startSession(s, 600);
    advance(s, 300);
    createTask(s, "pending thing", "large");
    completeTask(s, s.tasks[0]!.id);
    endSession(s);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.tasks[0]!.done).toBe(true);
    expect(loaded.state!.tasks[0]!.paid).toBe(false);
    expect(loaded.state!.allowance).toBeCloseTo(s.allowance, 6);
    // Accruing further allowance after reload still pays the pending task.
    startSession(loaded.state!, 600);
    advance(loaded.state!, 600);
    expect(loaded.state!.tasks[0]!.paid).toBe(true);
  });
});
