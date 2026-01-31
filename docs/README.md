# Eternum Documentation (Repo Index)

This page is a **map of the documentation inside this repository**.

## I’m a player / community member
- The “official” docs site lives in: [`client/apps/game-docs`](../client/apps/game-docs)
  - If you’re looking for gameplay and player-facing docs, start there.

## I’m a developer
### Quick links
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Deployment: [`deploy/README.md`](../deploy/README.md)
- Config notes: [`config/README.md`](../config/README.md)
- Contracts: [`contracts/`](../contracts)
- Packages / SDK: [`packages/`](../packages)

### Repo docs (this folder)
- Architecture
  - Runtime world profiles: [`docs/architecture/runtime-world-profiles.md`](./architecture/runtime-world-profiles.md)
  - Torii selective subscriptions: [`docs/architecture/torii-selective-subscriptions.md`](./architecture/torii-selective-subscriptions.md)
- SQL notes
  - Global SQL queries: [`docs/global-sql-queries.md`](./global-sql-queries.md)

## Running the docs site locally
The docs site lives at [`client/apps/game-docs`](../client/apps/game-docs). A typical local run looks like:

```bash
cd client/apps/game-docs
pnpm install
pnpm dev
```

If the above doesn’t work on your machine, use the root README and the `client/apps/game-docs/README.md` for the exact, current commands.

---

### Suggestions / improvements
If you’re not a developer, the best kind of doc feedback is:
- the page URL/file you were reading
- what you expected to happen
- what actually happened
- the exact step where you got stuck
