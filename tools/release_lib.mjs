/**
 * The decisions behind tools/package_release.mjs and tools/publish_release.mjs,
 * as pure functions.
 *
 * The release scripts run rarely, on the one boundary here that is hard to take
 * back, and their choices — which staged version is newest, which build-tools
 * to trust, whether the signature is the right one, whether the staged files
 * still hash to what the manifest says — used to live inline and were exercised
 * only on release day. They are here so `tools/release.test.mjs` can hold them
 * without an SDK, a keystore, a device or the network (issues #22, #23, #26).
 *
 * Nothing here touches the filesystem, `process`, a clock or an rng.
 */
import path from 'node:path';

// The SHA-256 digest of the release certificate, recorded in ANDROID.md §3.
// Every future release must be signed with this key: Android treats a different
// signer as a different app, and no installed copy will take it as an update.
export const EXPECTED_CERT =
  '5143a96256f142b37bee8929b4e53257e5b5cd9a55ae80eee9c26fd5061aaae4';

// `vX.Y.Z` (the only shape package_release writes) to [X, Y, Z], else null.
export function parseVersion(name){
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(name);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// The highest tag numerically. #23: default `.sort()` compares strings, so it
// puts v1.10.0 before v1.9.0 and hands publish_release the wrong directory the
// first time a component reaches two digits.
export function newestTag(names){
  return names
    .filter((n) => parseVersion(n))
    .sort((a, b) => {
      const x = parseVersion(a), y = parseVersion(b);
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .at(-1) ?? null;
}

// The build-tools directory to use, chosen by number. Android names them
// `X.Y.Z` or `X.Y.Z-suffix` (rc, preview, …); a stable release of a given
// number beats a preview of the same number. #22: the old code took the
// lexicographically last, so `9.0.0` beat `10.0.0`.
export function newestBuildTools(names){
  const key = (n) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(n);
    if (!m) return null;
    return { maj: +m[1], min: +m[2], pat: +m[3], stable: m[4] === '' ? 1 : 0, rest: m[4] };
  };
  return names
    .filter((n) => key(n))
    .sort((a, b) => {
      const x = key(a), y = key(b);
      return x.maj - y.maj || x.min - y.min || x.pat - y.pat ||
        x.stable - y.stable || x.rest.localeCompare(y.rest);
    })
    .at(-1) ?? null;
}

// The SHA-256 certificate digest apksigner prints, lowercased and unpunctuated
// so a colon-separated form and a plain one compare equal.
export function parseCertDigest(output){
  const m = /SHA-256 digest:\s*([0-9a-fA-F:\s]+)/i.exec(output || '');
  return m ? m[1].replace(/[^0-9a-fA-F]/g, '').toLowerCase() : null;
}

export function certificateMatches(digest, expected = EXPECTED_CERT){
  return typeof digest === 'string' && digest.toLowerCase() === expected.toLowerCase();
}

// The decision step 4 of package_release has to make. `verify` is null when no
// apksigner could be run at all. #22: absence used to mean "do not check", and
// the APK was staged anyway; now it fails closed, and a verified signature on
// the wrong certificate fails too.
export function signatureVerdict({ verify }){
  if (!verify)
    return { ok: false, reason:
      'apksigner was not found under the SDK build-tools, so the APK could not be ' +
      'verified. An unverified build is not staged (issue #22): install build-tools ' +
      'or point ANDROID_HOME at an SDK that has them.' };
  if (verify.status !== 0)
    return { ok: false, reason:
      `the APK does not verify:\n${verify.stdout ?? ''}${verify.stderr ?? ''}` };
  const digest = parseCertDigest(verify.stdout);
  if (!digest)
    return { ok: false, reason: 'apksigner printed no SHA-256 certificate digest.' };
  if (!certificateMatches(digest))
    return { ok: false, reason:
      `signed with ${digest}, expected ${EXPECTED_CERT}. That is the wrong key: an APK ` +
      'signed by anything else cannot update an installed copy. Stop.' };
  return { ok: true, signer: digest };
}

// The JDK the Android build is made with: 21 (ANDROID.md §2). Gradle 8.14
// refuses a newer class file outright ("Unsupported class file major version
// 69" is Java 25, which is what Android Studio now bundles), and nothing older
// runs Capacitor 8. `candidates` are [dir, text of dir/release] pairs, in order
// of preference; the first whose JAVA_VERSION is 21.x wins, or null.
export const JDK_MAJOR = 21;
export function pickJdk(candidates){
  for (const [dir, release] of candidates){
    const v = /^JAVA_VERSION="(\d+)[."]/m.exec(release ?? '')?.[1];
    if (Number(v) === JDK_MAJOR) return dir;
  }
  return null;
}

// The assets a release stages, both of them, always. The desktop build ships
// beside the APK on one version line (DESKTOP.md), so a staged directory
// holding one of the two is a half-built release, not a smaller one.
export function releaseAssets(version){
  return [`Tressette-${version}-android.apk`, `Tressette-${version}-windows-x64.exe`];
}

// Every place the version is declared, read from their texts. Android's
// versionName is the source; the desktop wrapper declares it five more times,
// and a bump that misses one ships an .exe whose metadata disagrees with its
// tag, or leaves cargo to rewrite the committed lockfile during the release
// build. Nothing here reads a file: the caller passes the texts.
export function versionDeclarations(t){
  const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const lock = json(t.packageLock);
  return {
    'mobile/android/app/build.gradle versionName':
      /versionName\s+["']([^"']+)["']/.exec(t.gradle ?? '')?.[1],
    'desktop/src-tauri/tauri.conf.json version': json(t.tauriConf)?.version,
    'desktop/src-tauri/Cargo.toml version':
      /^version\s*=\s*"([^"]+)"/m.exec(t.cargoToml ?? '')?.[1],
    'desktop/package.json version': json(t.packageJson)?.version,
    'desktop/package-lock.json version': lock?.version,
    'desktop/package-lock.json packages[""].version': lock?.packages?.['']?.version,
    'desktop/src-tauri/Cargo.lock tressette version':
      /\[\[package\]\]\r?\nname = "tressette"\r?\nversion = "([^"]+)"/.exec(t.cargoLock ?? '')?.[1],
  };
}

