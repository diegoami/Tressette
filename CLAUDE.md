> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Claude Code harness

This is the Claude Code harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `AGENTS.md`'s process: that file is the other harness.

**Harness.** This harness has no cross-harness implementer/reviewer roles and no
design-issue stage. Claude implements; the review comes at milestones, from an
independent model the owner runs.

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

**The report comes back to Claude.** Claude reproduces each finding before
acting on it (`PLAN.md` §7.7), then opens one issue labelled `review`, titled
`Independent review of <BASE>..<HEAD>`. It holds the report verbatim and a
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
