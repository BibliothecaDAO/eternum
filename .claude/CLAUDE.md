# Shared Project Guidelines

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

# Frontend Guidelines

@.claude/frontend-rules.md

# Contracts Guidelines

@.claude/contracts-rules.md
