// src/game/Level4.ts
import * as PIXI from "pixi.js";
import { IMG } from "./assets";
import { Input } from "./input";
import type { AudioBus } from "./audio";

/* =============================== Tipos =================================== */
type Vec2 = { x: number; y: number };

type Runner = {
  kind: "runner";
  sp: PIXI.Sprite;
  pos: Vec2;
  speed: number;
  hp: number;
  dead: boolean;
  shootFlash: number;
  shootCd: number;   // 👈 nuevo
};

type Turret = {
  kind: "turret";
  sp: PIXI.Sprite;
  pos: Vec2;
  shootCd: number;
  hp: number;
  dead: boolean;
};

type Enemy = Runner | Turret;
type Shot = { sp: PIXI.Graphics; pos: Vec2; vx: number; vy: number };
// ⬇️ ahora soporta “life” y “god”
type Pickup = { sp: PIXI.Sprite; pos: Vec2; kind: "distortion" | "life" | "god" };

type Rival = {
  sp: PIXI.Sprite;
  pos: Vec2;
  speed: number;
  base: number;
  amp: number;
  phase: number;
};

type LevelOpts = {
  onGameOver?: () => void;
  onLevelComplete?: (place: 1 | 2 | 3) => void;
  audio?: AudioBus;
};

/* ============================== Clase ==================================== */
export class Level4 {
  /* ===== Core ===== */
  app: PIXI.Application;
  input: Input;
  opts: LevelOpts;

  constructor(app: PIXI.Application, input: Input, opts: LevelOpts = {}) {
    this.app = app;
    this.input = input;
    this.opts = opts;

    this.app.stage.addChild(this.stage);
    this.stage.addChild(this.bgLayer);
    // this.stage.addChild(this.bgShade); // “modo noche” por encima del fondo
    this.stage.addChild(this.world);
    this.stage.addChild(this.hud);
    this.stage.addChild(this.overlay);

    this.world.sortableChildren = true;

    // FX Modo Dios
    this.godHalo.visible = false;
    this.godHalo.zIndex = 990;         // bajo el player (1000)
    this.trailContainer.zIndex = 985;  // aún más atrás
    this.world.addChild(this.trailContainer, this.godHalo);
  }

  /* ===== Estado de carga ===== */
  ready = false;
  readonly FINISH_Y_OFFSET = 54;

  /* ===== Viewport / Capas ===== */
  readonly W = 1280;
  readonly H = 720;

  stage = new PIXI.Container();
  bgLayer = new PIXI.Container();
  // bgShade = new PIXI.Graphics(); // “modo noche”
  world = new PIXI.Container();
  hud = new PIXI.Container();
  overlay = new PIXI.Container(); // countdown / resultados
  readonly SHOT_Z = 950;             // sobre rivales (700) y enemigos (750), bajo player (1000)
readonly DISC_SCALE_TURRET = 4.0;  // tamaño vinilo torreta
readonly DISC_SCALE_RUNNER = 4.0;  // tamaño vinilo runner

  /* ===== Fondo scroll ===== */
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;

  /* ===== Suelo ===== */
  ground!: PIXI.TilingSprite;

  /* ===== Pista / vueltas ===== */
  camX = 0;
  trackLength = 26000;           // más largo que L3
  lapFinishX = this.trackLength;
  lapsTotal = 4;                // más vueltas = más desafío
  lap = 1;

  finishSprite!: PIXI.Sprite | PIXI.Graphics;
  finishTexLap1?: PIXI.Texture;
  finishTexLap2?: PIXI.Texture;
  finishTexFinal?: PIXI.Texture;
  finishTexFallback?: PIXI.Texture;

  /* ===== HUD ===== */
  hpBarBg = new PIXI.Graphics();
  hpBarFg = new PIXI.Graphics();
  maxHP = 100;
  hp = 100;

  lapText = new PIXI.Text({
    text: "VUELTA 1/36",
    style: { fill: 0xfff090, fontSize: 18, fontFamily: "Arial", fontWeight: "900" },
  });

  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0xffcc00, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0;

