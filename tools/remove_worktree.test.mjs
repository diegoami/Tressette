// The safety rules behind tools/remove_worktree.mjs, held without touching a
// real worktree (issue #79). The pure cases decide what may be removed from
// `git worktree list --porcelain` and a status string; the integration cases
// run the real script against a throwaway repository so a refusal is proved to
// leave the worktree on disk, not only to print a message.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseWorktreeList, findWorktree, confirmationMatches, worktreeIdentity,
  removeArgs, removalRefusals,
} from './worktree_lib.mjs';

const MAIN = path.join('C:', 'work', 'Tressette');
const OTHER = path.join('C:', 'work', 'Tressette-work', 'leftover');
const LOCKED = path.join('C:', 'work', 'Tressette-work', 'locked');
const sha = (c) => c.repeat(40);

// --- reading `git worktree list --porcelain`

test('worktrees are read from porcelain, branch, detached, locked and all', () => {
  const listed = [
    `worktree ${MAIN}`,
    `HEAD ${sha('a')}`,
    'branch refs/heads/main',
    '',
    `worktree ${OTHER}`,
    `HEAD ${sha('b')}`,
    'detached',
    '',
    `worktree ${LOCKED}`,
    `HEAD ${sha('c')}`,
    'branch refs/heads/feature',
    'locked the owner is using it',
    '',
  ].join('\n');

  const w = parseWorktreeList(listed);
  assert.equal(w.length, 3);
  assert.deepEqual(
    { path: w[0].path, head: w[0].head, branch: w[0].branch, detached: w[0].detached },
    { path: MAIN, head: sha('a'), branch: 'refs/heads/main', detached: false });
  assert.equal(w[1].detached, true);
  assert.equal(w[1].branch, null);
  assert.equal(w[2].locked, true);
  assert.equal(w[2].lockReason, 'the owner is using it');
  assert.deepEqual(parseWorktreeList(''), []);
  assert.deepEqual(parseWorktreeList(undefined), []);
});

test('a target matches whatever case or slashes git prints', () => {
  const w = parseWorktreeList(
    `worktree ${OTHER}\nHEAD ${sha('b')}\nbranch refs/heads/leftover\n`);
  assert.equal(findWorktree(w, OTHER)?.path, OTHER);
  assert.equal(findWorktree(w, OTHER.toUpperCase())?.path, OTHER);
  assert.equal(findWorktree(w, OTHER.replace(/\\/g, '/'))?.path, OTHER);
  assert.equal(findWorktree(w, path.join('C:', 'work', 'elsewhere')), null);
});

test('identity names the branch, or the detached SHA', () => {
  assert.equal(worktreeIdentity({ branch: 'refs/heads/fix/thing', head: sha('a') }),
    'fix/thing (branch)');
  assert.equal(worktreeIdentity({ branch: null, head: sha('b') }), `${sha('b')} (detached)`);
});

test('only the exact path confirms, and it is the only thing asked', () => {
  assert.equal(confirmationMatches(OTHER, OTHER), true);
  assert.equal(confirmationMatches(`  ${OTHER}  `, OTHER), true);
  assert.equal(confirmationMatches(OTHER.toUpperCase(), OTHER), true);
  assert.equal(confirmationMatches(OTHER.replace(/\\/g, '/'), OTHER), true);
  assert.equal(confirmationMatches(path.join('C:', 'work', 'elsewhere'), OTHER), false);
  assert.equal(confirmationMatches('', OTHER), false);
  assert.equal(confirmationMatches(undefined, OTHER), false);
});

test('removal is plain git worktree remove, never --force and never prune', () => {
  const args = removeArgs(OTHER);
  assert.deepEqual(args, ['worktree', 'remove', OTHER]);
  assert.ok(!args.includes('--force'));
  assert.ok(!args.includes('prune'));
});

// --- the refusals

const WORKTREES = parseWorktreeList(
  `worktree ${MAIN}\nHEAD ${sha('a')}\nbranch refs/heads/main\n\n` +
  `worktree ${OTHER}\nHEAD ${sha('b')}\nbranch refs/heads/leftover\n\n` +
  `worktree ${LOCKED}\nHEAD ${sha('c')}\nbranch refs/heads/locked\nlocked in use\n`);
const clean = (target) =>
  removalRefusals({ target, worktrees: WORKTREES, mainPath: MAIN, statusPorcelain: '' });

test('a clean, linked worktree may be removed', () => {
  assert.deepEqual(clean(OTHER), []);
});

test('the main checkout is refused', () => {
  const r = clean(MAIN);
  assert.equal(r.length, 1);
  assert.match(r[0], /main checkout/);
});

test('an unregistered path is refused', () => {
  const r = clean(path.join('C:', 'work', 'elsewhere'));
  assert.equal(r.length, 1);
  assert.match(r[0], /is not a registered worktree/);
});

test('a locked worktree is refused, naming its reason', () => {
  const r = clean(LOCKED);
  assert.equal(r.length, 1);
  assert.match(r[0], /is locked \(in use\); unlock it first/);
});

test('tracked or untracked changes are refused', () => {
  const r = removalRefusals({ target: OTHER, worktrees: WORKTREES, mainPath: MAIN,
    statusPorcelain: ' M public/index.html\n?? scratch.txt\n' });
  assert.equal(r.length, 1);
  assert.match(r[0], /tracked or untracked changes/);
  assert.match(r[0], /does not use --force/);
});

