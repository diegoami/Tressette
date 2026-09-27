# Tressette — the desktop build

The recorded decision for packaging `public/` as a desktop application, and how
the build is checked. Companion to [`ANDROID.md`](ANDROID.md), which does the
same for the APK.

**Status.** The [`desktop/`](desktop/README.md) wrapper is built and passes
`tools/smoke_desktop.mjs` (below). A release carries it beside the APK from
1.0.4 on, and the about screen and `/windows` link to it. Installers and code
signing are deferred.

## Recorded decision

Chosen by the owner on 2026-09-23: Discola's decision, taken as it stands.

| Decision | Value | Note |
|---|---|---|
| Shell | **Tauri 2** | wraps `public/` unchanged |
| Platforms | **Windows only** | Linux and macOS are later options |
| Goal | **Personal use + GitHub Releases** | as for Android, not app stores |
| Binary hosting | **`diegoami/tressette-releases`** | the repository the APK ships from |
| Code signing | **Unsigned first** | SmartScreen warns on first run; the release notes will say so |
| Identifier | **`com.tressette.desktop`** | permanent: it keys the app's storage |

The comparison it was made from, Tauri against Electron and against rewriting
the page in the Geoclick stack, is in
[Discola's `DESKTOP.md`](https://github.com/diegoami/discola-web/blob/main/DESKTOP.md),
and nothing in it differs for this game. Tauri wraps `public/` unchanged, so
the web build stays a directory that opens with no toolchain (`SPEC.md` §2).
The Rust toolchain it needs was already installed. Electron would bundle a
whole Chromium to show one page, and a rewrite would change nothing a player
sees while risking everything the UI check guards.

The wrapper was forked from Discola at `8574702`: the same three source files
and configuration, renamed, with Discola's `Cargo.lock` as the starting point
so the build uses the Tauri it was proven on (runtime 2.11.6, CLI 2.11.5).

## How the build is checked

`tools/check_ui.mjs` measures `public/` over `file://`. The app embeds those
same bytes, so the layout is checked there, and the check gained the app's
window, 1280 × 800, as a viewport. What the check cannot see is what only the
wrapper can break, and `tools/smoke_desktop.mjs` checks that against the built
`tressette.exe` itself:

```sh
cd desktop && npm ci && npm run build && cd ..
node tools/smoke_desktop.mjs
```

It launches the app with WebView2's DevTools port open and attaches
`playwright-core`, the repository's one dev dependency, over CDP. Nothing is
injected into the build: Discola checked its wrapper with a probe compiled into
a throwaway build, and here the build that is checked is the build that ships.
The app runs against a temporary WebView2 profile, so a smoke run never writes
into a player's history.

Run on 2026-09-23 (Windows 11, Tauri 2.11.6, WebView2 153):

```
first launch
  pass  served from the app origin  (http://tauri.localhost)
  pass  the window opens at 1280x800  (1280x800)
  pass  all 6 decks load over the asset protocol
  pass  a deal puts ten cards in your hand  (10)
  pass  a whole deal plays through the fan  (20 cards played)
  pass  the end of the hand shows its result  (Hai perso)
  pass  the hand is recorded in the history  (1 hands)
  pass  all 6 @font-face rules load
  pass  nothing is fetched from outside the app
  pass  no script errors
second launch
  pass  the hand is in the history after a restart  (1 hands)
  pass  the deck chosen before the restart is still chosen  (Napoletane)
  pass  the app wrote to the temporary profile, not the player's
```

Two things learned writing it, both about the harness rather than the app:

- Attached to WebView2 over CDP, Playwright's visibility check never passes
  for the fan's cards, although they are on screen at full size. The smoke
  taps them at measured points with `page.mouse`, which is what a pointer does
  anyway.
- The deck has to be chosen by the name the page uses. The first version
  chose `'trevisane'`, which is not a deck: that deal was never recorded, and
  the restart came back with the default deck. The two persistence checks
  failed exactly as they should, and a player cannot reach that state, since
  the picker offers only real names and the page replaces an unknown saved one
  on load.

## Releasing

Both targets ship as one GitHub Release on
[`diegoami/tressette-releases`](https://github.com/diegoami/tressette-releases),
on one version line, from this machine: it holds the Android signing key and
the Rust toolchain.

A release is a milestone, an annotated tag on the reviewed commit of `main`, and
it is built from the tag, in a worktree of its own, never in the main checkout
([`ANDROID.md`](ANDROID.md) §4 has the whole order):

```sh
git fetch origin --tags
git worktree add --detach <main>/../Tressette-work/release-<sha12> <sha>   # the candidate
node <that worktree>/tools/package_release.mjs --candidate                 # for the device checks; never published
git tag -a vX.Y.Z -m "Tressette X.Y.Z" <sha> && git push origin vX.Y.Z      # after the review's AGREE
git worktree add --detach <main>/../Tressette-work/release-vX.Y.Z vX.Y.Z
node <that worktree>/tools/package_release.mjs                             # builds both from the tag, smokes the exe, stages dist-release/vX.Y.Z/
node <that worktree>/tools/publish_release.mjs --subtitle "…"              # dry run: verifies, prints the notes
node <that worktree>/tools/publish_release.mjs --subtitle "…" --confirm
```

The packager installs what a fresh worktree lacks itself, and finds the
signing key's configuration in the main checkout (`ANDROID.md` §4).

A version bump touches seven declarations in six files: Android's
`versionName` (and `versionCode`), `tauri.conf.json`, `Cargo.toml`,
`desktop/package.json`, `desktop/package-lock.json` twice (its top-level
`version` and `packages[""].version`), and `Cargo.lock`'s `tressette` entry.
`package_release.mjs` refuses to build unless they all
agree, and so does `tools/release.test.mjs` on every pull request, so a missed
one turns CI red before release day. `versionCode` is held separately, since it
only has to move with the rest: both check that it is above the previous
milestone tag's when `versionName` has moved, and unchanged when it has not
(#58). The packager refuses an `.exe` that is
missing, under 1 MB or not a PE binary, runs the smoke against it, and stages
`Tressette-X.Y.Z-android.apk`, `Tressette-X.Y.Z-windows-x64.exe` and
`SHA256SUMS.txt`, replacing any earlier directory. The publisher requires
exactly those two assets: an APK-only directory is half a release, not a
smaller one.

This follows Discola's 1.0.4, ported into this repository's own fail-closed
release scripts (`tools/release_lib.mjs`, issues #22, #23 and #26) rather than
copied over them, so every decision is a pure function the tests hold.

The executable is **unsigned**, so SmartScreen warns on first run. The release
notes say so where a player meets it:

> L'eseguibile non è firmato digitalmente, quindi Windows mostrerà l'avviso
> «Windows ha protetto il PC»: clicca «Ulteriori informazioni», poi «Esegui
> comunque». È portabile, senza installer: mettilo dove preferisci.

## Out of scope

A CI job for the desktop build. Releases are built locally
([`ANDROID.md`](ANDROID.md) §4, "Build locally, not in CI"), and a Windows
runner with a Rust toolchain costs more than the command it would save.
Installers and code signing wait until a broader distribution is wanted.
