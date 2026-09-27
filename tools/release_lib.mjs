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

// Where a build comes from, and so where it may be staged. A release is a
// milestone: an annotated tag vX.Y.Z on main, on the exact commit that was
// reviewed (AGENTS.md, Releases), and a publishable build is made from that
// tag and nothing else. `candidate` is the one other build there is: the
// untagged candidate commit, built for the device checks that must happen
// before the tag, and staged where publish_release never looks.
//
// Facts in: `head` and `tagCommit` are full SHAs (tagCommit null when there is
// no tag vX.Y.Z), `tagType` is what `git cat-file -t` says of the tag, `onMain`
// is whether HEAD is on origin/main, `clean` is whether tracked files match
// HEAD. Returns { ok, dir, kind } or { ok: false, reason }.
export function buildSource({ version, head, tagCommit, tagType, onMain, clean, candidate }){
  const tag = `v${version}`;
  const no = (reason) => ({ ok: false, reason });
  if (!clean)
    return no('tracked files differ from HEAD, so the build would not be the commit it names. ' +
              'Commit or stash them first.');
  if (!onMain)
    return no(`HEAD ${head.slice(0, 7)} is not on origin/main. A milestone is a commit on main; ` +
              'fetch, and check out the candidate or the tag.');
  if (tagCommit && tagCommit !== head)
    return no(`${tag} exists and points at ${tagCommit.slice(0, 7)}, but HEAD is ${head.slice(0, 7)}. ` +
              `Check out ${tag} to build the release.`);
  if (tagCommit && tagType !== 'tag')
    return no(`${tag} is a lightweight tag. A milestone is an annotated tag: ` +
              `git tag -a ${tag} -m "Tressette ${version}" <sha>.`);
  if (tagCommit) return { ok: true, kind: 'release', dir: tag };
  if (candidate) return { ok: true, kind: 'candidate', dir: `candidate-${head.slice(0, 7)}` };
  return no(`HEAD is not tagged ${tag}. The tag comes first, on the reviewed commit ` +
            '(AGENTS.md, Releases); build from it. For the device checks before the tag, ' +
            'pass --candidate: that build is staged where publish_release never looks.');
}

// Why a release cannot be built in this checkout, or null. It is built in a
// worktree of its own (AGENTS.md), never in the main
// checkout, which may hold someone's work in progress.
// A linked worktree's git dir is its own, under the common one; the main
// checkout's git dir is the common dir. Both are absolute paths from
// `git rev-parse --path-format=absolute`.
export function releaseCheckoutProblem({ gitDir, commonDir }){
  const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  if (!gitDir || !commonDir) return 'this is not a git checkout';
  if (same(gitDir, commonDir))
    return 'this is the main checkout, where no release is built (AGENTS.md). Fetch, then ' +
      'git worktree add --detach <main>/../Tressette-work/release-<tag or sha> <tag or sha>, ' +
      'and run the packager from there (ANDROID.md §4).';
  return null;
}

// Why publishing `tag` must not go ahead, from the tag's facts here and on the
// origin: `localObject` and `remoteObject` are the tag objects' SHAs (null when
// absent), `type` what `git cat-file -t` says, `onMain` whether its commit is
// on origin/main. The release notes name the tagged commit, and a tag that
// exists only on this machine names a commit nobody else can find.
export function publishTagProblems({ tag, localObject, remoteObject, type, onMain }){
  const problems = [];
  if (!localObject) problems.push(`there is no tag ${tag} here: a release is built from its tag`);
  else {
    if (type !== 'tag') problems.push(`${tag} is a lightweight tag, and a milestone is an annotated one`);
    if (!onMain) problems.push(`${tag} is not on origin/main`);
    if (!remoteObject) problems.push(`${tag} is not on the origin: git push origin ${tag}`);
    else if (remoteObject !== localObject)
      problems.push(`${tag} on the origin is not the ${tag} here`);
  }
  return problems;
}

// The assets a release stages, both of them, always. The desktop build ships
// beside the APK on one version line (DESKTOP.md), so a staged directory
// holding one of the two is a half-built release, not a smaller one.
export function releaseAssets(version){
  return [`Tressette-${version}-android.apk`, `Tressette-${version}-windows-x64.exe`];
}

// Every place the version is declared, read from their texts. Android's
// versionName is the source; the desktop wrapper declares it six more times,
// in five files (package-lock.json holds it twice, #67), and a bump that
// misses one ships an .exe whose metadata disagrees with its
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

// versionCode is the number Android compares to decide whether an APK is an
// update to the installed copy, so it is not a declaration of the version
// line: it only has to move with it. `versionDeclarations` holds versionName
// to the desktop's five, and this holds versionCode to the previous milestone
// tag's (#58, from v1.0.4's review: a bump that forgot it passed every gate).
// Given the gradle texts now and at `prevTag` (null when there is no earlier
// tag), returns why versionCode is wrong, or null.
const gradleName = (g) => /versionName\s+["']([^"']+)["']/.exec(g ?? '')?.[1] ?? null;
const gradleCode = (g) => { const m = /versionCode\s+(\d+)\b/.exec(g ?? ''); return m ? Number(m[1]) : null; };
export function versionCodeProblem({ gradle, prevGradle, prevTag }){
  const name = gradleName(gradle), code = gradleCode(gradle);
  if (!Number.isInteger(code) || code < 1)
    return `versionCode is ${code ?? '(missing)'}, not a positive integer`;
  if (!prevTag) return null;
  const prevName = gradleName(prevGradle), prevCode = gradleCode(prevGradle);
  if (prevCode === null) return `versionCode could not be read at ${prevTag}`;
  if (name === prevName && code !== prevCode)
    return `versionCode is ${code} but versionName is still ${name}, as at ${prevTag}, ` +
           `where versionCode was ${prevCode}: move both or neither`;
  if (name !== prevName && code <= prevCode)
    return `versionName moved from ${prevName} (${prevTag}) to ${name}, but versionCode ${code} ` +
           `is not above ${prevCode}: Android would refuse it as an update`;
  return null;
}

// The milestone before `tag`: the newest vX.Y.Z tag among `tags` (those
// reachable from HEAD) other than `tag` itself, or null.
export function previousTag(tags, tag){
  return newestTag(tags.filter((t) => t !== tag));
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
// one line that changes from release to release. `commit`, the full SHA the
// tag names, goes in too: the binaries live in another repository, and that
// line is how a release there leads back to the source it was built from.
export function releaseNotes(version, { subtitle, commit } = {}){
  const [apk, exe] = releaseAssets(version);
  const title = subtitle ? `Tressette ${version}: ${subtitle}.` : `Tressette ${version}.`;
  const source = commit
    ? `Costruita dal tag \`v${version}\` di diegoami/Tressette, commit \`${commit}\`.\n\n` : '';
  return `${title}\n\n${source}` +
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
