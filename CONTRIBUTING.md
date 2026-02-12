# Contributing Guidelines

Thank you for your interest in contributing to the Eternum!

## Code of Conduct

We expect all contributors to foster a welcoming and inclusive environment.

## Getting Started

1) **Fork the repository** (GitHub UI).
2) **Clone your fork** to your machine.
3) **Create a branch** for your change.
4) **Sync from upstream** regularly to reduce merge conflicts.

### Quickstart (developer)
From the repo root:

```bash
pnpm install
pnpm run build:packages
```

Common dev commands:
- Game: `pnpm dev`
- Docs site: `pnpm dev:docs`
- Lint: `pnpm lint`
- Tests: `pnpm test`

### Docs contributions
There are two doc “homes”:
- **Docs site (player + dev docs):** `client/apps/game-docs/docs/pages/`
- **Repo docs (architecture/notes):** `docs/`

If you change docs, please run the docs dev server locally:

```bash
pnpm dev:docs
```

## Reporting Issues

If you encounter a bug or want to suggest a new feature, please create an issue in the
[Issue Tracker](https://github.com/BibliothecaDAO/eternum/issues). Be sure to provide the following information:

- A clear and concise description of the issue or feature
- Steps to reproduce the bug (if applicable)
- Any relevant error messages or screenshots
- Suggestions for resolving the issue or implementing the feature

## Submitting Changes

1. **Commit your changes**: Make your changes and commit them with a meaningful commit message that describes the
   changes you've made.
2. **Pull the latest changes**: Before submitting your pull request, pull the latest changes from the upstream
   repository to minimize conflicts.
3. **Push your changes**: Push your changes to your forked repository on GitHub.
4. **Create a pull request**: Open a new pull request on the
   [original repository](https://github.com/BibliothecaDAO/eternum). In the description, provide an overview of your
   changes and any additional context.

## Code Style and Quality

Please adhere to the following guidelines when writing code for the Eternum project:

- Write clean, readable, and well-documented code.
- Use descriptive variable and function names that reflect their purpose.
- Organize your code into modular components to improve maintainability.
- Ensure your code is compatible with the existing codebase and follows the project's coding conventions.
- Include tests to verify the functionality of your changes.

### Naming Conventions

| Entity Type        | Naming Convention | Examples                            |
| ------------------ | ----------------- | ----------------------------------- |
| Files              | kebab-case        | `user-profile.tsx`, `api-utils.ts`  |
| Components         | PascalCase        | `UserProfile`, `NavigationMenu`     |
| Enums              | PascalCase        | `UserRole`, `PaymentStatus`         |
| Types & Interfaces | PascalCase        | `UserProfile`, `ApiResponse`        |
| Functions          | camelCase         | `getUserData()`, `calculateTotal()` |
| Variables          | camelCase         | `userCount`, `totalPrice`           |
| Constants          | UPPER_SNAKE_CASE  | `MAX_USERS`, `API_ENDPOINT`         |

## Review Process

Once you submit a pull request, maintainers will review your changes and provide feedback. Your pull request may be
accepted immediately, or it may require further changes. Be patient and open to the feedback, as our goal is to ensure
the highest quality code for the Eternum project.

## Recognition

Your contributions to the Eternum project are valued and appreciated! All contributors will be recognized and
acknowledged in the project documentation.

Thank you for adhering to these guidelines and for your commitment to making the Eternum project a success!
