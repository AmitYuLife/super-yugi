import Phaser from "phaser";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "menu" });
  }

  create() {
    const escKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    const pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    escKey.on("down", this.resumeGame, this);
    pKey.on("down", this.resumeGame, this);
  }

  private resumeGame() {
    this.scene.stop("menu");
    this.scene.resume("game");
  }
}
