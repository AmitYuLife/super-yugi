import Phaser from "phaser";

export default class ScoreScene extends Phaser.Scene {
  private score: number = 0;

  constructor() {
    super({ key: "score" });
  }

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
