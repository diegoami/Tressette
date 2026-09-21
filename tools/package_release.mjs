#!/usr/bin/env node
/**
 * Build a signed release APK and stage it for publishing.
 *
 *   node tools/package_release.mjs
 *
 * Steps, in order, stopping at the first failure:
 *   1. cap sync android   — copy public/ into the Android project
 *   2. gradlew assembleRelease
 *   3. refuse an unsigned APK (a silently unsigned build is worse than none)
 *   4. apksigner verify    — the signature must actually check out
 *   5. write dist-release/vX.Y.Z/Tressette-X.Y.Z-android.apk + SHA256SUMS.txt
 *
 * The version comes from mobile/android/app/build.gradle's versionName, so
 * there is one source of truth for it and the filename cannot drift from what
 * is inside the APK.
 *
 * Node standard library only. It shells out to the Android toolchain, which is
 * the tooling a packaging step is allowed to need; nothing here is imported by
 * the game or the web build.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_CERT, newestBuildTools, signatureVerdict } from './release_lib.mjs';

const WIN = process.platform === 'win32';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'mobile');
const ANDROID = path.join(MOBILE, 'android');

const fail = (msg) => { console.error(`\npackage_release: ${msg}`); process.exit(1); };

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (WIN ? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
       : path.join(os.homedir(), 'Android', 'Sdk'));
if (!existsSync(sdk)) fail(`Android SDK not found (looked in ${sdk}). Set ANDROID_HOME.`);

const javaHome = process.env.JAVA_HOME;
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

// Node 24 refuses to spawn a .cmd/.bat without shell:true (a Windows security
// change), and returns status null rather than an error. So on Windows every
// external command goes through the shell, and its arguments are quoted here
// because the shell would otherwise split them on spaces — the SDK and JDK can
// sit under "Program Files".
const quote = (a) => (WIN && /[\s&()[\]{}^=;!'+,`~]/.test(a) ? `"${a}"` : a);
function run(cmd, args, opts = {}) {
  if (WIN) return spawnSync([cmd, ...args].map(quote).join(' '), { shell: true, env, ...opts });
  return spawnSync(cmd, args, { env, ...opts });
}

function step(label, cmd, args, opts = {}) {
  console.log(`\n> ${label}`);
  const res = run(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) fail(`${label} failed (exit ${res.status ?? res.signal}).`);
}

// --- version, from the one place it is declared ---
const gradle = readFileSync(path.join(ANDROID, 'app', 'build.gradle'), 'utf8');
const version = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
const tag = `v${version}`;
console.log(`packaging Tressette ${tag}`);

// --- a signing key must be configured, or the whole exercise is pointless ---
if (!existsSync(path.join(ANDROID, 'keystore.properties')))
  fail('mobile/android/keystore.properties is missing — no signing key configured. ' +
       'Copy keystore.properties.example and fill it in (see ANDROID.md §4).');

// --- 1 & 2: sync the web assets, then build ---
const apkDir = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release');
rmSync(apkDir, { recursive: true, force: true }); // never mistake a stale APK for this one
step('cap sync android', 'npx', ['cap', 'sync', 'android'], { cwd: MOBILE });
step('gradlew assembleRelease', path.join(ANDROID, WIN ? 'gradlew.bat' : 'gradlew'),
     ['assembleRelease', '--console=plain'], { cwd: ANDROID });

// --- 3: refuse an unsigned APK ---
if (existsSync(path.join(apkDir, 'app-release-unsigned.apk')))
  fail('Gradle produced app-release-unsigned.apk — keystore.properties is not being applied.');
const apk = path.join(apkDir, 'app-release.apk');
if (!existsSync(apk)) fail(`expected ${path.relative(ROOT, apk)}, but it is not there.`);

// --- 4: the signature must verify, on our key, or nothing is staged ---
// #22: this used to default to "(not checked: apksigner not found)" and stage
// the APK anyway, and it accepted any verified certificate. Both are refusals
// now: `signatureVerdict` fails closed on a missing verifier, a failed
// verification and the wrong key, and the certificate must be the one recorded
// in ANDROID.md §3.
function findApksigner(){
  const buildTools = path.join(sdk, 'build-tools');
  if (!existsSync(buildTools)) return null;
  const ver = newestBuildTools(readdirSync(buildTools));
  if (!ver) return null;
  const apksigner = path.join(buildTools, ver, WIN ? 'apksigner.bat' : 'apksigner');
  return existsSync(apksigner) ? apksigner : null;
}

const apksigner = findApksigner();
let verify = null;
if (apksigner) {
  console.log('\n> apksigner verify');
  verify = run(apksigner, ['verify', '--print-certs', apk],
    { encoding: 'utf8', ...(javaHome ? { env: { ...env, JAVA_HOME: javaHome } } : {}) });
  process.stdout.write(verify.stdout ?? '');
  if (verify.stderr) process.stderr.write(verify.stderr);
}
const verdict = signatureVerdict({ verify });
if (!verdict.ok) fail(verdict.reason);
const signer = verdict.signer;

// --- 5: stage it, with a checksum ---
const outDir = path.join(ROOT, 'dist-release', tag);
mkdirSync(outDir, { recursive: true });
const apkName = `Tressette-${version}-android.apk`;
copyFileSync(apk, path.join(outDir, apkName));
const sha = createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), `${sha}  ${apkName}\n`);

console.log(`\ndone.`);
console.log(`  ${path.relative(ROOT, path.join(outDir, apkName))}`);
console.log(`  sha256 ${sha}`);
console.log(`  cert   ${signer}`);
console.log(`         (expected ${EXPECTED_CERT}, ANDROID.md \u00a73)`);
console.log(`\nnext: node tools/publish_release.mjs   (dry run; --confirm to publish)`);
