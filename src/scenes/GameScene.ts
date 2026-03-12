import Phaser from "phaser";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import playerImg from "../assets/yugi.png";
import burgersImg from "../assets/burgers.png";
import skyImg from "../assets/sky.jpg";
import cowImg from "../assets/cow.png";
import mooSfx from "../assets/moo.mp3";
import titleImg from "../assets/title.png";

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private clouds!: Phaser.GameObjects.Group;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private sky!: Phaser.GameObjects.TileSprite;
  private titleText!: Phaser.GameObjects.Image;
  private taglineText!: Phaser.GameObjects.Text;
  private idleHoverTween?: Phaser.Tweens.Tween;
  private startButton!: Phaser.GameObjects.Container;
  private hitboxDebugHint?: Phaser.GameObjects.Text;
  private hitboxDebugKey?: Phaser.Input.Keyboard.Key;
  private isHitboxDebugEnabled = false;
  private burgerFrameNames: (string | number)[] = [];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hasStarted = false;
  private isInvulnerable = false;
  private isGameOver = false;
  private hasQueuedRestart = false;
  private hasUnlockedAudio = false;
  private gameOverBackdrop?: Phaser.GameObjects.Rectangle;
  private gameOverOverlay?: Phaser.GameObjects.Container;
  private cowSprite?: Phaser.GameObjects.Image;
  private bloodEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flapVelocity = -500;
  private readonly maxFallSpeed = 820;
  private readonly cloudScaleFactor = 1.12;
  private readonly titleTextureKey = "title-3d";
  private readonly hitboxMarginRatio = 0.03;

  constructor() {
    super({ key: "game" });
  }

  preload() {
    this.load.image("sky", skyImg);
    this.load.image("burger", burgersImg);
    this.load.image("player", playerImg);
    this.load.image("cow", cowImg);
    this.load.image("title", titleImg);
    this.load.audio("moo", mooSfx);
  }

  create() {
    this.cameras.main.setBackgroundColor("#71c5cf");
    this.scale.on("resize", this.handleResize, this);

    this.score = 0;
    this.scoreText = this.add
      .text(20, 20, "Score: 0", {
        font: "700 36px Arial",
        color: "#ffffff",
        stroke: "#1f2d56",
        strokeThickness: 8,
      })
      .setDepth(20);

    this.hasStarted = false;
    this.isInvulnerable = false;
    this.isGameOver = false;
    this.hasQueuedRestart = false;
    this.hasUnlockedAudio = false;

    const { width, height } = this.scale;
    this.sky = this.add.tileSprite(width / 2, height / 2, width, height, "sky");

    const startX = Math.max(120, width * 0.28);
    const startY = height / 2;

    this.player = this.physics.add.sprite(startX, startY, "player");
    this.scaleEntities();
    this.player.setDragY(36);
    this.player.setGravityY(1650);
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.player.setCollideWorldBounds(false);
    this.startIdleHover();

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
    this.hitboxDebugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.hitboxDebugKey.on("down", this.toggleHitboxDebug, this);

    this.input.on("pointerdown", () => {
      if (this.hasStarted && !this.isGameOver) {
        this.jump();
      }
    });

    this.input.keyboard?.once("keydown", () => this.unlockAudioContext());
    this.input.once("pointerdown", () => this.unlockAudioContext());

    this.clouds = this.physics.add.group({ allowGravity: false });
    this.createBurgerFrames();

    this.physics.add.overlap(
      this.player,
      this.clouds,
      this.hitCloud,
      undefined,
      this,
    );

    this.createMenuOverlay();
    this.hitboxDebugHint = this.add
      .text(width - 20, height - 18, "H: Hitboxes OFF", {
        font: "700 18px Poppins",
        color: "#ffffff",
        stroke: "#1f2d56",
        strokeThickness: 5,
      })
      .setOrigin(1, 1)
      .setDepth(40)
      .setAlpha(0.86);
    this.handleResize({ width, height } as Phaser.Structs.Size);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_time: number, delta: number) {
    const { height } = this.scale;
    if (this.player.y < -20 || this.player.y > height + 20) {
      this.triggerGameOver();
      return;
    }

    if (!this.isGameOver) {
      this.sky.tilePositionX += delta * this.getParallaxSpeed();
    }

    if (this.hasStarted) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.velocity.y = Phaser.Math.Clamp(
        body.velocity.y,
        this.flapVelocity,
        this.maxFallSpeed,
      );

      const targetAngle = Phaser.Math.Clamp(
        Phaser.Math.Linear(-35, 85, (body.velocity.y + 250) / 900),
        -35,
        85,
      );
      this.player.angle = Phaser.Math.Linear(this.player.angle, targetAngle, 0.14);
    }

    this.clouds.children.each((child) => {
      const cloud = child as Phaser.Physics.Arcade.Sprite;
      if (cloud.x < -cloud.displayWidth) {
        this.clouds.remove(cloud, true, true);
      }
      return true;
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;
    this.cameras.main.setViewport(0, 0, width, height);

    if (this.sky) {
      this.updateSkySizing(width, height);
    }

    if (this.titleText) {
      this.layoutMenuTitle(width, height);
    }

    if (this.taglineText) {
      this.taglineText.setPosition(width / 2, height * 0.765);
    }

    if (this.startButton) {
      this.startButton.setPosition(width / 2, height * 0.64);
    }

    if (this.scoreText) {
      this.scoreText.setPosition(24, 20);
    }

    if (this.hitboxDebugHint) {
      this.hitboxDebugHint.setPosition(width - 20, height - 18);
    }

    if (this.gameOverBackdrop) {
      this.gameOverBackdrop.setSize(width, height);
    }

    if (this.gameOverOverlay) {
      this.gameOverOverlay.setPosition(width / 2, height / 2);
    }

    if (this.player) {
      this.scaleEntities();
    }
  }

  private shutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.spawnTimer?.remove(false);
    this.idleHoverTween?.stop();
    this.input.off("pointerdown", this.restartFromGameOver, this);
    this.input.keyboard?.off("keydown", this.restartFromGameOver, this);
    this.hitboxDebugKey?.off("down", this.toggleHitboxDebug, this);
    this.hitboxDebugKey = undefined;
    this.gameOverOverlay?.destroy();
    this.gameOverBackdrop?.destroy();
    this.hitboxDebugHint?.destroy();
    this.hitboxDebugHint = undefined;
    this.setHitboxDebug(false);
    this.gameOverOverlay = undefined;
    this.gameOverBackdrop = undefined;
    this.cowSprite?.destroy();
    this.cowSprite = undefined;
    this.bloodEmitter?.destroy();
    this.bloodEmitter = undefined;
  }

  private scaleEntities() {
    const minViewport = Math.min(this.scale.width, this.scale.height);
    const targetPlayerHeight = Phaser.Math.Clamp(minViewport * 0.145, 74, 132);
    const playerScale = targetPlayerHeight / this.player.height;
    this.player.setScale(playerScale);

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.updatePlayerHitbox(playerBody);

    const burgerFrame =
      this.textures.getFrame("burger", this.burgerFrameNames[0]) ??
      this.textures.getFrame("burger", "__BASE");
    const burgerHeight = burgerFrame?.height ?? 128;
    const cloudScale = (targetPlayerHeight * this.cloudScaleFactor) / burgerHeight;
    this.clouds?.children.each((child) => {
      const cloud = child as Phaser.Physics.Arcade.Sprite;
      cloud.setScale(cloudScale);
      this.updateBurgerHitbox(cloud);
      return true;
    });
  }

  private updatePlayerHitbox(playerBody: Phaser.Physics.Arcade.Body) {
    // Tiny inset for forgiving edge contacts.
    const width = this.player.width * (1 - this.hitboxMarginRatio * 2);
    const height = this.player.height * (1 - this.hitboxMarginRatio * 2);
    const offsetX = this.player.width * this.hitboxMarginRatio;
    const offsetY = this.player.height * this.hitboxMarginRatio;
    playerBody.setSize(width, height, false);
    playerBody.setOffset(offsetX, offsetY);
  }

  private updateBurgerHitbox(cloud: Phaser.Physics.Arcade.Sprite) {
    const body = cloud.body as Phaser.Physics.Arcade.Body;
    // Square with tiny inset margin for fair collisions.
    const baseSide = Math.max(cloud.width, cloud.height);
    const side = baseSide * (1 - this.hitboxMarginRatio * 2);
    const offsetX = (cloud.width - side) * 0.5;
    const offsetY = (cloud.height - side) * 0.5;
    body.setSize(side, side, false);
    body.setOffset(offsetX, offsetY);
  }

  private toggleHitboxDebug() {
    this.setHitboxDebug(!this.isHitboxDebugEnabled);
  }

  private setHitboxDebug(enabled: boolean) {
    this.isHitboxDebugEnabled = enabled;
    const world = this.physics.world;
    if (enabled) {
      if (!world.debugGraphic) {
        world.createDebugGraphic();
      }
      world.drawDebug = true;
      world.debugGraphic?.setVisible(true).setDepth(999);
    } else {
      world.drawDebug = false;
      world.debugGraphic?.clear();
      world.debugGraphic?.setVisible(false);
    }

    this.hitboxDebugHint?.setText(`H: Hitboxes ${enabled ? "ON" : "OFF"}`);
    this.hitboxDebugHint?.setColor(enabled ? "#7dffba" : "#ffffff");
  }

  private createMenuOverlay() {
    const { width, height } = this.scale;
    this.titleText = this.add
      .image(width / 2, height * 0.24, "title")
      .setOrigin(0.5)
      .setDepth(10);

    this.layoutMenuTitle(width, height);

    this.taglineText = this.add
      .text(width / 2, height * 0.765, "The steaks have never been higher", {
        font: "700 28px Poppins",
        color: "#ffffff",
        stroke: "#24335a",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const buttonBg = this.add
      .rectangle(0, 0, 460, 88, 0xe30d76)
      .setStrokeStyle(5, 0xffffff);
    const buttonHitArea = this.add
      .rectangle(0, 0, 460, 88, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const buttonLabel = this.add
      .text(0, 0, "Hit Space to Play", {
        font: "900 40px Poppins",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.startButton = this.add.container(width / 2, height * 0.64, [
      buttonHitArea,
      buttonBg,
      buttonLabel,
    ]);
    this.startButton.setDepth(10);
    buttonHitArea.on("pointerdown", () => {
      this.startGame();
      this.jump();
    });
  }

  private layoutMenuTitle(width: number, height: number) {
    const maxWidth = width * 0.94;
    const maxHeight = height * 0.42;
    const textureWidth = this.titleText.width || 1;
    const textureHeight = this.titleText.height || 1;
    const scale = Math.min(maxWidth / textureWidth, maxHeight / textureHeight);

    this.titleText.setScale(scale);
    this.titleText.setPosition(width / 2, height * 0.25);
  }

  private create3DTitleTexture() {
    let renderer: THREE.WebGLRenderer | undefined;
    let titleGeometry: TextGeometry | undefined;
    const titleMaterials: THREE.MeshStandardMaterial[] = [];

    try {
      if (this.textures.exists(this.titleTextureKey)) {
        this.textures.remove(this.titleTextureKey);
      }

      const canvas = document.createElement("canvas");
      canvas.width = 1700;
      canvas.height = 560;

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvas.width, canvas.height, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        32,
        canvas.width / canvas.height,
        0.1,
        100,
      );
      camera.position.set(0, 2.2, 22);
      camera.lookAt(0, 0.6, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(7, 10, 18);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xffb6a0, 0.35);
      fillLight.position.set(-10, 2, 10);
      scene.add(fillLight);

      const font = new FontLoader().parse(helvetikerBold);
      titleGeometry = new TextGeometry("SUPER YUGI 2!", {
        font,
        size: 3.2,
        depth: 1.25,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelOffset: 0,
        bevelSegments: 6,
      });

      const positions = titleGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const arcLift = -0.028 * x * x + 1.35;
        positions.setY(i, y + arcLift);
        positions.setZ(i, z + Math.abs(x) * 0.18);
      }
      positions.needsUpdate = true;
      titleGeometry.computeVertexNormals();
      titleGeometry.center();

      titleMaterials.push(
        new THREE.MeshStandardMaterial({
          color: 0xff1f1f,
          roughness: 0.45,
          metalness: 0.12,
        }),
        new THREE.MeshStandardMaterial({
          color: 0x940909,
          roughness: 0.72,
          metalness: 0.06,
        }),
      );

      const textMesh = new THREE.Mesh(titleGeometry, titleMaterials);
      textMesh.rotation.x = -0.02;
      textMesh.rotation.y = -0.15;
      scene.add(textMesh);

      renderer.render(scene, camera);
      this.textures.addCanvas(this.titleTextureKey, canvas);
      return true;
    } catch {
      return false;
    } finally {
      titleGeometry?.dispose();
      titleMaterials.forEach((material) => material.dispose());
      renderer?.dispose();
    }
  }

  private pauseGame() {
    this.scene.pause();
    this.scene.launch("menu");
  }

  private jump() {
    if (this.isGameOver) return;
    this.unlockAudioContext();

    if (!this.hasStarted) {
      this.startGame();
    }

    this.player.body!.velocity.y = this.flapVelocity;

    this.tweens.add({
      targets: this.player,
      angle: this.player.angle > -22 ? this.player.angle - 22 : -22,
      duration: 90,
      ease: "Sine.easeOut",
    });
  }

  private startGame() {
    if (this.hasStarted) return;
    this.hasStarted = true;
    this.idleHoverTween?.stop();
    this.idleHoverTween = undefined;
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.startButton.disableInteractive();
    this.titleText.destroy();
    this.taglineText.destroy();
    this.startButton.destroy();
    // Null out refs so handleResize() guards don't call methods on destroyed objects
    const self = this as unknown as Record<string, unknown>;
    self.titleText = undefined;
    self.taglineText = undefined;
    self.startButton = undefined;

    this.addRowOfClouds();
    this.spawnTimer = this.time.addEvent({
      delay: this.getSpawnDelay(),
      callback: this.addRowOfClouds,
      callbackScope: this,
      loop: true,
    });
  }

  private startIdleHover() {
    this.idleHoverTween?.stop();
    this.player.setVelocity(0, 0);
    this.player.setAngle(-3);
    this.idleHoverTween = this.tweens.add({
      targets: this.player,
      y: this.player.y - 18,
      angle: 3,
      duration: 1050,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private addOneCloud(x: number, y: number, motion = 0) {
    const burgerFrame = Phaser.Utils.Array.GetRandom(this.burgerFrameNames) ?? 0;
    const cloud = this.physics.add.sprite(
      x,
      y,
      "burger",
      burgerFrame,
    ) as Phaser.Physics.Arcade.Sprite;
    this.clouds.add(cloud);
    const targetCloudHeight = this.player.displayHeight * this.cloudScaleFactor;
    const cloudScale = targetCloudHeight / cloud.height;
    cloud.setScale(cloudScale);
    cloud.body!.velocity.x = -this.getBurgerSpeed();
    this.updateBurgerHitbox(cloud);
    cloud.setData("hitAnimating", false);

    if (motion) {
      this.tweens.add({
        targets: cloud,
        loop: -1,
        y: cloud.y + motion,
        yoyo: true,
        duration: 950,
        ease: "Sine.easeInOut",
      });
    }

  }

  private addRowOfClouds() {
    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);

    if (this.score % 180 <= 60 && this.score % 2 === 1) return;
    if (this.score % 180 <= 120 && this.score % 3 === 1) return;
    if (this.score % 180 <= 180 && this.score % 4 === 1) return;

    const laneCount = 7;
    const holeSize = 3;
    const safeTop = 0.1;
    const safeBottom = 0.9;
    const hole = Math.floor(Math.random() * (laneCount - holeSize));
    const laneHeight = (this.scale.height * (safeBottom - safeTop)) / laneCount;
    const laneStartY = this.scale.height * safeTop;

    const motion =
      this.score % 60 <= 20 ? 0 : this.score % 60 <= 40 ? 75 : 150;

    for (let i = 0; i < laneCount; i += 1) {
      if (i < hole || i >= hole + holeSize) {
        const y = laneStartY + i * laneHeight + laneHeight / 2;
        this.addOneCloud(this.scale.width + 180, y, motion * 0.6);
      }
    }
  }

  private hitCloud(
    _player:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    cloud:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ) {
    if (this.isInvulnerable || this.isGameOver) return;
    if (!(cloud instanceof Phaser.GameObjects.GameObject)) return;

    const cloudSprite = cloud as Phaser.Physics.Arcade.Sprite;
    this.isInvulnerable = true;
    this.cameras.main.shake(90, 0.007);

    this.freezeGame();
    this.playDeathSound();
    this.playCowAnimation(cloudSprite);
  }

  private freezeGame() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.hasStarted = false;
    this.spawnTimer?.remove(false);
    this.isInvulnerable = true;
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.clouds.children.each((child) => {
      const cloud = child as Phaser.Physics.Arcade.Sprite;
      cloud.setVelocity(0, 0);
      this.tweens.killTweensOf(cloud);
      return true;
    });
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.freezeGame();
    this.playDeathSound();
    const highScore = this.updateSessionHighScore();
    this.time.delayedCall(320, () => this.showGameOverOverlay(highScore));
  }

  private showGameOverOverlay(highScore: number) {
    if (this.gameOverOverlay) return;
    const { width, height } = this.scale;

    this.gameOverBackdrop = this.add
      .rectangle(0, 0, width, height, 0x0f1b2d, 0.62)
      .setOrigin(0, 0)
      .setDepth(30);

    const panel = this.add
      .rectangle(0, 0, Math.min(660, width * 0.9), Math.min(460, height * 0.82), 0x12233d, 0.92)
      .setStrokeStyle(4, 0xffffff);
    const panelHalfHeight = panel.height / 2;

    const gameOverText = this.add
      .text(0, -138, "GAME OVER", {
        font: "900 64px Poppins",
        color: "#ffd166",
        stroke: "#e6527a",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(0, -42, `Score: ${this.score}`, {
        font: "700 44px Poppins",
        color: "#ffffff",
        stroke: "#223355",
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    const highScoreText = this.add
      .text(0, 24, `High Score: ${highScore}`, {
        font: "700 36px Poppins",
        color: "#7dffba",
        stroke: "#223355",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const hintY = panelHalfHeight - 42;
    const restartY = hintY - 90;

    const restartButtonBg = this.add
      .rectangle(0, restartY, 440, 86, 0x1f8f41)
      .setStrokeStyle(4, 0xffffff);
    const restartButtonHit = this.add
      .rectangle(0, restartY, 440, 86, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const restartLabel = this.add
      .text(0, restartY, "Play Again", {
        font: "900 36px Poppins",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(0, hintY, "Click the button or press SPACE to play again", {
        font: "700 22px Poppins",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: hint,
      alpha: { from: 0.55, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 620,
    });

    this.gameOverOverlay = this.add.container(width / 2, height / 2, [
      panel,
      gameOverText,
      scoreText,
      highScoreText,
      restartButtonBg,
      restartButtonHit,
      restartLabel,
      hint,
    ]);
    this.gameOverOverlay.setDepth(31);

    restartButtonHit.on("pointerover", () => restartButtonBg.setScale(1.05));
    restartButtonHit.on("pointerout", () => restartButtonBg.setScale(1));
    restartButtonHit.on("pointerdown", this.restartFromGameOver, this);
    this.input.keyboard?.once("keydown-SPACE", this.restartFromGameOver, this);
  }

  private restartFromGameOver() {
    if (!this.isGameOver || this.hasQueuedRestart) return;
    this.hasQueuedRestart = true;
    window.location.reload();
  }

  private playDeathSound() {
    this.unlockAudioContext();
    const manager = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (!("context" in manager) || !manager.context) return;

    const context = manager.context;
    if (context.state !== "running") return;
    const now = context.currentTime;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.32, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    masterGain.connect(context.destination);

    const notes = [1046, 932, 784, 659, 523, 392];
    notes.forEach((frequency, index) => {
      const start = now + index * 0.095;
      const end = start + 0.1;

      const lead = context.createOscillator();
      const harmony = context.createOscillator();
      const noteGain = context.createGain();

      lead.type = "square";
      harmony.type = "triangle";
      lead.frequency.setValueAtTime(frequency, start);
      harmony.frequency.setValueAtTime(frequency / 2, start);
      harmony.detune.setValueAtTime(4, start);

      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.26, start + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, end);

      lead.connect(noteGain);
      harmony.connect(noteGain);
      noteGain.connect(masterGain);
      lead.start(start);
      harmony.start(start);
      lead.stop(end);
      harmony.stop(end);
    });
  }

  private unlockAudioContext() {
    if (this.hasUnlockedAudio) return;
    const manager = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (!("context" in manager) || !manager.context) return;
    void manager.context.resume().then(() => {
      this.hasUnlockedAudio = true;
    });
  }

  private updateSessionHighScore() {
    const bestScore = Math.max(this.getSessionHighScore(), this.score);
    sessionStorage.setItem("super-yugi-2-high-score", String(bestScore));
    return bestScore;
  }

  private getSessionHighScore() {
    const stored = Number(sessionStorage.getItem("super-yugi-2-high-score") || "0");
    return Number.isFinite(stored) ? stored : 0;
  }

  private getBurgerSpeed() {
    return Phaser.Math.Clamp(this.scale.width * 0.4, 210, 520);
  }

  private getSpawnDelay() {
    return Phaser.Math.Clamp(820 - this.scale.width * 0.22, 360, 700);
  }

  private getParallaxSpeed() {
    return Phaser.Math.Clamp(this.scale.width * 0.000035, 0.012, 0.045);
  }

  private updateSkySizing(width: number, height: number) {
    this.sky.setPosition(width / 2, height / 2);
    this.sky.setSize(width, height);
    this.sky.tilePositionY = 0;

    const skyFrame = this.textures.getFrame("sky", "__BASE");
    if (!skyFrame) return;

    // Match texture height to viewport height so scrolling repeats only on X.
    const verticalScale = height / skyFrame.height;
    this.sky.setTileScale(verticalScale, verticalScale);
  }

  private playCowAnimation(burgerSprite: Phaser.Physics.Arcade.Sprite) {
    const { width, height } = this.scale;

    (burgerSprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.tweens.killTweensOf(burgerSprite);

    const startX = burgerSprite.x;
    const startY = burgerSprite.y;
    const startScale = burgerSprite.scaleX * 0.85;

    // Burst-dissolve the burger
    this.tweens.add({
      targets: burgerSprite,
      alpha: 0,
      scale: burgerSprite.scaleX * 1.6,
      duration: 220,
      ease: "Quad.easeOut",
    });

    // Cow appears at the burger's position, popping in from zero scale
    this.cowSprite = this.add.image(startX, startY, "cow");
    this.cowSprite.setOrigin(0.5);
    this.cowSprite.setScale(0);
    this.cowSprite.setDepth(25);
    this.sound.play("moo", { volume: 0.85 });

    this.tweens.add({
      targets: this.cowSprite,
      scale: startScale,
      angle: -9,
      duration: 220,
      ease: "Back.easeOut",
      onComplete: () => {
        if (!this.cowSprite) return;

        const cowMax = Math.max(this.cowSprite.width, this.cowSprite.height);
        const fillScale = (Math.max(width, height) * 3.4) / cowMax;

        // Pre-impact rumble starts halfway through approach
        this.time.delayedCall(300, () => this.cameras.main.shake(130, 0.009));

        // Rush toward the camera
        this.tweens.add({
          targets: this.cowSprite,
          x: width / 2,
          y: height * 0.44,
          scale: fillScale,
          angle: 11,
          duration: 600,
          ease: "Expo.easeIn",
          onComplete: () => {
            if (!this.cowSprite) return;

            // IMPACT — big shake + white flash + red blood tint
            this.cameras.main.shake(380, 0.03);

            const flash = this.add
              .rectangle(0, 0, width, height, 0xffffff, 1)
              .setOrigin(0, 0)
              .setDepth(29);
            this.tweens.add({
              targets: flash,
              alpha: 0,
              duration: 300,
              ease: "Quad.easeOut",
              onComplete: () => flash.destroy(),
            });

            const redOverlay = this.add
              .rectangle(0, 0, width, height, 0xaa0000, 0.42)
              .setOrigin(0, 0)
              .setDepth(27);
            this.tweens.add({
              targets: redOverlay,
              alpha: 0,
              duration: 950,
              delay: 120,
              ease: "Quad.easeOut",
              onComplete: () => redOverlay.destroy(),
            });

            // Pixelated blood drips from the screen
            this.spawnBloodParticles();

            // Cow bounces on impact
            this.tweens.add({
              targets: this.cowSprite,
              scale: fillScale * 0.87,
              duration: 130,
              yoyo: true,
              ease: "Quad.easeOut",
            });

            // Fall off screen after a beat
            this.time.delayedCall(400, () => {
              if (!this.cowSprite) return;
              const offY = height + this.cowSprite.displayHeight * 0.55;
              this.tweens.add({
                targets: this.cowSprite,
                y: offY,
                duration: 680,
                ease: "Quad.easeIn",
                onComplete: () => {
                  this.cowSprite?.destroy();
                  this.cowSprite = undefined;
                  const highScore = this.updateSessionHighScore();
                  this.showGameOverOverlay(highScore);
                },
              });
            });
          },
        });
      },
    });
  }

  private spawnBloodParticles() {
    const { width } = this.scale;

    // Build a small pixelated blood-drop texture once; reuse on subsequent deaths
    if (!this.textures.exists("blood-pixel")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xdd0000, 1);
      g.fillRect(0, 0, 8, 8);
      g.fillStyle(0xff3333, 1);
      g.fillRect(1, 1, 4, 3);
      g.generateTexture("blood-pixel", 8, 8);
      g.destroy();
    }

    // Initial impact splatter: mostly downward to avoid confetti-like spread.
    const splatEmitter = this.add.particles(width / 2, 0, "blood-pixel", {
      speedY: { min: 220, max: 640 },
      speedX: { min: -width * 0.12, max: width * 0.12 },
      scaleX: { min: 0.8, max: 2.2 },
      scaleY: { min: 2.2, max: 7.5 },
      alpha: { start: 1, end: 0.55 },
      lifespan: { min: 2000, max: 4400 },
      gravityY: 540,
      tint: [0xdd0000, 0xaa0000, 0xff2222, 0x880000],
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: false,
    });
    splatEmitter.setDepth(26);
    splatEmitter.explode(120);
    this.time.delayedCall(5200, () => splatEmitter.destroy());

    // Continuous drips from the top edge to sell "blood on screen" effect.
    this.bloodEmitter = this.add.particles(0, 0, "blood-pixel", {
      x: { min: width * 0.04, max: width * 0.96 },
      y: { min: -8, max: 14 },
      speedY: { min: 160, max: 460 },
      speedX: { min: -8, max: 8 },
      scaleX: { min: 0.8, max: 2.4 },
      scaleY: { min: 2.2, max: 8.5 },
      alpha: { start: 1, end: 0.52 },
      lifespan: { min: 3200, max: 6200 },
      quantity: 6,
      frequency: 20,
      gravityY: 360,
      tint: [0xdd0000, 0xaa0000, 0xff2222, 0x880000, 0xff4444],
      blendMode: Phaser.BlendModes.NORMAL,
    });
    this.bloodEmitter.setDepth(26);

    // Let drips run longer before stopping new particles.
    this.time.delayedCall(1600, () => {
      this.bloodEmitter?.stop();
      this.time.delayedCall(7000, () => {
        this.bloodEmitter?.destroy();
        this.bloodEmitter = undefined;
      });
    });
  }

  private createBurgerFrames() {
    const texture = this.textures.get("burger");
    const inset = 4;
    const frames = [
      {
        name: "burger-0",
        x: 44 + inset,
        y: 190 + inset,
        width: 297 - inset * 2,
        height: 272 - inset * 2,
      },
      {
        name: "burger-1",
        x: 376 + inset,
        y: 190 + inset,
        width: 278 - inset * 2,
        height: 272 - inset * 2,
      },
      {
        name: "burger-2",
        x: 696 + inset,
        y: 190 + inset,
        width: 278 - inset * 2,
        height: 272 - inset * 2,
      },
      {
        name: "burger-3",
        x: 44 + inset,
        y: 575 + inset,
        width: 297 - inset * 2,
        height: 271 - inset * 2,
      },
      {
        name: "burger-4",
        x: 376 + inset,
        y: 575 + inset,
        width: 278 - inset * 2,
        height: 271 - inset * 2,
      },
      {
        name: "burger-5",
        x: 696 + inset,
        y: 575 + inset,
        width: 278 - inset * 2,
        height: 271 - inset * 2,
      },
    ];

    frames.forEach(({ name, x, y, width, height }) => {
      if (!texture.has(name)) {
        texture.add(name, 0, x, y, width, height);
      }
    });

    this.burgerFrameNames = frames.map((frame) => frame.name);
  }
}
