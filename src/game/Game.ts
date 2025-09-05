import * as PIXI from "pixi.js";
import { Level1 } from "./Level1";
import { Level2 } from "./Level2";
import { Level3 } from "./Level3";
import { Level4 } from "./Level4";
import { Input } from "./input";
import { AudioBus } from "./audio";
import { withLoader } from "../ui/loader";
import { IMG } from "./assets";

type GameOpts = {
  onGameOver?: () => void;
  audio?: AudioBus;
};

type InitOpts = {
  onProgress?: (p01: number) => void; // 0..1
};

export class Game {
  app?: PIXI.Application;
  input?: Input;
  audio: AudioBus;
  level?: Level1 | Level2 | Level3 | Level4;
  running = false;
  last = 0;
  opts: GameOpts;

  // ===== Pausa global =====
  private paused = false;
  private pauseLatch = false;              // edge detector (para no repetir toggles)
  private pauseText?: PIXI.Text;

  constructor(opts: GameOpts = {}) {
    this.opts = opts;
    this.audio = opts.audio ?? new AudioBus();
  }

  async init(canvasRoot: HTMLDivElement, initOpts: InitOpts = {}) {
    while (canvasRoot.firstChild) canvasRoot.removeChild(canvasRoot.firstChild);
    canvasRoot.style.position = "relative";
    canvasRoot.style.touchAction = "none";

    const app = new PIXI.Application();
    const RES = Math.min(window.devicePixelRatio || 1, 1.5);

    await app.init({
      width: 1280,
      height: 720,
      background: "#000",
      antialias: true,
      resolution: RES,
    });

    canvasRoot.appendChild(app.canvas);
    app.canvas.style.display = "block";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    (app.canvas.style as any).imageRendering = "pixelated";

    // importante para zIndex del overlay de pausa
    app.stage.sortableChildren = true;

    this.app = app;
    this.input = new Input(canvasRoot);

    // === Overlay de PAUSA (centrado) ===
   const t = new PIXI.Text({
  text: "PAUSA",
  style: {
    fill: 0xffffff,
    fontSize: 128,
    fontFamily: "Arial",
    fontWeight: "900",
    align: "center",
    // en Pixi v8 dejá como mucho esto:
    dropShadow: true,
  },
});

    t.anchor.set(0.5);
    t.position.set(app.renderer.width / 2, app.renderer.height / 2);
    (t as any).zIndex = 99999;
    t.visible = false;
    app.stage.addChild(t);
    this.pauseText = t;

    // PRELOAD
    await this.preloadAssets(initOpts.onProgress);

    await this.initLevel1();

    // Audio inicial
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  /** Precarga todos los assets gráficos probables y reporta 0..1 */
  private async preloadAssets(onProgress?: (p01: number) => void) {
    const urls = Array.from(
      new Set(
        [
          IMG.fondo, IMG.suelo,
          (IMG as any).fondo2, (IMG as any).suelo2,
          (IMG as any).fondo3, (IMG as any).suelo3,
          "/assets/img/menu-fondo2.jpg", "/assets/img/suelo2.jpg",
          "/assets/img/menu-fondo3.jpg", "/assets/img/suelo3.jpg",
          IMG.kartSide, IMG.kartHit, IMG.kartDead, IMG.kartShoot,
          IMG.regSide, IMG.regShoot, IMG.regWreck,
          (IMG as any).kartRival1, (IMG as any).kartRival2,
          (IMG as any).kartRivalFredy, (IMG as any).kartFreddy, (IMG as any).kartFredy,
          (IMG as any).kartingFreddy, (IMG as any)["karting-fredy"], (IMG as any)["karting-fredy.png"],
          (IMG as any).kartRivalDoctor, (IMG as any).kartDoctor, (IMG as any).kartingDoctor,
          (IMG as any)["karting-doctor"], (IMG as any)["karting-doctor.png"],
          (IMG as any).finishLap1, (IMG as any).finishLap2, (IMG as any).finishFinal, (IMG as any).finish,
          (IMG as any).pedalDist ?? IMG.pedalDist,
        ].filter(Boolean)
      )
    );

    let done = 0;
    const total = urls.length || 1;
    const step = () => onProgress?.(++done / total);

    await Promise.all(
      urls.map(async (u) => {
        try { await PIXI.Assets.load(u as string); }
        catch {}
        finally { step(); }
      })
    );
  }

  // ===== Helpers de pausa =====
  private setPaused(on: boolean) {
    this.paused = on;
    if (this.pauseText) this.pauseText.visible = on;

    // Propagar opcionalmente al level si implementaste setPaused
    (this.level as any)?.setPaused?.(on);

    // Motor on/off (el BGM lo dejamos sonando, sólo cortamos motor)
    if (on) this.audio.stopSfx?.("motor");
    else this.audio.playSfx?.("motor");
  }
  private resetPause() {
    this.pauseLatch = false;
    this.setPaused(false);
  }

  async initLevel1() {
    this.resetPause();
    const l1 = new Level1(this.app!, this.input!, {
      onGameOver: () => {
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      onLevelComplete: async (_place) => { await this.startLevel2(); },
      audio: this.audio,
    });
    await withLoader(l1.load(), "Cargando Nivel 1…");
    this.level = l1;
  }

  async startLevel2() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    const l2 = new Level2(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_place) => { await this.startLevel3(); },
      audio: this.audio,
    });
    await withLoader(l2.load(), "Cargando Nivel 2…");
    this.level = l2;
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel3() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    const l3 = new Level3(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_place) => { await this.startLevel4(); },
      audio: this.audio,
    });
    await withLoader(l3.load(), "Cargando Nivel 3…");
    this.level = l3;
  }

  async startLevel4() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    const l4 = new Level4(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: (_place) => {
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      audio: this.audio,
    });
    await withLoader(l4.load(), "Cargando Nivel 4…");
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

    // === Toggle de pausa (P o Escape) ===
    const pauseKey = !!this.input?.a.pause;
    if (pauseKey && !this.pauseLatch) {
      this.setPaused(!this.paused);
    }
    this.pauseLatch = pauseKey;

    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;

    if (!this.paused) {
      this.level?.update?.(dt);
    }

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