test('a status that cannot be read is a refusal, not a pass', () => {
  const r = removalRefusals({ target: OTHER, worktrees: WORKTREES, mainPath: MAIN,
    statusPorcelain: null });
  assert.equal(r.length, 1);
  assert.match(r[0], /could not be read/);
});

test('no path at all is refused', () => {
  assert.match(clean('')[0], /no worktree path/);
});

// --- the real script against a throwaway repository

// Every throwaway repository a test made, so the run leaves nothing behind
// (git worktree remove deletes a worktree's directory but not its main repo).
const TEMP_REPOS = [];
after(() => {
  for (const dir of TEMP_REPOS)
    rmSync(dir, { recursive: true, force: true });
});

function makeRepo(){
  const tmp = mkdtempSync(path.join(tmpdir(), 'tressette-remove-worktree-'));
  TEMP_REPOS.push(tmp);
  mkdirSync(path.join(tmp, 'tools'));
  for (const f of ['remove_worktree.mjs', 'worktree_lib.mjs'])
    copyFileSync(new URL(`./${f}`, import.meta.url), path.join(tmp, 'tools', f));

  const git = (...args) => {
    const r = spawnSync('git',
      ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
      { cwd: tmp, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  writeFileSync(path.join(tmp, 'README.md'), 'base\n');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'base');

  const addLeftover = (name) => {
    const wt = path.join(tmp, name);
    git('worktree', 'add', '-q', '-b', name, wt);
    return wt;
  };
  const listed = () => parseWorktreeList(git('worktree', 'list', '--porcelain'));
  return { tmp, git, addLeftover, listed };
}

// Feed the two confirmations on stdin the way an owner types them.
const runTool = (tmp, target, input) => spawnSync(process.execPath,
  [path.join(tmp, 'tools', 'remove_worktree.mjs'), target], { encoding: 'utf8', input });

test('a clean leftover is removed only after both confirmations', () => {
  const { tmp, addLeftover, listed } = makeRepo();
  const wt = addLeftover('leftover');

  const res = runTool(tmp, wt, `${wt}\ny\n`);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /identity: leftover \(branch\)/);
  assert.match(res.stdout, /status:   clean/);
  // Git prints the path with forward slashes on Windows, the test built it with
  // backslashes; compare the two in one form.
  const slashes = (s) => s.replace(/\\/g, '/');
  assert.ok(slashes(res.stdout).includes(`removed ${slashes(wt)}`), res.stdout);
  assert.equal(existsSync(wt), false);
  assert.equal(findWorktree(listed(), wt), null, 'the registration is gone too');
});

test('an untracked file stops the removal and leaves the worktree', () => {
  const { tmp, addLeftover, listed } = makeRepo();
  const wt = addLeftover('leftover');
  writeFileSync(path.join(wt, 'scratch.txt'), 'x\n');

  const res = runTool(tmp, wt, `${wt}\ny\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /tracked or untracked changes/);
  assert.ok(existsSync(wt));
  assert.ok(findWorktree(listed(), wt));
});

test('a tracked change stops the removal too', () => {
  const { tmp, addLeftover } = makeRepo();
  const wt = addLeftover('leftover');
  writeFileSync(path.join(wt, 'README.md'), 'edited\n');

  const res = runTool(tmp, wt, `${wt}\ny\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /tracked or untracked changes/);
  assert.ok(existsSync(wt));
});

test('the main checkout is refused even with the exact path typed', () => {
  const { tmp } = makeRepo();
  const res = runTool(tmp, tmp, `${tmp}\ny\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /main checkout/);
  assert.ok(existsSync(path.join(tmp, '.git')));
});

test('an unregistered path is refused before anything is prompted', () => {
  const { tmp } = makeRepo();
  const res = runTool(tmp, path.join(tmp, 'never-registered'), '');
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /is not a registered worktree/);
});

test('a second path argument is refused before anything is prompted', () => {
  const { tmp, addLeftover } = makeRepo();
  const wt = addLeftover('leftover');

  const res = spawnSync(process.execPath,
    [path.join(tmp, 'tools', 'remove_worktree.mjs'), wt, path.join(tmp, 'second')],
    { encoding: 'utf8', input: `${wt}\ny\n` });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /exactly one worktree path/);
  assert.ok(existsSync(wt), 'the refused worktree is still on disk');
});

test('a locked worktree is refused until the owner unlocks it', () => {
  const { tmp, git, addLeftover } = makeRepo();
  const wt = addLeftover('leftover');
  git('worktree', 'lock', wt);

  const res = runTool(tmp, wt, `${wt}\ny\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /is locked/);
  assert.ok(existsSync(wt));
});

test('a mismatched path confirmation removes nothing', () => {
  const { tmp, addLeftover } = makeRepo();
  const wt = addLeftover('leftover');

  const res = runTool(tmp, wt, `${path.join(tmp, 'elsewhere')}\ny\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /did not match/);
  assert.ok(existsSync(wt));
});

test('declining the no-session attestation removes nothing', () => {
  const { tmp, addLeftover } = makeRepo();
  const wt = addLeftover('leftover');

  const res = runTool(tmp, wt, `${wt}\nn\n`);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /confirmation was not given/);
  assert.ok(existsSync(wt));
});
