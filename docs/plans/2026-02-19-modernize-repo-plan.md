# Super Yugi Modernization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the Super Yugi repo with Vite, split scenes into files, add ESLint + Prettier.

**Architecture:** Replace Webpack with Vite, split single-file game into file-per-scene, add code quality tooling. Each task is a working commit — the game should run after every task.

**Tech Stack:** Vite 6, Phaser 3.90, TypeScript 5.7, ESLint (flat config), Prettier

**Design doc:** `docs/plans/2026-02-19-modernize-repo-design.md`

---

### Task 1: Scaffold Vite project, replace Webpack

**Files:**
- Create: `index.html` (project root — Vite entry point)
- Create: `vite.config.ts`
- Modify: `package.json` (new deps + scripts)
- Modify: `tsconfig.json` (modern targets)
- Modify: `src/types.d.ts` (Vite asset types)
- Delete: `webpack.config.js`
- Delete: `yarn.lock`
- Delete: `src/style.css` (empty file)

**Step 1: Create `index.html` at project root**

Vite uses a root `index.html` as entry point (not auto-generated like Webpack).

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Super Yugi</title>
    <style>
      body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/index.ts"></script>
  </body>
</html>
```

**Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
});
```

**Step 3: Rewrite `package.json`**

```json
{
  "name": "super-yugi",
  "version": "1.0.0",
  "license": "UNLICENSED",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "typescript": "~5.7.0",
    "vite": "^6.0.0"
  }
}
```

Note: `private` is now a boolean (was incorrectly a string `"true"`). `type: "module"` enables ESM. Name changed from `super-yugi-2` to `super-yugi`.

**Step 4: Rewrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "sourceMap": true
  },
  "include": ["src"]
}
```

Key changes: `target` ES5→ES2020, `module` es6→ESNext, `moduleResolution` node→bundler, added `strict`, removed unused `jsx` and `allowJs`.

**Step 5: Update `src/types.d.ts`**

Vite has built-in client types. Replace custom declarations:

```ts
/// <reference types="vite/client" />
```

This covers all asset imports (images, CSS, etc.) with proper Vite types.

**Step 6: Delete old files**

```bash
rm webpack.config.js yarn.lock src/style.css
```

**Step 7: Delete `node_modules` and install fresh**

```bash
rm -rf node_modules
npm install
```

**Step 8: Verify the game runs**

```bash
npm run dev
```

Open browser, confirm: player sprite renders, can jump, clouds spawn, score works, pause menu works. The game should be fully playable.

**Step 9: Verify prod build**

```bash
npm run build && npm run preview
```

Confirm game works in production build too.

**Step 10: Commit**

```bash
git add -A
git commit -m "Migrate from Webpack to Vite, update deps"
```

---

### Task 2: Split scenes into separate files

**Files:**
- Create: `src/main.ts` (new entry point)
- Create: `src/scenes/GameScene.ts`
- Create: `src/scenes/MenuScene.ts`
- Create: `src/scenes/ScoreScene.ts`
- Modify: `index.html` (update script src)
- Delete: `src/index.ts`

**Step 1: Create `src/scenes/ScoreScene.ts`**

Extract the `Score` class from `src/index.ts`:

```ts
import Phaser from "phaser";

export default class ScoreScene extends Phaser.Scene {
  private score: number = 0;

  init(data: { score: number }) {
    this.score = data.score;
  }

  create() {
    const text = this.add.text(120, 340, `Score: ${this.score}`, {
      font: "34px Monospace",
      color: "#000",
      align: "center",
    });

    this.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0 },
      duration: 3000,
      delay: 2000,
    });

    this.time.addEvent({
      delay: 5000,
      callback: () => this.scene.stop("score"),
    });
  }
}
```

Changes from original:
- Class renamed `Score` → `ScoreScene`
- Import `Phaser` (default import works with modern Phaser)
- Arrow function class properties → proper class methods (`create()` not `create = () =>`)
- Removed empty `preload`, `update`, `stop` methods (Phaser doesn't require them)
- `score` field initialized with default, marked private

**Step 2: Create `src/scenes/MenuScene.ts`**

```ts
import Phaser from "phaser";

export default class MenuScene extends Phaser.Scene {
  create() {
    const escKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    const pKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.P,
    );

