import Phaser from "phaser";

export default class ScoreScene extends Phaser.Scene {
  private score: number = 0;
  private highScore: number = 0;

  constructor() {
    super({ key: "score" });
  }

  init(data: { score: number; highScore?: number }) {
    this.score = data.score;
    this.highScore = data.highScore ?? this.getSessionHighScore();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      sessionStorage.setItem("super-yugi-2-high-score", String(this.highScore));
    }
  }

  create() {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x0f1b2d, 0.78);
    overlay.setOrigin(0, 0);
    const restartZone = this.add
      .zone(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, height * 0.27, "GAME OVER", {
        font: "900 84px Poppins",
        color: "#ffd166",
        stroke: "#e6527a",
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.48, `Score: ${this.score}`, {
        font: "700 52px Poppins",
        color: "#ffffff",
        stroke: "#223355",
        strokeThickness: 8,
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.59, `High Score: ${this.highScore}`, {
        font: "700 42px Poppins",
        color: "#7dffba",
        stroke: "#223355",
        strokeThickness: 7,
        align: "center",
      })
      .setOrigin(0.5);

    const restartButton = this.add
      .rectangle(width / 2, height * 0.74, 520, 92, 0x1f8f41)
      .setStrokeStyle(4, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const restartLabel = this.add
      .text(width / 2, height * 0.74, "Play Again", {
        font: "900 38px Poppins",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);
    restartButton.on("pointerover", () => restartButton.setScale(1.06));
    restartButton.on("pointerout", () => restartButton.setScale(1));

    const hint = this.add.text(width / 2, height * 0.85, "Tap/click anywhere or press any key", {
      font: "700 24px Poppins",
      color: "#ffffff",
    });
    hint.setOrigin(0.5);
    this.tweens.add({
      targets: hint,
      alpha: { from: 0.6, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 640,
    });

    let didRestart = false;
    const keyboard = this.input.keyboard;
    const windowRestart = () => restartGame();
    const clearRestartListeners = () => {
      restartZone.off("pointerdown", restartGame);
      restartButton.off("pointerdown", restartGame);
      restartLabel.off("pointerdown", restartGame);
      this.input.off("pointerdown", restartGame);
      keyboard?.off("keydown", restartGame);
      window.removeEventListener("keydown", windowRestart);
      window.removeEventListener("pointerdown", windowRestart);
      window.removeEventListener("touchstart", windowRestart);
    };
    const restartGame = () => {
      if (didRestart) return;
      didRestart = true;
      clearRestartListeners();
      this.scene.start("game");
      this.time.delayedCall(140, () => {
        if (!this.scene.isActive("game")) {
          window.location.reload();
        }
      });
    };

    restartZone.on("pointerdown", restartGame);
    restartButton.on("pointerdown", restartGame);
    restartLabel.setInteractive({ useHandCursor: true }).on("pointerdown", restartGame);
    this.input.on("pointerdown", restartGame);

    keyboard?.on("keydown", restartGame);
    window.addEventListener("keydown", windowRestart);
    window.addEventListener("pointerdown", windowRestart);
    window.addEventListener("touchstart", windowRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, clearRestartListeners);
  }

  private getSessionHighScore() {
    const stored = Number(sessionStorage.getItem("super-yugi-2-high-score") || "0");
    return Number.isFinite(stored) ? stored : 0;
  }
}
