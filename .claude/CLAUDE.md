# Shared Project Guidelines

- This is a blockchain gaming project using Cairo/Starknet
- The game involves realms, resources, and armies
- Torii is used for indexing blockchain data
- The project uses pnpm workspaces for monorepo management

## 🎯 Key Documentation References

**MANDATORY: Read these domain-specific guidelines:**

- **Frontend Guidelines**: `.claude/frontend-rules.md` 🎨
  - Package architecture & dependencies
  - UI/UX patterns & design system
  - Component development standards
  - Frontend-specific workflows
- **Contracts Guidelines**: `.claude/contracts-rules.md` ⚡
  - Smart contract patterns
  - Cairo best practices
  - Contract testing requirements

## 📦 Package Architecture Overview

**CRITICAL: Understand the monorepo structure before coding:**

- `packages/types` – Shared type definitions
- `packages/provider` – Data provider interfaces
- `packages/core` – Core game logic
- `packages/torii` – Blockchain data indexing

**See `.claude/frontend-rules.md` for detailed package guidelines**

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
4. **Follow Pre-commit Checklist** (see below)
5. **Commit changes**: `git add . && git commit -m "your message"`
6. **Push branch**: `git push -u origin your-branch-name`
7. **Create PR**: **ALWAYS use `--base next`** when creating PRs: `gh pr create --base next`

**If you find yourself on `next` with uncommitted changes:**

- Create an appropriate branch: `git checkout -b fix/move-from-next` (or feature/, refactor/, etc.)
- Your changes will move with you to the new branch
- Then follow steps 4-7 above

**NEVER:**

- Work directly on `next` branch
- **Create PRs to `main` branch (ALWAYS target `next` - use `--base next`)**
- Push commits directly to `next`
- Use `gh pr create` without explicitly specifying `--base next`

## 📋 Pre-commit Checklist - MANDATORY

**Complete ALL items before committing:**

1. **Update Lockfile** – If dependencies changed: `pnpm install`
2. **Update Documentation** – Check if docs need updates
3. **Run Formatter** – `pnpm run format`
4. **Check Dependencies** – `pnpm run knip` (no unused deps)
5. **Build Packages** – `pnpm run build:packages` (if packages modified)
6. **Build Verification** – `pnpm run build` (MUST pass)
7. **Update Feature Log** – Add new features to `latest-features.ts`

**See `.claude/frontend-rules.md` for detailed checklist items**

## 🚀 Quick Command Reference

```bash
# Essential commands
pnpm run build:packages  # Build all packages
pnpm run build          # Full build verification
pnpm run format         # Format code
pnpm run knip          # Check unused dependencies
pnpm test              # Run tests

# Development
pnpm dev               # Start development server
```

## 🏗️ Domain-Specific Guidelines

### Frontend Development

- **Design System**: Check reusability before creating components
- **TypeScript**: NEVER use `(as any)` - properly type your data
- **Shortcuts**: Register via centralized manager only
- **Components**: Functional components, small and focused
- **Full details**: `.claude/frontend-rules.md`

### Contract Development

- **Cairo patterns**: Follow established patterns
- **Testing**: Comprehensive test coverage required
- **Full details**: `.claude/contracts-rules.md`

### Adding New Features

1. **Contract Entrypoints**: Follow 5-step process in frontend-rules.md
2. **UI Components**: Check design system first
3. **Torii Queries**: SQL by default, torii-client for complex joins
4. **Feature Logging**: Update `latest-features.ts` for user-facing changes

## Repository Etiquette

- Use descriptive commit messages
- Keep commits focused and atomic
- Don't commit generated files or build artifacts
- Always test locally before pushing
- Follow the appropriate domain guidelines

## Build Verification - MANDATORY

**CRITICAL: After making ANY code changes, always verify the build:**

```bash
pnpm run build
```

- This MUST pass before considering any task complete
- The project uses `pnpm`, not `npm`
- Never assume changes work without running the build
- If build fails, fix all errors before proceeding

## Claude.md Changes Guidelines

When making changes to project rules and guidelines:

- **Project-wide rules** (Git workflow, repository etiquette, etc.) → Update this file (`CLAUDE.md`)
- **Frontend-specific rules** → Update `.claude/frontend-rules.md`
- **Contract-specific rules** → Update `.claude/contracts-rules.md`

Keep changes focused to their respective domains and avoid cross-contamination between rule files.

## 📚 CRITICAL DOCUMENTATION PATTERN

**ALWAYS ADD IMPORTANT DOCS HERE!** When you create or discover:

- Architecture diagrams → Add reference path here
- Database schemas → Add reference path here
- Problem solutions → Add reference path here
- Setup guides → Add reference path here
- Package READMEs → Listed in frontend-rules.md
- App READMEs → Listed in frontend-rules.md

This prevents context loss! Update this file IMMEDIATELY when creating important docs.

## ⚠️ Common Pitfalls to Avoid

1. **Not reading domain guidelines** before starting work
2. **Skipping build verification** after changes
3. **Creating components without checking design system**
4. **Using `(as any)` in TypeScript**
5. **Working directly on `next` branch**
6. **Creating PRs to `main` instead of `next`**
7. **Not updating feature log for new features**

---

**Remember: When in doubt, check the domain-specific guidelines first!**
