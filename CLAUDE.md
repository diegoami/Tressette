> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Claude Code harness

This is the Claude Code harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `AGENTS.md`'s process: that file is the other harness.

**Harness.** This harness has no cross-harness implementer/reviewer roles.
Claude implements, and the review is a fresh-context Claude session; there is no
separate design-issue stage.

## Process

Claude implements the change on a branch, opens a PR referencing any relevant
issue, a fresh-context Claude session reviews it, and the owner merges. CI runs
on every PR (`PLAN.md` §7.4), and a red check does not merge.
