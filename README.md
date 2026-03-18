# WebstormProjects Monorepo

A monorepo using **npm workspaces** and **Turborepo** for managing multiple apps and shared packages.

## Structure

```
WebstormProjects/
├── apps/          ← deployable apps
├── packages/      ← shared libraries and config
├── package.json   ← root workspace config
└── turbo.json     ← task pipeline config
```

## Getting Started

Install all dependencies from the root:

```bash
npm install
```

## Adding Apps

```bash
# Next.js app
cd apps && npx create-next-app@latest my-app

# Vite app
cd apps && npm create vite@latest my-app
```

## Adding Shared Packages

Create a `packages/my-package/package.json` with a scoped name:

```json
{
  "name": "@workspace/my-package",
  "version": "0.0.1"
}
```

Then install it in any app:

```bash
npm install @workspace/my-package --workspace=apps/my-app
```

## Root Commands

| Command         | Description                                  |
|-----------------|----------------------------------------------|
| `npm run dev`   | Start all dev servers in parallel            |
| `npm run build` | Build all apps in dependency order           |
| `npm run test`  | Run tests across all workspaces              |
| `npm run lint`  | Lint all workspaces                          |
| `npm run clean` | Clean all build outputs                      |

To run a command in a single workspace:

```bash
npm run build --workspace=apps/my-app
```

## How Turborepo Works

Turborepo builds a task graph from your workspace dependencies. If `apps/web` depends on `packages/ui`, running `turbo build` will automatically build `packages/ui` first. It also caches outputs — only changed packages are rebuilt on subsequent runs.
