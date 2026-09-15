# Tressette

A two-player Tressette game for the browser, built in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, one opponent formula with four weight vectors.

**Nothing is built yet. Start by reading `PLAN.md` in full.** Section 7 says
how the work is organised: one iteration per session, a fresh-context review
per pull request, CI on every pull request. Section 0 lists the decisions
already made and the two still open.

Discola is the reference for everything the plan does not state. Clone it
beside this repo if it is not already there.

## Conventions

- Player-facing text is Italian. Comments, commit messages and documents are
  English.
- No build step and no runtime dependencies. `playwright-core` is for the UI
  check only and is gitignored.
- The card art is the original 1997 bitmaps, copied from Discola. Do not
  redraw it.

Iteration 0 expands this file with the rules that apply once code exists: the
card-size budget with its width term, the engine contract, the UI check.
