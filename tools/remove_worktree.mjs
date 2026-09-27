#!/usr/bin/env node
/**
 * Remove one leftover worktree, chosen explicitly by the owner.
 *
 *   node tools/remove_worktree.mjs <path>
 *
 * A leftover is a worktree a session made and did not remove (PLAN.md §7.7).
 * No session infers which worktrees are unused, so neither does this: it
 * touches exactly the one path given and nothing else, refuses a second
 * argument, and refuses the main checkout, an unregistered or locked worktree,
 * and any worktree with tracked changes or untracked files. It prints the exact
 * path, branch or detached SHA and clean status, then requires the owner to
 * type the exact path and to attest that no session is using the worktree. Only
 * then does it run plain `git worktree remove` — never --force, never a branch
 * delete, never prune.
 *
 * The tool proves the repository, path and cleanliness conditions; it cannot
 * see a live session. That is what the attestation covers, and why it asks.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import {
  parseWorktreeList, findWorktree, removalRefusals, worktreeIdentity,
  confirmationMatches, removeArgs,
} from './worktree_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const git = (args, opts = {}) =>
  spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });

const fail = (msg) => { console.error(`\nremove_worktree: ${msg}`); process.exit(1); };

const args = process.argv.slice(2);
if (args.length !== 1)
  fail('give exactly one worktree path: node tools/remove_worktree.mjs <path>');
const target = args[0];

// The main checkout is the parent of the common git directory; a linked
// worktree's git dir is its own under it (PLAN.md §7.7).
const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
if (common.status !== 0)
  fail(`this is not a git checkout: ${common.stderr.trim()}`);
const mainPath = path.dirname(common.stdout.trim());

const listed = git(['worktree', 'list', '--porcelain']);
if (listed.status !== 0)
  fail(`git worktree list failed: ${listed.stderr.trim()}`);
const worktrees = parseWorktreeList(listed.stdout);

const entry = findWorktree(worktrees, target);
const status = entry ? git(['-C', entry.path, 'status', '--porcelain']) : null;

const refusals = removalRefusals({
  target,
  worktrees,
  mainPath,
  statusPorcelain: status && status.status === 0 ? status.stdout : null,
});
if (refusals.length)
  fail(refusals.map((r) => `  ${r}`).join('\n') + '\nNothing was removed.');

console.log(`worktree: ${entry.path}`);
console.log(`identity: ${worktreeIdentity(entry)}`);
console.log('status:   clean (no tracked changes, no untracked files)');

// The interface's async iterator, not `question`: an owner may pipe the two
// answers, and `question` drops a line that arrives before it asks. The
// iterator keeps them.
const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
try {
  process.stdout.write('Type the exact worktree path above to confirm removal:\n> ');
  const typed = (await lines.next()).value ?? '';
  if (!confirmationMatches(typed, entry.path))
    fail('that path did not match; nothing was removed.');

  process.stdout.write(
    `Confirm no session is using ${entry.path} and it is safe to remove [y/N]: `);
  const attest = (await lines.next()).value ?? '';
  if (!/^y(es)?$/i.test(attest.trim()))
    fail('owner confirmation was not given; nothing was removed.');
} finally {
  rl.close();
}

const removed = git(removeArgs(entry.path), { stdio: 'inherit' });
if (removed.status !== 0)
  fail(`git worktree remove failed for ${entry.path}.`);
console.log(`removed ${entry.path}`);
