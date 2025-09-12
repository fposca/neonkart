// src/game/Game.ts
import * as PIXI from "pixi.js";
import { Level1 } from "./Level1";
import { Level2 } from "./Level2";
import { Level3 } from "./Level3";
import { Level4 } from "./Level4";
import { Level5 } from "./level5";
import { Level7 } from "./level7";
import { Input } from "./input";
import { AudioBus } from "./audio";
import { withLoader } from "../ui/loader";
import { IMG } from "./assets";
import { Level6 } from "./Level6"; 
type GameOpts = {
  onGameOver?: () => void;
  audio?: AudioBus;
  difficulty?: import("./difficulty").DifficultyId;
  skin?: import("./skins").SkinId;
};

type InitOpts = {
  onProgress?: (p01: number) => void; // 0..1
};

export class Game {
  app?: PIXI.Application;
  input?: Input;
  audio: AudioBus;
  level?: Level1 | Level2 | Level3 | Level4 | Level5 | Level6 | Level7;
  running = false;
  last = 0;
  opts: GameOpts;

  // ===== Pausa global =====
  private paused = false;
  private pauseLatch = false;              // edge detector (para no repetir toggles)
  private pauseText?: PIXI.Text;

  // ===== Progreso / retry =====
  private currentLevel: 1|2|3|4|5|6|7 = 1;
  private gameFinished = false;            // si true, retry vuelve a L1

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
        dropShadow: true,
      },
    });
    t.anchor.set(0.5);
    t.position.set(app.renderer.width / 2, app.renderer.height / 2);
    (t as any).zIndex = 99999;
    t.visible = false;
    app.stage.addChild(t);
    this.pauseText = t;

    // PRELOAD (incluye assets L1..L7)
    await this.preloadAssets(initOpts.onProgress);

    // Arrancamos por el Nivel 1
    await this.startLevel1();
  }

  /** Precarga todos los assets gráficos probables y reporta 0..1 */
  private async preloadAssets(onProgress?: (p01: number) => void) {
    const urls = Array.from(
      new Set(
        [
          // L1/L2/L3/L4 (lo que ya tenías)
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

          // ====== L5: assets “ice” ======
          (IMG as any).fondoIce, (IMG as any).sueloIce,
          (IMG as any).kartIceFront, (IMG as any).kartIceHit, (IMG as any).kartIceDead, (IMG as any).kartIceShoot,
          (IMG as any).enemyIceFront, (IMG as any).enemyIceAttack, (IMG as any).enemyIceDead,
          (IMG as any).rivalIce1, (IMG as any).rivalIce2,

          // ====== L6: submarino ======
          (IMG as any).fondoSea, (IMG as any).sueloSea,
          "/assets/img/fondo-sea.jpg", "/assets/img/suelo-sea.jpg",

          (IMG as any).kartSubFront, "/assets/img/karting-frente-submarine.png",
          (IMG as any).kartSubHit,   "/assets/img/karting-pain-submarine.png",
          (IMG as any).kartSubDead,  "/assets/img/karting-die-submarine.png",
          (IMG as any).kartSubShoot, "/assets/img/karting-attack-submarine.png",

          (IMG as any).enemySub,     "/assets/img/enemies-submarine.png",
          (IMG as any).enemySubAtk,  "/assets/img/enemies-attack-submarine.png",
          (IMG as any).enemySubDead, "/assets/img/enemies-die-submarine.png",

          (IMG as any).rivalSub1, "/assets/img/submarine-1.png",
          (IMG as any).rivalSub2, "/assets/img/submarine-2.png",

          // ====== L7: espacio ======
          (IMG as any).fondoSpace, (IMG as any).sueloSpace,
          "/assets/img/fondo-space.jpg", "/assets/img/suelo-space.jpg",

          (IMG as any).kartSpaceFront, "/assets/img/karting-frente-space.png",
          (IMG as any).kartSpaceHit,   "/assets/img/karting-pain-space.png",
          (IMG as any).kartSpaceDead,  "/assets/img/karting-die-space.png",
          (IMG as any).kartSpaceShoot, "/assets/img/karting-attack-space.png",

          (IMG as any).enemySpaceFront,  "/assets/img/enemies-space.png",
          (IMG as any).enemySpaceAttack, "/assets/img/enemies-attack-space.png",
          (IMG as any).enemySpaceDead,   "/assets/img/enemies-die-space.png",

          (IMG as any).spaceship1, "/assets/img/spaceship-1.png",
          (IMG as any).spaceship2, "/assets/img/spaceship-2.png",

          (IMG as any).finishLapSpace, "/assets/img/finish-lap-space.png",
          (IMG as any).finishSpace,    "/assets/img/finish-space.png",
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

    (this.level as any)?.setPaused?.(on);

    if (on) this.audio.stopSfx?.("motor");
    else this.audio.playSfx?.("motor");
  }
  private resetPause() {
    this.pauseLatch = false;
    this.setPaused(false);
  }

  // ===== Cadena de niveles =====
  async startLevel1() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 1;
    this.gameFinished = false;

    const l = new Level1(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel2(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 1…");
    this.level = l;
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel2() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 2;
    this.gameFinished = false;

    const l = new Level2(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel3(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 2…");
    this.level = l;
    this.audio.playBgmLevel2?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel3() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 3;
    this.gameFinished = false;

    const l = new Level3(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel4(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 3…");
    this.level = l;
    this.audio.playBgmLevel3?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel4() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 4;
    this.gameFinished = false;

    const l = new Level4(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel5(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 4…");
    this.level = l;
    this.audio.playBgmLevel4?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel5() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 5;
    this.gameFinished = false;

    const l = new Level5(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel6(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 5…");
    this.level = l;
    this.audio.playBgmLevel5?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel6() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 6;
    this.gameFinished = false;

    const l = new Level6(this.app!, this.input!, {
      onGameOver: () => { this.audio.stopSfx?.("motor"); this.opts.onGameOver?.(); },
      onLevelComplete: async (_p) => { await this.startLevel7(); },
      audio: this.audio,
      difficulty: this.opts.difficulty,   // 👈 NUEVO
  skin: this.opts.skin,   
    });
    await withLoader(l.load(), "Cargando Nivel 6…");
    this.level = l;
    this.audio.playBgmLevel6?.();
    this.audio.playSfx?.("motor");
  }

  async startLevel7() {
    const prev = this.level; this.level = undefined;
    try { prev?.destroy?.(); } catch {}
    this.audio.stopAll?.();

    this.resetPause();
    this.currentLevel = 7;
    this.gameFinished = false;

    const l = new Level7(this.app!, this.input!, {
      onGameOver: () => {                   // perdiste en el 7 → no terminó la campaña
        this.gameFinished = false;
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();  
        
      },
      onLevelComplete: (_p) => {            // ganaste el juego ✅
        this.gameFinished = true;
        this.audio.stopSfx?.("motor");
        this.opts.onGameOver?.();
      },
      audio: this.audio,
      difficulty: this.opts.difficulty,  // 👈 agregar
  skin: this.opts.skin, 
    });
    await withLoader(l.load(), "Cargando Nivel 7…");
    this.level = l;
    this.audio.playBgmLevel1?.();
    this.audio.playSfx?.("motor");
  }

  // ===== Retry inteligente =====
  async retryLastLevel() {
    if (this.gameFinished) {
      await this.startLevel1();
      return;
    }
    switch (this.currentLevel) {
      case 1: await this.startLevel1(); break;
      case 2: await this.startLevel2(); break;
      case 3: await this.startLevel3(); break;
      case 4: await this.startLevel4(); break;
      case 5: await this.startLevel5(); break;
      case 6: await this.startLevel6(); break;
      case 7: await this.startLevel7(); break;
      default: await this.startLevel1(); break;
    }
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
