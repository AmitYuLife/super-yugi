# Super Yugi: Modernize Repo

## Context

Phaser 3 flappy-bird game, ~470 LOC, last touched Jan 2021. All deps 5+ years old. No tests, linting, or formatting. Single-file game code with 3 Phaser scenes.

## Goals

1. Modern build tooling (Vite replaces Webpack)
2. Clean code structure (file-per-scene)
3. Code quality tooling (ESLint + Prettier)
4. Updated dependencies (Phaser 3.90, TypeScript 5.7)

## Design

### 1. Vite Migration

Replace Webpack + 7 plugins with Vite. Delete `webpack.config.js`, `yarn.lock`. Add `vite.config.ts`.

**Dependencies:**
- `phaser@^3.90.0` (from 3.50.1)
- `vite@^6` (replaces webpack, ts-loader, uglifyjs-webpack-plugin, css-loader, style-loader, html-webpack-plugin, clean-webpack-plugin)
- `typescript@~5.7` (from 4.1.3)
- Remove `@types/lodash` (unused)

**Scripts:** `dev`, `build`, `preview` (replaces start, develop, watch, serve, build)

**tsconfig:** Target ES2020+, ESNext modules.

Switch package manager from Yarn to npm.

### 2. Code Restructure

Split `src/index.ts` into:
```
src/
├── main.ts           # Phaser config + bootstrap
├── scenes/
│   ├── GameScene.ts  # Main gameplay
│   ├── MenuScene.ts  # Pause menu
│   └── ScoreScene.ts # Game over display
├── utils.ts          # Debounce (keep)
└── types.d.ts        # Asset type declarations (update for Vite)
```

Delete empty `style.css`. Move `index.html` to project root (Vite convention).

### 3. ESLint + Prettier

- `eslint` + `@eslint/js` + `typescript-eslint` (flat config)
- `prettier` + `eslint-config-prettier`
- Scripts: `lint`, `format`
- Format all files once during migration

No pre-commit hooks.
