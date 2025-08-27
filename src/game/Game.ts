// src/game/Game.ts
import * as PIXI from "pixi.js";
import { Level1 } from "./Level1";
import { Input } from "./input";
import { AudioBus } from "./audio";

type GameOpts = { onGameOver?: () => void };

export class Game {
  app?: PIXI.Application;
  input?: Input;
  audio = new AudioBus();
  level?: Level1;
  running = false;
  last = 0;
  opts: GameOpts;

  constructor(opts: GameOpts = {}) { this.opts = opts; }

  async init(canvasRoot: HTMLDivElement) {
    while (canvasRoot.firstChild) canvasRoot.removeChild(canvasRoot.firstChild);

    const app = new PIXI.Application();
    await app.init({ width: 1280, height: 720, background: "#000", antialias: true });
    canvasRoot.appendChild(app.canvas);
    app.canvas.style.display = "block";

    this.app = app;
    this.input = new Input(canvasRoot);

    this.level = new Level1(app, this.input, {
      onGameOver: () => {
        this.audio.stopSfx("motor"); // parar motor al morir
        this.opts.onGameOver?.();
      },
      audio: this.audio,
    });
    await this.level.load();

    this.audio.playBgmLevel1();
    this.audio.playSfx("motor");
  }

  start() {
    if (!this.app) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (t:number) => {
    if (!this.running || !this.app || !this.level) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;

    this.level.update(dt);
    this.app.renderer.render(this.app.stage);
    requestAnimationFrame(this.tick);
  };

  stop() {
    this.running = false;
    this.audio.stopAll();
  }

  destroy() {
    // súper defensivo: soporta múltiples llamadas sin crashear
    this.running = false;
    try { this.audio.stopAll(); } catch { /* empty */ }

    const app = this.app;
    this.app = undefined;

    if (app) {
      try { app.stage.removeChildren(); } catch { /* empty */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { (app.renderer as any)?.destroy?.(); } catch { /* empty */ }
      try { app.destroy(true); } catch { /* empty */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = (app as any).canvas as HTMLCanvasElement | undefined;
      if (canvas?.parentNode) {
        try { canvas.parentNode.removeChild(canvas); } catch { /* empty */ }
      }
    }

    this.input = undefined;
    this.level = undefined;
  }
}
