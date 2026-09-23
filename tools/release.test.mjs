// The release tooling's decisions, held without an SDK, a keystore, a device or
// the network — the gap issue #26 names. The last case is the integration one:
// the real script, run for a dry run, must not reach `gh release create`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  EXPECTED_CERT, parseVersion, newestTag, newestBuildTools,
  parseCertDigest, certificateMatches, signatureVerdict,
  parseChecksums, checksumProblems, releaseCreateArgs,
  releaseAssets, versionDeclarations, versionDisagreements, exeProblem, releaseNotes,
  pickJdk, buildSource, publishTagProblems, versionCodeProblem, previousTag,
} from './release_lib.mjs';

// --- #23: the newest staged version is the highest number, not the last string

test("tags are ordered by number, not by string (#23)", () => {
  assert.deepEqual(parseVersion('v1.2.30'), [1, 2, 30]);
  assert.equal(parseVersion('v1.0'), null);
  assert.equal(parseVersion('1.0.0'), null);
  assert.equal(parseVersion('v1.0.0-rc1'), null);

  assert.equal(newestTag(['v1.9.0', 'v1.10.0', 'v2.0.0']), 'v2.0.0');
  // The pair that did it: plain .sort() puts v1.9.0 last and publishes it.
  assert.equal(newestTag(['v1.9.0', 'v1.10.0']), 'v1.10.0');
  assert.equal(newestTag(['v1.10.0', 'v1.2.30']), 'v1.10.0');
  assert.equal(newestTag(['not-a-tag', 'v1.0.0', '2.0.0']), 'v1.0.0');
  assert.equal(newestTag([]), null);
  assert.equal(newestTag(['nonsense']), null);
});

// --- #22: build-tools chosen by number, stable beats a preview of the same one

test("build-tools are chosen by number, not lexicographically (#22)", () => {
  assert.equal(newestBuildTools(['34.0.0', '35.0.0']), '35.0.0');
  assert.equal(newestBuildTools(['9.0.0', '10.0.0']), '10.0.0');
  assert.equal(newestBuildTools(['35.0.0-rc1', '35.0.0']), '35.0.0',
    'a stable release beats a preview carrying the same number');
  assert.equal(newestBuildTools(['35.0.0', '35.0.0-rc2']), '35.0.0');
  assert.equal(newestBuildTools(['35.0.0-rc1', '35.0.0-rc2']), '35.0.0-rc2');
  assert.equal(newestBuildTools(['nope', '']), null);
});

// --- #22: the signature must be present, valid, and on the recorded key

test("the certificate is read from apksigner, colon or not", () => {
  const plain = 'Signer #1 certificate SHA-256 digest: ' + EXPECTED_CERT.toUpperCase();
  assert.equal(parseCertDigest(plain), EXPECTED_CERT);
  const colons = 'SHA-256 digest: ' +
    EXPECTED_CERT.match(/../g).join(':');
  assert.equal(parseCertDigest(colons), EXPECTED_CERT);
  assert.equal(parseCertDigest('no digest here'), null);
  assert.equal(parseCertDigest(undefined), null);

  assert.equal(certificateMatches(EXPECTED_CERT), true);
  assert.equal(certificateMatches(EXPECTED_CERT.toUpperCase()), true);
  assert.equal(certificateMatches('deadbeef'), false);
  assert.equal(certificateMatches(null), false);
});

test("a missing verifier fails closed, and so does the wrong key (#22)", () => {
  assert.equal(signatureVerdict({ verify: null }).ok, false,
    'no apksigner is a refusal, not a skip');
  assert.equal(signatureVerdict({ verify: { status: 1, stdout: '', stderr: 'bad' } }).ok, false);
  assert.equal(signatureVerdict({
    verify: { status: 0, stdout: 'Signer #1 certificate SHA-256 digest: deadbeef' },
  }).ok, false, 'a verified signature on someone else\u2019s key is not ours');

  const good = { status: 0, stdout: 'SHA-256 digest: ' + EXPECTED_CERT };
  assert.deepEqual(signatureVerdict({ verify: good }), { ok: true, signer: EXPECTED_CERT });
});

// --- #26: checksum validation, with the file reads injected

