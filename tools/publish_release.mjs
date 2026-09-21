#!/usr/bin/env node
/**
 * Publish a packaged release to the public releases repo as a GitHub Release.
 *
 *   node tools/publish_release.mjs            # dry run: check everything, do nothing
 *   node tools/publish_release.mjs --confirm  # actually create the release
 *
 * Reads dist-release/vX.Y.Z/ (from tools/package_release.mjs) and needs `gh`
 * logged in with access to the releases repo. Outward-facing and hard to take
 * back once the tag is public, so it does nothing without --confirm.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newestTag, checksumProblems, releaseCreateArgs } from './release_lib.mjs';

const RELEASES_REPO = 'diegoami/tressette-releases';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');

const fail = (msg) => { console.error(`\npublish_release: ${msg}`); process.exit(1); };

// --- which version: the newest dist-release/vX.Y.Z/ ---
// #23: by number, not by string, so v1.10.0 is not mistaken for older than
// v1.9.0 once a component reaches two digits.
const distRoot = path.join(ROOT, 'dist-release');
if (!existsSync(distRoot)) fail('no dist-release/ — run tools/package_release.mjs first.');
const tag = newestTag(readdirSync(distRoot));
if (!tag) fail('dist-release/ has no vX.Y.Z directory — run tools/package_release.mjs first.');
const version = tag.slice(1);
const dir = path.join(distRoot, tag);
const apkName = `Tressette-${version}-android.apk`;

// --- the staged files must be intact ---
const problems = checksumProblems(
  readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8'),
  (name) => {
    const p = path.join(dir, name);
    return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
  });
if (problems.length) fail(`${problems.join('; ')} — repackage.`);

// --- gh must be usable and the tag must be new ---
const gh = (args, opts = {}) => spawnSync('gh', args, { encoding: 'utf8', ...opts });
if (gh(['--version']).status !== 0) fail('the GitHub CLI (gh) is not installed or not on PATH.');
const seen = gh(['release', 'view', tag, '-R', RELEASES_REPO]);
if (seen.status === 0) fail(`${tag} already exists on ${RELEASES_REPO}. Bump versionName first.`);

// --- release notes, in Italian to match the game ---
const notes =
  `Tressette ${version} per Android.\n\n` +
  `**Installazione:** apri il file \`.apk\` sul telefono e consenti ` +
  `l'installazione da questa fonte. Lo storico delle mani resta sul ` +
  `dispositivo; niente lascia il telefono.\n\n` +
  `**Gioca nel browser:** https://tresettette.netlify.app/\n\n` +
  `Checksum SHA-256 in \`SHA256SUMS.txt\`.\n`;

console.log(`publish ${tag} to ${RELEASES_REPO}`);
console.log(`  ${apkName}`);
console.log(`  SHA256SUMS.txt`);

// The one irreversible step, behind a flag and behind a function. #26: a dry
// run has no arguments to create a release with, so it cannot.
const notesFile = path.join(os.tmpdir(), `tressette-${tag}-notes.md`);
const createArgs = releaseCreateArgs({
  confirm: CONFIRM, tag, version, dir, apkName, releasesRepo: RELEASES_REPO, notesFile,
});

if (!createArgs) {
  console.log('\n--- dry run --- nothing was published.');
  console.log('Re-run with --confirm to create the release.');
  console.log('\nNotes that would be used:\n');
  console.log(notes.split('\n').map((l) => '  ' + l).join('\n'));
  process.exit(0);
}

writeFileSync(notesFile, notes);
const res = gh(createArgs, { stdio: 'inherit' });
if (res.status !== 0) fail('gh release create failed.');
console.log(`\npublished: https://github.com/${RELEASES_REPO}/releases/tag/${tag}`);