    escKey.on("down", this.resumeGame, this);
    pKey.on("down", this.resumeGame, this);
  }

  private resumeGame() {
    this.scene.stop("menu");
    this.scene.resume("game");
  }
}
```

Changes from original:
- Class renamed `Menu` → `MenuScene`
- Arrow properties → class methods
- Key fields moved to local `create()` scope (not needed outside)
- Removed `console.log("launched")`
- Removed empty `preload`, `update`
- Non-null assertion on `this.input.keyboard` (strict mode)
- `resumeGame` uses Phaser's context arg on `.on()` instead of arrow function binding

**Step 3: Create `src/scenes/GameScene.ts`**

```ts
import Phaser from "phaser";
import { debounce } from "../utils";
import playerImg from "../assets/yugi.png";
import cloudImg from "../assets/cloud.png";
import skyImg from "../assets/sky.jpg";
import titleImg from "../assets/title.png";

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private clouds!: Phaser.GameObjects.Group;
  private score = 0;
  private lives = 3;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private hasStarted = false;
  private wobble!: Phaser.Tweens.Tween;
  private titleImage!: Phaser.GameObjects.Image;

  preload() {
    this.load.image("player", playerImg);
    this.load.image("cloud", cloudImg);
    this.load.image("sky", skyImg);
    this.load.image("title", titleImg);
  }

  create() {
    this.cameras.main.setBackgroundColor("#71c5cf");
    this.add.image(200, 245, "sky");
    this.titleImage = this.add.image(200, 245, "title");

    this.score = 0;
    this.scoreText = this.add.text(20, 20, "0", {
      font: "30px Arial",
      color: "#ffffff",
    });
    this.lives = 3;
    this.livesText = this.add.text(360, 20, "3", {
      font: "30px Arial",
      color: "#00aa00",
    });

    this.hasStarted = false;

    const startX = 100;
    const startY = 245;

    this.player = this.physics.add.sprite(startX, startY, "player");
    this.player.setBodySize(32.5, 16.25);
    this.player.setBounce(0.3);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.wobble = this.tweens.add({
      targets: this.player,
      y: { from: startY, to: startY + 20 },
      yoyo: true,
      loop: -1,
    });

    const keyboard = this.input.keyboard!;
    const jumpKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];
    jumpKeys.forEach((key) => key.on("down", this.jump, this));

    const pauseKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
    ];
    pauseKeys.forEach((key) => key.on("down", this.pauseGame, this));

    this.input.on("pointerdown", this.jump, this);

    this.clouds = this.physics.add.group({ allowGravity: false });

    this.physics.add.overlap(
      this.player,
      this.clouds,
      this.hitCloud,
      undefined,
      this,
    );
  }

  update() {
    if (this.player.y < 0 || this.player.y > 490) {
      this.scene.launch("score", { score: this.score });
      this.scene.restart();
    }

    if (this.player.angle < 90 && this.hasStarted) {
      this.player.angle += 1;
    }
  }

  private pauseGame() {
    this.scene.pause();
    this.scene.launch("menu");
  }

  private jump() {
    if (!this.hasStarted) {
      this.hasStarted = true;
      (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      this.tweens.remove(this.wobble);

      this.tweens.add({
        targets: this.titleImage,
        alpha: { from: 1, to: 0 },
        duration: 1250,
        ease: "Cubic.easeIn",
      });

      this.time.addEvent({
        delay: 750,
        callback: this.addRowOfClouds,
        callbackScope: this,
        loop: true,
      });
    }

    this.player.body!.velocity.y = -350;

    this.tweens.add({
      targets: this.player,
      angle: this.player.angle > 30 ? this.player.angle - 30 : 0,
      duration: 500,
    });
  }

  private addOneCloud(x: number, y: number, motion = 0) {
    const cloud = this.add.sprite(x, y, "cloud") as Phaser.Physics.Arcade.Sprite;
    this.clouds.add(cloud);
    cloud.body!.velocity.x = -200;
    (cloud.body as Phaser.Physics.Arcade.Body).setCircle(18, 12, 12);

    if (motion) {
      this.tweens.add({
        targets: cloud,
        loop: true,
        y: cloud.body!.position.y + motion,
        yoyo: true,
      });
    }

    this.time.addEvent({
      delay: 3000,
      callback: () => this.clouds.remove(cloud, true),
      callbackScope: this,
    });
  }

  private addRowOfClouds() {
    this.score += 1;
    this.scoreText.setText(String(this.score));

    if (this.score % 180 <= 60 && this.score % 2 === 1) return;
    if (this.score % 180 <= 120 && this.score % 3 === 1) return;
    if (this.score % 180 <= 180 && this.score % 4 === 1) return;

    const hole = Math.floor(Math.random() * 6);

    let motion: number;
    if (this.score % 60 <= 20) {
      motion = 0;
    } else if (this.score % 60 <= 40) {
      motion = 100;
    } else {
      motion = 200;
    }

    for (let i = 0; i < 8; i += 1) {
      if (i !== hole && i !== hole + 1 && i !== hole + 2) {
        this.addOneCloud(500, i * 60 + 40, motion);
      }
    }
  }

  private hitCloud = debounce(
    () => {
      this.lives -= 1;
      this.livesText.setText(String(this.lives));

      if (this.lives === 0) {
        this.scene.launch("score", { score: this.score });
        this.scene.restart();
      } else {
        this.tweens.add({
          targets: this.player,
          alpha: { from: 0, to: 1 },
          duration: 250,
          loop: 3,
        });
      }
    },
    1000,
    true,
  );
}
```

Changes from original:
- Class renamed `Game` → `GameScene`
- Arrow properties → class methods (except `hitCloud` which must stay arrow for debounce binding)
- Key setup simplified with `forEach` loops instead of 6 separate field declarations
- `null` → `undefined` in overlap callback (strict TS)
- `!= ` → `!==`
- `any` casts → `Phaser.Physics.Arcade.Body` where possible
- Private visibility on internal methods
- Definite assignment (`!`) on fields initialized in `create()`
- Renamed `title` → `titleImage` to avoid collision with Phaser.Scene.title (removed unintentional shadow)

**Step 4: Create `src/main.ts`**

```ts
import Phaser from "phaser";
import GameScene from "./scenes/GameScene";
import MenuScene from "./scenes/MenuScene";
import ScoreScene from "./scenes/ScoreScene";

