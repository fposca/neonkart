import * as PIXI from "pixi.js";
import { Level1 } from "./Level1";
import { Level2 } from "./Level2";
import { Level3 } from "./Level3";
import { Level4 } from "./Level4";
import { Input } from "./input";
import { AudioBus } from "./audio";
import { withLoader } from "../ui/loader"; // ⬅ overlay de niveles
import { IMG } from "./assets";            // ⬅ para precarga

type GameOpts = {
  onGameOver?: () => void;
  audio?: AudioBus; // permitir inyectar el bus de audio
};

type InitOpts = {
  onProgress?: (p01: number) => void; // 0..1 progreso de precarga
};

export class Game {
  app?: PIXI.Application;
  input?: Input;
  audio: AudioBus; // bus de audio usado por el juego
  level?: Level1 | Level2 | Level3 | Level4;
  running = false;
  last = 0;
  opts: GameOpts;

  constructor(opts: GameOpts = {}) {
    this.opts = opts;
    this.audio = opts.audio ?? new AudioBus();
  }

  async init(canvasRoot: HTMLDivElement, initOpts: InitOpts = {}) {
    // limpiar root
    while (canvasRoot.firstChild) canvasRoot.removeChild(canvasRoot.firstChild);

    // necesario para overlay táctil y evitar scroll
    canvasRoot.style.position = "relative";
    canvasRoot.style.touchAction = "none";

    // ===== PIXI App con cap de DPI para móviles =====
    const app = new PIXI.Application();

    const RES = Math.min(window.devicePixelRatio || 1, 1.5); // capea DPR
    await app.init({
      width: 1280,
      height: 720,
      background: "#000",
      antialias: true,
      resolution: RES,
    });

    canvasRoot.appendChild(app.canvas);
    // el canvas se estira al 100% del contenedor (que escalamos en App.tsx)
    app.canvas.style.display = "block";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    (app.canvas.style as any).imageRendering = "pixelated"; // opcional, look retro

    this.app = app;
    this.input = new Input(canvasRoot);

    // ⬇ PRELOAD paralela con porcentaje (antes de crear el primer nivel)
    await this.preloadAssets(initOpts.onProgress);

    await this.initLevel1();

    // Audio inicial del juego
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  /** Precarga todos los assets gráficos probables y reporta 0..1 */
  private async preloadAssets(onProgress?: (p01: number) => void) {
    // Lista de assets (incluye variantes/fallbacks que usan L1/L2/L3)
    const urls = Array.from(
      new Set(
        [
          // fondo/suelo base
          IMG.fondo, IMG.suelo,
          // variantes L2/L3 (si existen)
          (IMG as any).fondo2, (IMG as any).suelo2,
          (IMG as any).fondo3, (IMG as any).suelo3,
          "/assets/img/menu-fondo2.jpg", "/assets/img/suelo2.jpg",
          "/assets/img/menu-fondo3.jpg", "/assets/img/suelo3.jpg",
          // jugador
          IMG.kartSide, IMG.kartHit, IMG.kartDead, IMG.kartShoot,
          // enemigos base
          IMG.regSide, IMG.regShoot, IMG.regWreck,
          // rivales posibles
          (IMG as any).kartRival1, (IMG as any).kartRival2,
          (IMG as any).kartRivalFredy, (IMG as any).kartFreddy, (IMG as any).kartFredy,
          (IMG as any).kartingFreddy, (IMG as any)["karting-fredy"], (IMG as any)["karting-fredy.png"],
          (IMG as any).kartRivalDoctor, (IMG as any).kartDoctor, (IMG as any).kartingDoctor,
          (IMG as any)["karting-doctor"], (IMG as any)["karting-doctor.png"],
          // metas
          (IMG as any).finishLap1, (IMG as any).finishLap2, (IMG as any).finishFinal, (IMG as any).finish,
          // pickup
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
        catch { /* ignoramos fallos, hay fallbacks en los niveles */ }
        finally { step(); }
      })
    );
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

    // ⬅️ loader para carga del nivel
    await withLoader(l1.load(), "Cargando Nivel 1…");
    this.level = l1;
  }

  // L2 y al completar -> L3
  async startLevel2() {
    const prev = this.level;
    this.level = undefined; // desenganchar del loop
    try {
      prev?.destroy?.();
    } catch {}

    // 🎵 corta TODO el audio del Level 1 antes de crear L2
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

    // ⬅️ loader
    await withLoader(l2.load(), "Cargando Nivel 2…");
    this.level = l2;

    // 🎵 reinicia música y motor al entrar a L2
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel3() {
    const prev = this.level;
    this.level = undefined;
    try {
      prev?.destroy?.();
    } catch {}
    this.audio.stopAll?.();

    const l3 = new Level3(this.app!, this.input!, {
      onGameOver: () => {
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      onLevelComplete: async (_place) => {
        await this.startLevel4(); // pasa a L4
      },
      audio: this.audio,
    });

    // ⬅️ loader
    await withLoader(l3.load(), "Cargando Nivel 3…");
    this.level = l3;
  }

  async startLevel4() {
    const prev = this.level;
    this.level = undefined;
    try {
      prev?.destroy?.();
    } catch {}
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

    // ⬅️ loader
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
    const dt = Math.min((t - this.last) / 1000, 0.05); // cap dt
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
    try {
      this.audio.stopAll?.();
    } catch {}

    const app = this.app;
    this.app = undefined;

    if (app) {
      try {
        app.stage.removeChildren();
      } catch {}
      try {
        (app.renderer as any)?.destroy?.();
      } catch {}
      try {
        app.destroy(true);
      } catch {}
      const canvas = (app as any).canvas as HTMLCanvasElement | undefined;
      if (canvas?.parentNode) {
        try {
          canvas.parentNode.removeChild(canvas);
        } catch {}
      }
    }

    this.input = undefined;
    this.level = undefined;
  }
}