// The declarations that do not say `version`, as `where: value` lines. A
// declaration that cannot be read at all disagrees too: `(missing)` is not a
// version.
export function versionDisagreements(version, declarations){
  return Object.entries(declarations)
    .filter(([, value]) => value !== version)
    .map(([where, value]) => `${where}: ${value ?? '(missing)'}`);
}

// Why these bytes are not a Windows executable, or null if they could be. The
// desktop counterpart of refusing an unsigned APK: a missing, truncated or
// non-PE file must never be staged. 1 MB is far under the ~11 MB a build is
// and far over anything an interrupted copy or an error page would be.
export function exeProblem(bytes){
  if (!bytes) return 'the desktop executable is not there';
  if (bytes.length < 1024 * 1024)
    return `the desktop executable is only ${bytes.length} bytes, which is not a build`;
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a)
    return 'the desktop executable does not start with "MZ", so it is not a Windows binary';
  return null;
}

// `SHA256SUMS.txt` rows — `<64 hex><space><name>` — the shape `sha256sum`
// writes. Malformed input throws rather than parsing to an empty list, because
// an empty manifest that "verifies" is the failure mode this guards.
export function parseChecksums(text){
  return String(text).trim().split('\n').filter(Boolean).map((line) => {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (!m) throw new Error(`malformed SHA256SUMS line: ${line}`);
    return { hash: m[1], name: m[2] };
  });
}

// Everything wrong with a staged directory, given a `hashOf(name)` that returns
// the actual digest or null when the file is absent. Empty means staged intact.
//
// `expected`, when given, is the exact set of assets the manifest must list:
// the manifest verifying against itself says nothing about a release it forgot
// a file from. `present`, when given, is every file in the directory, and one
// the manifest does not list is a problem too, because publish uploads what
// the manifest names and a stray file means the staging was not what it said.
export function checksumProblems(manifestText, hashOf, { expected, present } = {}){
  let rows;
  try { rows = parseChecksums(manifestText); }
  catch (e){ return [e.message]; }
  if (!rows.length) return ['SHA256SUMS.txt is empty'];
  const problems = [];
  for (const { name, hash } of rows){
    const actual = hashOf(name);
    if (actual === null) problems.push(`missing ${name}`);
    else if (actual !== hash) problems.push(`${name} does not match SHA256SUMS.txt`);
  }
  const listed = new Set(rows.map((r) => r.name));
  for (const name of expected ?? [])
    if (!listed.has(name)) problems.push(`SHA256SUMS.txt does not list ${name}`);
  for (const name of rows.map((r) => r.name))
    if (expected && !expected.includes(name)) problems.push(`${name} is not a release asset`);
  for (const name of present ?? [])
    if (name !== 'SHA256SUMS.txt' && !listed.has(name))
      problems.push(`${name} is staged but not in SHA256SUMS.txt`);
  return problems;
}

// The release notes, in Italian to match the game. The Windows paragraph is
// the one place a player meets the unsigned-first decision (DESKTOP.md): it
// says what SmartScreen will show and how to get past it. `subtitle` is the
// one line that changes from release to release.
export function releaseNotes(version, { subtitle } = {}){
  const [apk, exe] = releaseAssets(version);
  const title = subtitle ? `Tressette ${version}: ${subtitle}.` : `Tressette ${version}.`;
  return `${title}\n\n` +
    `**Windows:** scarica \`${exe}\` e avvialo. L'eseguibile non è firmato ` +
    `digitalmente, quindi Windows mostrerà l'avviso «Windows ha protetto il PC»: ` +
    `clicca «Ulteriori informazioni», poi «Esegui comunque». È portabile, senza ` +
    `installer: mettilo dove preferisci.\n\n` +
    `**Android:** \`${apk}\`: apri il file sul telefono e consenti ` +
    `l'installazione da questa fonte.\n\n` +
    `Lo storico delle mani resta sul dispositivo: niente lascia il telefono o ` +
    `il computer.\n\n` +
    `**Gioca nel browser:** https://tresettette.netlify.app/\n\n` +
    `Checksum SHA-256 in \`SHA256SUMS.txt\`.\n`;
}

// The `gh release create` arguments, or null on a dry run. This is the one
// irreversible step, and returning null for the default keeps the no-write
// guarantee in a function that a test can call, not only in a process a human
// watches.
export function releaseCreateArgs({ confirm, tag, version, dir, assets, releasesRepo, notesFile }){
  if (!confirm) return null;
  return ['release', 'create', tag,
    ...assets.map((name) => path.join(dir, name)), path.join(dir, 'SHA256SUMS.txt'),
    '-R', releasesRepo, '--title', `Tressette ${version}`, '--notes-file', notesFile];
}
