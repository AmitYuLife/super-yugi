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
      gravity: { x: 0, y: 1000 },
    },
  },
  scene: [GameScene, MenuScene, ScoreScene],
});
