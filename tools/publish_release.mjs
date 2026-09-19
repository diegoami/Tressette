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

const RELEASES_REPO = 'diegoami/tressette-releases';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');

const fail = (msg) => { console.error(`\npublish_release: ${msg}`); process.exit(1); };

// --- which version: the newest dist-release/vX.Y.Z/ ---
const distRoot = path.join(ROOT, 'dist-release');
if (!existsSync(distRoot)) fail('no dist-release/ — run tools/package_release.mjs first.');
const tags = readdirSync(distRoot).filter((d) => /^v\d+\.\d+\.\d+$/.test(d)).sort();
if (!tags.length) fail('dist-release/ has no vX.Y.Z directory — run tools/package_release.mjs first.');
const tag = tags[tags.length - 1];
const version = tag.slice(1);
const dir = path.join(distRoot, tag);
const apkName = `Tressette-${version}-android.apk`;

// --- the staged files must be intact ---
for (const f of [apkName, 'SHA256SUMS.txt'])
  if (!existsSync(path.join(dir, f))) fail(`missing ${path.relative(ROOT, path.join(dir, f))}.`);
for (const line of readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')) {
  const [hash, name] = line.split(/\s+/);
  const actual = createHash('sha256').update(readFileSync(path.join(dir, name))).digest('hex');
  if (actual !== hash) fail(`${name} does not match SHA256SUMS.txt — repackage.`);
}

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

if (!CONFIRM) {
  console.log('\n--- dry run --- nothing was published.');
  console.log('Re-run with --confirm to create the release.');
  console.log('\nNotes that would be used:\n');
  console.log(notes.split('\n').map((l) => '  ' + l).join('\n'));
  process.exit(0);
}

const notesFile = path.join(os.tmpdir(), `tressette-${tag}-notes.md`);
writeFileSync(notesFile, notes);
const res = gh(['release', 'create', tag,
  path.join(dir, apkName), path.join(dir, 'SHA256SUMS.txt'),
  '-R', RELEASES_REPO, '--title', `Tressette ${version}`, '--notes-file', notesFile],
  { stdio: 'inherit' });
if (res.status !== 0) fail('gh release create failed.');
console.log(`\npublished: https://github.com/${RELEASES_REPO}/releases/tag/${tag}`);
