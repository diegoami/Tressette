#!/usr/bin/env node
/**
 * Publish a packaged release to the public releases repo as a GitHub Release.
 *
 *   node tools/publish_release.mjs                       # dry run: check everything, do nothing
 *   node tools/publish_release.mjs --confirm             # actually create the release
 *   node tools/publish_release.mjs --subtitle "…" [...]  # the notes' one release-specific line
 *
 * Reads dist-release/vX.Y.Z/ (from tools/package_release.mjs, built from the
 * tag): the APK and the Windows executable, each verified against
 * SHA256SUMS.txt, and the set itself, so a missing, unlisted or stray file
 * fails the run. The tag vX.Y.Z must be annotated, on main, and pushed to the
 * origin, and the notes name its commit. Needs `gh` logged in with access to
 * the releases repo. Outward-facing and hard to take back once the tag is
 * public, so it does nothing without --confirm.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newestTag, checksumProblems, releaseCreateArgs, releaseAssets, releaseNotes,
  publishTagProblems,
} from './release_lib.mjs';

// The one line of the notes that changes from release to release, from
// `--subtitle "…"`, in Italian. 1.0.4's was a constant here, and would have
// called every later release the first one for Windows.
const at = process.argv.indexOf('--subtitle');
const SUBTITLE = at > 0 ? process.argv[at + 1] : undefined;

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
const assets = releaseAssets(version);

// --- the staged files must be intact, and exactly the release's two ---
const manifest = path.join(dir, 'SHA256SUMS.txt');
if (!existsSync(manifest)) fail(`no SHA256SUMS.txt in dist-release/${tag}/ — repackage.`);
const problems = checksumProblems(
  readFileSync(manifest, 'utf8'),
  (name) => {
    const p = path.join(dir, name);
    return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
  },
  { expected: assets, present: readdirSync(dir) });
if (problems.length) fail(`${problems.join('; ')} — repackage.`);

// --- the milestone: the annotated tag, on main, here and on the origin ---
// package_release staged this directory only from a checkout of the tag; the
// notes name the tag's commit, so it has to be one anybody can find.
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const out = (...args) => { const r = git(...args); return r.status === 0 ? r.stdout.trim() : null; };
const commit = out('rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`);
const remote = out('ls-remote', 'origin', `refs/tags/${tag}`);
const tagProblems = publishTagProblems({
  tag,
  localObject: out('rev-parse', '-q', '--verify', `refs/tags/${tag}`),
  remoteObject: remote ? remote.split(/\s+/)[0] : null,
  type: out('cat-file', '-t', `refs/tags/${tag}`),
  onMain: !!commit && git('merge-base', '--is-ancestor', commit, 'origin/main').status === 0,
});
if (tagProblems.length) fail(tagProblems.join('; ') + '.');

// --- gh must be usable and the tag must be new ---
const gh = (args, opts = {}) => spawnSync('gh', args, { encoding: 'utf8', ...opts });
if (gh(['--version']).status !== 0) fail('the GitHub CLI (gh) is not installed or not on PATH.');
const seen = gh(['release', 'view', tag, '-R', RELEASES_REPO]);
if (seen.status === 0) fail(`${tag} already exists on ${RELEASES_REPO}. Bump the version first.`);

// --- release notes, in Italian to match the game ---
const notes = releaseNotes(version, { subtitle: SUBTITLE, commit });

console.log(`publish ${tag} (commit ${commit}) to ${RELEASES_REPO}`);
for (const name of assets) console.log(`  ${name}`);
console.log(`  SHA256SUMS.txt`);

// The one irreversible step, behind a flag and behind a function. #26: a dry
// run has no arguments to create a release with, so it cannot.
const notesFile = path.join(os.tmpdir(), `tressette-${tag}-notes.md`);
const createArgs = releaseCreateArgs({
  confirm: CONFIRM, tag, version, dir, assets, releasesRepo: RELEASES_REPO, notesFile,
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
