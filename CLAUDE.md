> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Claude Code harness

This is the Claude Code harness. It records this harness's process and points at
the shared rules; it does not restate them.

**Read first.** Before changing anything, read `PLAN.md` §7.7 — the shared
working rules and the gates — and `PLAN.md` §7, the shared process facts. Do not
apply `AGENTS.md`'s process: that file is the other harness.

**Harness.** This harness has no cross-harness implementer/reviewer roles and no
design-issue stage. Claude implements; the independent review comes once per
milestone, before its tag, from a model that is not Claude.

## Process

Claude implements the change in a worktree of its own, on a branch, opens a PR
referencing any relevant issue, and the owner merges. CI runs on every PR
(`PLAN.md` §7.4), and a red check does not merge. A PR gets no review of its
own; its review comes with the next milestone's.

**Where Claude works** follows `PLAN.md` §7.7, "Who works where". `Tressette/`,
the main checkout, is the planner's or orchestrator's, and nobody implements,
reviews, or checks out a branch or commit there. A session asked to implement,
unless it is already a Claude Code fork in the tool's own worktree
(`.claude/worktrees/`), first runs `git fetch origin`, then makes its worktree:

    git worktree add -b <branch> <main>/../Tressette-work/<branch> origin/<default>

It works only there, naming the worktree in every command, since the tool's
shell may return to `Tressette/` after each command. Before any check runs
there, it installs the dependencies in that worktree, as the project's setup
says (`npm ci`, then `npm run setup` if Chromium is missing), and never copies
or links them from `Tressette/`. On Windows, nested worktree paths need
`git config --global core.longpaths true`, which the owner sets on the
machine; a session does not set it. If it finds itself about
to edit, commit or switch branches in `Tressette/`, it stops and makes the
worktree first. After the merge it removes the worktree it made
(`git worktree remove`) and deletes its merged branch. It removes no worktree
it did not make.

## Milestones

**A milestone is a release** (`PLAN.md` §7.4): an annotated tag `vX.Y.Z` on
`main`, on the exact commit the published release is built from. Nothing else
is one: not a PR, a run of PRs, a change to a particular file, or a process
change. The binaries are published to `diegoami/tressette-releases`, but the
tag goes on this repository's `main`, and the release notes name its commit.

**How one happens.**

1. The owner calls a milestone, or Claude proposes one when a release is due or
   a coherent set of work has landed.
2. Claude opens a **milestone issue**, labelled `milestone`, titled
   `Milestone vX.Y.Z`. It holds the proposed tag, the candidate commit on `main`
   (full SHA), the previous milestone tag, the PRs merged since that tag, and
   the gate results on the candidate: `npm test`, `node tools/check_ui.mjs`, and
   `node tools/package_release.mjs --candidate`, whose smoke runs the built app.
3. Claude gives the owner one review prompt, from the template below, and puts
   it in the issue. The owner runs it in a model that is not Claude, in a fresh
   session. The reviewer opens one issue per finding it reproduced, and posts
   one verdict comment on the milestone issue: **AGREE** or **BLOCK**.
4. **The tag waits for the verdict.** On BLOCK, the findings are fixed in
   ordinary PRs, the candidate moves to the new `main` commit, and Claude
   updates the milestone issue and gives the re-review prompt without being
   asked. A third round that does not end in AGREE goes to the owner.
5. On AGREE, Claude creates the annotated tag on exactly the reviewed SHA,
   never on a later commit, pushes it, and the release is built from the tag
   (`ANDROID.md` §4). Work merged after the candidate belongs to the next
   milestone. The device checks (`ANDROID.md` §6) come before the tag, on the
   candidate build. Publishing stays as `ANDROID.md` has it: on the owner's
   go-ahead.
6. The owner may tag without a review. The milestone issue records that the
   review was skipped, and who decided.

**It blocks no work.** PRs keep merging on their gates while a milestone issue
is open; only the tag waits. Claude does not stand in for the other model: a
candidate is reviewed by another model, or the owner decides to tag without
one.

**When a verdict arrives,** Claude reproduces each finding before acting on it
(`PLAN.md` §7.7), and says on its issue whether it is confirmed, not
reproduced, or disputed, with the reason. Confirmed findings are fixed in PRs
that close their issues. A disputed finding goes to the owner, in its issue.

