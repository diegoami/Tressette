> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Claude Code harness

This is the Claude Code harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `AGENTS.md`'s process: that file is the other harness.

**Harness.** This harness has no cross-harness implementer/reviewer roles and no
design-issue stage. Claude implements; the review comes at milestones, from an
independent model the owner runs, or from a fresh-context Claude subagent when
the owner has none to run.

## Process

Claude implements the change on a branch, opens a PR referencing any relevant
issue, and the owner merges. CI runs on every PR (`PLAN.md` §7.4), and a red
check does not merge. A PR gets no review of its own; its review comes at the
next milestone.

## Milestone reviews

**A milestone** is any of:

- an Android release is about to be cut (`ANDROID.md`);
- a change to `public/engine.js` — the rules or the opponent — has merged;
- five Claude PRs have merged since the last review;
- the owner asks for one.

After a PR merges, Claude checks whether it reached a milestone. If it did,
Claude ends its report with a review prompt, filled in from the template below.
The owner runs it in a model other than Claude, in a fresh context, at high
effort.

**No review holds up the work.** A milestone review is never a gate: Claude
keeps implementing and the owner keeps merging while one is out. If the owner has
no independent model to run the prompt, Claude runs the same prompt itself, in a
subagent that has not seen the work, at high effort. It does so when the owner
says they have none, or when the next milestone arrives and the last prompt's
report has not come back; then the subagent reviews the whole range since the
last review issue. That review is fresh but not independent, and its issue says
so in its title (`Fresh-context review of <BASE>..<HEAD>`) and names the
reviewer. The owner can still run an independent model over the same range
later. Either way, the next review starts where this one ended.

**The report comes back to Claude.** Claude reproduces each finding before
acting on it (`PLAN.md` §7.7), then opens one issue labelled `review`, titled
`Independent review of <BASE>..<HEAD>` (or `Fresh-context review of …` for
Claude's own). It holds the report verbatim and a
verdict on each finding: confirmed, not reproduced, or disputed, with the reason.
Confirmed findings are fixed in PRs that close the issue or reference it. A
disputed finding goes to the owner. A review that finds nothing still gets its
issue, closed at once, because the next review's `<BASE>` is the last review
issue's `<HEAD>`. For the first review, `<BASE>` is `b9cdeb4`, the commit before
this process.

**The prompt.** Claude fills in the angle brackets:

```
Review diegoami/Tressette independently: you did not write it and have seen none
of the sessions that did. It is a two-player Tressette card game for the
browser: public/index.html and public/engine.js, with no build step.

Scope: the commits <BASE>..<HEAD> — <one line per merged PR: number and title> —
and the repository as it stands at <HEAD>. Check out <HEAD> first.

Read PLAN.md §7 and §7.7 first, then SPEC.md, then `git diff <BASE>..<HEAD>`.
PLAN.md §2 is the rules and §3.4 the opponent.

Run both gates yourself and report the counts: `npm test` and
`node tools/check_ui.mjs` (run `npm run setup` first if Chromium is missing).

Check, in order: the checks in PLAN.md §7.3. Then anything else wrong: a bug,
a document that says what the code does not, a rule in PLAN.md that the code or
the process breaks, a test or assertion that would pass on broken code.
<Anything this range needs a closer look at, or delete this line.>

Do not fix anything. Report each finding as: severity (defect, risk or nit),
file:line, what is wrong, and how to reproduce it. Say which findings you
reproduced and which you inferred. End with what you checked and found clean,
and what each passing check would have caught had the code been wrong.
```

## Amending this file

A change to `CLAUDE.md` goes through this process (`PLAN.md` §7.1).
