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
  against the real code rather than trusting the description, in a worktree of
  its own detached at the exact commit under review. It fetches in order
  (`PLAN.md` §7.7, "Who works where"): the exact full SHA first, then
  `git fetch origin pull/<N>/head` for a pull request, then
  `git cat-file -t <SHA>`, and only then creates the fresh detached worktree at
  that SHA. It removes that worktree only after recording its verdict. It posts
  its verdict on GitHub signed `— Luna (GPT-5.6, high)`.
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
   never in the main checkout (`PLAN.md` §7.7, "Who works where"). If the
   session was opened in the main checkout, first bring it up to date exactly
   as §7.7 says — `git fetch origin`, then `git pull --ff-only` only on the
   default branch with nothing uncommitted; otherwise leave it as it is and
   tell the owner, and never reset, stash or merge there — then leave it.
   First `git fetch origin`, then
   `git worktree add --no-track -b <branch> <main>/../Tressette-work/<branch> origin/<default>`,
   and work only there, naming the worktree in every command; the first push
   is `git push -u origin <branch>` (`--no-track` keeps the branch from
   tracking `origin/<default>`, so the push goes to its own branch). Install the
   dependencies in it before any check (`npm ci`, then `npm run setup` if
   Chromium is missing); never copy or link them from the main checkout. If
   you find yourself about to edit, commit or switch branches in the main
   checkout, stop and make the worktree first. Open a PR that references the
   issue.
   Have Luna review the PR against the agreed design; fix and iterate until
   Luna posts an explicit **AGREE**. Luna fetches the exact reviewed full SHA,
   then `git fetch origin pull/<N>/head`, then checks `git cat-file -t <SHA>`,
   and only then creates a fresh detached worktree at that SHA (`PLAN.md`
   §7.7). The owner merges. After the merge, remove the worktree you made
   (`git worktree remove`) and delete the merged branch. Luna removes her
   review worktree only after recording her verdict. A worktree whose session
   ended before cleanup is a leftover only the owner clears
   (`PLAN.md` §7.7), and no session removes a worktree it did not make.

This applies to every OpenCode implementation, with no size floor.

## Bootstrap

A change that introduces or edits `AGENTS.md` follows this same process: a PR
that Luna reviews to AGREE. The process reviews its own amendment. `CLAUDE.md`
is amended through its own harness's process (`PLAN.md` §7.1).

## Verification

The gates, and the run-count policy, are defined once in `PLAN.md` §7.7. This
harness adds nothing to them: the implementer runs them, and Luna reproduces
what it can.
