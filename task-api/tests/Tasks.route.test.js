const request = require("supertest");
const app = require("../src/app");
const taskService = require("../src/services/taskService");

beforeEach(() => {
  taskService._reset();
});

// Creates a task via the API and returns the parsed body
const createTask = (overrides = {}) =>
  request(app)
    .post("/tasks")
    .send({ title: "Test task", ...overrides })
    .then((r) => r.body);

describe("GET /tasks", () => {
  it("returns 200 and an empty array when no tasks exist", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all tasks", async () => {
    await createTask({ title: "A" });
    await createTask({ title: "B" });

    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe("GET /tasks?status=", () => {
  it("returns only tasks with the requested status", async () => {
    await createTask({ title: "A", status: "todo" });
    await createTask({ title: "B", status: "todo" });
    await createTask({ title: "C", status: "done" });

    const res = await request(app).get("/tasks?status=todo");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    res.body.forEach((t) => expect(t.status).toBe("todo"));
  });

  it("returns empty array for a status with no tasks", async () => {
    await createTask({ status: "todo" });
    const res = await request(app).get("/tasks?status=done");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /tasks?page=&limit= (pagination)", () => {
  beforeEach(async () => {
    for (const t of ["A", "B", "C", "D", "E"]) {
      await createTask({ title: t });
    }
  });

  it("page 1 returns the first items", async () => {
    const res = await request(app).get("/tasks?page=1&limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("A");
  });

  it("page 2 returns the next set of items", async () => {
    const res = await request(app).get("/tasks?page=2&limit=2");
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe("C");
  });
});

describe("GET /tasks/stats", () => {
  it("returns zeroed stats when no tasks exist", async () => {
    const res = await request(app).get("/tasks/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it("reflects created tasks in stats", async () => {
    await createTask({ status: "todo" });
    await createTask({ status: "in_progress" });
    await createTask({ status: "done" });

    const res = await request(app).get("/tasks/stats");
    expect(res.body.todo).toBe(1);
    expect(res.body.in_progress).toBe(1);
    expect(res.body.done).toBe(1);
  });
});

describe("POST /tasks", () => {
  it("creates a task and returns 201 with the task object", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "Write tests", priority: "high" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe("Write tests");
    expect(res.body.priority).toBe("high");
    expect(res.body.status).toBe("todo"); // default
    expect(res.body.assignee).toBeNull(); // default
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app).post("/tasks").send({ priority: "low" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it("returns 400 when title is an empty string", async () => {
    const res = await request(app).post("/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "T", status: "invalid" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });

  it("returns 400 for an invalid priority", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "T", priority: "critical" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/);
  });

  it("returns 400 for an invalid dueDate", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "T", dueDate: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/);
  });
});

describe("PUT /tasks/:id", () => {
  it("updates a task and returns the updated object", async () => {
    const task = await createTask();
    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ title: "Updated", priority: "high" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
    expect(res.body.priority).toBe("high");
    expect(res.body.id).toBe(task.id);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app)
      .put("/tasks/no-such-id")
      .send({ title: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is set to empty string", async () => {
    const task = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status", async () => {
    const task = await createTask();
    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ status: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /tasks/:id", () => {
  it("deletes the task and returns 204 with no body", async () => {
    const task = await createTask();
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // Confirm it's actually gone
    const check = await request(app).get("/tasks");
    expect(check.body).toHaveLength(0);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).delete("/tasks/no-such-id");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /tasks/:id/complete", () => {
  it("marks the task as done and sets completedAt", async () => {
    const task = await createTask({ status: "in_progress" });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");
    expect(res.body.completedAt).not.toBeNull();
  });

  it("preserves the original priority when completing (regression)", async () => {
    const task = await createTask({ priority: "high" });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.body.priority).toBe("high");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).patch("/tasks/no-such-id/complete");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /tasks/:id/assign", () => {
  it("assigns the task to a user and returns the updated task", async () => {
    const task = await createTask();
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "Alice" });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("Alice");
    expect(res.body.id).toBe(task.id);
  });

  it("trims whitespace from the assignee name", async () => {
    const task = await createTask();
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "  Bob  " });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("Bob");
  });

  it("can reassign a task that already has an assignee", async () => {
    const task = await createTask();
    await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "Alice" });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "Bob" });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("Bob");
  });

  it("returns 404 for an unknown task id", async () => {
    const res = await request(app)
      .patch("/tasks/no-such-id/assign")
      .send({ assignee: "Alice" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when assignee field is missing", async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/);
  });

  it("returns 400 when assignee is an empty string", async () => {
    const task = await createTask();
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 400 when assignee is not a string", async () => {
    const task = await createTask();
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: 42 });
    expect(res.status).toBe(400);
  });

  it("does not alter other task fields when assigning", async () => {
    const task = await createTask({ title: "My Task", priority: "high" });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: "Alice" });

    expect(res.body.title).toBe("My Task");
    expect(res.body.priority).toBe("high");
    expect(res.body.status).toBe("todo");
  });
});