  // Timer visual (opcional, como L3)
  raceTime = 0;
  timeText = new PIXI.Text({
    text: "00:00.000",
    style: { fill: 0xffffff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  // Ammo HUD
  ammoText = new PIXI.Text({
    text: "",
    style: { fill: 0x00d2ff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  // Mini-mapa
  mapBg = new PIXI.Graphics();
  mapW = 560;
  mapH = 6;
  mapX = 640 - this.mapW / 2;
  mapY = 24;
  mapPinPlayer = new PIXI.Graphics();
  mapPinR1 = new PIXI.Graphics();
  mapPinR2 = new PIXI.Graphics();
  mapLapTick = new PIXI.Graphics();

  // Etiqueta nivel
  levelTag = new PIXI.Text({
    text: "L4",
    style: { fill: 0xccccff, fontSize: 12, fontFamily: "Arial", fontWeight: "700" },
  });

    // ===== Labels grandes de posición (sin flama)
  posTextP = new PIXI.Text({
    text: "1",
    style: {
      fill: 0xffffff,
      fontSize: 96,
      fontFamily: "Arial",
      fontWeight: "900",
      dropShadow: true,
      
    },
  });
  posTextR1 = new PIXI.Text({
    text: "2",
    style: {
      fill: 0xffffff,
      fontSize: 96,
      fontFamily: "Arial",
      fontWeight: "900",
      dropShadow: true,
      
    },
  });
  posTextR2 = new PIXI.Text({
    text: "3",
    style: {
      fill: 0xffffff,
      fontSize: 96,
      fontFamily: "Arial",
      fontWeight: "900",
      dropShadow: true,
     
    },
  });

  /* ===== Jugador ===== */
  player = new PIXI.Sprite();
  playerX = 360;
  playerY = 520;
  minX = 120;
  maxX = 1180;

  // movimiento
  speed = 0;
  baseSpeed = 250;
  maxSpeed = 520;
  accel = 560;
  friction = 440;
  strafe = 520;

  // salto
  jumping = false;
  jumpVy = 0;
  jumpOffset = 0;
  jumpImpulse = 1500;
  gravity = 2600;

  // invuln / feedback
  invuln = 0;
  invulnTime = 0.8;
  hitTimer = 0;
  shootPlayerTimer = 0;

  // Distorsión / pickups
  hasDistortion = false;
  ammo = 0;
  playerShots: Shot[] = [];
  playerShotCd = 0;
  playerShotCdMax = 0.22; // un poquito más rápido que L3

  // sprites jugador
  tex: Record<string, PIXI.Texture | undefined> = {};
  setPlayerTextureHit() { if (this.tex.kartHit) this.player.texture = this.tex.kartHit; this.hitTimer = 0.18; }
  setPlayerTextureNormal() { if (this.tex.kart) this.player.texture = this.tex.kart; }
  setPlayerTextureDead() { if (this.tex.kartDead) this.player.texture = this.tex.kartDead; }
  setPlayerTextureShoot() {
    if (this.tex.kartShoot) { this.player.texture = this.tex.kartShoot; this.shootPlayerTimer = 0.12; }
  }

  /* ===== Estados generales ===== */
  overlayTimer: number | null = null;
  ended = false;
  finished = false;

  /* ===== Enemigos (más agresivos) ===== */
  enemies: Enemy[] = [];
  enemyTimer = 0;
  enemyMin = 1.2;  // spawnea más seguido
  enemyMax = 2.2;

  /* ===== Rivales (ligeramente más rápidos) ===== */
  rivals: Rival[] = [];

  /* ===== Disparos enemigos ===== */
  shots: Shot[] = [];

  /* ===== Pickups ===== */
  pickups: Pickup[] = [];
  pickupTimer = 3.5;
  pickupMin = 5.0; // aparecen un pelín más seguido
  pickupMax = 9.0;
  // ⬇️ life: ritmo separado, más espaciado
  lifePickupTimer = 10;
  lifePickupMin = 14;
  lifePickupMax = 20;

  /* ===== Modo Dios (más frecuente en L4) ===== */
  godMode = false;
  godTimer = 0;
  godDuration = 4;          // segundos de invulnerabilidad/boost
  godPickupTimer = 12;       // ⬅ empieza antes que en L3
  godPickupMin = 12;         // ⬅ intervalos más cortos
  godPickupMax = 20;
  godPickupsSpawned = 0;
  godPickupsMax = 2;         // 2 garantizados; chance de 3 en load()

  /* ===== Escalas (tamaño) ===== */
playerScale = 0.65; // kart del jugador
rivalScale  = 0.65; // Fredy/Doctor
enemyScale  = 0.65; // runners/torretas

  // FX
  godHalo = new PIXI.Graphics();
  godHaloPulse = 0;
  trailContainer = new PIXI.Container();
  godTrail: { sp: PIXI.Graphics; life: number; max: number }[] = [];
  godTrailTimer = 0;

  /* ===== Countdown ===== */
  controlsLocked = true;
  countdown = 3;
  countdownTimer = 1.0;
  countdownText = new PIXI.Text({
    text: "3",
    style: { fill: 0xffffff, fontSize: 128, fontFamily: "Arial", fontWeight: "900" },
  });
  goFlashTimer = 0;

  traffic = new PIXI.Container();
  lampRed = new PIXI.Graphics();
  lampYellow = new PIXI.Graphics();
  lampGreen = new PIXI.Graphics();

  /* ============================ Helpers ================================== */
  private nextEnemyIn() { this.enemyTimer = this.enemyMin + Math.random() * (this.enemyMax - this.enemyMin); }
  private async tryLoad(url?: string) { if (!url) return undefined; try { return await PIXI.Assets.load(url); } catch { return undefined; } }
  private screenX(worldX: number) { return worldX - this.camX; }
  private clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
/* ===== Anti-cheese borde derecho ===== */
private edgeZonePx = 18;          // cuánto consideramos “pegado” al borde
private edgeStickSec = 2.0;       // tiempo para activar penalización
private edgePenaltyDur = 2.2;     // duración del empuje
private edgePenaltySpeed = 720;   // px/s de empuje hacia la izquierda
private edgeStickTimer = 0;       // acumula tiempo “pegado + saltando”
private edgePenaltyTimer = 0;     // penalización activa

  private fmt(ms: number) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const pad3 = (n: number) => n.toString().padStart(3, "0");
    return `${pad2(m)}:${pad2(s)}.${pad3(mil)}`;
  }

  private redrawHP() {
    const p = Math.max(0, this.hp / this.maxHP);
    this.hpBarFg.clear().roundRect(1, 1, 258 * p, 16, 8).fill(p > 0.4 ? 0x33dd66 : 0xdd3344);
  }
  private updateAmmoHud() { this.ammoText.text = this.hasDistortion ? `Ammo: ${this.ammo}` : ""; }
  private updateLapHud() { this.lapText.text = `VUELTA ${this.lap}/${this.lapsTotal}`; }

  private lapProgressFor(worldX: number) {
    const baseLapX = (this.lap - 1) * this.trackLength;
    const raw = (worldX - baseLapX) / this.trackLength;
    return this.clamp01(raw);
  }
  private shouldAnnounceLap(lap: number) {
    const last5Start = this.lapsTotal - 5 + 1;
    if (lap >= last5Start) return true;
    return lap % 5 === 0;
  }
  private showLapAnnounce(txt: string) {
    this.lapAnnounce.text = txt;
    this.lapAnnounce.visible = true;
       this.lapAnnounce.alpha = 1;
    this.lapAnnounceTimer = 2.0;
    this.opts.audio?.playOne?.("countBeep");
  }

  private setFinishTextureForLap(lap: number) {
    let t: PIXI.Texture | undefined;
    if (lap === 1) t = this.finishTexLap1 ?? this.finishTexFallback;
    else if (lap === 2) t = this.finishTexLap2 ?? this.finishTexFallback;
    else t = this.finishTexFinal ?? this.finishTexFallback;

    if (this.finishSprite) { try { this.finishSprite.destroy({ children: true }); } catch {} }

    if (t) {
      const s = new PIXI.Sprite(t);
      s.anchor.set(0.5, 1);
      s.zIndex = 750;
      this.finishSprite = s;
    } else {
      const g = new PIXI.Graphics().rect(-6, -100, 12, 100).fill(0xffffff);
      g.zIndex = 750;
      this.finishSprite = g;
    }
    this.finishSprite.position.set(this.screenX(this.lapFinishX),  this.ground.y + this.FINISH_Y_OFFSET);
    this.finishSprite.visible = true;
    this.world.addChild(this.finishSprite);
  }

  /* =============================== Carga ================================= */
  async load() {
    // === Arte L4 (fondo/suelo + rivales) ===
    const fondo4 = (IMG as any).fondo4 ?? "/assets/img/fondo4.png";
    const suelo4 = (IMG as any).suelo4 ?? "/assets/img/suelo4.png";

    // === Jugador ===
    this.tex.kart      = await this.tryLoad(IMG.kartSide);
    this.tex.kartHit   = await this.tryLoad(IMG.kartHit);
    this.tex.kartDead  = await this.tryLoad(IMG.kartDead);
    this.tex.kartShoot = await this.tryLoad(IMG.kartShoot);

    // === Enemigos / torretas ===
    this.tex.enemy      = (await this.tryLoad((IMG as any).enemy2Side))  ?? (await this.tryLoad(IMG.regSide));
    this.tex.enemyAtk   = (await this.tryLoad((IMG as any).enemy2Shoot)) ?? (await this.tryLoad(IMG.regShoot));
    this.tex.enemyWreck = (await this.tryLoad((IMG as any).enemy2Wreck)) ?? (await this.tryLoad(IMG.regWreck));

    // === Metas ===
    this.finishTexLap1     = await this.tryLoad((IMG as any).finishLap1);
    this.finishTexLap2     = await this.tryLoad((IMG as any).finishLap2);
    this.finishTexFinal    = await this.tryLoad((IMG as any).finishFinal);
    this.finishTexFallback = await this.tryLoad((IMG as any).finish ?? (IMG as any).finishFinal);

    // === Pickups ===
    this.tex.pedal = await this.tryLoad((IMG as any).pedalDist ?? IMG.pedalDist);
    this.tex.life  = await this.tryLoad((IMG as any).life ?? "/assets/img/life.png");
    this.tex.god   = await this.tryLoad((IMG as any).god ?? "/assets/img/god.png"); // ⬅ god pickup

    // === Fondo/Suelo (con fallback) ===
    this.tex.fondo = (await this.tryLoad(fondo4)) ?? (await this.tryLoad(IMG.fondo));
    this.tex.suelo = (await this.tryLoad(suelo4)) ?? (await this.tryLoad(IMG.suelo));

    // Rivales nuevos
    this.tex.rival1 =
      (await this.tryLoad((IMG as any).kartEmet)) ??
      (await this.tryLoad("/assets/img/karting-emet.png")) ??
      this.tex.enemy;

    this.tex.rival2 =
      (await this.tryLoad((IMG as any).kartBrujo)) ??
      (await this.tryLoad("/assets/img/karting-brujo.png")) ??
      this.tex.enemy;

    // ---------- Fondo 2x ----------
    if (this.tex.fondo) {
      const t = this.tex.fondo;
      const sx = this.W / t.width, sy = this.H / t.height;
      this.bgWidthScaled = this.W;
      this.bg1 = new PIXI.Sprite(t); this.bg1.scale.set(sx, sy); this.bg1.x = 0;
      this.bg2 = new PIXI.Sprite(t); this.bg2.scale.set(sx, sy); this.bg2.x = this.bgWidthScaled;
    } else {
      const t = this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,this.W,this.H).fill(0x1a1a1a));
      this.bg1.texture = t; this.bg2.texture = t; this.bg2.x = this.W; this.bgWidthScaled = this.W;
    }
    this.bgLayer.addChild(this.bg1, this.bg2);

    // // “Modo noche”: lámina negra semitransparente encima del fondo
    // this.bgShade.clear().rect(0, 0, this.W, this.H).fill(0x000000);
    // this.bgShade.alpha = 0.28;
    // this.bgShade.zIndex = 50;

    // Suelo
    const gtex = this.tex.suelo ?? this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,512,160).fill(0x222));
    this.ground = new PIXI.TilingSprite({ texture: gtex, width: this.W, height: 160 });
    this.ground.y = this.H - this.ground.height;
    this.ground.zIndex = 100;
    this.world.addChild(this.ground);

    // Jugador
    this.player.texture = this.tex.kart ?? PIXI.Texture.WHITE;
    this.player.anchor.set(0.5, 0.8);
    this.player.position.set(this.playerX, this.playerY);
    this.player.zIndex = 1000;
    this.player.scale.set(this.playerScale); // 👈 NUEVO
    this.world.addChild(this.player);

    // HUD
    this.hud.position.set(20, 20);
    this.hpBarBg.roundRect(0,0,260,18,9).fill(0x222).stroke({ width:2, color:0x000 });
    this.hud.addChild(this.hpBarBg, this.hpBarFg);
    this.redrawHP();

    this.ammoText.position.set(0, 40);
    this.hud.addChild(this.ammoText); this.updateAmmoHud();

    this.timeText.position.set(200, 40);
    this.hud.addChild(this.timeText);

    this.lapText.position.set(0, 64);
    this.hud.addChild(this.lapText); this.updateLapHud();

    this.levelTag.position.set(230, 64);
    this.hud.addChild(this.levelTag);

    // Mini-mapa
    this.mapBg.clear()
      .roundRect(this.mapX, this.mapY, this.mapW, this.mapH, 3)
      .fill(0x2a2a2a)
      .stroke({ width: 2, color: 0x000000 });
    this.mapPinPlayer.clear().circle(0, 0, 3).fill(0x00d2ff);
    this.mapPinR1.clear().circle(0, 0, 2.5).fill(0xff7f00);
    this.mapPinR2.clear().circle(0, 0, 2.5).fill(0x00ff66);
    this.mapLapTick.clear().rect(-1, -6, 2, this.mapH + 12).fill(0xffffff);
    this.hud.addChild(this.mapBg, this.mapPinPlayer, this.mapPinR1, this.mapPinR2, this.mapLapTick);
    const tick = (p: number) => {
      const g = new PIXI.Graphics().rect(-1, -4, 2, this.mapH + 8).fill(0x3a3a3a);
      g.position.set(this.mapX + p * this.mapW, this.mapY);
      this.hud.addChild(g);
    };
    tick(0.25); tick(0.5); tick(0.75);

    // Cartel de anuncio
    this.lapAnnounce.anchor.set(0.5);
    this.lapAnnounce.position.set(this.W/2, this.H/2 - 100);
    this.lapAnnounce.visible = false;
    this.stage.addChild(this.lapAnnounce);

    // Meta inicial
    this.setFinishTextureForLap(1);

    // Rivales
    this.spawnRivalsAtStart();
this.setupPositionLabels();
    // Enemigos
    this.nextEnemyIn();

    // Overlay oculto
    this.overlay.visible = false;

    // Timer visual
    this.raceTime = 0;
    this.timeText.text = "00:00.000";

    // Sonidos
    this.opts.audio?.playBgmLevel4?.();
    this.opts.audio?.playSfx?.("motor");

    // GOD: chance de 3 pickups en L4 (60%)
    if (Math.random() < 0.6) this.godPickupsMax = 3;

    // Countdown
    this.setupCountdown();

    // listo
    this.ready = true;
  }

  /* ====================== Countdown / Semáforo =========================== */
  private setupCountdown() {
    this.controlsLocked = true;
    this.countdown = 3;
    this.countdownTimer = 1.0;
    this.goFlashTimer = 0;

    this.countdownText.text = "3";
    this.countdownText.anchor.set(0.5);

    this.traffic.removeChildren();
    const r = 24;
    this.lampRed.circle(0,0,r).fill(0x550000).stroke({ width:4, color:0x220000 });
    this.lampYellow.circle(0,0,r).fill(0x554400).stroke({ width:4, color:0x221a00 });
    this.lampGreen.circle(0,0,r).fill(0x004d00).stroke({ width:4, color:0x002200 });

    const spacing = 64;
    this.lampRed.position.set(-spacing, 0);
    this.lampYellow.position.set(0, 0);
    this.lampGreen.position.set(spacing, 0);
    this.traffic.addChild(this.lampRed, this.lampYellow, this.lampGreen);

    // panel
    this.overlay.removeChildren();
    const panelW = 560;
    const panelH = 260;

    const panel = new PIXI.Graphics()
      .roundRect(0, 0, panelW, panelH, 24)
      .fill({ color: 0x000000, alpha: 0.4 })
      // .stroke({ width: 6, color: 0x00d2ff, alignment: 1 });

    const cx = (this.W - panelW) / 2;
    const cy = (this.H - panelH) / 2 - 30;
    panel.position.set(cx, cy);

    const centerX = cx + panelW / 2;
    const centerY = cy + panelH / 2;

    this.countdownText.position.set(centerX, centerY - 34);
    this.traffic.position.set(centerX, centerY + 62);

    this.overlay.addChild(panel, this.countdownText, this.traffic);
    this.overlay.visible = true;
  }
  private setTrafficLights(red: boolean, yellow: boolean, green: boolean) {
    this.lampRed.tint = red ? 0xff0000 : 0x550000;
    this.lampYellow.tint = yellow ? 0xffdd33 : 0x554400;
    this.lampGreen.tint = green ? 0x00ff66 : 0x004d00;
  }

  /* ============================ Spawns/FX ================================ */
  private spawnRivalsAtStart() {
    const mk = (t?: PIXI.Texture) => {
      const sp = new PIXI.Sprite(t ?? this.tex.enemy ?? PIXI.Texture.WHITE);
      sp.anchor.set(0.5, 0.8);
      sp.zIndex = 700;
       sp.scale.set(this.rivalScale); // 👈 NUEVO
      this.world.addChild(sp);
      return sp;
    };
    const startWorldX = this.camX + this.player.x;
    const r1: Rival = { sp: mk(this.tex.rival1), pos: { x: startWorldX + 40, y: this.playerY - 6 }, speed: this.baseSpeed, base: 500, amp: 48, phase: Math.random()*Math.PI*2 };
    const r2: Rival = { sp: mk(this.tex.rival2), pos: { x: startWorldX - 40, y: this.playerY + 6 }, speed: this.baseSpeed, base: 485, amp: 38, phase: Math.random()*Math.PI*2 };
    this.rivals.push(r1, r2);
    for (const r of this.rivals) { r.sp.x = this.screenX(r.pos.x); r.sp.y = r.pos.y; }
  }

  private spawnRunner() {
    const margin = 240;
    const x = this.camX + this.W + margin;
    const y = this.playerY;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 760; // por encima de torretas/rivales
    sp.scale.set(this.enemyScale); // 👈
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0x27ae60);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const rel = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 100);
    const e: Runner = { kind: "runner", sp, pos: { x, y }, speed: this.baseSpeed + rel, hp: 3, dead: false, shootFlash: 0,  shootCd: 0.5 + Math.random() * 0.9, };
    this.enemies.push(e);
  }

  private spawnTurret() {
    const margin = 260;
    const x = this.camX + this.W + margin;
    const y = this.playerY - 24;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 640;
    sp.scale.set(this.enemyScale); // 👈 agrega esto
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0xc0392b);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const e: Turret = { kind: "turret", sp, pos: { x, y }, shootCd: 0.55 + Math.random()*0.7, hp: 2, dead: false };
    this.enemies.push(e);
  }

  private spawnEnemy() {
    // 70% runner / 30% torreta en L4
    if (Math.random() < 0.70) this.spawnRunner(); else this.spawnTurret();
  }
