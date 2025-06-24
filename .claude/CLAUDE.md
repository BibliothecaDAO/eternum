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
- **Tailwind CSS**: Always use colors defined in `client/apps/game/tailwind.config.js` rather than default Tailwind colors (e.g., use `bg-danger` instead of `bg-red-600`, `bg-green` instead of `bg-green-600`)

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

## Project-Specific Notes

- This is a blockchain gaming project using Cairo/Starknet
- The game involves realms, resources, and armies
- Torii is used for indexing blockchain data
- The project uses pnpm workspaces for monorepo management

## Git Workflow - MANDATORY PROCESS

**CRITICAL: Follow this exact workflow for ALL changes (features, bug fixes, refactors, docs, etc.):**

1. **Always start from `next` branch**: `git checkout next && git pull origin next`
2. **Create a branch with appropriate prefix**:
   - Features: `git checkout -b feature/your-feature-name`
   - Bug fixes: `git checkout -b fix/your-bug-description`
   - Refactors: `git checkout -b refactor/what-youre-refactoring`
   - Documentation: `git checkout -b docs/what-docs-youre-updating`
   - Other: `git checkout -b chore/your-change-description`
3. **Make your changes on the branch** (NEVER work directly on `next`)
4. **Commit changes**: `git add . && git commit -m "your message"`
5. **Push branch**: `git push -u origin your-branch-name`
6. **Create PR**: Always create pull requests FROM your branch TO `next` branch

**If you find yourself on `next` with uncommitted changes:**

- Create an appropriate branch: `git checkout -b fix/move-from-next` (or feature/, refactor/, etc.)
- Your changes will move with you to the new branch
- Then follow steps 4-6 above

**NEVER:**

- Work directly on `next` branch
- Create PRs to `main` (always target `next`)
- Push commits directly to `next`

## Repository Etiquette

- Use descriptive commit messages
- Keep commits focused and atomic
- Don't commit generated files or build artifacts
- Always test locally before pushing
