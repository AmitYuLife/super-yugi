import Phaser from "phaser";
import playerImg from "../assets/yugi.png";
import burgersImg from "../assets/burgers.png";
import skyImg from "../assets/sky.jpg";

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private clouds!: Phaser.GameObjects.Group;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private sky!: Phaser.GameObjects.TileSprite;
  private titleText!: Phaser.GameObjects.Text;
  private titleShadow!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private titleTween?: Phaser.Tweens.Tween;
  private startButton!: Phaser.GameObjects.Container;
  private burgerFrameNames: (string | number)[] = [];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hasStarted = false;
  private isInvulnerable = false;
  private isGameOver = false;
  private hasUnlockedAudio = false;
  private readonly flapVelocity = -500;
  private readonly maxFallSpeed = 820;

  constructor() {
    super({ key: "game" });
  }

  preload() {
    this.load.image("sky", skyImg);
    this.load.image("burger", burgersImg);
    this.load.image("player", playerImg);
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

    this.input.on("pointerdown", () => {
      if (this.hasStarted) {
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
    this.handleResize({ width, height } as Phaser.Structs.Size);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_time: number, delta: number) {
    const { height } = this.scale;
    if (this.player.y < -20 || this.player.y > height + 20) {
      this.triggerGameOver();
      return;
    }

    if (this.hasStarted) {
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
      this.sky.setPosition(width / 2, height / 2);
      this.sky.setSize(width, height);
    }

    if (this.titleText) {
      this.titleText.setPosition(width / 2, height * 0.2);
    }

    if (this.titleShadow) {
      this.titleShadow.setPosition(width / 2 + 5, height * 0.2 + 6);
    }

    if (this.subtitleText) {
      this.subtitleText.setPosition(width / 2, height * 0.3);
    }

    if (this.startButton) {
      this.startButton.setPosition(width / 2, height * 0.64);
    }

    if (this.scoreText) {
      this.scoreText.setPosition(24, 20);
    }

    if (this.player) {
      this.scaleEntities();
    }
  }

  private shutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.spawnTimer?.remove(false);
    this.titleTween?.stop();
  }

  private scaleEntities() {
    const minViewport = Math.min(this.scale.width, this.scale.height);
    const targetPlayerHeight = Phaser.Math.Clamp(minViewport * 0.145, 74, 132);
    const playerScale = targetPlayerHeight / this.player.height;
    this.player.setScale(playerScale);

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setSize(
      this.player.displayWidth * 0.8,
      this.player.displayHeight * 0.68,
      true,
    );

    const burgerFrame =
      this.textures.getFrame("burger", this.burgerFrameNames[0]) ??
      this.textures.getFrame("burger", "__BASE");
    const burgerHeight = burgerFrame?.height ?? 128;
    const cloudScale = (targetPlayerHeight * 1.3) / burgerHeight;
    this.clouds?.children.each((child) => {
      const cloud = child as Phaser.Physics.Arcade.Sprite;
      cloud.setScale(cloudScale);
      const radius = Math.min(cloud.displayWidth, cloud.displayHeight) * 0.44;
      (cloud.body as Phaser.Physics.Arcade.Body).setCircle(
        radius,
        cloud.displayWidth * 0.5 - radius,
        cloud.displayHeight * 0.5 - radius,
      );
      return true;
    });
  }

  private createMenuOverlay() {
    const { width, height } = this.scale;

    this.titleShadow = this.add
      .text(width / 2 + 5, height * 0.2 + 6, "SUPER YUGI 2!", {
        font: "900 84px Poppins",
        color: "#1b2745",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.titleText = this.add
      .text(width / 2, height * 0.2, "SUPER YUGI 2!", {
        font: "900 84px Poppins",
        color: "#ffe680",
        stroke: "#ff4f7b",
        strokeThickness: 10,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: "#ffffff",
          blur: 10,
          fill: true,
          stroke: false,
        },
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.subtitleText = this.add
      .text(width / 2, height * 0.3, "Rocket through the cloud maze!", {
        font: "700 28px Poppins",
        color: "#ffffff",
        stroke: "#24335a",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.titleTween = this.tweens.add({
      targets: [this.titleText, this.titleShadow],
      y: "-=8",
      scale: { from: 1, to: 1.04 },
      angle: { from: -1.5, to: 1.5 },
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: "Sine.easeInOut",
    });

    const buttonBg = this.add
      .rectangle(0, 0, 460, 88, 0x1f8f41)
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

    buttonHitArea.on("pointerover", () => this.startButton.setScale(1.08));
    buttonHitArea.on("pointerout", () => this.startButton.setScale(1));
    buttonHitArea.on("pointerdown", () => {
      this.startGame();
      this.jump();
    });
  }

  private pauseGame() {
    this.scene.pause();
    this.scene.launch("menu");
  }

  private jump() {
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
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.titleTween?.stop();
    this.startButton.disableInteractive();

    this.tweens.add({
      targets: [this.titleText, this.titleShadow, this.subtitleText, this.startButton],
      alpha: { from: 1, to: 0 },
      y: "-=20",
      duration: 350,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.titleText.destroy();
        this.titleShadow.destroy();
        this.subtitleText.destroy();
        this.startButton.destroy();
      },
    });

    this.addRowOfClouds();
    this.spawnTimer = this.time.addEvent({
      delay: this.getSpawnDelay(),
      callback: this.addRowOfClouds,
      callbackScope: this,
      loop: true,
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
    const targetCloudHeight = this.player.displayHeight * 1.3;
    const cloudScale = targetCloudHeight / cloud.height;
    cloud.setScale(cloudScale);
    cloud.body!.velocity.x = -this.getBurgerSpeed();
    const radius = Math.min(cloud.displayWidth, cloud.displayHeight) * 0.44;
    (cloud.body as Phaser.Physics.Arcade.Body).setCircle(
      radius,
      cloud.displayWidth * 0.5 - radius,
      cloud.displayHeight * 0.5 - radius,
    );
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
    if (!cloudSprite.getData("hitAnimating")) {
      cloudSprite.setData("hitAnimating", true);
      this.tweens.add({
        targets: cloudSprite,
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: 0.45,
        yoyo: true,
        duration: 120,
        ease: "Quad.easeOut",
        onComplete: () => cloudSprite.setData("hitAnimating", false),
      });
    }

    this.isInvulnerable = true;

    this.cameras.main.shake(180, 0.006);

    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.25, to: 1 },
      duration: 90,
      repeat: 8,
    });

    this.player.setVelocityX(-90);
    this.time.delayedCall(120, () => this.player.setVelocityX(0));

    this.triggerGameOver();
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.spawnTimer?.remove(false);
    this.isInvulnerable = true;
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.playDeathSound();
    const highScore = this.updateSessionHighScore();
    this.time.delayedCall(520, () => {
      this.scene.start("score", { score: this.score, highScore });
    });
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
