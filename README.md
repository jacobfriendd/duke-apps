# duke-apps Monorepo

A monorepo using **npm workspaces** and **Turborepo** for managing multiple apps and shared packages.

## Structure

```
duke-apps/
├── packages/      ← apps and shared libraries
├── package.json   ← root workspace config
└── turbo.json     ← task pipeline config
```

All apps and shared libraries live under `packages/`. Use naming conventions to distinguish them:

```
packages/
  app-portal/       ← a deployable app
  app-dashboard/    ← another deployable app
  ui/               ← shared component library
  utils/            ← shared utilities
```

## Getting Started

Install all dependencies from the root:

```bash
npm install
```

## Adding an App

```bash
# Next.js app
cd packages && npx create-next-app@latest app-my-app

# Vite app
cd packages && npm create vite@latest app-my-app
```

## Adding a Shared Package

Create a `packages/my-package/package.json` with a scoped name:

```json
{
  "name": "@duke/my-package",
  "version": "0.0.1"
}
```

Then run `npm install` at the root, and install it in any app:

```bash
npm install @duke/my-package --workspace=packages/app-my-app
```

## Root Commands

| Command         | Description                                  |
|-----------------|----------------------------------------------|
| `npm run dev`   | Start all dev servers in parallel            |
| `npm run build` | Build all packages in dependency order       |
| `npm run test`  | Run tests across all workspaces              |
| `npm run lint`  | Lint all workspaces                          |
| `npm run clean` | Clean all build outputs                      |

To run a command in a single workspace:

```bash
npm run build --workspace=packages/app-my-app
```

## How Turborepo Works

Turborepo builds a task graph from your workspace dependencies. If `packages/app-portal` depends on `packages/ui`, running `turbo build` will automatically build `packages/ui` first. It also caches outputs — only changed packages are rebuilt on subsequent runs.
