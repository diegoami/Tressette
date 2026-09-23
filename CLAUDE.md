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

## The review, on the record

The reviewer checks what `PLAN.md` §7.3 lists and posts its verdict as a PR
comment: **AGREE** or **CHANGES REQUIRED**, each finding with a `file:line`,
signed `— Claude reviewer (fresh context)`. It posts through the owner's GitHub
account, so the signature is the only marker of authorship. The implementer
fixes in the same PR and replies with the fixing commit; the reviewer looks
again. A PR merges only with an AGREE on its latest commit. A finding the
implementer disagrees with goes to the owner, in the PR.

## Amending this file

A change to `CLAUDE.md` goes through this process (`PLAN.md` §7.1).
