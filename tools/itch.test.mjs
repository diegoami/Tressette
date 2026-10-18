// The itch.io tooling's decisions, held without the network, butler or a real
// zip extractor (issue #95). The last cases exercise the hand-rolled ZIP
// encoder, which is the one piece that cannot be checked by reading source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIDECAR_SCHEMA, parseProject, channelAssets, channelTargets, stageName,
  itchStageFiles, releaseStageFiles, formatSidecar, parseSidecar,
  sidecarProblem, tagRef, branchHead, requiredStages,
} from './itch_lib.mjs';
import { crc32, buildZip } from './zip_lib.mjs';

const SHA = 'a'.repeat(40);

// --- the project slug is explicit, never guessed (#95 open question) ---

test('the itch project is an owner/slug, and nothing else', () => {
  assert.deepEqual(parseProject('diegoami/tressette'),
    { owner: 'diegoami', slug: 'tressette', target: 'diegoami/tressette' });
  for (const bad of [undefined, '', 'tressette', 'diegoami/', '/tressette',
                     'a/b/c', 'a b/c', 'diegoami/../etc', 'http://x/y',
                     'diegoami/tressette:html5'])
    assert.throws(() => parseProject(bad), /owner\/slug/, JSON.stringify(bad));
});

// --- the three channels map to one file each, and one --userversion ---

test('each butler channel carries exactly one named file', () => {
  assert.deepEqual(channelAssets('1.0.7'), {
    html5:   'Tressette-1.0.7-itch-html5.zip',
    windows: 'Tressette-1.0.7-windows-x64.exe',
    android: 'Tressette-1.0.7-android.apk',
  });
  assert.deepEqual(channelTargets('diegoami/tressette', '1.0.7'), [
    { channel: 'html5',   target: 'diegoami/tressette:html5',
      file: 'Tressette-1.0.7-itch-html5.zip',    userversion: '1.0.7' },
    { channel: 'windows', target: 'diegoami/tressette:windows',
      file: 'Tressette-1.0.7-windows-x64.exe',   userversion: '1.0.7' },
    { channel: 'android', target: 'diegoami/tressette:android',
      file: 'Tressette-1.0.7-android.apk',       userversion: '1.0.7' },
  ]);
  // The three filenames are distinct: a repeated ZIP is impossible.
  const files = Object.values(channelAssets('1.0.7'));
  assert.equal(new Set(files).size, 3);
});

test('a stage is vX.Y.Z for a release, candidate-<first seven> otherwise', () => {
  assert.equal(stageName({ kind: 'release', version: '1.0.7', commit: SHA }), 'v1.0.7');
  assert.equal(stageName({ kind: 'candidate', version: '1.0.7', commit: SHA }),
    'candidate-aaaaaaa');
  // The same seven-character form tools/package_release.mjs uses.
  assert.match(stageName({ kind: 'candidate', version: '1.0.7', commit: SHA }), /^candidate-[0-9a-f]{7}$/);
});

test('the itch stage holds the zip; the release stage keeps its exact two', () => {
  assert.deepEqual(itchStageFiles('1.0.7'), ['Tressette-1.0.7-itch-html5.zip']);
  assert.deepEqual(releaseStageFiles('1.0.7'),
    ['Tressette-1.0.7-android.apk', 'Tressette-1.0.7-windows-x64.exe']);
});

// --- the source sidecar ties a stage to the commit it was built from ---

test('a sidecar round-trips, and malformed ones are refused', () => {
  const good = { version: '1.0.7', commit: SHA, kind: 'release' };
  const text = formatSidecar(good);
  assert.deepEqual(parseSidecar(text), { schema: SIDECAR_SCHEMA, ...good });
  assert.ok(text.endsWith('\n'));
  // Stable bytes for the same facts, so both packagers write the same file.
  assert.equal(formatSidecar(good), text);

  const bad = (mutate, why) => {
    const o = JSON.parse(text);
    mutate(o);
    assert.throws(() => parseSidecar(JSON.stringify(o)), why);
  };
  assert.throws(() => parseSidecar('not json'), /not JSON/);
  assert.throws(() => parseSidecar('[]'), /not a JSON object/);
  bad((o) => { o.schema = 2; }, /schema/);
  bad((o) => { o.version = '1.0'; }, /version/);
  bad((o) => { o.commit = 'abc'; }, /commit/);
  bad((o) => { o.kind = 'draft'; }, /kind/);
});

