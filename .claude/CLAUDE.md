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

**⚠️ CRITICAL: NEVER COMMIT WITHOUT A SUCCESSFUL BUILD! ⚠️**

IMPORTANT: Before committing changes, YOU MUST:

1. **Run Build Check** (MANDATORY - DO THIS FIRST!):
   - Execute `pnpm run build` in EVERY affected app directory
   - For game changes: `cd client/apps/game && pnpm run build`
   - For landing page changes: `cd client/apps/landing && pnpm run build`
   - **IF BUILD FAILS: FIX ALL ERRORS BEFORE PROCEEDING!**
   - **NEVER use --no-verify or skip this step**
2. **Update Lockfile**: If you added/removed dependencies, run `pnpm install` to update pnpm-lock.yaml and commit it
3. **Update Documentation**: Check if `client/apps/game-docs` needs updates based on your changes
4. **Update README**: Update the main README if you've added new features or changed setup steps
5. **Check Directory READMEs**: If you made changes in a directory, check if that directory's README needs updates
6. **Run Formatter**: Execute `pnpm run format` to ensure consistent code formatting
7. **Check Unused Dependencies**: Run `knip` and ensure no changes (no unused dependencies)
8. **Build Packages**: If you modified packages, run `pnpm run build:packages`
9. **Create PR to `next`**: When creating PR, ALWAYS use `gh pr create --base next` (NEVER to `main`)

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
6. **Create PR**: **ALWAYS use `--base next`** when creating PRs: `gh pr create --base next`

**If you find yourself on `next` with uncommitted changes:**

- Create an appropriate branch: `git checkout -b fix/move-from-next` (or feature/, refactor/, etc.)
- Your changes will move with you to the new branch
- Then follow steps 4-6 above

**NEVER:**

- Work directly on `next` branch
- **Create PRs to `main` branch (ALWAYS target `next` - use `--base next`)**
- Push commits directly to `next`
- Use `gh pr create` without explicitly specifying `--base next`

## Repository Etiquette

- Use descriptive commit messages
- Keep commits focused and atomic
- Don't commit generated files or build artifacts
- Always test locally before pushing

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
