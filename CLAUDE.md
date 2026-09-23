> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Claude Code harness

This is the Claude Code harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `AGENTS.md`'s process: that file is the other harness.

**Harness.** This harness has no cross-harness implementer/reviewer roles and no
design-issue stage. Claude implements; the review comes at milestones, as a
GitHub issue the owner runs in another model when they have the chance.

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

After a PR merges, Claude checks whether it reached a milestone.

**A review is an issue.** At a milestone Claude opens an issue labelled
`review`, titled `Review <BASE>..<HEAD>`, whose body is the prompt below, filled
in, and links it in its report. That issue is the whole request. The owner runs
the prompt in a model other than Claude, in a fresh context, at high effort,
whenever they have the chance, and the report goes on the issue as a comment.

**It blocks nothing.** Claude keeps implementing and the owner keeps merging
whether or not the issue has been run, however long it stays open. An open
review issue is a range nobody has reviewed yet, and says only that. The next
review issue's `<BASE>` is the last review issue's `<HEAD>`, run or not, so the
ranges never overlap; for the first, `<BASE>` is `b9cdeb4`, the commit before
this process. Claude does not stand in for the other model: a range is reviewed
by another model or is still open.

**When a report arrives,** Claude reproduces each finding before acting on it
(`PLAN.md` §7.7) and comments on the issue with a verdict on each: confirmed,
not reproduced, or disputed, with the reason. Confirmed findings are fixed in
PRs that reference the issue; the last one closes it. A disputed finding goes to
the owner, in the issue. A report with no findings closes the issue.

**The prompt.** Claude fills in the angle brackets; `<N>` is the review issue's
own number, filled in once the issue exists:

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

Do not fix anything. Post your report as a comment on
https://github.com/diegoami/Tressette/issues/<N> if you can; otherwise return it
and the owner will post it. Report each finding as: severity (defect, risk or nit),
file:line, what is wrong, and how to reproduce it. Say which findings you
reproduced and which you inferred. End with what you checked and found clean,
and what each passing check would have caught had the code been wrong.
```

## Amending this file

A change to `CLAUDE.md` goes through this process (`PLAN.md` §7.1).
