⚔️ Eternum Project Guidelines 🧱 Package Architecture IMPORTANT: Read each package README before contributing:

packages/types/README.md — Shared type definitions

packages/provider/README.md — Data provider interfaces and implementations

packages/core/README.md — Core game logic and utility functions

packages/torii/README.md — SQL + Torii integration for blockchain data

This helps you:

Discover existing functions before writing new ones

Place new logic in the correct layer

Avoid redundant dependencies and circular imports

🛠️ Common Dev Commands

```bash
# Build all packages (REQUIRED after package changes)
pnpm run build:packages

# Run formatter
pnpm run format

# Check for unused code/dependencies
pnpm run knip
```

🗺 Application Structure When adding features, consult the relevant app's README:

client/apps/game/ – Main game app (React + Three.js)

client/apps/bot/ – Game bot logic

client/apps/game-docs/ – Developer documentation site

client/apps/heavy-load/ – Load testing tools

client/apps/landing/ – Marketing site

🌍 World vs. Local View (Hex View) Worldmap: Global hex grid showing realms, structures, and armies

Local hex view: Sub-grid inside a realm or structure for construction and local interactions

Key UX transition: Clicking into a structure enters the local grid; actions here are isolated to the specific realm.
Design systems and game logic must support both views coherently.

🎨 Code Style & Best Practices Use TypeScript exclusively

Never use as any — Fix types properly

Follow compositional patterns over inheritance

Use functional React components and avoid monoliths

Match naming conventions already used across the codebase

Break large logic into reusable utility functions

⌨️ Shortcut Integration MANDATORY: Register all new shortcuts via the centralized manager:

```swift
@client/apps/game/src/utils/shortcuts/centralized-shortcut-manager.ts
```

If your shortcut logic is tied to a Three.js scene, use SceneShortcutManager to bridge context.

❌ Do NOT register shortcuts directly in scenes or components.

🧪 Testing Practices Co-locate test files with source code

Use clear, descriptive test names

Always run pnpm test before pushing

✅ Pre-Commit Checklist Before pushing any change:

- [ ] pnpm install (if deps changed)

- [ ] Update pnpm-lock.yaml

- [ ] Update any relevant README files

- [ ] Update latest-features.ts (if UX- or player-facing)

- [ ] pnpm run format

- [ ] pnpm run knip (no unused code)

- [ ] pnpm run build:packages (if packages changed)

- [ ] pnpm run build (MANDATORY before merge)

🧭 Systematic Dev Process 📋 Task Analysis (always at the start)

```markdown
- Type: [Feature | Bug Fix | Refactor | UX Improvement | Docs]
- User-facing: [Yes/No]
- Needs logging: [Yes/No]
- Affects packages: [Yes/No]
```

🔍 Pre-Work Checklist

```markdown
- [ ] Read all relevant README files
- [ ] Look for reusable components
- [ ] Identify applicable guidelines (UX, contract, etc.)
- [ ] Plan feature log entry
```

⚙️ Implementation Reminders

```markdown
- [ ] Follow TS best practices (no `as any`)
- [ ] Use core utils and patterns
- [ ] Keep logic reusable and focused
- [ ] Consult UX agent if needed
```

✅ Pre-Commit Summary

```markdown
- [ ] Dependencies updated?
- [ ] Docs updated?
- [ ] Run format
- [ ] Run knip
- [ ] Build packages
- [ ] Build app
- [ ] Feature added to `latest-features.ts`
- [ ] Exports updated in index.ts if new components
```

📝 Completion Summary

```markdown
- Modified files: [list]
- Checklist: [X/Y]
- Feature logged: [Yes/No]
- Ready for commit: [Yes/No]
```

🧩 Design System Guidelines When adding UI components:

Evaluate reuse potential before placing in a feature directory

If generic, place in design system:

atoms/ — low-level UI primitives

molecules/ — composed UI units

Search for similar existing implementations

Replace and refactor usages where appropriate

Use kebab-case for file names and PascalCase for component names

🧠 UX Agent Consultation If you're unsure about interaction design or user flow, consult the UX agent.

Use it to:

Improve clarity or discoverability

Test new interaction patterns

Reduce player friction or confusion

Improve game mechanic UI

Example query:

"Players aren't clear on how to move armies. How should I redesign the selection flow?"

🔐 Adding New Contract Entrypoints When adding new Cairo entrypoints:

Create TypeScript props interface in: packages/types/src/types/provider.ts

Add provider method in: packages/dojo/node_modules/@bibliothecadao/provider/src/index.ts

Create system call wrapper in: packages/types/src/dojo/create-system-calls.ts

Add to policies in: client/apps/game/src/hooks/context/policies.ts

Run:

```bash
pnpm run build:packages
pnpm run build
```

⚠️ CRITICAL:

Match param names and order from the contract

Use withAuth() for all system calls

Coordinate params must follow { x: num.BigNumberish, y: num.BigNumberish }

Use NAMESPACE-system_name for contract naming

Authorization is managed in policies.ts

🧠 Torii Query Guidelines Default to SQL queries (packages/torii/src/queries/sql/)

Use Torii client only when SQL isn't enough (complex joins, dynamic filters)

Name query files clearly and export from api.ts

✨ Feature Log Policy MANDATORY: Log every new player-facing feature or UX improvement in:

```swift
client/apps/game/src/ui/features/world/latest-features.ts
```

Logging Format:

```ts
{
  date: "2025-07-29",
  title: "Idle army shortcut",
  description: "You can now cycle through idle armies using the TAB key"
}
```

Rules: Log only user-visible features (not internal fixes)

Use YYYY-MM-DD format

Newest entries go first

Write from the player's perspective (not dev lingo)
