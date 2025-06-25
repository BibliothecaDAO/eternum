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
