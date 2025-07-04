# Eternum Project Guidelines

## Package Architecture

IMPORTANT: Read these package READMEs to understand the codebase structure:

- `packages/types/README.md` - Type definitions shared across packages
- `packages/provider/README.md` - Data provider interfaces and implementations
- `packages/core/README.md` - Core game logic and utilities
- `packages/torii/README.md` - Torii integration for blockchain data

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

- `client/apps/game/README.md` - Main game application
- `client/apps/bot/README.md` - Bot implementation
- `client/apps/game-docs/README.md` - Game documentation site
- `client/apps/heavy-load/README.md` - Performance testing tools
- `client/apps/landing/README.md` - Landing page

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Prefer composition over inheritance
- Use functional components for React code
- Keep components small and focused
- **NEVER use `(as any)` to bypass TypeScript errors** - This defeats the purpose of TypeScript's type safety. Instead,
  properly type your data or fix the underlying type issues

## Testing Guidelines

- Write tests for new features
- Run tests before committing: `pnpm test`
- Test files should be colocated with source files
- Use descriptive test names

## COMMIT Checklist

IMPORTANT: Before committing changes, YOU MUST:

1. **Update Lockfile**: If you added/removed dependencies, run `pnpm install` to update pnpm-lock.yaml and commit it
2. **Update Documentation**: Check if `client/apps/game-docs` needs updates based on your changes
3. **Update README**: Update the main README if you've added new features or changed setup steps
4. **Check Directory READMEs**: If you made changes in a directory, check if that directory's README needs updates
5. **Run Formatter**: Execute `pnpm run format` to ensure consistent code formatting
6. **Check Unused Dependencies**: Run `knip` and ensure no changes (no unused dependencies)
7. **Build Packages**: If you modified packages, run `pnpm run build:packages`

## Design System Guidelines

When creating new UI components:

1. **Check for reusability**: Before creating a component in a feature-specific location, evaluate if it could be used
   elsewhere in the app
2. **Add to design system if generic**: If the component is generic enough (like buttons, inputs, modals), add it to the
   appropriate design system folder:
   - `atoms/` for basic UI primitives (buttons, inputs, labels)
   - `molecules/` for composed components (card headers, form groups)
3. **Search for existing usage**: When adding a component to the design system, search the codebase for similar
   implementations that could be replaced
4. **Replace existing implementations**: Update all found instances to use the new design system component for
   consistency
5. **Follow naming conventions**: Use kebab-case for files and PascalCase for component names

## Adding New Contract Entrypoints - MANDATORY PROCESS

**When new entrypoints are added to contracts, follow this exact pattern:**

1. **Add TypeScript Props Interface** in `packages/types/src/types/provider.ts`:

   ```typescript
   export interface YourEntrypointProps extends SystemSigner {
     // Add parameters matching the contract entrypoint
     // Use num.BigNumberish for IDs and numbers
     // Use coordinate structure for Coord: { x: num.BigNumberish; y: num.BigNumberish; }
   }
   ```

2. **Add Provider Method** in `packages/dojo/node_modules/@bibliothecadao/provider/src/index.ts`:

   ```typescript
   public async your_entrypoint(props: SystemProps.YourEntrypointProps) {
     const { signer, param1, param2 } = props;
     return await this.executeAndCheckTransaction(signer, {
       contractAddress: getContractByName(this.manifest, `${NAMESPACE}-system_name`),
       entrypoint: "your_entrypoint",
       calldata: [param1, param2], // Match contract parameter order
     });
   }
   ```

3. **Add System Call Wrapper** in `packages/types/src/dojo/create-system-calls.ts`:

   ```typescript
   // Add function definition
   const your_entrypoint = async (props: SystemProps.YourEntrypointProps): Promise<Result> => {
     return await provider.your_entrypoint(props);
   };

   // Add to systemCalls export object
   const systemCalls = {
     // ... existing calls
     your_entrypoint: withAuth(your_entrypoint),
   };
   ```

4. **Add to Policies** in `client/apps/game/src/hooks/context/policies.ts`:

   ```typescript
   [getContractByName(dojoConfig.manifest, "s1_eternum", "system_name").address]: {
     methods: [
       {
         name: "your_entrypoint",
         entrypoint: "your_entrypoint",
       },
       // Don't forget dojo_name and world_dispatcher
       {
         name: "dojo_name",
         entrypoint: "dojo_name",
       },
       {
         name: "world_dispatcher",
         entrypoint: "world_dispatcher",
       },
     ],
   },
   ```

5. **MANDATORY: Run Build Verification**:
   ```bash
   pnpm run build:packages
   pnpm run build
   ```

**Example Pattern - Relic System:**

- Contract entrypoints: `open_chest(explorer_id: ID, chest_coord: Coord)`, `apply_relic(...)`
- Props interfaces: `OpenChestProps`, `ApplyRelicProps`
- Provider methods: `open_chest()`, `apply_relic()`
- System calls: `open_chest: withAuth(open_chest)`, `apply_relic: withAuth(apply_relic)`
- Policies entry: Add `relic_systems` contract with `open_chest` and `apply_relic` methods

**CRITICAL NOTES:**

- Always match contract parameter names and order exactly
- Use `${NAMESPACE}-system_name` pattern for contract addresses (e.g., `relic_systems`)
- Coordinate parameters use `{ x: num.BigNumberish; y: num.BigNumberish; }` structure
- All system calls MUST use `withAuth()` wrapper for authentication
- ALWAYS update policies.ts when adding new entrypoints - this is required for user authorization
- Build verification is mandatory before considering task complete
