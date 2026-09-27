> Guidance for OpenCode. Claude Code uses CLAUDE.md.

# OpenCode harness

This is the OpenCode harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `CLAUDE.md`'s process: that file is the other harness.

## Roles

- **Implementer — DeepSeek** (`opencode/deepseek-v4.1-flash`). Writes the
  design, the code and the tests; replies on GitHub signed
  `— Implementer (DeepSeek V4.1 Flash)`.
- **Reviewer — Luna** (`opencode/gpt-5.6-luna`, the `high` variant), invoked as
  a subagent in a fresh context and given an explicit model id. It verifies
  against the real code rather than trusting the description, in a worktree
  of its own detached at the exact commit under review, after fetching
  (`PLAN.md` §7.7, "Who works where"), and posts its verdict on GitHub signed
  `— Luna (GPT-5.6, high)`.
- Luna posts through the owner's GitHub account — there is no separate bot
  identity — so the signature line is the only marker of authorship.
- A BLOCK is not overridden by the implementer. It goes to the owner.

## The process — two stages

1. **DESIGN.** Before any implementation, write the proposal as a GitHub issue:
   the problem, findings with `file:line` references, the design, and open
   questions. Have Luna review that issue and comment. Iterate — reply, Luna
   re-reviews — until Luna posts an explicit **AGREE**. Do not implement before
   that.
2. **IMPLEMENTATION.** Implement the agreed design in a worktree of your own,
   never in the main checkout (`PLAN.md` §7.7, "Who works where"): first
   `git fetch origin`, then
   `git worktree add -b <branch> <main>/../Tressette-work/<branch> origin/<default>`,
   and work only there, naming the worktree in every command. Install the
   dependencies in it before any check (`npm ci`, then `npm run setup` if
   Chromium is missing); never copy or link them from the main checkout. If
   you find yourself about to edit, commit or switch branches in the main
   checkout, stop and make the worktree first. Open a PR that references the
   issue.
   Have Luna review the PR against the agreed design; fix and iterate until
   Luna posts an explicit **AGREE**. The owner merges. After the merge, remove
   the worktree you made (`git worktree remove`) and delete the merged branch.

This applies to every OpenCode implementation, with no size floor.

## Bootstrap

A change that introduces or edits `AGENTS.md` follows this same process: a PR
that Luna reviews to AGREE. The process reviews its own amendment. `CLAUDE.md`
is amended through its own harness's process (`PLAN.md` §7.1).

## Verification

The gates, and the run-count policy, are defined once in `PLAN.md` §7.7. This
harness adds nothing to them: the implementer runs them, and Luna reproduces
what it can.
