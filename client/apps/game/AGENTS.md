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

ONLY commit files YOU changed in THIS session
ALWAYS include fixes #<number> or closes #<number> in the commit message when there is a related issue or PR
NEVER use git add -A or git add . - these sweep up changes from other agents
ALWAYS use git add <specific-file-paths> listing only files you modified
Before committing, run git status and verify you are only staging YOUR files
Track which files you created/modified/deleted during the session

### Forbidden Git Operations

These commands can destroy other agents' work:

git reset --hard - destroys uncommitted changes
git checkout . - destroys uncommitted changes
git clean -fd - deletes untracked files
git stash - stashes ALL changes including other agents' work
git add -A / git add . - stages other agents' uncommitted work
git commit --no-verify - bypasses required checks and is never allowed

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

Resolve conflicts in YOUR files only
If conflict is in a file you didn't modify, abort and ask the user
NEVER force push
