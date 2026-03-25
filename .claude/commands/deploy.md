---
name: deploy
description: Deploy NanoClaw — bump patch version, rebuild container, restart service, and tag the release.
---

# Deploy Command

Simplified deployment pipeline for NanoClaw:
1. Read current version, calculate next patch version
2. Bump patch version in `package.json`
3. Rebuild agent container
4. Restart the service
5. Commit, tag, and push
6. Verify deployment

使用中文汇总过程中的输出的信息。

---

## Step 1 — Read current version

Read the version from `package.json` using shell tools:

```bash
CURRENT=$(grep '"version"' package.json | awk -F'"' '{print $4}')
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)
NEXT="$MAJOR.$MINOR.$((PATCH + 1))"
echo "$CURRENT → $NEXT"
```

Announce: "Deploying: v<current> → v<next>"

## Step 2 — Bump patch version in package.json

Use the Edit tool to update only the `"version"` field in `package.json`.

Pattern to update:
```
"version": "<current>",
```
→
```
"version": "<next>",
```

Verify with shell:
```bash
grep '"version"' package.json | awk -F'"' '{print $4}'
```

## Step 3 — Rebuild agent container

This step is long-running so MUST use `run_in_background: true` on the Bash tool, then use `TaskOutput` with `block: true` and `timeout: 600000` to wait for completion.

```bash
./container/build.sh
```

- CRITICAL: Use `run_in_background: true` for this Bash call — the build often takes 5-10 minutes
- After the build completes, read the output to check for errors
- If the build fails:
  1. Revert the version bump: `git checkout -- package.json`
  2. Print the error
  3. STOP — do NOT commit, tag, or restart

## Step 4 — Restart service (macOS launchd)

Stop and restart the NanoClaw service:

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Wait a few seconds, then verify:
```bash
launchctl list | grep nanoclaw
```

## Step 5 — Commit, tag, and push (only after successful build and restart)

Only execute this step if the container build and restart succeeded.

```bash
git add package.json
git commit -m "chore: release v<next>"
git tag -a v<next> -m "release v<next>"
git push origin main
git push origin v<next>
```

If push fails due to diverged history, stop and report — do NOT force-push.

## Step 6 — Verify deployment

Check the service is running:
```bash
launchctl list | grep nanoclaw
```

Optionally check logs:
```bash
tail -20 logs/nanoclaw.log 2>/dev/null || echo "Log file not found"
```

## Step 7 — Report

使用中文输出的信息。

Print a summary:
- Version bumped: vX.X.X → vX.X.X
- Tag created: vX.X.X
- Branch pushed: main
- Tag pushed: vX.X.X
- Container rebuilt: success / failed
- Service status: Up / Error

## Rules

- NEVER bump minor or major versions — only patch
- NEVER use `node -e` to read package.json — use `grep`/`awk`/`cut` shell commands instead
- NEVER commit or push if container build fails — revert local changes instead
- If deployment fails, check logs FIRST before proposing fixes
- Do NOT force-push to `main`
