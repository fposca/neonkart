// src/game/Game.ts
import * as PIXI from "pixi.js";
import { Level1 } from "./Level1";
import { Level2 } from "./Level2";
import { Level3 } from "./Level3";
import { Level4 } from "./Level4";
import { Input } from "./input";
import { AudioBus } from "./audio";

type GameOpts = { onGameOver?: () => void };

export class Game {
  app?: PIXI.Application;
  input?: Input;
  audio = new AudioBus();
  level?: Level1 | Level2 | Level3; // <- incluye L3
  running = false;
  last = 0;
  opts: GameOpts;

  constructor(opts: GameOpts = {}) { this.opts = opts; }

  async init(canvasRoot: HTMLDivElement) {
    while (canvasRoot.firstChild) canvasRoot.removeChild(canvasRoot.firstChild);

    // necesario para overlay táctil y evitar scroll
    canvasRoot.style.position = "relative";
    canvasRoot.style.touchAction = "none";

    const app = new PIXI.Application();
    await app.init({ width: 1280, height: 720, background: "#000", antialias: true });
    canvasRoot.appendChild(app.canvas);
    app.canvas.style.display = "block";

    this.app = app;
    this.input = new Input(canvasRoot);

    await this.initLevel1();

    // Audio inicial del juego
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  async initLevel1() {
    const l1 = new Level1(this.app!, this.input!, {
      onGameOver: () => {
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      onLevelComplete: async (_place) => {
        await this.startLevel2();
      },
      audio: this.audio,
    });
    await l1.load();
    this.level = l1;
  }

  // L2 y al completar -> L3
  async startLevel2() {
    const prev = this.level;
    this.level = undefined;          // desenganchar del loop
    try { prev?.destroy?.(); } catch {}

    // 🎵 Corta TODO el audio del Level 1 antes de crear L2
    this.audio.stopAll?.();

    const l2 = new Level2(this.app!, this.input!, {
      onGameOver: () => {
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      onLevelComplete: async (_place) => {
        await this.startLevel3();
      },
      audio: this.audio,
    });

    await l2.load();
    this.level = l2;

    // 🎵 Reinicia música y motor al entrar a L2
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

async startLevel3() {
  const prev = this.level;
  this.level = undefined;
  try { prev?.destroy?.(); } catch {}
  this.audio.stopAll?.();

  const l3 = new Level3(this.app!, this.input!, {
    onGameOver: () => {
      this.audio.stopSfx?.("motor");
      this.opts.onGameOver?.();
    },
    onLevelComplete: async (_place) => {
      await this.startLevel4(); // <- ahora pasa a L4
    },
    audio: this.audio,
  });

  await l3.load();
  this.level = l3;
}

async startLevel4() {
  const prev = this.level;
  this.level = undefined;
  try { prev?.destroy?.(); } catch {}
  this.audio.stopAll?.();

  const l4 = new Level4(this.app!, this.input!, {
    onGameOver: () => {
      this.audio.stopSfx?.("motor");
      this.opts.onGameOver?.();
    },
    onLevelComplete: (_place) => {
      // TODO: cuando tengamos Level5, cambiar a startLevel5()
      this.audio.stopSfx?.("motor");
      this.opts.onGameOver?.();
    },
    audio: this.audio,
  });

  await l4.load();
  this.level = l4;
}

  start() {
    if (!this.app) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (t: number) => {
    if (!this.running || !this.app) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;

    this.level?.update?.(dt);

    this.app.renderer.render(this.app.stage);
    requestAnimationFrame(this.tick);
  };

  stop() {
    this.running = false;
    this.audio.stopAll?.();
  }

  destroy() {
    this.running = false;
    try { this.audio.stopAll?.(); } catch {}

    const app = this.app;
    this.app = undefined;

    if (app) {
      try { app.stage.removeChildren(); } catch {}
      try { (app.renderer as any)?.destroy?.(); } catch {}
      try { app.destroy(true); } catch {}
      const canvas = (app as any).canvas as HTMLCanvasElement | undefined;
      if (canvas?.parentNode) {
        try { canvas.parentNode.removeChild(canvas); } catch {}
      }
    }

    this.input = undefined;
    this.level = undefined;
  }
}
