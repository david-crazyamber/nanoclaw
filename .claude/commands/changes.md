---
name: changes
description: Show all current changes in the codebase, including modified files, diff stats, and a meaningful summary of what changed and why.
---

# Changes Command

Display a comprehensive summary of all modifications made since the last commit, including an AI-generated analysis of what actually changed and why it matters. Use this before `/ship` to review what will be committed.
使用中文汇总过程中的输出的信息。

Usage:
- `/changes` — Show complete changes summary with analysis
- `/changes --full` — Show full diff content in addition to summary

## Arguments
- `--full` (optional): Show complete diff output in addition to the summary

---

## Step 1 — Get current git state

Run these in parallel:
```bash
git status
git diff --stat HEAD
git diff --cached --stat
git log --oneline -5
```

## Step 2 — Display summary

First show a high-level overview:
- Current branch: `$(git branch --show-current)`
- Last commit: `$(git log --oneline -1 --no-decorate)`
- Working tree status: Clean / Modified / Untracked files present

## Step 3 — Analyze and summarize changes

Get the actual diff content for analysis:
```bash
git diff HEAD > /tmp/changes.diff
git diff --cached HEAD > /tmp/staged.diff 2>/dev/null || true
```

Then provide an AI-generated summary that includes:

### Change Categories
Categorize the changes into:
- **New Features** — New functionality added
- **Bug Fixes** — Issues resolved
- **Refactoring** — Code restructuring without behavior change
- **Documentation** — README, comments, or documentation updates
- **Configuration** — Config files, env vars, tooling changes
- **Tests** — Test additions or updates
- **Chores** — Dependencies, formatting, cleanup

### Key Changes Summary
For each significant change, explain:
- **What** changed (high-level description)
- **Why** it was changed (purpose/intent)
- **Impact** — what parts of the system are affected

### Breaking Changes (if any)
Highlight any changes that might break existing functionality or require migration.

## Step 4 — List modified files

Display files with their change types:

1. **Staged changes** (already added to commit):
   - `git diff --cached --name-status`

2. **Unstaged changes** (modified but not added):
   - `git diff --name-status`

3. **Untracked files** (not yet tracked by git):
   - `git ls-files --others --exclude-standard`

## Step 5 — Show diff stats

Display detailed change statistics:
```
Changes summary:
$(git diff --stat HEAD)
```

## Step 6 — (Optional) Show full diff

If `$ARGUMENTS` contains `--full`:
```bash
echo "=== Full diff ==="
git diff HEAD
```

## Step 7 — Recommend next steps

Based on the changes, suggest:
- If there are unstaged changes: "Run `git add <files>` to stage changes for commit"
- If there are staged changes: "Run `/ship` to commit and push these changes"
- If working tree is clean: "No changes to commit"

Also warn if:
- Large number of files changed (might need review)
- Sensitive files (`.env`, secrets) are being modified
- Tests are missing for new features

## Rules
- Do NOT make any modifications to the repository, this is a read-only command
- Always show both staged and unstaged changes
- Highlight if there are any sensitive files (`.env`, secrets, etc.) that might be accidentally committed
- Provide meaningful summaries, not just file lists — explain WHAT changed and WHY