private enemyShoot(from: Enemy) {
  if (from.dead) return;

  // Cálculo en mundo (no uses screenX para el ángulo)
  const sxW = from.pos.x,      sy = from.pos.y - 24;
  const dxW = this.camX + this.player.x, dy = this.player.y - 10;
  const ang = Math.atan2(dy - sy, dxW - sxW);
  const v = 430;

  const scale = from.kind === "turret" ? this.DISC_SCALE_TURRET : this.DISC_SCALE_RUNNER;
  const gfx = this.makeReggaetonDisc(scale); // vinilo grande para ambos

  const shot: Shot = {
    sp: gfx,
    pos: { x: sxW, y: sy },     // en mundo
    vx: Math.cos(ang) * v,
    vy: Math.sin(ang) * v,
  };

  // giro del vinilo
  (shot.sp as any).rotSpeed = Math.random() < 0.5 ? -8 : 8;

  // posicionar (X en pantalla, Y ya es pantalla)
  shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
  shot.sp.zIndex = this.SHOT_Z;

  this.world.addChild(shot.sp);
  this.shots.push(shot);

  this.opts.audio?.playOne?.("enemyShoot");

  // flash de disparo
  if (!from.dead && this.tex.enemyAtk) {
    from.sp.texture = this.tex.enemyAtk;
    setTimeout(() => { if (!from.dead && this.tex.enemy) from.sp.texture = this.tex.enemy; }, 180);
  }
}


  /* =================== Fin / Overlays con auto-hide ====================== */
  private showResultOverlay(text: string) {
    this.overlay.removeChildren();

    const panel = new PIXI.Graphics()
      .roundRect(0, 0, 520, 200, 18)
      .fill({ color: 0x000000, alpha: 0.5 });

    panel.position.set((this.W - 520) / 2, (this.H - 200) / 2);
    this.overlay.addChild(panel);

    const title = new PIXI.Text({
      text,
      style: { fill: 0xffffff, fontSize: 64, fontFamily: "Arial", fontWeight: "900", align: "center" },
    });
    title.anchor.set(0.5);
    title.position.set(this.W / 2, this.H / 2 - 16);
    this.overlay.addChild(title);

    const time = new PIXI.Text({
      text: this.fmt(this.raceTime * 1000),
      style: { fill: 0x00d2ff, fontSize: 20, fontFamily: "Arial", fontWeight: "700" },
    });
    time.anchor.set(0.5);
    time.position.set(this.W / 2, this.H / 2 + 28);
    this.overlay.addChild(time);

    this.overlay.visible = true;
    // reset visual del texto
(this.countdownText.style as any).fill = 0xffffff;
this.countdownText.alpha = 1;

// estado inicial: solo ROJO encendido
this.setTrafficLights(true, false, false);
// opcional beep inicial:
// this.opts.audio?.playOne?.("countBeep");
  }

  private levelComplete(place: 1 | 2 | 3) {
  if (this.finished) return;
  this.finished = true;
  this.controlsLocked = true;

  // FREEZE combate / spawns (como L3)
  this.invuln = 9999;
  this.enemyTimer = 9999;

  // destruir proyectiles para que no queden flotando (enemigos y jugador)
  for (const s of this.shots)       { try { s.sp.destroy(); } catch {} }
  for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
  this.shots = [];
  this.playerShots = [];

  // ⛔ NO paramos el BGM (igual que L3). Si querés cortar solo el motor, descomentá:
  // this.opts.audio?.stopSfx?.("motor");

  const label = place === 1 ? "¡1º!" : place === 2 ? "2º" : "3º";
  this.lapAnnounce.visible = false;
this.lapAnnounceTimer = 0;
  this.showResultOverlay(label);

  if (this.overlayTimer) clearTimeout(this.overlayTimer);
  this.overlayTimer = window.setTimeout(() => {
    this.overlay.visible = false;
    this.opts.onLevelComplete?.(place);
  }, 2500); // mismo timing que L3
}

  private endGame() {
    if (this.ended) return;
    this.ended = true;
    this.setPlayerTextureDead();
    this.showResultOverlay("GAME OVER");
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    this.overlayTimer = window.setTimeout(() => {
      this.overlay.visible = false;
      this.opts.onGameOver?.();
    }, 3000);
    this.opts.audio?.stopSfx?.("motor");
    this.opts.audio?.stopBgm?.();
  }

  /* ============================== GOD mode =============================== */
  private setGod(on: boolean) {
    this.godMode = on;
    if (on) {
      this.godTimer = this.godDuration;
      (this.player as any).tint = 0xffee66;
      this.drawGodHalo();
      this.godHalo.visible = true;
      this.godHalo.alpha = 0.5;
      this.godHaloPulse = 0;
      this.showLapAnnounce("¡MODO DIOS!");
    } else {
      (this.player as any).tint = 0xffffff;
      this.godHalo.visible = false;
    }
  }
  private drawGodHalo() {
    this.godHalo.clear();
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 72, 38).fill({ color: 0xffd200, alpha: 0.22 });
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 46, 20).fill({ color: 0xffffaa, alpha: 0.18 });
  }
  private emitGodTrail() {
    for (let i = 0; i < 2; i++) {
      const g = new PIXI.Graphics().roundRect(-10, -4, 20, 8, 4).fill(0xfff4b0);
      g.alpha = 0.85;
      g.position.set(
        this.player.x - 30 + (Math.random() * 14 - 7),
        this.player.y - this.jumpOffset + (Math.random() * 10 - 5)
      );
      this.trailContainer.addChild(g);
      this.godTrail.push({ sp: g, life: 0.5, max: 0.5 });
    }
  }

  /* =============================== Update ================================ */
  update(dt: number) {
    if (!this.ready) return;
    if (this.ended) return;
    if (this.finished) return; // congela todo tras cruzar la meta ✅

   // COUNTDOWN (luces acumulativas)
if (this.controlsLocked && !this.finished && !this.ended) {
  this.countdownTimer -= dt;
  if (this.countdownTimer <= 0) {
    if (this.countdown === 3) {
      // 3 -> 2: ROJO + AMARILLO
      this.countdown = 2;
      this.countdownText.text = "2";
      this.countdownTimer = 1.0;
      this.setTrafficLights(true, true, false);
      this.opts.audio?.playOne?.("countBeep");
    } else if (this.countdown === 2) {
      // 2 -> 1: ROJO + AMARILLO + VERDE
      this.countdown = 1;
      this.countdownText.text = "1";
      this.countdownTimer = 1.0;
      this.setTrafficLights(true, true, true);
      this.opts.audio?.playOne?.("countBeep");
    } else if (this.countdown === 1) {
      // GO!
      this.countdown = 0;
      this.countdownText.text = "GO!";
      (this.countdownText.style as any).fill = 0x00ff66;
      this.goFlashTimer = 0.6;
      this.countdownTimer = 0.4;

      // mantener las 3 encendidas durante el GO (opcional: solo verde)
      this.setTrafficLights(true, true, true);
      // this.setTrafficLights(false, false, true);

      this.opts.audio?.playOne?.("countGo");
    } else {
      // arranca la carrera
      this.overlay.removeChildren();
      this.overlay.visible = false;
      this.controlsLocked = false;
    }
  }

  // parpadeo del "GO!"
  if (this.goFlashTimer > 0) {
    this.goFlashTimer -= dt;
    (this.countdownText as any).alpha = 0.55 + 0.45 * Math.sin(this.goFlashTimer * 20);
  }
}


    // tiempo visual
    if (!this.finished && !this.controlsLocked) {
      this.raceTime += dt;
      this.timeText.text = this.fmt(this.raceTime * 1000);
    }

    // timers jugador
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitTimer > 0) { this.hitTimer -= dt; if (this.hitTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.shootPlayerTimer > 0) { this.shootPlayerTimer -= dt; if (this.shootPlayerTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.playerShotCd > 0) this.playerShotCd -= dt;

    // GOD MODE
    if (this.godMode) {
      this.godTimer -= dt;
      if (this.godTimer <= 0) {
        this.setGod(false);
      } else {
        // halo pegado al player
        this.godHalo.position.set(this.player.x, 0);
        this.drawGodHalo();
        // pulso
        this.godHaloPulse += dt * 3;
        const k = 0.5 + 0.2 * Math.sin(this.godHaloPulse * 4);
        this.godHalo.alpha = k;
        // trail
        this.godTrailTimer -= dt;
        if (this.godTrailTimer <= 0) { this.emitGodTrail(); this.godTrailTimer = 0.03; }
      }
    }
    // actualizar partículas del trail
    if (this.godTrail.length) {
      for (const t of this.godTrail) {
        t.life -= dt;
        t.sp.alpha = 0.85 * Math.max(0, t.life / t.max);
        t.sp.x -= this.speed * dt * 0.2;
      }
      this.godTrail = this.godTrail.filter(t => { const alive = t.life > 0; if (!alive) t.sp.destroy(); return alive; });
    }

    // velocidad / lateral (boost más fuerte en L4)
    const accelPressed = this.input.a.right && !this.controlsLocked;
    const boost = this.godMode ? 2.1 : 1.0; // ⬅ boost alto
    const target = (accelPressed ? this.maxSpeed : this.baseSpeed) * boost;
    if (this.speed < target) this.speed = Math.min(target, this.speed + this.accel * dt);
    else this.speed = Math.max(target, this.speed - this.friction * dt * 0.5);

    if (!this.controlsLocked) {
      if (this.input.a.left)  this.playerX -= this.strafe * dt;
      if (this.input.a.right) this.playerX += this.strafe * dt * 0.6;
    }
    this.playerX = Math.max(this.minX, Math.min(this.maxX, this.playerX));

    // salto
    if (!this.controlsLocked && this.input.a.fire && !this.jumping) { this.jumping = true; this.jumpVy = this.jumpImpulse; }
    if (this.jumping) {
      this.jumpVy -= this.gravity * dt;
      this.jumpOffset += this.jumpVy * dt;
      if (this.jumpOffset <= 0) { this.jumpOffset = 0; this.jumping = false; this.jumpVy = 0; }
    }
// ==== Anti-cheese: pegado al borde derecho saltando ====
if (!this.controlsLocked && !this.finished && !this.ended) {
  const nearRight = this.playerX >= (this.maxX - this.edgeZonePx);
  const abusingJump = this.jumping || !!this.input.a.fire;

  if (nearRight && abusingJump) {
    this.edgeStickTimer += dt;
    if (this.edgeStickTimer >= this.edgeStickSec && this.edgePenaltyTimer <= 0) {
      this.edgePenaltyTimer = this.edgePenaltyDur;
      this.edgeStickTimer = 0;
      this.showLapAnnounce?.("¡PENALIZACIÓN!");
      this.opts.audio?.playOne?.("impact");
    }
  } else {
    this.edgeStickTimer = Math.max(0, this.edgeStickTimer - dt * 0.5);
  }

  if (this.edgePenaltyTimer > 0) {
    this.edgePenaltyTimer -= dt;
    this.playerX -= this.edgePenaltySpeed * dt;

    if (this.playerX > this.maxX - this.edgeZonePx) {
      this.playerX = this.maxX - this.edgeZonePx;
    }
  }

  this.playerX = Math.max(this.minX, Math.min(this.maxX, this.playerX));
}

    // disparo jugador (si hay ammo)
    const shootPressed = (this.input as any).a.fire2 || (this.input as any).a.ctrl || (this.input as any).a.F;
    if (!this.controlsLocked && shootPressed && this.hasDistortion && this.playerShotCd <= 0 && this.ammo > 0) {
      const sx = this.player.x + 40;
      const sy = this.player.y - 24;
      const speed = 920;
      const gfx = this.makeNoteShot(); // 🎵

      const shot: Shot = { sp: gfx, pos: { x: this.camX + sx, y: sy }, vx: speed, vy: 0 };
      shot.sp.position.set(sx, sy);
      shot.sp.zIndex = 800;
      this.world.addChild(shot.sp);
      this.playerShots.push(shot);
      this.playerShotCd = this.playerShotCdMax;
      this.setPlayerTextureShoot();
      this.opts.audio?.playOne?.("playerShoot");

      this.ammo--; this.updateAmmoHud();
      if (this.ammo <= 0) { this.hasDistortion = false; this.updateAmmoHud(); }
    }

    // cámara / parallax
    this.camX += this.speed * dt;
    const bgOffset = -(this.camX * 0.25) % this.bgWidthScaled;
    this.bg1.x = bgOffset; this.bg2.x = bgOffset + this.bgWidthScaled;
    if (this.bg1.x <= -this.bgWidthScaled) this.bg1.x += this.bgWidthScaled * 2;
    if (this.bg2.x <= -this.bgWidthScaled) this.bg2.x += this.bgWidthScaled * 2;
    if (this.ground) this.ground.tilePosition.x = -this.camX;

    // aplicar jugador
    this.player.x = this.playerX;
    this.player.y = this.playerY - this.jumpOffset;

    // vueltas (por distancia)
    const playerWorldX = this.camX + this.player.x;
    while (!this.finished && !this.controlsLocked && playerWorldX >= this.lapFinishX) {
      if (this.lap < this.lapsTotal) {
        this.lap += 1;
        this.updateLapHud();

        if (this.lap === this.lapsTotal) this.showLapAnnounce("¡ÚLTIMA VUELTA!");
        else if (this.shouldAnnounceLap(this.lap)) this.showLapAnnounce(`VUELTA ${this.lap}`);

        this.setFinishTextureForLap(this.lap);
        this.lapFinishX += this.trackLength;
      } else {
        const rivalsAhead = this.rivals.filter(r => r.pos.x >= this.lapFinishX).length;
      const place = (1 + rivalsAhead) as 1 | 2 | 3;
this.levelComplete(place);
break;
      }
    }

    // meta sprite posición
    if (this.finishSprite) {
      this.finishSprite.x = this.screenX(this.lapFinishX);
      this.finishSprite.y = this.ground.y + this.FINISH_Y_OFFSET;
    }
    // Fade anuncio (¡MODO DIOS! / VUELTA X / ¡ÚLTIMA VUELTA!)
if (this.lapAnnounceTimer > 0) {
  this.lapAnnounceTimer -= dt;
  const t = Math.max(0, this.lapAnnounceTimer);
  const total = 2.0;
  this.lapAnnounce.alpha = t / total;
  if (this.lapAnnounceTimer <= 0) this.lapAnnounce.visible = false;
}

    /* ===== Rivales ===== */
for (let i = 0; i < this.rivals.length; i++) {
  const r = this.rivals[i];
  // ❌ sacá esta línea de acá:
  // this.updateRacePositions();

  r.phase += dt * (0.7 + 0.3 * i);
  const osc = Math.sin(r.phase) * r.amp;

  const baseLapX = (this.lap - 1) * this.trackLength;
  const rivalRelX = r.pos.x - baseLapX;
  const playerRelX = (this.camX + this.player.x) - baseLapX;
  const gap = playerRelX - rivalRelX;

  let catchup = 0;
  if (gap > 450) catchup += 55;
  if (gap < -450) catchup -= 35;

  const godHandicap = this.godMode ? -120 : 0;

  const rivalMaxWhenYouBoost = this.maxSpeed - 15;
  const rivalMaxWhenCruise   = this.maxSpeed + 35;

  const targetVBase = r.base + osc + catchup + godHandicap;
  const maxRival = this.input.a.right ? rivalMaxWhenYouBoost : rivalMaxWhenCruise;
  const minRival = this.baseSpeed + 40;

  const targetV = Math.max(minRival, Math.min(maxRival, targetVBase));
  r.speed = r.speed * 0.82 + targetV * 0.18;

  r.pos.x += r.speed * dt;
  r.sp.x = this.screenX(r.pos.x);
  r.sp.y = r.pos.y;
}


    /* ===== Enemigos ===== */
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.controlsLocked) { this.spawnEnemy(); this.nextEnemyIn(); }

    for (const e of this.enemies) {
      if (e.kind === "runner") {
        
        e.pos.x -= e.speed * dt;
        e.sp.x = this.screenX(e.pos.x);
        e.sp.y = this.playerY;

        const R = e as Runner;
        if (R.shootFlash > 0) {
          R.shootFlash -= dt;
          if (R.shootFlash <= 0 && !R.dead && this.tex.enemy) e.sp.texture = this.tex.enemy;
        }
R.shootCd -= dt;
if (R.shootCd <= 0 && !R.dead && !this.controlsLocked) {
  this.enemyShoot(R);
  R.shootCd = 0.6 + Math.random() * 0.7;
}
        if (!e.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds();
          const eb = e.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 50 * dt * 60;
            e.pos.x += 100 * dt;
            const minKeep = this.baseSpeed * 0.75; if (this.speed < minKeep) this.speed = minKeep;
            if (this.hurtPlayer(7)) { this.opts.audio?.playOne?.("crash"); }
          }
        }
      } else {
        e.pos.x -= this.baseSpeed * dt * 0.22;
        e.sp.x = this.screenX(e.pos.x);
        e.sp.y = e.pos.y;

        e.shootCd -= dt;
        if (e.shootCd <= 0 && !e.dead) {
          this.enemyShoot(e);
          e.shootCd = 0.6 + Math.random() * 0.7;
        }

        if (!e.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds();
          const eb = e.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 50 * dt * 60;
            if (this.hurtPlayer(9)) { this.opts.audio?.playOne?.("crash"); }
          }
        }
      }
    }

    // disparo enemigo (balas)
    for (const s of this.shots) {
      s.pos.x += s.vx * dt;
      s.pos.y += s.vy * dt;
      // rotación del vinilo
  const rs = (s.sp as any).rotSpeed ?? 0;
  if (rs) s.sp.rotation += rs * dt;
      s.sp.x = this.screenX(s.pos.x);
      s.sp.y = s.pos.y;

      const pb = this.player.getBounds(), sb = s.sp.getBounds();
      const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
      if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
        if (this.hurtPlayer(13)) { this.opts.audio?.playOne?.("impact"); }
        s.pos.x = this.camX - 9999;
      }
    }
    this.shots = this.shots.filter(s => {
      const alive = s.pos.x > this.camX - 300 && s.pos.x < this.camX + this.W + 400 && s.pos.y > 0 && s.pos.y < this.H;
      if (!alive) s.sp.destroy();
      return alive;
    });

    // ===== Pickups =====
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && !this.controlsLocked) {
      this.spawnPickup();
      this.pickupTimer = this.pickupMin + Math.random() * (this.pickupMax - this.pickupMin);
    }

    // ⬇️ vida independiente
    this.lifePickupTimer -= dt;
    if (this.lifePickupTimer <= 0 && !this.controlsLocked) {
      this.spawnLifePickup();
      this.lifePickupTimer = this.lifePickupMin + Math.random() * (this.lifePickupMax - this.lifePickupMin);
    }

    // ⭐ GOD pickup (más frecuente en L4)
    this.godPickupTimer -= dt;
    if (this.godPickupsSpawned < this.godPickupsMax && this.godPickupTimer <= 0 && !this.controlsLocked) {
      this.spawnGodPickup();
      this.godPickupTimer = this.godPickupMin + Math.random() * (this.godPickupMax - this.godPickupMin);
    }

    for (const p of this.pickups) {
      p.pos.x -= this.baseSpeed * dt;
      p.sp.x = this.screenX(p.pos.x); p.sp.y = p.pos.y;

      const pb = this.player.getBounds(), qb = p.sp.getBounds();
      const touch = pb.right > qb.left && pb.left < qb.right && pb.bottom > qb.top && pb.top < qb.bottom;
      if (touch && !this.controlsLocked) { this.givePickup(p); p.pos.x = this.camX - 9999; }
    }
    this.pickups = this.pickups.filter(p => { const alive = p.pos.x > this.camX - 300; if (!alive) p.sp.destroy(); return alive; });

    // disparos del jugador
    for (const s of this.playerShots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
      // rotación del vinilo (si existe rotSpeed)
  const rs = (s.sp as any).rotSpeed ?? 0;
  if (rs) s.sp.rotation += rs * dt;
      s.sp.rotation = Math.sin(s.pos.x * 0.02) * 0.25; // wobble

      for (const e of this.enemies) {
        if (e.dead) continue;
        const eb = e.sp.getBounds(), sb = s.sp.getBounds();
        const hit = sb.right > eb.left && sb.left < eb.right && sb.bottom > eb.top && sb.top < eb.bottom;
        if (hit) {
          e.hp -= 1;
          e.sp.alpha = 0.85; setTimeout(() => { e.sp.alpha = 1; }, 60);
          s.pos.x = this.camX + this.W + 9999;

          if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            if (this.tex.enemyWreck) e.sp.texture = this.tex.enemyWreck;
            if (e.kind === "runner") (e as Runner).speed = this.baseSpeed * 0.8;
          }
        }
      }
    }
    this.playerShots = this.playerShots.filter(s => { const alive = s.pos.x < this.camX + this.W + 300; if (!alive) s.sp.destroy(); return alive; });

    // culling enemigos
    this.enemies = this.enemies.filter(e => { const alive = e.pos.x > this.camX - 600; if (!alive) e.sp.destroy(); return alive; });
    this.updateRacePositions();
    // minimapa
    this.updateMiniMap();
    
  }

  /* =============================== Mini-mapa ============================== */
  private updateMiniMap() {
    const playerWorld = this.camX + this.player.x;
    const r1x = this.rivals[0]?.pos.x ?? playerWorld;
    const r2x = this.rivals[1]?.pos.x ?? playerWorld;

    const px = this.mapX + this.lapProgressFor(playerWorld) * this.mapW;
    const r1 = this.mapX + this.lapProgressFor(r1x) * this.mapW;
    const r2 = this.mapX + this.lapProgressFor(r2x) * this.mapW;

    this.mapPinPlayer.position.set(px, this.mapY + this.mapH * 0.5);
    this.mapPinR1.position.set(r1, this.mapY + this.mapH * 0.5);
    this.mapPinR2.position.set(r2, this.mapY + this.mapH * 0.5);

    this.mapLapTick.position.set(this.mapX + this.mapW, this.mapY);
  }

  /* ============================== Pickups ================================ */
  private spawnPickup(){
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite(this.tex.pedal ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 400;
    if (!this.tex.pedal) {
      const g = new PIXI.Graphics().rect(-12,-8,24,16).fill(0x00d2ff);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "distortion" });
  }

  // vida
  private spawnLifePickup() {
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite(this.tex.life ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 420;
    if (!this.tex.life) {
      const g = new PIXI.Graphics().circle(0, 0, 10).fill(0x33dd33);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "life" });
  }

  // ⭐ GOD pickup
  private spawnGodPickup() {
    const x = this.camX + this.W + 220;
    const y = this.playerY - 60;
    const sp = new PIXI.Sprite(this.tex.god ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 840;
    if (!this.tex.god) {
      const g = new PIXI.Graphics().circle(0,0,12).fill(0xffee66).stroke({ width:2, color:0xaa9900 });
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "god" });
  }

  private givePickup(p: Pickup){
    if (p.kind === "distortion") {
      this.hasDistortion = true;
      this.ammo = 10;
      this.updateAmmoHud();
      this.opts.audio?.playOne?.("pickup");
    } else if (p.kind === "life") {
      this.hp = Math.min(this.maxHP, this.hp + 25);
      this.redrawHP();
      this.opts.audio?.playOne?.("pickup");
    } else if (p.kind === "god") {
      if (this.godPickupsSpawned < this.godPickupsMax) {
        this.godPickupsSpawned++;
        this.setGod(true);
        this.opts.audio?.playOne?.("pickupGod");
      }
    }
  }
