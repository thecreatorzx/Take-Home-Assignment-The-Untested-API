const taskService = require("../src/services/taskService");

// Reset in-memory store before every test so tests don't bleed into each other
beforeEach(() => {
  taskService._reset();
});

const makeTask = (overrides = {}) =>
  taskService.create({ title: "Test task", ...overrides });

describe("create", () => {
  it("creates a task with required fields and sensible defaults", () => {
    const task = makeTask();

    expect(task.id).toBeDefined();
    expect(task.title).toBe("Test task");
    expect(task.description).toBe("");
    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.dueDate).toBeNull();
    expect(task.assignee).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.createdAt).toBeDefined();
  });

  it("persists custom fields", () => {
    const task = makeTask({
      description: "desc",
      status: "in_progress",
      priority: "high",
      dueDate: "2099-01-01T00:00:00.000Z",
    });

    expect(task.description).toBe("desc");
    expect(task.status).toBe("in_progress");
    expect(task.priority).toBe("high");
    expect(task.dueDate).toBe("2099-01-01T00:00:00.000Z");
  });

  it("assigns a unique id to each task", () => {
    const a = makeTask();
    const b = makeTask();
    expect(a.id).not.toBe(b.id);
  });
});

describe("getAll", () => {
  it("returns an empty array when no tasks exist", () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it("returns all created tasks", () => {
    makeTask({ title: "A" });
    makeTask({ title: "B" });
    expect(taskService.getAll()).toHaveLength(2);
  });

  it("returns a copy — mutating the result does not affect the store", () => {
    makeTask();
    const tasks = taskService.getAll();
    tasks.pop();
    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe("findById", () => {
  it("returns the task with the given id", () => {
    const task = makeTask();
    expect(taskService.findById(task.id)).toMatchObject({ id: task.id });
  });

  it("returns undefined for an unknown id", () => {
    expect(taskService.findById("no-such-id")).toBeUndefined();
  });
});

describe("getByStatus", () => {
  it("returns only tasks matching the given status", () => {
    makeTask({ status: "todo" });
    makeTask({ status: "todo" });
    makeTask({ status: "in_progress" });

    const todos = taskService.getByStatus("todo");
    expect(todos).toHaveLength(2);
    todos.forEach((t) => expect(t.status).toBe("todo"));
  });

  it("returns an empty array when no tasks have that status", () => {
    makeTask({ status: "todo" });
    expect(taskService.getByStatus("done")).toEqual([]);
  });

  /**
   * BUG TEST — verifies the fix for the substring-match bug.
   * The original code used t.status.includes(status).
   * Searching for "do" would match BOTH "todo" and "done".
   * After the fix this must return only "done" tasks.
   */
  it("does NOT match partial status strings (regression for includes() bug)", () => {
    makeTask({ status: "todo" });
    makeTask({ status: "done" });

    // "do" is a substring of both "todo" and "done" — must not match todo
    const results = taskService.getByStatus("do");
    expect(results).toHaveLength(0);

    // "in" is a substring of "in_progress" but should not be a valid filter
    makeTask({ status: "in_progress" });
    expect(taskService.getByStatus("in")).toHaveLength(0);
  });
});

describe("getPaginated", () => {
  beforeEach(() => {
    // Create 5 tasks with identifiable titles
    ["A", "B", "C", "D", "E"].forEach((t) => makeTask({ title: t }));
  });

  /**
   * BUG TEST — verifies the fix for the pagination offset bug.
   * Original code: offset = page * limit  →  page 1 skips the first page entirely.
   * Fixed code:    offset = (page - 1) * limit  →  page 1 starts at index 0.
   */
  it("page 1 returns the FIRST set of items (regression for offset bug)", () => {
    const page1 = taskService.getPaginated(1, 2);
    expect(page1).toHaveLength(2);
    expect(page1[0].title).toBe("A");
    expect(page1[1].title).toBe("B");
  });

  it("page 2 returns the second set of items", () => {
    const page2 = taskService.getPaginated(2, 2);
    expect(page2).toHaveLength(2);
    expect(page2[0].title).toBe("C");
    expect(page2[1].title).toBe("D");
  });

  it("last page returns remaining items even if fewer than limit", () => {
    const page3 = taskService.getPaginated(3, 2);
    expect(page3).toHaveLength(1);
    expect(page3[0].title).toBe("E");
  });

  it("returns empty array for a page beyond the data", () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });
});

describe("getStats", () => {
  it("returns zeroed counts when the store is empty", () => {
    expect(taskService.getStats()).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  it("counts tasks by status correctly", () => {
    makeTask({ status: "todo" });
    makeTask({ status: "todo" });
    makeTask({ status: "in_progress" });
    makeTask({ status: "done" });

    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  it("counts overdue tasks — past dueDate and not done", () => {
    makeTask({ dueDate: "2000-01-01T00:00:00.000Z", status: "todo" }); // overdue
    makeTask({ dueDate: "2000-01-01T00:00:00.000Z", status: "in_progress" }); // overdue
    makeTask({ dueDate: "2000-01-01T00:00:00.000Z", status: "done" }); // NOT overdue (done)
    makeTask({ dueDate: "2099-01-01T00:00:00.000Z", status: "todo" }); // NOT overdue (future)
    makeTask({ status: "todo" }); // NOT overdue (no due date)

    expect(taskService.getStats().overdue).toBe(2);
  });
});

describe("update", () => {
  it("merges new fields into the existing task", () => {
    const task = makeTask({ title: "Original" });
    const updated = taskService.update(task.id, {
      title: "Updated",
      priority: "high",
    });

    expect(updated.title).toBe("Updated");
    expect(updated.priority).toBe("high");
    expect(updated.id).toBe(task.id); // id preserved
  });

  it("returns null for an unknown id", () => {
    expect(taskService.update("no-such-id", { title: "X" })).toBeNull();
  });
});

describe("remove", () => {
  it("deletes the task and returns true", () => {
    const task = makeTask();
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  it("returns false for an unknown id", () => {
    expect(taskService.remove("no-such-id")).toBe(false);
  });
});

describe("completeTask", () => {
  it("sets status to done and records completedAt", () => {
    const task = makeTask();
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe("done");
    expect(completed.completedAt).not.toBeNull();
  });

  /**
   * BUG TEST — verifies the fix for completeTask silently resetting priority.
   * Original code hardcoded priority: 'medium' in the spread.
   * A high-priority task would silently become medium on completion.
   */
  it("preserves the original priority (regression for priority-reset bug)", () => {
    const task = makeTask({ priority: "high" });
    const completed = taskService.completeTask(task.id);
    expect(completed.priority).toBe("high");
  });

  it("returns null for an unknown id", () => {
    expect(taskService.completeTask("no-such-id")).toBeNull();
  });
});

describe("assignTask", () => {
  it("stores the assignee on the task", () => {
    const task = makeTask();
    const updated = taskService.assignTask(task.id, "Alice");
    expect(updated.assignee).toBe("Alice");
  });

  it("can reassign an already-assigned task", () => {
    const task = makeTask();
    taskService.assignTask(task.id, "Alice");
    const updated = taskService.assignTask(task.id, "Bob");
    expect(updated.assignee).toBe("Bob");
  });

  it("returns null for an unknown id", () => {
    expect(taskService.assignTask("no-such-id", "Alice")).toBeNull();
  });
});
