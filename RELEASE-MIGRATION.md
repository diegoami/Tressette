# Release repository consolidation — 2026-10-25

Downloads now live in the public [source repository](https://github.com/diegoami/Tressette/releases).
All ten releases from `diegoami/tressette-releases` were copied, preserving
their titles, notes, asset names, asset labels and prerelease status. The 26
assets include the original checksum files. No historical binary was rebuilt
or modified. `v1.0.8` remains latest; `v1.0.7-beta.1` remains a prerelease.

[RELEASE-ASSETS.json](RELEASE-ASSETS.json) records every asset's size and SHA-256.
Original downloads were checked against GitHub asset digests and each original
`SHA256SUMS.txt`; destination downloads were independently hashed and compared
with the originals, including the checksum files themselves. GitHub assigns new
release IDs, asset IDs and publication timestamps to the copies; original dates
are listed below. Original release notes are unchanged.

| Release | Original publication (UTC) | Tag treatment |
|---|---|---|
| v1.0.0 | 2026-09-19 17:50:22 | original legacy tag imported unchanged |
| v1.0.1 | 2026-09-19 19:05:25 | original legacy tag imported unchanged |
| v1.0.2 | 2026-09-19 20:03:45 | original legacy tag imported unchanged |
| v1.0.3 | 2026-09-21 17:26:46 | original legacy tag imported unchanged |
| v1.0.4 | 2026-09-23 12:47:41 | existing source tag reused |
| v1.0.5 | 2026-09-26 18:15:57 | existing source tag reused |
| v1.0.6 | 2026-09-27 18:45:09 | existing source tag reused |
| v1.0.7-beta.1 | 2026-09-28 09:54:37 | original legacy tag imported unchanged |
| v1.0.7 | 2026-09-28 12:48:37 | existing source tag reused |
| v1.0.8 | 2026-10-18 21:12:28 | existing source tag reused; latest |

## Legacy provenance exceptions

There were no source tags for `v1.0.0`–`v1.0.3` or `v1.0.7-beta.1`.
Their original lightweight tags all point to commit
`bd49ef9dd83bb5b73d4e6bc3a94a5f7bb21cb08b`, a README snapshot from the former
binary repository. These five tags were imported without changing their object
IDs. They are historical release anchors, **not verified source commits**.
GitHub's automatically generated source archives for these tags consequently
contain that legacy snapshot, not the app source. Future publishing still
requires an annotated source tag on main, pushed to origin, and now also uses
`gh release create --verify-tag` to prohibit implicit tags.

The original beta notes explicitly identify source commit
`34d691af71d6b7238310e96202b65ec1eb48ddb6`, also the existing stable `v1.0.7`
source tag's commit. That statement is preserved; the old beta tag is not moved.
Beta and stable binaries have different digests and were copied separately.

The four earliest notes give no source commit. Read-only APK inspection found
both `assets/public/index.html` and `assets/public/engine.js` in source history:
for v1.0.0–v1.0.2 after CRLF-to-LF normalization, and for v1.0.3 byte for byte.
[RELEASE-LEGACY.json](RELEASE-LEGACY.json) records the blob IDs and matches.
Matching two files does not establish the full native build's provenance, so
no source commit was inferred or retrospectively tagged for these releases.

## Retired repository and links

The former repository contained only its bilingual README. Its downloads,
rules, strategy tips and credits are preserved in [DOWNLOADS.md](DOWNLOADS.md),
with current destinations, alongside [RULES.md](RULES.md) and [REGOLE.md](REGOLE.md).
The former README now points here; that repository is archived with every old
release, tag and asset retained. Links embedded in installed apps continue to
resolve there. No GitHub repository rename or asset deletion was performed.

Merging the consolidation PR deploys the website and `/android` and `/windows`
redirect changes. Future packaged apps will carry the new links; already
installed historical apps remain unchanged. Privacy and contact information is
linked from the source README and bilingual downloads page in [PRIVACY.md](PRIVACY.md).