test("a staged directory verifies, or says exactly what is wrong", () => {
  const apk = 'Tressette-1.0.0-android.apk';
  const hash = 'a'.repeat(64);
  const manifest = `${hash}  ${apk}\n`;
  assert.deepEqual(parseChecksums(manifest), [{ hash, name: apk }]);

  assert.deepEqual(checksumProblems(manifest, (n) => (n === apk ? hash : null)), []);

  assert.deepEqual(checksumProblems(manifest, () => null), [`missing ${apk}`]);
  assert.deepEqual(checksumProblems(manifest, () => 'b'.repeat(64)),
    [`${apk} does not match SHA256SUMS.txt`]);

  assert.equal(checksumProblems('garbage, not a manifest', () => null).length, 1,
    'a truncated manifest must not parse to "nothing missing"');
  assert.deepEqual(checksumProblems('', () => null), ['SHA256SUMS.txt is empty']);
});

// --- #26: the dry run is a property of a function, not of a human watching

test("without --confirm there are no release-create arguments", () => {
  const base = {
    tag: 'v1.0.0', version: '1.0.0', dir: path.join('root', 'dist-release', 'v1.0.0'),
    assets: releaseAssets('1.0.0'), releasesRepo: 'diegoami/tressette-releases',
    notesFile: path.join('tmp', 'notes.md'),
  };
  assert.equal(releaseCreateArgs({ ...base, confirm: false }), null,
    'the default publish path cannot write');

  const args = releaseCreateArgs({ ...base, confirm: true });
  assert.deepEqual(args.slice(0, 2), ['release', 'create']);
  assert.equal(args[2], 'v1.0.0');
  assert.ok(args.includes('--notes-file'));
  assert.ok(!args.includes('--confirm'));
  for (const name of [...releaseAssets('1.0.0'), 'SHA256SUMS.txt'])
    assert.ok(args.some((a) => a.endsWith(name)), `the release uploads ${name}`);
});

// --- the desktop build: one version line, both assets, a real executable

// The texts as each file writes them, at one version. The tests below start
// from these and break one thing each.
const declared = (v) => ({
  gradle: `android {\n    defaultConfig {\n        versionCode 5\n        versionName "${v}"\n    }\n}\n`,
  tauriConf: JSON.stringify({ productName: 'Tressette', version: v }),
  cargoToml: `[package]\nname = "tressette"\nversion = "${v}"\nedition = "2021"\n`,
  packageJson: JSON.stringify({ name: 'tressette-desktop', version: v }),
  packageLock: JSON.stringify({ version: v, packages: { '': { version: v } } }),
  cargoLock: `[[package]]\nname = "tauri"\nversion = "2.11.6"\n\n` +
             `[[package]]\nname = "tressette"\nversion = "${v}"\n`,
});

test("every version declaration is read, and one that disagrees is named", () => {
  const all = versionDeclarations(declared('1.0.4'));
  assert.equal(Object.keys(all).length, 7);
  assert.deepEqual(versionDisagreements('1.0.4', all), []);

  // The bump that forgets the lockfiles, which is the easy one to forget.
  const stale = versionDeclarations({ ...declared('1.0.4'),
    packageLock: declared('1.0.3').packageLock, cargoLock: declared('1.0.3').cargoLock });
  assert.deepEqual(versionDisagreements('1.0.4', stale), [
    'desktop/package-lock.json version: 1.0.3',
    'desktop/package-lock.json packages[""].version: 1.0.3',
    'desktop/src-tauri/Cargo.lock tressette version: 1.0.3',
  ]);

  // Unreadable is not agreeing, and Cargo.lock is read whatever its line ends.
  const odd = versionDeclarations({ ...declared('1.0.4'), tauriConf: '{ not json',
    cargoLock: declared('1.0.4').cargoLock.replace(/\n/g, '\r\n') });
  assert.deepEqual(versionDisagreements('1.0.4', odd),
    ['desktop/src-tauri/tauri.conf.json version: (missing)']);
});

// The check package_release makes, on the repository as it is. A version bump
// that misses a declaration fails here, on the pull request, rather than on
// release day.
test("the repository's version declarations agree with each other", () => {
  const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  const all = versionDeclarations({
    gradle: read('mobile/android/app/build.gradle'),
    tauriConf: read('desktop/src-tauri/tauri.conf.json'),
    cargoToml: read('desktop/src-tauri/Cargo.toml'),
    packageJson: read('desktop/package.json'),
    packageLock: read('desktop/package-lock.json'),
    cargoLock: read('desktop/src-tauri/Cargo.lock'),
  });
  const version = all['mobile/android/app/build.gradle versionName'];
  assert.ok(parseVersion(`v${version}`), `versionName ${version} is X.Y.Z`);
  assert.deepEqual(versionDisagreements(version, all), []);
});

