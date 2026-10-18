#!/usr/bin/env node
/**
 * Upload the itch.io build, the Windows executable and the Android APK to
 * three butler channels, after proving all three came from one commit.
 *
 *   node tools/publish_itch.mjs --project owner/slug            # dry run
 *   node tools/publish_itch.mjs --project owner/slug --confirm  # actually push
 *
 * There is no default project: the owner confirms the slug first (#95), so a
 * guessed target is a refusal. The dry run validates everything and prints the
 * three resolved `butler push` commands; --confirm runs them.
 *
 * The version is this checkout's versionName, and only that: the publisher
 * reads exactly one stage, `vX.Y.Z`, in dist-itch/ and in dist-release/, with
 * the exact three files, both exact checksum manifests and both source
 * sidecars. A sidecar records `{version, commit, kind}`; the release sidecars
 * must be `release` and the candidate sidecars `candidate`, and all four plus
 * the peeled annotated tag on the live origin must name one full commit, which
 * must be an ancestor of origin's main. A missing, malformed, stale, mixed or
 * extra stage, or a tag pointing at another commit, is a refusal before any
 * upload.
 *
 * Needs butler (https://itch.io/docs/butler/) on PATH, or BUTLER set to its
 * path, and BUTLER_API_KEY in the environment (or a prior `butler login`). The
 * key is read from the environment and never written, printed or stored.
 *
 * Nothing is uploaded without --confirm, and nothing at all is uploaded by this
 * change.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksumProblems } from './release_lib.mjs';
import {
  parseProject, channelTargets, stageName, itchStageFiles, releaseStageFiles,
  parseSidecar, sidecarProblem, tagRef, branchHead,
} from './itch_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');
const BUTLER = process.env.BUTLER || 'butler';
const fail = (msg) => { console.error(`\npublish_itch: ${msg}`); process.exit(1); };

// --- the project: explicit, validated, printed ---
const at = process.argv.indexOf('--project');
const projectArg = at > 0 ? process.argv[at + 1] : undefined;
if (!projectArg)
  fail('--project owner/slug is required (e.g. --project diegoami/tressette). ' +
       'The slug is the owner\'s to confirm; there is no default.');
let project;
try { project = parseProject(projectArg); }
catch (e) { fail(e.message); }

// --- the version: this checkout's, and one stage only ---
const gradlePath = path.join(ROOT, 'mobile/android/app/build.gradle');
if (!existsSync(gradlePath)) fail('mobile/android/app/build.gradle is missing — cannot read versionName.');
const version = /versionName\s+["']([^"']+)["']/.exec(readFileSync(gradlePath, 'utf8'))?.[1];
if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`versionName is not X.Y.Z: ${JSON.stringify(version)}`);
const tag = `v${version}`;

// --- the two staged directories, exactly the current version's ---
const itchDir = path.join(ROOT, 'dist-itch', tag);
const relDir = path.join(ROOT, 'dist-release', tag);
if (!existsSync(itchDir))
  fail(`dist-itch/${tag}/ is missing — package the itch build from the tag (tools/package_itch.mjs).`);
if (!existsSync(relDir))
  fail(`dist-release/${tag}/ is missing — package the release from the tag (tools/package_release.mjs).`);

const problems = [];
const hashIn = (dir) => (name) => {
  const p = path.join(dir, name);
  return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
};
// Both exact manifests: every listed hash checked, and the file set exactly the
// assets — a missing, unlisted or stray file is a refusal. This verifies the
// three channel files before anything is pushed.
for (const [dir, assets] of [[itchDir, itchStageFiles(version)], [relDir, releaseStageFiles(version)]]){
  const manifest = path.join(dir, 'SHA256SUMS.txt');
  if (!existsSync(manifest)){ problems.push(`${path.relative(ROOT, manifest)} is missing — repackage.`); continue; }
  problems.push(...checksumProblems(readFileSync(manifest, 'utf8'), hashIn(dir),
    { expected: assets, present: readdirSync(dir) }).map((p) => `${path.relative(ROOT, dir)}: ${p}`));
}

// --- both sidecars, and the candidate that was smoke- and phone-tested ---
const readSidecar = (label, stage) => {
  const p = path.join(ROOT, label, `${stage}.source`);
  if (!existsSync(p)) return { problem: `${label}/${stage}.source is missing` };
  try { return { sidecar: parseSidecar(readFileSync(p, 'utf8')) }; }
  catch (e) { return { problem: `${label}/${stage}.source: ${e.message}` }; }
};
const itchS = readSidecar('dist-itch', tag);
const relS = readSidecar('dist-release', tag);
if (itchS.problem) problems.push(itchS.problem);
else problems.push(sidecarProblem({ label: 'dist-itch', stage: tag, sidecar: itchS.sidecar, version, commit: relS.sidecar?.commit ?? null, kind: 'release' }));
if (relS.problem) problems.push(relS.problem);
else problems.push(sidecarProblem({ label: 'dist-release', stage: tag, sidecar: relS.sidecar, version, commit: relS.sidecar.commit, kind: 'release' }));
const commit = relS.sidecar?.commit ?? null;
if (itchS.sidecar && relS.sidecar && itchS.sidecar.commit !== relS.sidecar.commit)
  problems.push(`dist-itch and dist-release sidecars name different commits ` +
                `(${itchS.sidecar.commit} vs ${relS.sidecar.commit})`);

if (commit){
  // The candidate for this commit must have been built and checked; the release
  // must point at the same commit, or the smoke and phone checks were for
  // something else.
  const candStage = stageName({ kind: 'candidate', commit, version });
  const candItch = readSidecar('dist-itch', candStage);
  const candRel = readSidecar('dist-release', candStage);
  if (candItch.problem) problems.push(candItch.problem);
  else problems.push(sidecarProblem({ label: 'dist-itch', stage: candStage, sidecar: candItch.sidecar, version, commit, kind: 'candidate' }));
  if (candRel.problem) problems.push(candRel.problem);
  else problems.push(sidecarProblem({ label: 'dist-release', stage: candStage, sidecar: candRel.sidecar, version, commit, kind: 'candidate' }));
}
if (problems.length) fail('the staged build is not publishable:\n  ' + problems.join('\n  '));

// --- the milestone: the annotated tag on the live origin, at that commit ---
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const ls = git('ls-remote', 'origin');
if (ls.status !== 0) fail(`git ls-remote origin failed, so the tag cannot be checked:\n${ls.stderr}`);
const ref = tagRef(ls.stdout, tag);
if (!ref) fail(`${tag} is not on origin. Tag the packaged commit and push it:\n` +
               `  git tag -a ${tag} ${commit} -m "Tressette ${version}" && git push origin ${tag}`);
if (!ref.annotated) fail(`origin's ${tag} is a lightweight tag; a milestone is an annotated one (AGENTS.md).`);
if (ref.commit !== commit)
  fail(`origin's ${tag} is not the commit that was packaged.\n  packaged ${commit}\n  tagged   ${ref.commit}`);
const main = branchHead(ls.stdout, 'main');
if (!main) fail('origin has no main branch.');
if (git('cat-file', '-e', commit).status !== 0)
  fail(`the packaged commit ${commit} is not in this clone — git fetch origin, then retry.`);
if (git('cat-file', '-e', main).status !== 0){
  const fetched = git('fetch', 'origin', 'main');
  if (fetched.status !== 0 || git('cat-file', '-e', main).status !== 0)
    fail(`origin's main (${main}) is not in this clone and could not be fetched:\n${fetched.stderr}`);
}
const ancestor = git('merge-base', '--is-ancestor', commit, main);
if (ancestor.status === 1) fail(`${tag} (${commit}) is not an ancestor of origin's main (${main}).`);
if (ancestor.status !== 0) fail(`merge-base could not be run (exit ${ancestor.status}):\n${ancestor.stderr}`);

// --- butler must be usable ---
const have = spawnSync(BUTLER, ['--version'], { encoding: 'utf8' });
if (have.error || have.status !== 0)
  fail(`butler is not installed or not on PATH (set BUTLER to its path): https://itch.io/docs/butler/`);

// --- the plan: three channels, one file each ---
const targets = channelTargets(project.target, version);
const fileFor = (t) => path.join(t.channel === 'html5' ? itchDir : relDir, t.file);
console.log(`\nitch.io upload for Tressette ${tag} (commit ${commit})`);
console.log(`  project: ${project.target}`);
for (const t of targets)
  console.log(`  ${t.channel.padEnd(8)} ${t.file}  ->  ${t.target}  (--userversion ${t.userversion})`);

if (!CONFIRM){
  console.log('\nDry run. Re-run with --confirm to push.');
  process.exit(0);
}
if (!process.env.BUTLER_API_KEY)
  fail('BUTLER_API_KEY is not set. Export the itch.io API key first; it is never stored in the repo.');

// --- push, one channel at a time, stopping and reporting on failure ---
const done = [];
for (const t of targets){
  console.log(`\n> butler push ${path.relative(ROOT, fileFor(t))} ${t.target} --userversion ${t.userversion}`);
  const res = spawnSync(BUTLER, ['push', fileFor(t), t.target, '--userversion', t.userversion], { stdio: 'inherit' });
  if (res.status !== 0)
    fail(`butler push to ${t.channel} failed (exit ${res.status ?? res.error?.message}). ` +
         `Completed: ${done.join(', ') || 'none'}; the later channels were not pushed.`);
  done.push(t.channel);
}
console.log(`\npushed ${done.join(', ')}.`);
console.log('Check the page, and tick the html5 channel as the one played in the browser if it is not already.');
