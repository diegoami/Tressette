#!/usr/bin/env node
/**
 * Build the itch.io HTML5 artifact: a zip of public/ with index.html at its
 * root, staged under dist-itch/ and never in dist-release/.
 *
 *   node tools/package_itch.mjs              # from the tag vX.Y.Z: the release
 *   node tools/package_itch.mjs --candidate  # from the untagged candidate
 *
 * Dry run by default: it walks public/, prints the plan and writes nothing.
 * --confirm writes the zip, its SHA256SUMS.txt and, only after the staging has
 * verified, an adjacent source sidecar (`dist-itch/<stage>.source`) recording
 * the version, the full commit and whether the build is a candidate or a
 * release. `publish_itch.mjs` reads that sidecar, so a ZIP can never be
 * published for a commit other than the one it was built from.
 *
 * The stage is `vX.Y.Z` when HEAD is the annotated tag, and
 * `candidate-<first seven of the commit>` otherwise (--candidate), the same
 * names tools/package_release.mjs uses. The itch ZIP is a third asset for a
 * second storefront; keeping it out of dist-release/ is what preserves the
 * GitHub release's exact two-asset contract (release_lib.releaseAssets).
 *
 * The version comes from mobile/android/app/build.gradle's versionName, the
 * one source tools/package_release.mjs also reads; the cross-check that every
 * other declaration agrees is that script's job, not duplicated here.
 *
 * Node standard library only. The zip encoder is tools/zip_lib.mjs.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSource, releaseCheckoutProblem, checksumProblems } from './release_lib.mjs';
import { buildZip } from './zip_lib.mjs';
import { formatSidecar, itchStageFiles } from './itch_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const fail = (msg) => { console.error(`\npackage_itch: ${msg}`); process.exit(1); };
const CONFIRM = process.argv.includes('--confirm');
const CANDIDATE = process.argv.includes('--candidate');

// --- the version, and where the build may be staged ---
const gradlePath = path.join(ROOT, 'mobile/android/app/build.gradle');
if (!existsSync(gradlePath)) fail('mobile/android/app/build.gradle is missing — cannot read versionName.');
const version = /versionName\s+["']([^"']+)["']/.exec(readFileSync(gradlePath, 'utf8'))?.[1];
if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`versionName is not X.Y.Z: ${JSON.stringify(version)}`);
const tag = `v${version}`;

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const out = (...args) => { const r = git(...args); return r.status === 0 ? r.stdout.trim() : null; };
const head = out('rev-parse', 'HEAD');
if (!head) fail('this is not a git checkout.');
const source = buildSource({
  version, head,
  tagCommit: out('rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`),
  tagType: out('cat-file', '-t', `refs/tags/${tag}`),
  onMain: git('merge-base', '--is-ancestor', head, 'origin/main').status === 0,
  clean: git('diff', '--quiet', 'HEAD', '--').status === 0,
  candidate: CANDIDATE,
});
if (!source.ok) fail(source.reason);
// A build is made in a worktree of its own, never in the main checkout
// (AGENTS.md), for the same reason package_release.mjs refuses there.
const where = releaseCheckoutProblem({
  gitDir: out('rev-parse', '--path-format=absolute', '--git-dir'),
  commonDir: out('rev-parse', '--path-format=absolute', '--git-common-dir'),
});
if (where) fail(where);

// --- walk public/, relative, forward slashes, index.html at the root ---
if (!existsSync(PUBLIC)) fail('public/ is missing — the game source is gone.');
if (!existsSync(path.join(PUBLIC, 'index.html')))
  fail('public/index.html is missing — itch.io needs index.html at the zip root.');
function* walk(dir, prefix = ''){
  for (const name of readdirSync(dir)){
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) yield* walk(abs, rel);
    else yield { name: rel, data: readFileSync(abs), size: statSync(abs).size };
  }
}
const entries = [...walk(PUBLIC)].sort((a, b) => a.name.localeCompare(b.name));
if (!entries.length) fail('public/ is empty — nothing to package.');

const [zipName] = itchStageFiles(version);
const outDir = path.join(ROOT, 'dist-itch', source.dir);
const zipPath = path.join(outDir, zipName);
const sumsPath = path.join(outDir, 'SHA256SUMS.txt');
const sidecarPath = path.join(ROOT, 'dist-itch', `${source.dir}.source`);

console.log(`\nitch.io build for Tressette ${tag} (${source.kind}, commit ${head})`);
console.log(`  source:    public/ (${entries.length} files)`);
console.log(`  output:    dist-itch/${source.dir}/${zipName}`);
console.log(`  sidecar:   dist-itch/${source.dir}.source`);
for (const e of entries) console.log(`    ${e.name}  (${e.size} bytes)`);

if (!CONFIRM) {
  console.log('\nDry run. Re-run with --confirm to write.');
  process.exit(0);
}

// --- stage: replace any earlier directory, then verify what was staged ---
const zipBuf = buildZip(entries);
const zipHash = createHash('sha256').update(zipBuf).digest('hex');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(zipPath, zipBuf);
writeFileSync(sumsPath, `${zipHash}  ${zipName}\n`);
const hashOf = (name) => {
  const p = path.join(outDir, name);
  return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
};
const problems = checksumProblems(readFileSync(sumsPath, 'utf8'), hashOf,
  { expected: itchStageFiles(version), present: readdirSync(outDir) });
if (problems.length) fail(`what was staged does not verify: ${problems.join('; ')}`);

// The sidecar is written only after the staging above verified, so its
// existence means the directory was complete when it was built.
writeFileSync(sidecarPath, formatSidecar({ version, commit: head, kind: source.kind }));

console.log(`\ndone.`);
console.log(`  dist-itch/${source.dir}/${zipName}`);
console.log(`  ${zipHash}  ${zipName}`);
console.log(source.kind === 'release'
  ? `\nnext: node tools/smoke_itch_zip.mjs   (then publish_itch.mjs)`
  : `\nnext: run the ZIP smoke and the real-phone check on commit ${head}; ` +
    `tag that exact commit ${tag}, check it out, and package again.`);