// The JDK Android Studio bundles was 25 when this was written, and Gradle 8.14
// fails on it with "Unsupported class file major version 69": the first
// fallback tried took that JDK because it was there. A 21 is what is looked for.
test("the Android build is given a JDK 21, not whichever JDK is found first", () => {
  const release = (v) => `JAVA_VERSION="${v}"\nIMPLEMENTOR="JetBrains s.r.o."\n`;
  assert.equal(pickJdk([['studio', release('25.0.3')], ['jbr-21', release('21.0.11')]]), 'jbr-21');
  assert.equal(pickJdk([['a', release('21')], ['b', release('21.0.1')]]), 'a');
  assert.equal(pickJdk([['old', release('17.0.9')], ['new', release('25.0.3')]]), null);
  assert.equal(pickJdk([['no release file', null], ['garbage', 'hello']]), null);
  assert.equal(pickJdk([]), null);
});

// --- a milestone is an annotated tag on main, and the release is built from it

const HEAD = 'a'.repeat(40), OTHER = 'b'.repeat(40);
const tagged = { version: '1.0.5', head: HEAD, tagCommit: HEAD, tagType: 'tag', onMain: true, clean: true };

test("a publishable build comes only from the annotated tag, on main, unchanged", () => {
  assert.deepEqual(buildSource(tagged), { ok: true, kind: 'release', dir: 'v1.0.5' });

  // Every way a build can claim a tag it is not.
  const refused = (facts, why) => {
    const r = buildSource({ ...tagged, ...facts });
    assert.equal(r.ok, false, why);
    return r.reason;
  };
  assert.match(refused({ clean: false }, 'edited files'), /differ from HEAD/);
  assert.match(refused({ onMain: false }, 'a branch'), /not on origin\/main/);
  assert.match(refused({ tagCommit: OTHER }, 'a later commit'), /points at bbbbbbb.*HEAD is aaaaaaa/);
  assert.match(refused({ tagType: 'commit' }, 'lightweight'), /lightweight/);
  assert.match(refused({ tagCommit: null }, 'no tag yet'), /not tagged v1\.0\.5.*--candidate/s);
  // --candidate never turns a tag mismatch into a build.
  assert.equal(buildSource({ ...tagged, tagCommit: OTHER, candidate: true }).ok, false);
});

test("a candidate build is for the device checks, and is staged where publish never looks", () => {
  const r = buildSource({ ...tagged, tagCommit: null, candidate: true });
  assert.deepEqual(r, { ok: true, kind: 'candidate', dir: 'candidate-aaaaaaa' });
  assert.equal(parseVersion(r.dir), null, 'publish_release only reads vX.Y.Z directories');
  assert.equal(newestTag(['v1.0.4', r.dir]), 'v1.0.4');
  // A candidate is still a commit on main, unchanged.
  assert.equal(buildSource({ ...tagged, tagCommit: null, candidate: true, onMain: false }).ok, false);
  assert.equal(buildSource({ ...tagged, tagCommit: null, candidate: true, clean: false }).ok, false);
});

test("publishing needs the annotated tag here and on the origin, the same one", () => {
  const T = 'c'.repeat(40);
  const good = { tag: 'v1.0.5', localObject: T, remoteObject: T, type: 'tag', onMain: true };
  assert.deepEqual(publishTagProblems(good), []);
  assert.deepEqual(publishTagProblems({ ...good, localObject: null }),
    ['there is no tag v1.0.5 here: a release is built from its tag']);
  assert.deepEqual(publishTagProblems({ ...good, remoteObject: null }),
    ['v1.0.5 is not on the origin: git push origin v1.0.5']);
  assert.deepEqual(publishTagProblems({ ...good, remoteObject: 'd'.repeat(40) }),
    ['v1.0.5 on the origin is not the v1.0.5 here']);
  assert.deepEqual(publishTagProblems({ ...good, type: 'commit', onMain: false }),
    ['v1.0.5 is a lightweight tag, and a milestone is an annotated one', 'v1.0.5 is not on origin/main']);
});

