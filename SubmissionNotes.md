# Notes

## Test Coverage

**Status: All tests passing ✅** The included test files cover the core endpoints, the new assignment route, and the edge cases identified above (like 404s and the priority-retention fix). I've run the full suite locally to confirm everything is green.

## What I'd test next

A few things I didn't get to but would want to cover:

The validators let empty strings slip through for `status` and `priority` because `if (body.status && ...)` is falsy for `""`. So you could technically create a task with `status: ""` and it'd pass validation fine. That should be caught.

I also didn't write any tests around what happens if two requests try to update the same task at the same time. The store is a plain array with no locking, so concurrent writes could race and one of them would just get lost. Probably not a real issue right now, but worth documenting.

And there's no limit on string lengths anywhere — `title`, `description`, `assignee` can all be arbitrarily long. Before this goes anywhere near production that should get capped.

## PATCH /tasks/:id/assign Implementation design

Here is a quick look at the design decisions and logic behind the new assignment endpoint:

- Design Decision: I chose to store the assignee as a plain `string`. Since we don't have a `user` database or `authentication` implemented right now, using it as a simple string was the best choice for current scenerio.

- Validation: The endpoint checks that assignee exists in the request body and validates that it is not an empty string.

- Edge Cases Handled/Noted: It correctly handles `404` if the task `ID` doesn't exist.

Currently, the endpoint allows reassigning a task that is already marked done. I decided not to block this yet, as some teams like to reassign completed tasks to others, but it's something that should be properly clarified.

## Things that surprised me

The README and the actual code don't agree on what the valid statuses are. The README says `pending | in-progress | completed`, but the validators and service use `todo | in_progress | done`. I went with what the code says since that's what's actually enforced, but if a frontend team was reading the README they'd be sending the wrong values and getting 400s with no obvious explanation.

The `priority: 'medium'` thing in `completeTask` also caught me off guard — it's easy to glance past it during a review because it's just one property in a spread, and the intent isn't obvious. A comment or just removing it would've helped.

## Questions before shipping

A few things I'd want answered:

- Auth & Permissions: Is there any auth planned? Right now, anyone can delete or reassign any task.

- Persistence: The in-memory store resets on restart. Is that intentional for this phase, or do we need to wire up a real database before launch?

- Assignee Validation: Should the assignee eventually be validated against actual User IDs, or is a freeform name fine for our use case?

- Locking Completed Tasks: Should completing a task lock it from further changes? Right now, you can still update the description or reassign a done task.
