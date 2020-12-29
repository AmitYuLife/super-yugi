import * as Phaser from "phaser";
import { debounce } from "./utils";
import player from "./assets/yugi.png";
import cloud from "./assets/cloud.png";
import sky from "./assets/sky.jpg";
import title from "./assets/title.png";

export class Menu extends Phaser.Scene {
  escKey: Phaser.Input.Keyboard.Key;
  pKey: Phaser.Input.Keyboard.Key;

  preload = () => {};
  create = () => {
    console.log("launched");

    this.escKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    this.escKey.on("down", this.resumeGame);
    this.pKey.on("down", this.resumeGame);
  };

  resumeGame = () => {
    this.scene.stop("menu");
    this.scene.resume("game");
  };

  update = () => {};
}
export default class Game extends Phaser.Scene {
  player: Phaser.Physics.Arcade.Sprite;
  clouds: Phaser.GameObjects.Group;
  score: number;
  lives: number;
  scoreText: Phaser.GameObjects.Text;
  livesText: Phaser.GameObjects.Text;

  spaceKey: Phaser.Input.Keyboard.Key;
  upKey: Phaser.Input.Keyboard.Key;
  wKey: Phaser.Input.Keyboard.Key;
  enterKey: Phaser.Input.Keyboard.Key;
  escKey: Phaser.Input.Keyboard.Key;
  pKey: Phaser.Input.Keyboard.Key;

  click: Phaser.Input.Pointer;

  hasStarted: boolean;
  wobble: Phaser.Tweens.Tween;
  title: Phaser.GameObjects.Image;

  preload = () => {
    this.load.image("player", player);
    this.load.image("cloud", cloud);
    this.load.image("sky", sky);
    this.load.image("title", title);
  };

  create = () => {
    this.cameras.main.setBackgroundColor("#71c5cf");
    this.add.image(200, 245, "sky");
    this.title = this.add.image(200, 245, "title");

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
    (this.player.body as any).setAllowGravity(false);

    this.wobble = this.tweens.add({
      targets: this.player,
      y: { from: startY, to: startY + 20 },
      yoyo: true,
      loop: -1,
    });

    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );

    this.escKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    this.spaceKey.on("down", this.jump);
    this.upKey.on("down", this.jump);
    this.wKey.on("down", this.jump);
    this.enterKey.on("down", this.jump);

    this.escKey.on("down", this.pauseGame);
    this.pKey.on("down", this.pauseGame);

    this.input.on("pointerdown", this.jump);

    this.clouds = this.physics.add.group({
      allowGravity: false,
    });

    this.physics.add.overlap(
      this.player,
      this.clouds,
      this.hitCloud,
      null,
      this
    );
  };

  update = () => {
    if (this.player.y < 0 || this.player.y > 490) {
      this.scene.restart();
    }

    if (this.player.angle < 90 && this.hasStarted) {
      this.player.angle += 1;
    }
  };

  pauseGame = () => {
    this.scene.pause();
    this.scene.launch("menu");
  };

  jump = () => {
    if (!this.hasStarted) {
      this.hasStarted = true;
      (this.player.body as any).setAllowGravity(true);
      this.tweens.remove(this.wobble);

      this.tweens.add({
        targets: this.title,
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

    this.player.body.velocity.y = -350;

    this.tweens.add({
      targets: this.player,
      angle: this.player.angle > 30 ? this.player.angle - 30 : 0,
      duration: 500,
    });
  };

  addOneCloud = (x: number, y: number, motion = 0) => {
    const cloud = this.add.sprite(
      x,
      y,
      "cloud"
    ) as Phaser.Physics.Arcade.Sprite;
    this.clouds.add(cloud);
    cloud.body.velocity.x = -200;
    cloud.body.setCircle(18, 12, 12);

    if (motion) {
      this.tweens.add({
        targets: cloud,
        loop: true,
        y: cloud.body.position.y + motion,
        yoyo: true,
      });
    }

    // after 3 seconds, destroy clouds
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        this.clouds.remove(cloud, true);
      },
      callbackScope: this,
      loop: false,
    });
  };

  addRowOfClouds = () => {
    this.score += 1;
    this.scoreText.setText(String(this.score));

    if (this.score % 180 <= 60 && this.score % 2 === 1) {
      return;
    } else if (this.score % 180 <= 120 && this.score % 3 === 1) {
      return;
    } else if (this.score % 180 <= 180 && this.score % 4 === 1) {
      return;
    }

    const hole = Math.floor(Math.random() * 6);

    let motion: number;

    if (this.score % 60 <= 20) {
      motion = 0;
    } else if (this.score % 60 <= 40) {
      motion = 100;
    } else if (this.score % 60 <= 60) {
      motion = 200;
    }

    for (let i = 0; i < 8; i += 1) {
      if (i != hole && i != hole + 1 && i != hole + 2) {
        this.addOneCloud(500, i * 60 + 40, motion);
      }
    }
  };

  hitCloud = debounce(
    () => {
      this.lives -= 1;
      this.livesText.setText(String(this.lives));

      if (this.lives === 0) {
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
    true
  );
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 400,
  height: 490,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1000 },
      // debug: true,
    },
  },
  scene: [new Game({ key: "game" }), new Menu({ key: "menu" })],
});
