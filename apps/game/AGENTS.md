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

## Playtest: the one command that proves client work

`pnpm --dir apps/game playtest` starts a browser on the machine's GPU (Vulkan; headless Chrome would otherwise render on
SwiftShader) and plays the newest live game from the environment's directory the way a player does, leaving the
evidence. Run it against a running client and reuse it; extend its steps rather than writing another runner.

- As a spectator (default): realm view, open the map, pan (WASD), zoom, select (Tab), the menu, back to the realm and
  the map, then a minute of watching.
- As a player (`--player <browser profile dir>`): from the home page's Resume or Play free, realm view, open the map,
  select Army 1, explore twice (tap a tile beside the army, Enter), then five orders at a spamming player's pace. Sign
  the profile in once by hand
  (`npx -y agent-browser --session login --profile <dir> open https://127.0.0.1:4174/sign-in --ignore-https-errors`); it
  stays signed in. Orders use the map's default zoom and need the army's stamina.

```bash
# The client must be served first. Measure what players run: a production build behind `vite preview`
# (`vite preview` keeps the dev server's /api proxy). The dev server works too but its numbers are slower.
pnpm --dir apps/game exec vite build --outDir ../../.context/playtest-dist
pnpm --dir apps/game exec vite preview --outDir ../../.context/playtest-dist --host 127.0.0.1 --port 4174

pnpm --dir apps/game playtest --base-url https://127.0.0.1:4174 --iterations 3 --out .context/playtest/run
pnpm --dir apps/game playtest --base-url https://127.0.0.1:4174 --player .context/playtest-profiles/<account>
```

Options: `--renderer-modes webgpu-auto,webgpu-force-webgl` (default both), `--iterations` (default 3),
`--cpu-throttle 4` (Chrome's CPU slowdown, so this machine stands in for a laptop), `--chain-id` and `--game-id`
(default: the directory's newest live game), `--trace` (a Chrome trace per run), `--compare <summary.json>` (fails when
boot regresses), `--headed`. Paths are taken from where the command is run.

It leaves, in `--out` (default `.context/playtest/<timestamp>`):

- `summary.json`: boot metrics and every step metric per renderer mode, as run count, median, min and max.
- `<role>-<mode>-<run>-transcript.json`: the run's boot timeline, per-step summaries (frame time, long animation frames
  with their scripts, input-to-paint latency, draw calls, retained heap, each Herald message to the frame after it), the
  client's own action timelines (click to rendered), every JSON-RPC POST with whether its connection was reused,
  reloads, the machine's load average, and the raw probe data.
- `<role>-<mode>-<run>-NN-<step>.png` after every step, and `<role>-<mode>-<run>-console.log`.

The probe (`scripts/client-playtest-probe.js`) is an init script that only observes; no app code is changed for it. The
boot gate fails the run (exit 1) on entry or world-interactive over 30 s, browser errors, or a WebGPU fallback without a
reason, or on a one-minute load average over 12 at any step (the machine is shared: such a run is not evidence); a page
reload during a step is a warning with its cost. Stop the preview server when done.

## Browser Testing with `agent-browser` Skill

Use this runbook when validating spectator/game flow in a real browser session.

### Login-First Workflow

Use this workflow before capturing screenshots or validating account-specific game UI:

1. Start the game client with a supported Node runtime. The local shell may pick Node 21.x, which Vite rejects; prefer
   Node 20.19+ or 22.12+. The committed `.env` points the dev server at the live lab stack; no env setup is needed.

```bash
npx -y node@20.19.0 $(which pnpm) --dir /path/to/repo/apps/game dev --host 127.0.0.1 --port 4174
```

When debugging Three.js, world-map rendering, or graphics state, enable the graphics debug mode by opening the app with
`?dev` once (the browser keeps it; `?dev=0` clears it). No build setting turns it on.

If `npx` reports duplicate workspace names from the monorepo, run the command from `/tmp` and pass the absolute `pnpm`
path as shown above.

2. Open a headed browser on the app shell (the home page) with a persistent profile. If the player is already logged in,
   continue immediately. If no wallet/account is visible, ask the user to log in themselves. Do not ask for credentials.

```bash
mkdir -p .context/agent-browser-login-profile
npx -y agent-browser --session game-check \
  --profile "$PWD/.context/agent-browser-login-profile" \
  --headed open https://127.0.0.1:4174/ --ignore-https-errors
```

3. Check whether the UI shows the user's wallet/account, for example `RASCHEL0...`, and local storage has a real
   `eternum_account_store.state.accountName`. If both are already present, do not wait for the user; proceed to the live
   game.

4. Prefer a game under `Your games` on the home page with an `Enter game` button. This is a live, playable game where
   the logged-in account is registered. Use spectate or review only if the user explicitly asks for it or no playable
   registered game exists.

5. For requests about UI "in the game" or "current live game", enter the live match first and use in-game controls. Do
   not use shell routes such as `/results` unless the user explicitly asks for the results page.

6. Known in-game controls:
   - In-game leaderboard: top-right social/leaderboard icon opens the `Leaderboard` popup.
   - Production window: selected realm left panel `PRODUCTION` card, then `MODIFY`.
   - Army view: press `Tab` to cycle/select a player army through the world-map shortcut logic.

### Prerequisites

1. Install workspace deps from repo root:

```bash
pnpm install --frozen-lockfile
```

2. Ensure workspace packages consumed by `apps/game` are built:

```bash
pnpm run build:packages
```

3. Start game client on a fixed port:

```bash
# If local node is already >=20.19
pnpm --dir apps/game dev --host 127.0.0.1 --port 4173

# If local node is older (common in CI/agents), force a compatible runtime:
npx -y node@20.19.0 $(which pnpm) --dir apps/game dev --host 127.0.0.1 --port 4173
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

1. URL contains `/g/` and `spectate=true`.
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
cp ~/.agent-browser/tmp/screenshots/<latest-file>.png .context/spectator-browser/spectator-map-full.png
```

Optionally collect console diagnostics:

```bash
npx -y agent-browser --session spectator-check console
npx -y agent-browser --session spectator-check errors
```