test("the release notes name the tagged commit", () => {
  const sha = 'e'.repeat(40);
  const notes = releaseNotes('1.0.5', { commit: sha });
  assert.ok(notes.includes(`Costruita dal tag \`v1.0.5\` di diegoami/Tressette, commit \`${sha}\`.`));
  assert.ok(!releaseNotes('1.0.5').includes('Costruita'), 'no commit, no line');
});

// --- #58: versionCode moves with versionName, measured from the previous tag

const gradleAt = (name, code) =>
  `android {\n    defaultConfig {\n        versionCode ${code}\n        versionName "${name}"\n    }\n}\n`;

test("versionCode has to move when versionName does, and only then (#58)", () => {
  const prev = { prevGradle: gradleAt('1.0.4', 5), prevTag: 'v1.0.4' };
  assert.equal(versionCodeProblem({ gradle: gradleAt('1.0.5', 6), ...prev }), null);
  assert.equal(versionCodeProblem({ gradle: gradleAt('1.0.4', 5), ...prev }), null, 'no bump yet');
  // The review's case: every declaration at 1.0.5, versionCode left at 5.
  assert.match(versionCodeProblem({ gradle: gradleAt('1.0.5', 5), ...prev }),
    /moved from 1\.0\.4 \(v1\.0\.4\) to 1\.0\.5, but versionCode 5 is not above 5/);
  assert.match(versionCodeProblem({ gradle: gradleAt('1.0.5', 4), ...prev }), /not above 5/);
  assert.match(versionCodeProblem({ gradle: gradleAt('1.0.4', 6), ...prev }), /move both or neither/);
  assert.match(versionCodeProblem({ gradle: 'versionName "1.0.5"', ...prev }), /\(missing\)/);
  // Before the first milestone there is nothing to measure against.
  assert.equal(versionCodeProblem({ gradle: gradleAt('1.0.4', 5), prevGradle: null, prevTag: null }), null);

  assert.equal(previousTag(['v1.0.4', 'v1.0.5', ''], 'v1.0.5'), 'v1.0.4');
  assert.equal(previousTag(['v1.0.4'], 'v1.0.4'), null);
  assert.equal(previousTag(['v1.0.9', 'v1.0.10', 'v1.1.0'], 'v1.1.0'), 'v1.0.10');
});

