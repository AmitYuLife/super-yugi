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

  constructor() {
    super({ key: "game" });
  }

  preload() {
    this.load.image("sky", skyImg);
    this.load.image("cloud", cloudImg);
    this.load.image("title", titleImg);
    this.load.image("player", playerImg);
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
    const cloud = this.add.sprite(
      x,
      y,
      "cloud",
    ) as Phaser.Physics.Arcade.Sprite;
    this.clouds.add(cloud);
    cloud.body!.velocity.x = -200;
    (cloud.body as Phaser.Physics.Arcade.Body).setCircle(18, 12, 12);

    if (motion) {
      this.tweens.add({
        targets: cloud,
        loop: -1,
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

    const motion =
      this.score % 60 <= 20 ? 0 : this.score % 60 <= 40 ? 100 : 200;

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