**The prompt.** Claude fills in the angle brackets. `<N>` is the milestone
issue's number, `<TAG>` the proposed tag, `<PREV>` the previous milestone tag,
`<SHA>` the candidate's full SHA.

```
Review diegoami/Tressette independently, as the review of a release: you did not
write it and have seen none of the sessions that did. It is a two-player
Tressette card game for the browser, public/index.html and public/engine.js with
no build step, wrapped as an Android APK and a Windows app.

The candidate for <TAG> is <SHA> on main. The previous release is <PREV>.
Reach it in this order, and review nowhere else:
1. Fetch first: `git fetch origin --tags <SHA>`. Naming the SHA brings an
   untagged candidate even into a clone whose refspec leaves out main, such as
   a single-branch or shallow clone a sandbox or a cloud session makes. The
   candidate is a commit on main, not a pull request, so there is no
   pull/<N>/head to fetch. Not `git pull`: the checkout you started in may be
   on another branch or hold local changes.
2. A commit you cannot see is not missing until you have fetched. Only if
   `git cat-file -t <SHA>` still does not print "commit" after the fetch, stop
   and say so in your reply; do not review.
3. Review in a fresh, detached worktree of your own at exactly <SHA>, never in
   the checkout you started in, which may be someone's work in progress: leave
   its branch and files exactly as they are. Run
     git worktree add --detach <main>/../Tressette-review/review-<id>-<stamp> <SHA>
   where <main> is the parent directory of
   `git rev-parse --path-format=absolute --git-common-dir`, <id> is the first
   12 characters of <SHA>, and <stamp> is the UTC time as YYYYMMDDTHHMMSSZ, so
   every run has its own. Remove no worktree you did not make. On Windows,
   nested worktree paths can pass the path limit: this needs
   `git config --global core.longpaths true`, which the owner sets on the
   machine. If a path is too long, stop and say so; do not change git's
   configuration.
4. In that worktree, `git rev-parse HEAD` must equal <SHA> before you review.
   Every command from here on runs there.
5. Before any check runs there, install the dependencies in that worktree, as
   the project's setup says: `npm ci`, then `npm run setup` if Chromium is
   missing. Never copy or link them from the checkout you started in.

Review `git diff <PREV>..<SHA>`, following it into any file it touches. The
pull requests in that range:
<one line per merged PR: number and title>

Read PLAN.md §7 and §7.7 first, then SPEC.md. PLAN.md §2 is the rules and §3.4
the opponent.

Run both gates yourself and report the counts: `npm test` and
`node tools/check_ui.mjs`, in your worktree, after step 5.
The desktop build and its smoke need Windows with Rust and WebView2; if you
cannot run them, say so and review them by reading.

Check, in order: the checks in PLAN.md §7.3. Then anything else wrong: a bug,
a document that says what the code does not, a rule in PLAN.md that the code or
the process breaks, a test or assertion that would pass on broken code.
<Anything this range needs a closer look at, or delete this line.>

Do not fix anything. For each finding you reproduced, open one issue in
diegoami/Tressette: what is wrong, file:line, severity (defect, risk or nit),
and how to reproduce it. Then post one comment on
https://github.com/diegoami/Tressette/issues/<N>: AGREE or BLOCK on the first
line, then the worktree you reviewed in, as a relative path
(../Tressette-review/review-<id>-<stamp>), and <SHA>, then the finding issues,
anything you inferred but could not reproduce,
what you checked and found clean, and what each passing check would have caught
had the code been wrong. BLOCK if any finding should stop <TAG> from shipping.

Write every issue and comment body to a file as UTF-8 without a byte-order mark,
and pass it with --body-file; never inline it. If you cannot post, return the
bodies and the owner will.
```

**The re-review prompt,** after a BLOCK, is the same prompt with the new
candidate as `<SHA>`, and this paragraph after the list of pull requests:

```
This is round <R>. Round <R-1> reviewed <OLD SHA> and posted BLOCK, with the
findings <#issue, #issue>. Reach <SHA> as above, fetching again and in a new
worktree of its own, not round <R-1>'s. Check first that each finding is fixed
at <SHA>, and say so on its issue. Then review `git diff <OLD SHA>..<SHA>` as
a whole, and anything in `<PREV>..<SHA>` the fixes reach into.
```

## Amending this file

A change to `CLAUDE.md` goes through this process (`PLAN.md` §7.1).