test('a sidecar that disagrees with the stage is named', () => {
  const base = { label: 'dist-itch', stage: 'v1.0.7', version: '1.0.7', commit: SHA, kind: 'release' };
  const sidecar = { schema: SIDECAR_SCHEMA, version: '1.0.7', commit: SHA, kind: 'release' };
  assert.equal(sidecarProblem({ ...base, sidecar }), null);

  assert.match(sidecarProblem({ ...base, sidecar: null }), /dist-itch\/v1\.0\.7\.source is missing/);
  assert.match(sidecarProblem({ ...base, sidecar: { ...sidecar, version: '1.0.6' } }),
    /is version 1\.0\.6, expected 1\.0\.7/);
  assert.match(sidecarProblem({ ...base, sidecar: { ...sidecar, kind: 'candidate' } }),
    /is a candidate sidecar, expected release/);
  assert.match(sidecarProblem({ ...base, sidecar: { ...sidecar, commit: 'b'.repeat(40) } }),
    /is commit bbbb.*expected aaaa/s);
});

// --- the live remote refs: annotated tag, on main, at the packaged commit ---

test('the annotated tag and its commit are read from ls-remote, exactly', () => {
  const annotated = `1111\trefs/tags/v1.0.7\n2222\trefs/tags/v1.0.7^{}\n`;
  assert.deepEqual(tagRef(annotated, 'v1.0.7'), { commit: '2222', annotated: true });
  const light = `3333\trefs/tags/v1.0.7\n`;
  assert.deepEqual(tagRef(light, 'v1.0.7'), { commit: '3333', annotated: false });
  assert.equal(tagRef(light, 'v1.0.70'), null, 'a prefix is not the tag');
  assert.equal(tagRef(`4444\trefs/tags/some/v1.0.7\n`, 'v1.0.7'), null);
  assert.equal(tagRef('', 'v1.0.7'), null);

  const refs = `aaaa\trefs/heads/main\nbbbb\trefs/heads/main-old\n`;
  assert.equal(branchHead(refs, 'main'), 'aaaa');
  assert.equal(branchHead(refs, 'main-old'), 'bbbb');
  assert.equal(branchHead(refs, 'ma'), null);
});

test('the release and its candidate are named from one commit', () => {
  assert.deepEqual(requiredStages('1.0.7', SHA), { release: 'v1.0.7', candidate: 'candidate-aaaaaaa' });
});

// --- the hand-rolled zip encoder ---

test('crc32 is the reflected IEEE polynomial', () => {
  assert.equal(crc32(Buffer.from('')), 0);
  assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('buildZip writes a readable, deterministic archive', () => {
  const entries = [
    { name: 'index.html', data: Buffer.from('<h1>hi</h1>'.repeat(50)) },
    { name: 'engine.js', data: Buffer.from('console.log(1)') },
    { name: 'decks/x.png', data: Buffer.alloc(1000, 7) },
  ];
  const zip = buildZip(entries);
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'starts with a local file header');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'ends with the EOCD');
  assert.equal(zip.readUInt16LE(zip.length - 22 + 10), entries.length, 'counts the entries');

  // Same bytes whatever the input order: the encoder sorts.
  assert.ok(buildZip([...entries].reverse()).equals(zip));

  // The first local header names the first sorted entry, and its payload is
  // the raw DEFLATE of the source.
  const nameLen = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30, 30 + nameLen).toString('utf8'), 'decks/x.png');
  const method = zip.readUInt16LE(8);
  const compSize = zip.readUInt32LE(18);
  const payload = zip.subarray(30 + nameLen, 30 + nameLen + compSize);
  const data = method === 0x08 ? inflateRawSync(payload) : payload;
  assert.deepEqual(data, entries[2].data);
});

// --- the publisher refuses, dry run included, before anything is uploaded ---
// The real script, run against a temp checkout. The refusal cases below fail
// before butler is ever consulted, so they run on every platform; the dry-run
// case needs a butler shim and a git origin, so it is POSIX-only, as
// release.test.mjs's gh shim is.

const REPO_FILES = ['publish_itch.mjs', 'itch_lib.mjs', 'release_lib.mjs'];

function publishCheckout(version = '1.0.7'){
  const tmp = mkdtempSync(path.join(tmpdir(), 'tressette-itch-'));
  mkdirSync(path.join(tmp, 'tools'));
  for (const f of REPO_FILES)
    copyFileSync(new URL(`./${f}`, import.meta.url), path.join(tmp, 'tools', f));
  mkdirSync(path.join(tmp, 'mobile', 'android', 'app'), { recursive: true });
  writeFileSync(path.join(tmp, 'mobile', 'android', 'app', 'build.gradle'),
    `android {\n  defaultConfig {\n    versionCode 8\n    versionName "${version}"\n  }\n}\n`);
  return tmp;
}