// The same check on the repository, against its own previous milestone tag. A
// shallow clone has no tags to measure from, which is why CI's engine job
// fetches the whole history; anywhere else a missing tag fails here.
test("the repository's versionCode has moved with its versionName since the last tag", (t) => {
  const git = (...args) => spawnSync('git', args, {
    cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  if (git('rev-parse', '--is-shallow-repository').stdout.trim() === 'true')
    return t.skip('a shallow clone has no tags to measure from');
  const gradle = readFileSync(new URL('../mobile/android/app/build.gradle', import.meta.url), 'utf8');
  const tag = `v${/versionName\s+"([^"]+)"/.exec(gradle)[1]}`;
  const tags = git('tag', '--list', 'v*', '--merged', 'HEAD').stdout.split('\n');
  const prevTag = previousTag(tags, tag);
  assert.ok(prevTag || tags.includes(tag), 'at least the baseline milestone tag is reachable from HEAD');
  const prevGradle = prevTag ? git('show', `${prevTag}:mobile/android/app/build.gradle`).stdout : null;
  assert.equal(versionCodeProblem({ gradle, prevGradle, prevTag }), null);
});

test("an executable that is missing, truncated or not PE is refused", () => {
  const exe = Buffer.alloc(2 * 1024 * 1024);
  exe[0] = 0x4d; exe[1] = 0x5a;
  assert.equal(exeProblem(exe), null);
  assert.match(exeProblem(null), /not there/);
  assert.match(exeProblem(exe.subarray(0, 4096)), /only 4096 bytes/);
  const notPe = Buffer.from(exe);
  notPe[0] = 0x3c;   // '<': an HTML error page saved under the .exe's name
  assert.match(exeProblem(notPe), /not a Windows binary/);
});

test("a release stages both assets and nothing else", () => {
  const assets = releaseAssets('1.0.4');
  assert.deepEqual(assets, ['Tressette-1.0.4-android.apk', 'Tressette-1.0.4-windows-x64.exe']);
  const hash = 'c'.repeat(64);
  const ok = () => hash;
  const both = assets.map((n) => `${hash}  ${n}`).join('\n') + '\n';
  const present = [...assets, 'SHA256SUMS.txt'];
  assert.deepEqual(checksumProblems(both, ok, { expected: assets, present }), []);

  // An APK-only manifest verifies against itself, and is still half a release.
  assert.deepEqual(checksumProblems(`${hash}  ${assets[0]}\n`, ok, { expected: assets, present }), [
    `SHA256SUMS.txt does not list ${assets[1]}`,
    `${assets[1]} is staged but not in SHA256SUMS.txt`,
  ]);
  // Another version's file listed, and a stray file staged.
  const old = both + `${hash}  Tressette-1.0.3-android.apk\n`;
  assert.deepEqual(checksumProblems(old, ok, { expected: assets, present: [...present, 'notes.md'] }), [
    'Tressette-1.0.3-android.apk is not a release asset',
    'notes.md is staged but not in SHA256SUMS.txt',
  ]);
});

test("the release notes name both files and say what SmartScreen will show", () => {
  const notes = releaseNotes('1.0.4', { subtitle: 'la prima versione per Windows' });
  assert.match(notes, /^Tressette 1\.0\.4: la prima versione per Windows\./);
  for (const name of releaseAssets('1.0.4')) assert.ok(notes.includes(name), name);
  assert.match(notes, /Windows ha protetto il PC/);
  assert.match(notes, /Esegui comunque/);
  assert.match(notes, /SHA256SUMS\.txt/);
  assert.match(releaseNotes('1.0.4'), /^Tressette 1\.0\.4\.\n/);
});

// --- #26: the integration half — the real script, dry-run, does not create

test("the script's dry run exits clean and never calls gh release create",
  { skip: process.platform === 'win32' ? 'the gh shim here is a POSIX script' : false },
  () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'tressette-publish-'));
    mkdirSync(path.join(tmp, 'tools'));
    for (const f of ['publish_release.mjs', 'release_lib.mjs'])
      copyFileSync(new URL(`./${f}`, import.meta.url), path.join(tmp, 'tools', f));

    // A milestone to publish: the copy is a repository with the annotated tag
    // on main, pushed to an origin that is a bare repository beside it.
    const git = (cwd, ...args) => {
      const r = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
        { cwd, encoding: 'utf8' });
      assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    };
    const origin = mkdtempSync(path.join(tmpdir(), 'tressette-origin-'));
    git(origin, 'init', '-q', '--bare');
    git(tmp, 'init', '-q', '-b', 'main');
    git(tmp, 'add', 'tools');
    git(tmp, 'commit', '-q', '-m', 'the release');
    git(tmp, 'tag', '-a', 'v1.0.0', '-m', 'Tressette 1.0.0');
    git(tmp, 'remote', 'add', 'origin', origin);
    git(tmp, 'push', '-q', 'origin', 'main', 'v1.0.0');
    git(tmp, 'fetch', '-q', 'origin');

    const dir = path.join(tmp, 'dist-release', 'v1.0.0');
    mkdirSync(dir, { recursive: true });
    const rows = releaseAssets('1.0.0').map((name) => {
      writeFileSync(path.join(dir, name), `not really ${name}`);
      return `${createHash('sha256').update(`not really ${name}`).digest('hex')}  ${name}`;
    });
    writeFileSync(path.join(dir, 'SHA256SUMS.txt'), rows.join('\n') + '\n');

    // A gh that answers the two questions the script asks and records a create
    // if it is ever reached. `release view` fails, so the tag looks new.
    const bin = path.join(tmp, 'bin');
    mkdirSync(bin);
    const marker = path.join(tmp, 'created');
    writeFileSync(path.join(bin, 'gh'),
      '#!/bin/sh\n' +
      'case "$1" in\n' +
      '  --version) exit 0 ;;\n' +
      '  release) case "$2" in view) exit 1 ;; create) echo "$@" > ' +
      JSON.stringify(marker) + '; exit 0 ;; esac ;;\n' +
      'esac\n' +
      'exit 0\n');
    chmodSync(path.join(bin, 'gh'), 0o755);

    const res = spawnSync(process.execPath, [path.join(tmp, 'tools', 'publish_release.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH },
    });

    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /dry run/);
    assert.match(res.stdout, /Costruita dal tag `v1\.0\.0`/, 'the notes name the tagged commit');
    assert.equal(existsSync(marker), false,
      'a dry run must not reach gh release create');
  });
