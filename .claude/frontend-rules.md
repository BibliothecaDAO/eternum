# Eternum Project Guidelines

## Package Architecture

IMPORTANT: Read these package READMEs to understand the codebase structure:

- `packages/types/README.md` – Type definitions shared across packages
- `packages/provider/README.md` – Data provider interfaces and implementations
- `packages/core/README.md` – Core game logic and utilities
- `packages/torii/README.md` – Torii integration for blockchain data

This helps you:

- Locate existing functions before creating new ones
- Write new functions in the appropriate package
- Understand dependencies between packages

## Common Commands

```bash
# Build all packages (REQUIRED after package changes)
pnpm run build:packages

# Development commands
pnpm run format # run prettier formatting
pnpm run knip # knip
```

## Application Structure

When building features, read the relevant app README:

- `client/apps/game/README.md` – Main game application
- `client/apps/bot/README.md` – Bot implementation
- `client/apps/game-docs/README.md` – Game documentation site
- `client/apps/heavy-load/README.md` – Performance testing tools
- `client/apps/landing/README.md` – Landing page

## Game World Display: Worldmap vs. Hex View

The worldmap is a hex-based global view where you can see all structures, realms, and armies on a large-scale grid.

Armies spawn on adjacent hexes of a structure and can explore, travel, and engage in battles across the hexes.

Clicking into a structure or realm enters the hex view (also called "local view"), which contains its own internal grid
of sub-hexes.

Inside a local hex view, buildings can be constructed on sub-hexes — these actions are isolated to that specific
structure or realm.

Transitioning between these two layers is a core interaction in gameplay and impacts UX and system design.

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Prefer composition over inheritance
- Use functional components for React code
- Keep components small and focused
- **NEVER use `(as any)` to bypass TypeScript errors** – Instead, properly type your data or fix the underlying issue

## Shortcut Integration Guidelines

If you're adding new keyboard shortcuts to the app:

- **Always register them via the centralized manager** located at:
  `@client/apps/game/src/utils/shortcuts/centralized-shortcut-manager.ts`
- This ensures shortcuts are consistent across scenes and easy to maintain
- **Do not register shortcuts ad-hoc** in component files or scene logic
- If shortcuts are tied to the game scene (e.g., Three.js), you can use `SceneShortcutManager` to bridge centralized
  logic with scene-specific behavior

## Testing Guidelines

- Write tests for new features
- Run tests before committing: `pnpm test`
- Test files should be colocated with source files
- Use descriptive test names

## COMMIT Checklist

IMPORTANT: Before committing changes, YOU MUST:

1. **Update Lockfile** – If you added/removed dependencies, run `pnpm install` and commit pnpm-lock.yaml
2. **Update Documentation** – Check if `client/apps/game-docs` needs updates based on your changes
3. **Update README** – Update the main README if you've added new features or changed setup steps
4. **Check Directory READMEs** – If you made changes in a directory, check if its README needs updates
5. **Run Formatter** – Execute `pnpm run format` to ensure consistent code formatting
6. **Check Unused Dependencies** – Run `knip` and ensure no changes (no unused dependencies)
7. **Build Packages** – If you modified packages, run `pnpm run build:packages`

## Design System Guidelines

When creating new UI components:

1. **Check for reusability**: Before creating a component in a feature-specific location, evaluate if it could be used
   elsewhere in the app
2. **Add to design system if generic**:
   - `atoms/` for basic UI primitives (buttons, inputs, labels)
   - `molecules/` for composed components (card headers, form groups)
3. **Search for existing usage**: When adding a component to the design system, search the codebase for similar
   implementations that could be replaced
4. **Replace existing implementations**: Update all found instances to use the new design system component
5. **Follow naming conventions**: Use kebab-case for files and PascalCase for component names

## Adding New Contract Entrypoints – MANDATORY PROCESS

When new entrypoints are added to contracts, follow this exact pattern:

1. **Add TypeScript Props Interface** in `packages/types/src/types/provider.ts`
2. **Add Provider Method** in `packages/dojo/node_modules/@bibliothecadao/provider/src/index.ts`
3. **Add System Call Wrapper** in `packages/types/src/dojo/create-system-calls.ts`
4. **Add to Policies** in `client/apps/game/src/hooks/context/policies.ts`
5. **MANDATORY: Run Build Verification**

```bash
pnpm run build:packages
pnpm run build
```

**Example Pattern – Relic System:**

- Contract entrypoints: `open_chest(...)`, `apply_relic(...)`
- Props interfaces: `OpenChestProps`, `ApplyRelicProps`
- Provider methods: `open_chest()`, `apply_relic()`
- System calls: `open_chest: withAuth(open_chest)`, `apply_relic: withAuth(apply_relic)`
- Policies: Add methods under `relic_systems` contract

**CRITICAL NOTES:**

- Always match contract parameter names and order
- Use `${NAMESPACE}-system_name` for contract addresses
- Coordinate parameters must be `{ x: num.BigNumberish; y: num.BigNumberish; }`
- All system calls MUST be wrapped with `withAuth()`
- You must update policies.ts for user authorization
- Run full build before completing your task

## Torii Query Strategy

- **Use SQL queries by default** for best performance
- Queries live in `packages/torii/src/queries/sql/`
- Use torii-client queries only when needed for complex multi-model joins
- Follow naming conventions for query files and structure
- Export all SQL queries from the main api.ts file

## Feature Log Policy

Whenever a new feature or UX improvement is added (excluding bug fixes), it must be logged in `latest-features.ts` with a clear, descriptive title and a timestamp. This entry will appear in the in-game 'Latest Features' panel to help users understand what's new.

### Guidelines for Feature Logging:

1. **Include only features and UX improvements** - Bug fixes should not be logged
2. **Use clear, descriptive titles** - Write titles that explain the feature clearly to players
3. **Follow the timestamp format** - Use YYYY-MM-DD format (e.g., "2025-07-29")  
4. **Sort entries chronologically** - Most recent features should appear first in the array
5. **Write from the player's perspective** - Focus on what the player can now do or experience

### Example Entry:

```typescript
{
  date: "2025-07-29",
  title: "You can now cycle between idle armies using the TAB key"
}
```

### File Location:

The feature log is maintained in:
`client/apps/game/src/ui/features/world/latest-features.ts`
