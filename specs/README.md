# Specs

Every feature or significant change starts here. Code is written only after its spec is approved.

## Structure

One folder per spec, numbered in creation order:

```
specs/
  _templates/             # Copy these to start a new spec
  001-dni-encryption/
    requirements.md       # What and why
    design.md             # How
    tasks.md              # Ordered implementation steps
```

## Workflow

Each phase ends with an approval gate. The project owner approves by changing the file's `Status` to `Approved`.

| Phase | File | Answers | Written by |
|---|---|---|---|
| 1. Requirements | `requirements.md` | What problem, for whom, what counts as done | Owner + agent |
| 2. Design | `design.md` | Database changes, screens, components, reuse, risks | Agent, reviewed by owner |
| 3. Tasks | `tasks.md` | Small, ordered, verifiable steps | Agent, reviewed by owner |
| 4. Implementation | Code + tests | — | Agent, one task at a time |

Rules:

- Don't start a phase until the previous one is `Approved`.
- Acceptance criteria in `requirements.md` must be testable; each becomes at least one test.
- If implementation reveals the spec is wrong, stop and update the spec first.
- When done, set every file's status to `Done` and update `docs/` and `db_schema.sql` if behavior changed.

## Status values

`Draft` → `Approved` → `Done` (or `Superseded by <spec>`).
