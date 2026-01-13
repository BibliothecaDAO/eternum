# Agent Instructions for Game Client

## Documenting UX Changes and New Features

Whenever you make a UX change or add a new feature in the client, you **must** add an entry to the latest features list at:

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
