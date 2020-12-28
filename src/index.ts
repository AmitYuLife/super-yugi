import * as Phaser from "phaser";
import { debounce } from "./utils";
import bird from "./assets/yugi.png";
import pipe from "./assets/cloud.png";
import sky from "./assets/sky.jpg";

export default class Game extends Phaser.Scene {
  bird: Phaser.Physics.Arcade.Sprite;
  pipes: Phaser.GameObjects.Group;
  score: number;
  lives: number;
  scoreText: Phaser.GameObjects.Text;
  livesText: Phaser.GameObjects.Text;
  spaceKey: Phaser.Input.Keyboard.Key;

  preload = () => {
    this.load.image("bird", bird);
    this.load.image("pipe", pipe);
    this.load.image("sky", sky);
  };

  create = () => {
    this.cameras.main.setBackgroundColor("#71c5cf");
    this.add.image(300, 275, "sky").setScale(1.25);

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

    this.bird = this.physics.add.sprite(100, 245, "bird");
    this.bird.setScale(0.25);
    this.bird.setBodySize(130, 65);
    this.bird.body.y = this.bird.body.y / 2;
    this.bird.setBounce(0.3);

    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.spaceKey.on("down", this.jump);

    this.pipes = this.physics.add.group({
      allowGravity: false,
    });

    this.time.addEvent({
      delay: 750,
      callback: this.addRowOfPipes,
      callbackScope: this,
      loop: true,
    });

    this.physics.add.overlap(this.bird, this.pipes, this.hitPipe, null, this);
  };

  update = () => {
    if (this.bird.y < 0 || this.bird.y > 490) {
      this.scene.restart();
    }

    if (this.bird.angle < 90) {
      this.bird.angle += 1;
    }
  };

  jump = () => {
    this.bird.body.velocity.y = -350;

    this.tweens.add({
      targets: this.bird,
      angle: this.bird.angle > 30 ? this.bird.angle - 30 : 0,
      duration: 500,
    });
    // TODO: go to -20 degree angle
  };

  addOnePipe = (x: number, y: number, motion = 0) => {
    const pipe = this.add.sprite(x, y, "pipe") as Phaser.Physics.Arcade.Sprite;
    this.pipes.add(pipe);
    pipe.body.velocity.x = -200;
    pipe.body.setCircle(18, 12, 12);

    if (motion) {
      this.tweens.add({
        targets: pipe,
        loop: true,
        y: pipe.body.position.y + motion,
        yoyo: true,
      });
    }

    // TODO: Automatically kill the pipe when it's no longer visible
  };

  addRowOfPipes = () => {
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
        this.addOnePipe(500, i * 60 + 40, motion);
      }
    }
  };

  hitPipe = debounce(
    () => {
      this.lives -= 1;
      this.livesText.setText(String(this.lives));

      if (this.lives === 0) {
        this.scene.restart();
      } else {
        this.tweens.add({
          targets: this.bird,
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
  scene: Game,
});
