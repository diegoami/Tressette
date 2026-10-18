# Tressette — the itch.io build

## Listing assets and page status

The game and its binaries are named **Tressette**. The owner-selected itch.io
project title is **Tressettette**, with the confirmed project slug
[`diegoami/tressettette`](https://diegoami.itch.io/tressettette).

The English copy, upload order, cover, and five screenshots for the official
v1.0.8 page are in the versioned [v1.0.8 listing kit](itch-listing/v1.0.8/README.md).
The kit is source material for the project page; it is not part of the HTML5
game ZIP. Its capture script can regenerate the screenshots and cover from the
repository's game and local fonts.

The HTML5, Android, and Windows v1.0.8 builds have been uploaded to the private
itch.io draft, and the owner confirmed that the HTML game and Android build
passed their phone checks. The draft remains private until the owner publishes
the page. For the HTML5 build, the page must use the HTML project kind and have
**This file will be played in the browser** enabled on the HTML5 ZIP. The
canonical embed is 480×720 portrait; keep the fullscreen option available and
do not force it. The Android APK and Windows EXE stay downloadable. These
settings are edited in the itch.io dashboard and are not changed by uploading
the files again.

The browser game, packaged as an HTML5 ZIP and uploaded to itch.io, with the
Windows and Android builds on the same project page. This is the playbook the
owner follows; `tools/package_itch.mjs`, `tools/smoke_itch_zip.mjs` and
`tools/publish_itch.mjs` are what it runs.

The GitHub release is unchanged: `diegoami/tressette-releases` still carries
exactly the APK and the Windows `.exe` and their `SHA256SUMS.txt`
([`ANDROID.md`](ANDROID.md) §4). The itch ZIP is a third artifact for a second
storefront, staged under `dist-itch/` so it can never join that release.

## The page (edited by hand)

**Butler pushes builds, not page text.** The description, the embed size, the
cover, the screenshots, the tags and the fullscreen toggle are all edited on
itch.io by hand, so a change here is not live until the owner pastes it. The
confirmed publisher target is `diegoami/tressettette`; check what is uploaded
with `butler status diegoami/tressettette` (all three channels).

- **Embed size: 480×720, portrait.** On phones itch.io launches the game
  fullscreen and fixes the orientation from the embed's aspect ratio before any
  game code runs, so a portrait embed is what keeps a phone upright. This is the
  owner's decision (Discola `STORES.md`, issue #121), and the UI check asserts
  the whole first screen fits it without scrolling, in both languages
  (`tools/check_ui.mjs`, the `itch embed` viewport).
- **The page must also work at 640×480** and at every other size and
  orientation. That is a supported window, not the canonical embed, so the sheet
  may scroll there.
- **"This file will be played in the browser"** is ticked once, on the `html5`
  channel, and stays ticked.
- **The fullscreen option stays available to the player and is never forced.**
  Discola tried taking the embed fullscreen (and locking portrait) on the first
  Start and the owner rejected it; the game never calls `requestFullscreen` or
  `screen.orientation.lock`, and the UI check's framed probe asserts it,
  top-level and inside a same-origin iframe.
- **Free**, with tags `card-game`, `italian`, `singleplayer`, `offline`,
  `retro`, `browser`.

A one-line description is enough; the phone player is sent to the web version
for the better experience, because the runner's fullscreen toast covers the
bottom of the screen for a few seconds:

> Tressette a due contro quattro avversari con carattere, con i mazzi
> regionali italiani. Funziona offline, senza account e senza pubblicità: lo
> storico resta sul dispositivo. In italiano e in inglese. Per un'esperienza
> migliore gioca su <https://tresettette.netlify.app> .

**Deferred until the page exists and its URL is confirmed:** the `/itch`
redirect in `netlify.toml` and the in-game link to the itch page. Neither is
added before the owner confirms the project URL (issue #95).

## The three channels

One butler channel per build, one file each, all at the same `--userversion`:

| channel | file | source |
|---|---|---|
| `html5` | `Tressette-X.Y.Z-itch-html5.zip` | `dist-itch/vX.Y.Z/` |
| `windows` | `Tressette-X.Y.Z-windows-x64.exe` | `dist-release/vX.Y.Z/` |
| `android` | `Tressette-X.Y.Z-android.apk` | `dist-release/vX.Y.Z/` |

`tools/publish_itch.mjs` maps each channel to its one file, so a wrong or
repeated ZIP is impossible, and pushes all three only after every hash, both
sidecars and the live tag have checked out.

## Packaging order

Every build is made in a worktree of its own, detached at the commit it builds,
never in the main checkout ([`AGENTS.md`](AGENTS.md), *Releases*); both
packagers refuse to run in the main checkout and require a clean checkout at the
commit. In order:

1. **Candidate.** In a worktree at the candidate commit on `main`:
   `node tools/package_release.mjs --candidate` and
   `node tools/package_itch.mjs --candidate`. They stage
   `dist-release/candidate-<first seven of the sha>/` and
   `dist-itch/candidate-<first seven of the sha>/`, each with an adjacent
   `<stage>.source` sidecar recording the version, the full commit and
   `"candidate"`.
2. **The gates and the smoke**, on that commit: `npm test`,
   `node tools/check_ui.mjs`, then the packaged ZIP:
   `node tools/smoke_itch_zip.mjs dist-itch/candidate-<sha>/Tressette-X.Y.Z-itch-html5.zip`.
   The smoke verifies the ZIP against `SHA256SUMS.txt`, extracts it with the
   system `tar`/`unzip`, compares every file byte for byte with `public/`, and
   loads the extracted page in Chromium at 480×720 and 640×480.
3. **The real-phone check**, on the candidate ZIP, before the tag: upload the
   candidate HTML5 ZIP by hand to a private itch.io draft and open it on a
   phone. The publisher accepts only tagged release stages. The orientation
   problem the embed size exists for showed up only there (Discola #121).
4. **The tag**, on exactly the tested candidate commit:
   `git tag -a vX.Y.Z -m "Tressette X.Y.Z" <sha>`, then `git push origin vX.Y.Z`.
   If the candidate changed, build and check a new one first — including the
   phone check.
5. **Release packaging**, in a worktree at the tag:
   `node tools/package_release.mjs` and `node tools/package_itch.mjs`. The
   release sidecars now say `"release"` and name the same commit as the
   candidate sidecars.
6. **Upload**: `node tools/publish_itch.mjs --project owner/slug` (dry run),
   then `--confirm`. It refuses unless the release and candidate sidecars in
   both `dist-itch/` and `dist-release/` name one full commit, that commit is
   the peeled annotated `vX.Y.Z` on the live `origin`, and it is an ancestor of
   `origin`'s `main`.

Repackaging from the same commit is allowed: the source identity is the
guarantee, not the byte identity of a rebuilt `.exe` or APK.

## The publisher

```sh
node tools/publish_itch.mjs --project owner/slug            # dry run: check, print, upload nothing
node tools/publish_itch.mjs --project owner/slug --confirm  # push the three channels
```

- **`--project owner/slug` is required on both runs.** There is no default: the
  owner confirms the slug before a publisher may run, and a guessed target is a
  refusal. The three resolved targets are printed.
- It needs `butler` (<https://itch.io/docs/butler/>) on `PATH`, or `BUTLER` set
  to its path, and the API key in `BUTLER_API_KEY`. The key is read from the
  environment and never written, printed or stored in the repo.
- Dry run by default; nothing is uploaded without `--confirm`. On a failed
  channel it stops and reports which channels were completed.
- The version is this checkout's `versionName` and only that: it reads one
  stage, `vX.Y.Z`, in both staging roots. A missing current stage, a malformed
  or mismatched sidecar, a mixed commit, an extra file in a stage, or a tag on a
  different commit is a refusal before any upload.
