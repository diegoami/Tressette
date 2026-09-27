---
name: review-handoff
description: Prepare a release for its independent review - open the milestone issue with everything the reviewer needs, and give the owner the one command that starts the review on a model of their choice. Use when a release is called or proposed, for the re-review after a BLOCK, and whenever the owner asks for a review. Also use when the owner says a review is in, to process it.
---

# Review handoff

Only a release gets this review (`AGENTS.md`, *Releases*). A PR or a proposal
doesn't: say how it was verified instead.

The reviewer's job is written once, in `.opencode/agents/release-reviewer.md`.
It starts with no context and reads everything from the milestone issue, so the
issue has to carry everything it needs.

## Open the milestone issue

Title `Milestone vX.Y.Z`, labelled `milestone`, body passed with `--body-file`:

- **Proposed tag**: `vX.Y.Z`, annotated, the next in the existing scheme unless
  the owner says otherwise.
- **Candidate on `main`**: the full SHA of `origin/main` after a fetch.
- **Previous milestone tag**: `git describe --tags --abbrev=0`.
- **Merged since**: every PR between the two, number and title.
- **Gates on the candidate**: each command, its pass count, what it would have
  caught, and CI's result for that SHA:
  - `npm test`
  - `node tools/check_ui.mjs`
  - `node tools/package_release.mjs --candidate`, which stages
    `dist-release/candidate-<sha>/` for the device checks and is never
    published.
- **What changed**: two or three sentences across the range. Do not argue for
  it.
- **Claims to verify**: what the release claims is true, with `file:line`.
- **Known owner decisions**: settled questions, so they aren't reported as
  defects, or "none".
- **Before the tag**: the device checks (`ANDROID.md` §6) on the candidate
  build, and this review.
- **Review**: `pending`, then `AGREE at <sha>`, `BLOCK at <sha>: #n` or
  `tagged without review (owner)`. Keep it current.

Make sure the `milestone` label exists (`gh label list`).

## Give the owner the command

Pick a reviewer model that implemented none of the release. Then, from the main
checkout, start it in a fresh session:

```sh
opencode run -m <provider/model> --command review-release <issue number>
```

In the TUI, use `/new`, pick the model with `/models`, then run
`/review-release <issue number>`. Neither the command nor the agent sets a
model, so the one picked here is the one used. With another tool, tell it:
"Follow `.opencode/agents/release-reviewer.md` for milestone issue #n."

For a re-review, first move **Candidate** to the new `main` commit, and add the
round, the earlier verdict with its SHA, and the fix PRs to the issue. Then give
the same command again, in a fresh session.

## When the review is in

- Read the verdict and every issue it lists. Check that the SHA is the current
  candidate, and update the issue's `Review:` line.
- Reproduce each finding before acting on it, and say on its issue whether it is
  confirmed, not reproduced, or disputed, with the reason. A confirmed finding
  is fixed in a PR that closes its issue; a disputed one goes to the owner, in
  its issue.
- Reply on the milestone issue with what happened to each finding.
- **BLOCK**: once the fixes merge, rerun the gates on the new `main` commit,
  move the candidate, and start the re-review without being asked. After a third
  round without AGREE, the owner decides.
- **AGREE**: run the device checks on the candidate build (`ANDROID.md` §6),
  then tag exactly the reviewed SHA, build from the tag (`ANDROID.md` §4), and
  publish on the owner's go-ahead.
