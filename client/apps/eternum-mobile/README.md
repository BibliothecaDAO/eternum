# Eternum/Blitz Mobile Client

A mobile game client built with:

- React + TypeScript
- wouter for routing
- shadcn/ui components
- TailwindCSS
- pnpm package manager
- Vite

## Project Structure (Feature-Sliced Design Architecture)

Feature-Sliced Design (FSD) provides a clear and organized way to structure projects around their core business value.
By following standardized architectural patterns, it eliminates confusion about code organization and makes the codebase
more maintainable.

The key benefit of FSD is that it enables seamless integration of new features while maintaining a clean and modular
codebase. Its strict layering system prevents tight coupling between components and helps avoid the common pitfall of
spaghetti code with complex interdependencies. The clear structure and standardized patterns also make it easy for new
developers to onboard quickly, as they can easily understand where different pieces of functionality belong and how they
interact.

Detailed documentation: https://feature-sliced.design/

### Layers

Modules on one layer can only know about and import from modules from the layers strictly below. (e.g. `src/widgets` can
only import from `src/features`, `src/shared`, you cannot import from `src/pages` or `src/app` or `src/widgets`)

```
src/
  - app/
  - pages/
  - widgets/
  - features/
  - shared/
```

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
    - hexception/
    - settings/
    ...
  - widgets/
    - header/
    - resource-list/
    - manage-production/
    - create-army/
    ...
  - features/
    - hyperstructures/
    - trade/
    - armies/
    ...
```

### Segments

Slices are grouped into segments.

- `ui` — everything related to UI display: UI components, date formatters, styles, etc.
- `api` — backend interactions: request functions, data types, mappers, etc.
- `model` — the data model: schemas, interfaces, stores, and business logic.
- `lib` — library code that other modules on this slice need.
- `config` — configuration files and feature flags.

```
src/
  - widgets/
    - resource-list/
      - ui/
      - api/
      - lib/
```
