// The release tooling's decisions, held without an SDK, a keystore, a device or
// the network — the gap issue #26 names. The last case is the integration one:
// the real script, run for a dry run, must not reach `gh release create`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  EXPECTED_CERT, parseVersion, newestTag, newestBuildTools,
  parseCertDigest, certificateMatches, signatureVerdict,
  parseChecksums, checksumProblems, releaseCreateArgs,
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
    apkName: 'Tressette-1.0.0-android.apk', releasesRepo: 'diegoami/tressette-releases',
    notesFile: path.join('tmp', 'notes.md'),
  };
  assert.equal(releaseCreateArgs({ ...base, confirm: false }), null,
    'the default publish path cannot write');

  const args = releaseCreateArgs({ ...base, confirm: true });
  assert.deepEqual(args.slice(0, 2), ['release', 'create']);
  assert.equal(args[2], 'v1.0.0');
  assert.ok(args.includes('--notes-file'));
  assert.ok(!args.includes('--confirm'));
});

// --- #26: the integration half — the real script, dry-run, does not create

test("the script's dry run exits clean and never calls gh release create",
  { skip: process.platform === 'win32' ? 'the gh shim here is a POSIX script' : false },
  () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'tressette-publish-'));
    mkdirSync(path.join(tmp, 'tools'));
    for (const f of ['publish_release.mjs', 'release_lib.mjs'])
      copyFileSync(new URL(`./${f}`, import.meta.url), path.join(tmp, 'tools', f));

    const apk = 'Tressette-1.0.0-android.apk';
    const dir = path.join(tmp, 'dist-release', 'v1.0.0');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, apk), 'not really an apk');
    const hash = createHash('sha256').update('not really an apk').digest('hex');
    writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${hash}  ${apk}\n`);

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
    assert.equal(existsSync(marker), false,
      'a dry run must not reach gh release create');
  });
