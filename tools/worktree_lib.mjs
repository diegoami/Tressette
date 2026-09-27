/**
 * The decisions behind tools/remove_worktree.mjs, as pure functions.
 *
 * The owner clears leftover worktrees rarely, one at a time, on the boundary
 * where a wrong path deletes someone's work in progress. `git worktree remove`
 * refuses a dirty worktree and the main checkout anyway, but only after the
 * owner has named the target, and it cannot explain a refusal in the
 * repository's own terms. These functions answer "may this exact path be
 * removed, and why not" from `git worktree list --porcelain`, the main
 * checkout's path and `git status --porcelain` output, so
 * tools/remove_worktree.test.mjs holds the refusals without running git
 * (issue #79).
 *
 * Nothing here touches the filesystem, `process`, a clock or an rng. The tool
 * proves the repository, path and cleanliness conditions; only the owner can
 * attest that no session is using the worktree.
 */
import path from 'node:path';

// One entry of `git worktree list --porcelain`: a path, a HEAD, and either a
// branch or `detached`, plus the flags git prints when they apply. The main
// worktree is the first entry.
export function parseWorktreeList(porcelain){
  const entries = [];
  let cur = null;
  for (const raw of String(porcelain ?? '').split('\n')){
    const line = raw.trimEnd();
    if (line === ''){
      if (cur){ entries.push(cur); cur = null; }
      continue;
    }
    const sp = line.indexOf(' ');
    const key = sp === -1 ? line : line.slice(0, sp);
    const value = sp === -1 ? '' : line.slice(sp + 1);
    if (key === 'worktree'){
      if (cur) entries.push(cur);
      cur = { path: value, head: null, branch: null, detached: false,
              bare: false, locked: false, prunable: false };
    }
    else if (!cur) continue;
    else if (key === 'HEAD') cur.head = value;
    else if (key === 'branch') cur.branch = value;
    else if (key === 'detached') cur.detached = true;
    else if (key === 'bare') cur.bare = true;
    else if (key === 'locked'){ cur.locked = true; cur.lockReason = value || null; }
    else if (key === 'prunable'){ cur.prunable = true; cur.pruneReason = value || null; }
  }
  if (cur) entries.push(cur);
  return entries;
}

// Git may print a path with forward slashes or a different drive-letter case
// from the one the owner types; both resolve to the same worktree.
const samePath = (a, b) =>
  path.resolve(String(a)).toLowerCase() === path.resolve(String(b)).toLowerCase();

export function findWorktree(worktrees, target){
  return (worktrees ?? []).find((w) => samePath(w.path, target)) ?? null;
}

// The exact path the owner typed, against the target. Both resolve to the same
// worktree — that is the confirmation — anything else is a refusal.
export function confirmationMatches(typed, target){
  const t = String(typed ?? '').trim();
  return t !== '' && samePath(t, target);
}

// `refs/heads/x` -> `x (branch)`, otherwise the detached HEAD.
export function worktreeIdentity(entry){
  if (entry.branch)
    return `${entry.branch.replace(/^refs\/heads\//, '')} (branch)`;
  return `${entry.head ?? '(unknown)'} (detached)`;
}

// The plain removal: `git worktree remove <path>`, never --force. Kept here as
// a function so a test can assert the force flag is not in the arguments.
export function removeArgs(target){
  return ['worktree', 'remove', target];
}

// Every reason this target must not be removed, in the order the tool checks
// them: not registered, the main checkout, locked, then dirty — tracked changes
// or untracked files. `statusPorcelain` is `git status --porcelain` in the
// target, null when it could not be read. Empty means it may be removed.
export function removalRefusals({ target, worktrees, mainPath, statusPorcelain }){
  if (!target || String(target).trim() === '')
    return ['no worktree path was given'];
  const entry = findWorktree(worktrees, target);
  if (!entry)
    return [`${String(target).trim()} is not a registered worktree of this repository`];

  const refusals = [];
  if (samePath(entry.path, mainPath))
    refusals.push(`${entry.path} is the main checkout, which no session may remove`);
  if (entry.locked)
    refusals.push(`${entry.path} is locked${entry.lockReason ? ` (${entry.lockReason})` : ''}; unlock it first`);
  if (statusPorcelain === null)
    refusals.push(`${entry.path} could not be read, so nothing is known about its changes`);
  else if (String(statusPorcelain).trim() !== '')
    refusals.push(`${entry.path} has tracked or untracked changes; git worktree remove ` +
      'would refuse it, and this tool does not use --force');
  return refusals;
}
