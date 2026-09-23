# desktop/ — the Tauri wrapper

Packages `public/`, the same directory Netlify serves, into a Windows desktop
app. Like `mobile/`'s Capacitor wrapper it adds **no build step**: `public/`
stays a directory of static files and Tauri embeds it unchanged, which is what
keeps the web build toolchain-free (`SPEC.md` §2).

| key | value | |
|---|---|---|
| identifier | `com.tressette.desktop` | **permanent**: it keys the webview's storage |
| frontendDist | `../../public` | relative to `src-tauri/tauri.conf.json` |
| window | 1280 × 800 | a size `tools/check_ui.mjs` checks the table at |

`com.tressette.desktop` cannot be changed after a release. `localStorage` is
scoped to the webview's origin, so a different identifier is a different app
with empty storage: the settings and the history of hands would be gone.

## Build

Needs a Rust toolchain with the MSVC build tools, and the WebView2 runtime,
which Windows 11 ships.

```sh
npm ci
npm run build        # tauri build --no-bundle
```

The executable lands at `src-tauri/target/release/tressette.exe`. It is
portable: one file, no installer.

Installers and code signing are deferred. A release builds this executable
beside the APK, from the milestone tag: `tools/package_release.mjs` and
`tools/publish_release.mjs`, in the order `../DESKTOP.md`'s Releasing section
and `../ANDROID.md` §4 give.

## Icons

Do not edit `src-tauri/icons/` by hand. They are cut with the web and Android
icons by `tools/make_icons.mjs`:

```sh
node tools/make_icons.mjs
```
