# mobile/ — the Android wrapper

Capacitor packages `public/` — the same directory Netlify serves — into an APK.
There is no build step and no `beforeBuildCommand`: `cap sync` copies the
directory as it stands, which is the whole point of a game that has no build.
See [`../ANDROID.md`](../ANDROID.md) for the rest.

## The identity, and why it is here

`capacitor.config.json` is where the app's identity is **recorded**. It is JSON
rather than a `capacitor.config.ts` because this project has no TypeScript
toolchain and this file does not justify introducing one.

| key | value | |
|---|---|---|
| `appId` | `com.tressette.app` | the package name — **permanent** |
| `appName` | `Tressette` | what shows under the icon; freely changeable |
| `webDir` | `../public` | relative to this file |

`appId` is the one that cannot be taken back. `cap add android` copies it into
`android/app/build.gradle` as `namespace` and `applicationId`, and from there it
goes into the manifest and into any store listing. Once an APK with that id has
been installed or published, a different id is a different app: it installs
alongside rather than upgrading, and the old one can never be updated again.
Changing it after `cap add android` means editing the generated Gradle files
too, or deleting `android/` and regenerating.

`appName` is only a label and can change in any release.

## Regenerating android/

`android/` is committed, minus `keystore.properties` and any `*.jks`, which must
never be. If it ever has to be rebuilt from scratch:

```sh
cd mobile
npm install
npx cap add android      # needs ANDROID_HOME
npx cap sync android
```

Then re-apply the two edits that are not Capacitor's defaults — the release
signing block in `android/app/build.gradle` and the version numbers — and
regenerate the launcher icons with `npx @capacitor/assets generate --android`.
