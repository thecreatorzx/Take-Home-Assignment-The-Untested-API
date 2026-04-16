# Bugs I Found

## 1. Pagination is broken — page 1 returns nothing useful

Found this in `getPaginated` in `taskService.js`:

```js
const offset = page * limit;
```

If you request page 1 with a limit of 10, the offset becomes 10 — so you've already skipped the entire first page before you've returned a single result. Page 2 would skip 20 items. The data is basically unreachable through pagination unless you start at page 0, which isn't how any pagination API works.

The fix is straightforward:

```js
const offset = (page - 1) * limit;
```

I caught this writing the pagination tests — page 1 kept returning items starting from index 10, which made no sense.

---

## 2. Status filter matches substrings, not exact values

In `getByStatus`:

```js
tasks.filter((t) => t.status.includes(status));
```

`String.includes()` is a substring check, not an equality check. So searching for `"do"` matches both `"todo"` and `"done"`. Searching for `"in"` would match `"in_progress"`. In practice this probably never showed up because callers were passing full status names — but it's the kind of thing that silently returns wrong data and you'd have no idea why.

Changed it to `t.status === status`. Simple fix, should've been that from the start.

---

## 3. Completing a task resets its priority to medium

This one's subtle and easy to miss on a code review. In `completeTask`:

```js
const updated = {
  ...task,
  priority: "medium", // ← this shouldn't be here
  status: "done",
  completedAt: new Date().toISOString(),
};
```

The `priority: 'medium'` line is sitting right after the spread, so it overwrites whatever the task's priority actually was. Mark a high-priority task as done and it silently comes back as medium. There's no good reason for this — I think it was just a mistake. Removed that line and the spread handles priority correctly on its own.