function stage(dir, names, version, commit, kind){
  mkdirSync(dir, { recursive: true });
  const rows = names.map((name) => {
    const data = `not really ${name}`;
    writeFileSync(path.join(dir, name), data);
    return `${createHash('sha256').update(data).digest('hex')}  ${name}`;
  });
  writeFileSync(path.join(dir, 'SHA256SUMS.txt'), rows.join('\n') + '\n');
  writeFileSync(`${dir}.source`, formatSidecar({ version, commit, kind }));
}

const runPublish = (tmp, ...args) => spawnSync(process.execPath,
  [path.join(tmp, 'tools', 'publish_itch.mjs'), ...args], { encoding: 'utf8' });

test('publish_itch refuses without --project', () => {
  const tmp = publishCheckout();
  const res = runPublish(tmp);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--project owner\/slug is required/);
});

test('publish_itch refuses a missing current stage', () => {
  const tmp = publishCheckout();
  const res = runPublish(tmp, '--project', 'diegoami/tressette');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /dist-itch\/v1\.0\.7\/ is missing/);
});

test('publish_itch refuses a missing candidate sidecar', () => {
  const tmp = publishCheckout();
  const commit = 'a'.repeat(40);
  stage(path.join(tmp, 'dist-itch', 'v1.0.7'), itchStageFiles('1.0.7'), '1.0.7', commit, 'release');
  stage(path.join(tmp, 'dist-release', 'v1.0.7'), releaseStageFiles('1.0.7'), '1.0.7', commit, 'release');
  const res = runPublish(tmp, '--project', 'diegoami/tressette');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /dist-itch\/candidate-aaaaaaa\.source is missing/);
});

test('publish_itch refuses a mixed commit between the two sidecars', () => {
  const tmp = publishCheckout();
  stage(path.join(tmp, 'dist-itch', 'v1.0.7'), itchStageFiles('1.0.7'), '1.0.7', 'a'.repeat(40), 'release');
  stage(path.join(tmp, 'dist-release', 'v1.0.7'), releaseStageFiles('1.0.7'), '1.0.7', 'b'.repeat(40), 'release');
  const res = runPublish(tmp, '--project', 'diegoami/tressette');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /name different commits/);
});

test('publish_itch dry-runs the three channels and uploads nothing',
  { skip: process.platform === 'win32' ? 'the butler shim here is a POSIX script' : false },
  () => {
    const tmp = publishCheckout();
    const git = (cwd, ...args) => {
      const r = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
        { cwd, encoding: 'utf8' });
      assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    };
    const origin = mkdtempSync(path.join(tmpdir(), 'tressette-itch-origin-'));
    git(origin, 'init', '-q', '--bare');
    git(tmp, 'init', '-q', '-b', 'main');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-q', '-m', 'the release');
    git(tmp, 'tag', '-a', 'v1.0.7', '-m', 'Tressette 1.0.7');
    git(tmp, 'remote', 'add', 'origin', origin);
    git(tmp, 'push', '-q', 'origin', 'main', 'v1.0.7');
    git(tmp, 'fetch', '-q', 'origin');
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: tmp, encoding: 'utf8' }).stdout.trim();

    stage(path.join(tmp, 'dist-itch', 'v1.0.7'), itchStageFiles('1.0.7'), '1.0.7', commit, 'release');
    stage(path.join(tmp, 'dist-release', 'v1.0.7'), releaseStageFiles('1.0.7'), '1.0.7', commit, 'release');
    for (const label of ['dist-itch', 'dist-release'])
      writeFileSync(path.join(tmp, label, `candidate-${commit.slice(0, 7)}.source`),
        formatSidecar({ version: '1.0.7', commit, kind: 'candidate' }));

    // A butler that answers --version and records a push if it is ever reached.
    const bin = path.join(tmp, 'bin');
    mkdirSync(bin);
    const marker = path.join(tmp, 'pushed');
    writeFileSync(path.join(bin, 'butler'),
      '#!/bin/sh\n' +
      'if [ "$1" = "--version" ]; then echo "butler 15.0.0"; exit 0; fi\n' +
      'if [ "$1" = "push" ]; then echo "$@" >> ' + JSON.stringify(marker) + '; exit 0; fi\n' +
      'exit 0\n');
    chmodSync(path.join(bin, 'butler'), 0o755);

    const res = spawnSync(process.execPath, [path.join(tmp, 'tools', 'publish_itch.mjs'),
      '--project', 'diegoami/tressette'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH },
    });
    assert.equal(res.status, 0, res.stderr);
    for (const channel of ['html5', 'windows', 'android'])
      assert.match(res.stdout, new RegExp(`diegoami/tressette:${channel}`), channel);
    assert.match(res.stdout, /Dry run/);
    assert.equal(existsSync(marker), false, 'a dry run must not push');
  });
