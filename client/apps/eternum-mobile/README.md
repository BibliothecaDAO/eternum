# Eternum Mobile Client

A mobile game client built with:

- React + TypeScript
- wouter for routing
- zustand for state management
- shadcn/ui components
- TailwindCSS
- pnpm package manager
- Vite

## Project Structure (Feature-Sliced Design)

### Layers

Modules on one layer can only know about and import from modules from the layers strictly below. (e.g. `src/widgets` can
only import from `src/features`, `src/shared`, you cannot import from `src/pages` or `src/app` or `src/widgets`)

- `src/app/` — everything that makes the app run — routing, entrypoints, global styles, providers.
- `src/pages/` — full pages or large parts of a page in nested routing.
- `src/widgets/` — large self-contained chunks of functionality or UI, usually delivering an entire use case.
- `src/features/` — reused implementations of entire product features, i.e. actions that bring business value to the
  user.
- `src/shared/` — reusable functionality, especially when it's detached from the specifics of the project/business

### Slices

Folders inside Layers are called Slices and are grouped by business domain. Slices cannot use other slices on the same
layer, and that helps with high cohesion and low coupling.

Example:

```
src/
  - pages/
    - login/
    - worldmap/
    - settings/
  - widgets/
    - resource-list/
    - navigation/
    - header/
  - features/
    - hyperstructures/
    - trade/
    - armies/
```

### Segments

Slices are grouped into segments.

Example:

- `ui` — everything related to UI display: UI components, date formatters, styles, etc.
- `api` — backend interactions: request functions, data types, mappers, etc.
- `model` — the data model: schemas, interfaces, stores, and business logic.
- `lib` — library code that other modules on this slice need.
- `config` — configuration files and feature flags.
