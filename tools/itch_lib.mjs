/**
 * The decisions behind the itch.io packaging, smoke and publishing scripts, as
 * pure functions (issue #95).
 *
 * itch.io is a second storefront on the same source as the GitHub release, and
 * its packaging must not disturb the exact two-asset contract the GitHub
 * publisher depends on (tools/release_lib.mjs:179-181,
 * tools/package_release.mjs:235-251). So the itch ZIP stages under dist-itch/,
 * apart from dist-release/, and the two are tied together only by a source
 * sidecar each: JSON `{schema, version, commit, kind}` written beside the
 * staged directory once staging has succeeded. `publish_itch.mjs` refuses
 * unless both sidecars, the release sidecar, the candidate sidecars and the
 * live annotated tag all name one commit.
 *
 * Nothing here touches the filesystem, `process`, a clock or the network.
 */
import { releaseAssets } from './release_lib.mjs';

// The sidecar schema version. A file with another schema is not read.
export const SIDECAR_SCHEMA = 1;

// A commit id: 40 hex (SHA-1) or 64 (SHA-256), as release_lib's OIDs.
const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

// A project is `owner/slug`, exactly one slash, no spaces or path tricks. There
// is no default: the owner confirms the slug before a publisher may run
// (#95 open question), so a guessed target is a refusal, not a fallback.
export function parseProject(text){
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(String(text ?? ''));
  if (!m)
    throw new Error(`--project must be owner/slug (e.g. diegoami/tressette), ` +
                    `not ${JSON.stringify(text)}`);
  return { owner: m[1], slug: m[2], target: `${m[1]}/${m[2]}` };
}

// The one file each butler channel carries, for one version. The mapping is
// explicit so a wrong or repeated ZIP is impossible (#95 revision).
export function channelAssets(version){
  return {
    html5:   `Tressette-${version}-itch-html5.zip`,
    windows: `Tressette-${version}-windows-x64.exe`,
    android: `Tressette-${version}-android.apk`,
  };
}

// The three `butler push` targets and the file and --userversion each carries,
// in the order they are pushed. `project` is the owner/slug string.
export function channelTargets(project, version){
  const { target } = parseProject(project);
  const assets = channelAssets(version);
  return Object.keys(assets).map((channel) => ({
    channel,
    target: `${target}:${channel}`,
    file: assets[channel],
    userversion: version,
  }));
}

// The stage directory a build is written to: `vX.Y.Z` for a release, and
// `candidate-<first seven of the commit>` for the untagged build, matching
// tools/package_release.mjs:136 so both packagers name a candidate the same way.
export function stageName({ kind, commit, version }){
  return kind === 'release' ? `v${version}` : `candidate-${commit.slice(0, 7)}`;
}

// The files inside dist-itch/<stage>/ and dist-release/<stage>/. The GitHub
// release keeps exactly its two assets (release_lib.releaseAssets); the itch
// stage holds exactly the ZIP. Each directory also carries SHA256SUMS.txt.
export function itchStageFiles(version){
  return [`Tressette-${version}-itch-html5.zip`];
}
export function releaseStageFiles(version){
  return releaseAssets(version);
}

// Serialize a source sidecar. Stable key order and LF, so two packagers write
// the same bytes for the same facts.
export function formatSidecar({ version, commit, kind }){
  for (const [k, v] of [['version', version], ['commit', commit], ['kind', kind]])
    if (typeof v !== 'string') throw new Error(`${k} must be a string`);
  return JSON.stringify({ schema: SIDECAR_SCHEMA, version, commit, kind }, null, 2) + '\n';
}

// Parse a source sidecar, or throw. Malformed is a refusal, never a skip.
export function parseSidecar(text){
  let o;
  try { o = JSON.parse(text); }
  catch { throw new Error('the source sidecar is not JSON'); }
  if (!o || typeof o !== 'object' || Array.isArray(o))
    throw new Error('the source sidecar is not a JSON object');
  if (o.schema !== SIDECAR_SCHEMA)
    throw new Error(`the sidecar schema is ${JSON.stringify(o.schema)}, expected ${SIDECAR_SCHEMA}`);
  if (!/^\d+\.\d+\.\d+$/.test(o.version ?? ''))
    throw new Error(`the sidecar version is not X.Y.Z: ${JSON.stringify(o.version)}`);
  if (!OID.test(o.commit ?? ''))
    throw new Error(`the sidecar commit is not a full object id: ${JSON.stringify(o.commit)}`);
  if (o.kind !== 'release' && o.kind !== 'candidate')
    throw new Error(`the sidecar kind is ${JSON.stringify(o.kind)}, expected release or candidate`);
  return { schema: SIDECAR_SCHEMA, version: o.version, commit: o.commit, kind: o.kind };
}

// Everything wrong with one sidecar for the stage being published, or null. The
// stage name already fixes version and kind; the commit is the shared source
// identity the whole publisher rests on.
export function sidecarProblem({ label, stage, sidecar, version, commit, kind }){
  const where = `${label}/${stage}.source`;
  if (!sidecar) return `${where} is missing — package again with the itch or release packager`;
  if (sidecar.version !== version) return `${where} is version ${sidecar.version}, expected ${version}`;
  if (sidecar.kind !== kind) return `${where} is a ${sidecar.kind} sidecar, expected ${kind}`;
  if (sidecar.commit !== commit) return `${where} is commit ${sidecar.commit}, expected ${commit}`;
  return null;
}

// The commit `tag` names in `git ls-remote` output, or null when absent. An
// annotated tag lists the tag object and then the peeled commit (`^{}`); a
// lightweight tag lists the commit alone. Refs match exactly, so v1.0.7 is not
// satisfied by v1.0.70 or by some/prefix/v1.0.7.
export function tagRef(lsRemote, tag){
  let direct = null, peeled = null;
  for (const line of String(lsRemote).split(/\r?\n/)){
    const m = /^([0-9a-f]+)\t(\S+)$/.exec(line);
    if (!m) continue;
    if (m[2] === `refs/tags/${tag}^{}`) peeled = m[1];
    else if (m[2] === `refs/tags/${tag}`) direct = m[1];
  }
  if (!direct && !peeled) return null;
  return { commit: peeled ?? direct, annotated: peeled !== null };
}

// The commit a branch points at in `git ls-remote` output, or null. This is the
// live value on the remote; a local `origin/<branch>` is only the last fetch.
export function branchHead(lsRemote, branch){
  for (const line of String(lsRemote).split(/\r?\n/)){
    const m = /^([0-9a-f]+)\t(\S+)$/.exec(line);
    if (m && m[2] === `refs/heads/${branch}`) return m[1];
  }
  return null;
}

// The stage and sidecar names the publisher requires, given the version and the
// release commit. The candidate stage is named from the same commit, so it is
// the candidate that was smoke-tested and phone-tested for this version.
export function requiredStages(version, commit){
  return {
    release: stageName({ kind: 'release', commit, version }),
    candidate: stageName({ kind: 'candidate', commit, version }),
  };
}
