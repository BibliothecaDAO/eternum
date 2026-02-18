# Agent Instructions for Game Client

## Documenting UX Changes and New Features

Whenever you make a UX change or add a new feature in the client, you **must** add an entry to the latest features list
at:

```
src/ui/features/world/latest-features.ts
```

### Entry Format

Add a new object at the **top** of the `latestFeatures` array with the following structure:

```typescript
{
  date: "YYYY-MM-DD",      // Today's date
  title: "Feature Title",   // Short, descriptive title
  description: "..."        // Brief description of what changed and how it benefits users
}
```

### Example

```typescript
export const latestFeatures = [
  {
    date: "2025-01-13",
    title: "Quick Resource Transfer",
    description:
      "Added a new quick transfer button to move resources between structures with a single click, reducing the number of steps needed for common operations.",
  },
  // ... existing entries
];
```

### Guidelines

- Keep the title concise (3-6 words)
- Write the description from the user's perspective, focusing on the benefit
- Use present tense ("Added", "Improved", "Fixed")
- New entries go at the top of the array (most recent first)

## CRITICAL Git Rules for Parallel Agents CRITICAL

Multiple agents may work on different files in the same worktree simultaneously. You MUST follow these rules:

### Committing

ONLY commit files YOU changed in THIS session ALWAYS include fixes #<number> or closes #<number> in the commit message
when there is a related issue or PR NEVER use git add -A or git add . - these sweep up changes from other agents ALWAYS
use git add <specific-file-paths> listing only files you modified Before committing, run git status and verify you are
only staging YOUR files Track which files you created/modified/deleted during the session

### Forbidden Git Operations

These commands can destroy other agents' work:

git reset --hard - destroys uncommitted changes git checkout . - destroys uncommitted changes git clean -fd - deletes
untracked files git stash - stashes ALL changes including other agents' work git add -A / git add . - stages other
agents' uncommitted work git commit --no-verify - bypasses required checks and is never allowed

### Safe Workflow

```bash
# 1. Check status first
git status

# 2. Add ONLY your specific files
git add packages/ai/src/providers/transform-messages.ts
git add packages/ai/CHANGELOG.md

# 3. Commit
git commit -m "fix(ai): description"

# 4. Push (pull --rebase if needed, but NEVER reset/checkout)
git pull --rebase && git push
```

### If Rebase Conflicts Occur

Resolve conflicts in YOUR files only If conflict is in a file you didn't modify, abort and ask the user NEVER force push

## Browser Testing with `agent-browser` Skill

Use this runbook when validating spectator/game flow in a real browser session.

### Prerequisites

1. Install workspace deps from repo root:

```bash
pnpm install --frozen-lockfile
```

2. Ensure workspace packages consumed by `client/apps/game` are built:

```bash
PATH="/Users/os/Library/pnpm:$PATH" pnpm -r --filter "@bibliothecadao/*" --if-present build
```

3. Start game client on a fixed port:

```bash
# If local node is already >=20.19
PATH="/Users/os/Library/pnpm:$PATH" pnpm --dir client/apps/game dev --host 127.0.0.1 --port 4173

# If local node is older (common in CI/agents), force a compatible runtime:
npx -y node@20.19.0 $(which pnpm) --dir client/apps/game dev --host 127.0.0.1 --port 4173
```

### Spectator Smoke Test (Autonomous)

Run these commands in a separate shell while dev server is running:

```bash
# Open local client
npx -y agent-browser --session spectator-check --headed open https://127.0.0.1:4173 --ignore-https-errors

# Inspect and enter spectate flow
npx -y agent-browser --session spectator-check snapshot -i
npx -y agent-browser --session spectator-check find text "Spectate" click
npx -y agent-browser --session spectator-check wait 2500

# Assertions
npx -y agent-browser --session spectator-check get url
npx -y agent-browser --session spectator-check eval "Boolean(document.getElementById('main-canvas'))"
npx -y agent-browser --session spectator-check get count "text=Unable to Start"
npx -y agent-browser --session spectator-check console
npx -y agent-browser --session spectator-check errors
```

Expected pass signals:

1. URL contains `/play/map` and `spectate=true`.
2. `main-canvas` exists (`true`).
3. `Unable to Start` count is `0`.

Known environment caveat:

1. In headless virtualized environments, `THREE.WebGLRenderer` may fail with `Error creating WebGL context`.
2. When this happens, capture screenshot + console/errors logs and treat the run as infra-blocked, not app-pass.

### Artifacts

Capture a full-page screenshot and copy to workspace artifacts:

```bash
npx -y agent-browser --session spectator-check screenshot --full
mkdir -p .context/spectator-browser
cp /Users/os/.agent-browser/tmp/screenshots/<latest-file>.png .context/spectator-browser/spectator-map-full.png
```

Optionally collect console diagnostics:

```bash
npx -y agent-browser --session spectator-check console
npx -y agent-browser --session spectator-check errors
```