// Color por posición (1º dorado, 2º plateado, 3º gris)
private colorForPlace(place: number): number {
  if (place === 1) return 0xffd24a;
  if (place === 2) return 0xc0c0c0;
  return 0x7a7a7a;
}

// 🎵 Disparo como "nota musical"
private makeNoteShot(): PIXI.Graphics {
  const col = 0xff00ff;
  const edge = 0xff00ff;
  const g = new PIXI.Graphics();
  g.circle(0, 0, 8).fill(col).stroke({ width: 2, color: edge, alignment: 1 }); // cabeza
  g.roundRect(6, -26, 4, 26, 2).fill(col);                                     // plica
  const flag = new PIXI.Graphics().roundRect(10, -26, 18, 10, 4).fill(col);    // banderín
  flag.alpha = 0.95;
  g.addChild(flag);
  g.rotation = -0.12;
  return g;
}

// 🎧 Disparo reggaetonero: vinilo girando
private makeReggaetonDisc(scale = 4): PIXI.Graphics {
  const g = new PIXI.Graphics();
  const glow = new PIXI.Graphics().circle(0, 0, 16).fill({ color: 0xff33aa, alpha: 0.22 });
  g.addChild(glow);
  g.circle(0, 0, 12).fill(0x111111).stroke({ width: 2, color: 0xffffff, alignment: 1, alpha: 0.6 });
  g.circle(0, 0, 9).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  g.circle(0, 0, 6).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  g.circle(0, 0, 4).fill(0xff33aa);
  g.scale.set(scale); // 👈 agranda
  return g;
}