new Phaser.Game({
  type: Phaser.AUTO,
  width: 400,
  height: 490,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1000 },
    },
  },
  scene: [GameScene, MenuScene, ScoreScene],
});
```

Note: Pass scene classes directly (not instances). Phaser auto-instantiates them. Scene keys are set via constructor — each scene needs a constructor calling `super({ key: "..." })`. Add constructors:

In each scene class, add a constructor:
- `GameScene`: `constructor() { super({ key: "game" }); }`
- `MenuScene`: `constructor() { super({ key: "menu" }); }`
- `ScoreScene`: `constructor() { super({ key: "score" }); }`

**Step 5: Update `index.html`**

Change script src from `/src/index.ts` to `/src/main.ts`.

**Step 6: Delete `src/index.ts`**

```bash
rm src/index.ts
```

**Step 7: Verify the game runs**

```bash
npm run dev
```

Test: jump, clouds, score, pause/resume, game over, all work exactly as before.

**Step 8: Commit**

```bash
git add -A
git commit -m "Split scenes into separate files"
```

---

### Task 3: Clean up utils.ts

**Files:**
- Modify: `src/utils.ts`

**Step 1: Modernize debounce function**

```ts
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
  immediate: boolean,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, wait);

    if (callNow) func.apply(this, args);
  };
}
```

Changes: `var` → `let`/`const`, proper TS generics, typed timeout, rest params instead of `arguments`.

**Step 2: Verify game still works**

```bash
npm run dev
```

Test: hit a cloud, confirm debounce works (only lose 1 life per hit, not multiple).

**Step 3: Commit**

```bash
git add src/utils.ts
git commit -m "Modernize debounce utility"
```

---

### Task 4: Add ESLint + Prettier

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (add devDeps + scripts)

**Step 1: Install dependencies**

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier
```

**Step 2: Create `eslint.config.js`**

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["dist/"],
  },
);
```

**Step 3: Create `.prettierrc`**

```json
{
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false
}
```

**Step 4: Add scripts to `package.json`**

Add to `scripts`:
```json
"lint": "eslint src/",
"format": "prettier --write src/"
```

**Step 5: Run formatter on all files**

```bash
npx prettier --write src/
```

**Step 6: Run linter, fix any issues**

```bash
npx eslint src/
```

Fix any reported issues.

**Step 7: Verify game still works**

```bash
npm run dev
```

Quick playtest.

**Step 8: Commit**

```bash
git add -A
git commit -m "Add ESLint + Prettier, format codebase"
```

---

### Task 5: Final verification + cleanup

**Step 1: Run prod build**

```bash
npm run build
```

Confirm no TS errors, build succeeds.

**Step 2: Run prod preview**

```bash
npm run preview
```

Full playtest in production build.

**Step 3: Run lint + format check**

```bash
npx eslint src/ && npx prettier --check src/
```

Both pass clean.

**Step 4: Update `.gitignore`**

Ensure `.gitignore` is clean:

```
node_modules
dist
**/.DS_Store
```

(The `docs/` line was already removed in design doc commit.)

**Step 5: Commit if any changes**

```bash
git add -A
git commit -m "Final cleanup"
```
