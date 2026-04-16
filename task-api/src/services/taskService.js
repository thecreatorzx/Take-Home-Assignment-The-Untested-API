const { v4: uuidv4 } = require("uuid");

let tasks = [];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

const getByStatus = (status) => tasks.filter((t) => t.status === status); // BUG FIX #1: was t.status.includes(status) — a substring match.
// Searching "do" would match both "todo" and "done". Now using
//  strict equality.

const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit; // BUG FIX #2: was page * limit, which skips the entire first page.
  // Page 1 should start at offset 0, so offset = (page - 1) * limit.

  return tasks.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    else console.log(`Unknown status: ${t.status}`);
    if (t.dueDate && t.status !== "done" && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({
  title,
  description = "",
  status = "todo",
  priority = "medium",
  dueDate = null,
  assignee = null,
}) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  const updated = {
    ...task,
    // BUG FIX #3: was hardcoding priority: 'medium', silently overwriting
    // whatever priority the task had. Spread task first so priority is preserved.
    status: "done",
    completedAt: new Date().toISOString(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};
// New feature: assign a task to a user by name
const assignTask = (id, assignee) => {
  assignee = assignee.trim();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee };
  tasks[index] = updated;
  return updated;
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