// Labels de posición (sin flama)
private setupPositionLabels() {
  this.posTextP.anchor.set(0.5, 1);
  this.posTextR1.anchor.set(0.5, 1);
  this.posTextR2.anchor.set(0.5, 1);
  (this.posTextP  as any).zIndex = 2000;
  (this.posTextR1 as any).zIndex = 2000;
  (this.posTextR2 as any).zIndex = 2000;
  this.world.addChild(this.posTextP, this.posTextR1, this.posTextR2);
}

// Ordena por X de mundo y coloca 1/2/3 arriba de la cabeza
private updateRacePositions() {
  const playerWX = this.camX + this.player.x;
  const r1WX = this.rivals[0]?.pos.x ?? -Infinity;
  const r2WX = this.rivals[1]?.pos.x ?? -Infinity;

  const rows = [
    { sp: this.player,        wx: playerWX, label: this.posTextP },
    { sp: this.rivals[0]?.sp, wx: r1WX,     label: this.posTextR1 },
    { sp: this.rivals[1]?.sp, wx: r2WX,     label: this.posTextR2 },
  ].filter(r => r.sp) as { sp: PIXI.Sprite; wx: number; label: PIXI.Text }[];

  rows.sort((a, b) => b.wx - a.wx); // más adelante = mejor posición

  const OFFSET = -36; // separacion sobre la cabeza
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const yTop = r.sp.y - r.sp.height * (r.sp.anchor?.y ?? 0.5);
    r.label.text = String(i + 1);
    (r.label.style as any).fill = this.colorForPlace(i + 1);
    r.label.x = r.sp.x;
    r.label.y = yTop - OFFSET;
  }
}

  /* ============================== Daño player ============================ */
  private hurtPlayer(dmg: number): boolean {
    if (this.invuln > 0 || this.ended || this.finished || this.godMode) return false; // nada de daño en GOD
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime;
    this.redrawHP();
    this.setPlayerTextureHit();
    this.opts.audio?.playOne?.("playerHit");
    if (this.hp <= 0) this.endGame();
    return true; // daño aplicado
  }

  /* ============================== Destroy ================================ */
  destroy() {
    try { this.stage.removeChildren(); } catch {}
    try { this.world.removeChildren(); } catch {}
    try { this.bgLayer.removeChildren(); } catch {}
    try { this.hud.removeChildren(); } catch {}
    for (const e of this.enemies) { try { e.sp.destroy(); } catch {} }
    for (const r of this.rivals)  { try { r.sp.destroy(); } catch {} }
    for (const s of this.shots)   { try { s.sp.destroy(); } catch {} }
    for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
    for (const p of this.pickups) { try { p.sp.destroy(); } catch {} }
    for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
    try { this.posTextP.destroy(); } catch {}
try { this.posTextR1.destroy(); } catch {}
try { this.posTextR2.destroy(); } catch {}
    try { this.godHalo.destroy(); } catch {}
    try { this.trailContainer.destroy({ children: true }); } catch {}
    try { this.stage.destroy({ children: true }); } catch {}
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.opts.audio?.stopSfx?.("motor");
    this.opts.audio?.stopBgm?.();
    this.ready = false;
  }
}
