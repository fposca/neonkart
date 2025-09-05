// src/game/Level3.ts
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
  shootCd: number;  
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
export class Level3 {
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
    this.stage.addChild(this.world);
    this.stage.addChild(this.hud);
    this.stage.addChild(this.overlay);

    this.world.sortableChildren = true;

    // FX Modo Dios
    this.godHalo.visible = false;
    this.godHalo.zIndex = 990;      // debajo del player (1000)
    this.trailContainer.zIndex = 985;
    this.world.addChild(this.trailContainer, this.godHalo);
  }

  /* ===== Estado de carga ===== */
  ready = false;

  /* ===== Viewport / Capas ===== */
  readonly W = 1280;
  readonly H = 720;

  stage = new PIXI.Container();
  bgLayer = new PIXI.Container();
  world = new PIXI.Container();
  hud = new PIXI.Container();
  overlay = new PIXI.Container(); // cuenta regresiva / resultados

  readonly SHOT_Z = 950;             // sobre rivales (700) y enemigos (750), bajo player (1000)
readonly DISC_SCALE_TURRET = 4.0;  // tamaño vinilo torreta
readonly DISC_SCALE_RUNNER = 4.0;  // tamaño vinilo runner
readonly TURRET_CHANCE = 0.35;     // mezcla (ajustable). Si querés ver más torretas, subí este número

/* ===== Escalas (tamaño) ===== */
playerScale = 0.65; // kart del jugador
rivalScale  = 0.65; // Fredy/Doctor
enemyScale  = 0.65; // runners/torretas

  /* ===== Fondo scroll ===== */
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;

  /* ===== Suelo ===== */
  ground!: PIXI.TilingSprite;
  readonly FINISH_Y_OFFSET = 54;

  /* ===== Pista / vueltas (modo distancia, MÁS LARGO) ===== */
  camX = 0;
  trackLength = 9000;            // <- vueltas más largas que L1/L2
  lapFinishX = this.trackLength; // worldX de meta de la vuelta actual
  lapsTotal = 12;                // (puede cambiarse)
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
    text: "VUELTA 1/30",
    style: { fill: 0xfff090, fontSize: 18, fontFamily: "Arial", fontWeight: "900" },
  });

  // Cartel grande de vuelta (cada 5 y las últimas 5; última = mensaje especial)
  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0xffcc00, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0;

  // Power + Timer (visual)
  powerBar = new PIXI.Graphics();
  raceTime = 0; // solo visual
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
    text: "L3",
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

  // invuln / feedback hit
  invuln = 0;
  invulnTime = 0.8;
  hitTimer = 0;
  shootPlayerTimer = 0;

  // Distorsión / pickups
  hasDistortion = false;
  distortTimer = 0;
  distortDuration = 10; // visual (si querés también por tiempo)
  ammo = 0; // <- 10 por pickup
  playerShots: Shot[] = [];
  playerShotCd = 0;
  playerShotCdMax = 0.25;

  // sprites jugador
  tex: Record<string, PIXI.Texture | undefined> = {};

  setPlayerTextureHit() {
    if (this.tex.kartHit) this.player.texture = this.tex.kartHit;
    this.hitTimer = 0.18;
  }
  setPlayerTextureNormal() { if (this.tex.kart) this.player.texture = this.tex.kart; }
  setPlayerTextureDead()   { if (this.tex.kartDead) this.player.texture = this.tex.kartDead; }
  setPlayerTextureShoot() {
    if (this.tex.kartShoot) { this.player.texture = this.tex.kartShoot; this.shootPlayerTimer = 0.12; }
  }

  /* ===== Estados generales ===== */
  overlayTimer: number | null = null;
  ended = false;
  finished = false;

  /* ===== Enemigos ===== */
  enemies: Enemy[] = [];
  enemyTimer = 0;
  enemyMin = 2.4;
  enemyMax = 4.0;

  /* ===== Rivales ===== */
  rivals: Rival[] = [];

  /* ===== Enemigos: disparos ===== */
  shots: Shot[] = []; // enemigos

  /* ===== Pickups ===== */
  pickups: Pickup[] = [];
  pickupTimer = 3.5;
  pickupMin = 6;
  pickupMax = 10;
  // ⬇️ Timers del life (más espaciado que el pedal)
  lifePickupTimer = 9;   // primer spawn ~9s
  lifePickupMin = 12;    // luego 12..
  lifePickupMax = 18;    // ..a 18s

  /* ===== Modo Dios ===== */
  godMode = false;
  godTimer = 0;
  godDuration = 15;       // ⬅ Ajustá la duración acá
  // spawn MUY raro (1 por nivel, 25% chance de 2)
  godPickupTimer = 24;    // primer intento tarde
  godPickupMin = 28;
  godPickupMax = 42;
  godPickupsSpawned = 0;
  godPickupsMax = 1;      // se decide en load()

  // FX: halo + trail
  godHalo = new PIXI.Graphics();
  godHaloPulse = 0;
  trailContainer = new PIXI.Container();
  godTrail: { sp: PIXI.Graphics; life: number; max: number }[] = [];
  godTrailTimer = 0;
  godBurstTimer = 0;

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
  private async tryMany(paths: (string | undefined)[]) { for (const p of paths) { const t = await this.tryLoad(p); if (t) return t; } return undefined; }
  private screenX(worldX: number) { return worldX - this.camX; }
  private clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

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
    this.hpBarFg.clear();
    this.hpBarFg.roundRect(1, 1, 258 * p, 16, 8).fill(p > 0.4 ? 0x33dd66 : 0xdd3344);
  }
  private redrawPower() {
    this.powerBar.clear();
    if (!this.hasDistortion) return;
    const p = Math.max(0, this.distortTimer / this.distortDuration);
    this.powerBar.roundRect(0, 0, 260 * p, 4, 2).fill(0x00d2ff);
  }
  private updateAmmoHud() { this.ammoText.text = this.hasDistortion ? `Ammo: ${this.ammo}` : ""; }
  private updateLapHud() { this.lapText.text = `VUELTA ${this.lap}/${this.lapsTotal}`; }

  // progreso vuelta actual (0..1)
  private lapProgressFor(worldX: number) {
    const baseLapX = (this.lap - 1) * this.trackLength;
    const raw = (worldX - baseLapX) / this.trackLength;
    return this.clamp01(raw);
  }

  private shouldAnnounceLap(lap: number) {
    const last5Start = this.lapsTotal - 5 + 1;
    if (lap >= last5Start) return true;  // todas las últimas 5
    return lap % 5 === 0;                // cada 5 antes de eso
  }
  private showLapAnnounce(txt: string) {
    this.lapAnnounce.text = txt;
    this.lapAnnounce.visible = true;
    this.lapAnnounce.alpha = 1;
    this.lapAnnounceTimer = 2.0;
    this.opts.audio?.playOne?.("countBeep");
  }

  /* ===== Meta: recrear SIEMPRE el sprite según vuelta ===== */
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

    this.finishSprite.position.set(this.screenX(this.lapFinishX), this.ground.y + this.FINISH_Y_OFFSET);
    this.finishSprite.visible = true;
    this.world.addChild(this.finishSprite);
  }

  /* =============================== Carga ================================= */
  async load() {
    // FONDO / SUELO (intenta variantes L3 y cae a L1 si no existen)
    const fondo3 = (IMG as any).fondo3 ?? (IMG as any)["menu-fondo3"] ?? "/assets/img/menu-fondo3.jpg";
    const suelo3 = (IMG as any).suelo3 ?? "/assets/img/suelo3.jpg";
    this.tex.fondo = (await this.tryLoad(fondo3)) ?? (await this.tryLoad(IMG.fondo));
    this.tex.suelo = (await this.tryLoad(suelo3)) ?? (await this.tryLoad(IMG.suelo));

    // Jugador
    this.tex.kart      = await this.tryLoad(IMG.kartSide);
    this.tex.kartHit   = await this.tryLoad(IMG.kartHit);
    this.tex.kartDead  = await this.tryLoad(IMG.kartDead);
    this.tex.kartShoot = await this.tryLoad(IMG.kartShoot);

    // Enemigos (runner/torreta) — soporta arte alternativo si existiera
    this.tex.enemy      = (await this.tryLoad((IMG as any).enemy2Side))  ?? (await this.tryLoad(IMG.regSide));
    this.tex.enemyAtk   = (await this.tryLoad((IMG as any).enemy2Shoot)) ?? (await this.tryLoad(IMG.regShoot));
    this.tex.enemyWreck = (await this.tryLoad((IMG as any).enemy2Wreck)) ?? (await this.tryLoad(IMG.regWreck));

    // RIVALES: Fredy y Doctor con múltiples fallbacks
    this.tex.rival1 =
      (await this.tryMany([
        (IMG as any).kartRivalFredy,
        (IMG as any).kartFreddy,
        (IMG as any).kartFredy,
        (IMG as any).kartingFreddy,
        (IMG as any).kartingFredy,
        (IMG as any)["karting-fredy"],
        (IMG as any)["karting-fredy.png"],
        "/assets/img/karting-fredy.png",
      ])) ?? this.tex.enemy;

    this.tex.rival2 =
      (await this.tryMany([
        (IMG as any).kartRivalDoctor,
        (IMG as any).kartDoctor,
        (IMG as any).kartingDoctor,
        (IMG as any)["karting-doctor"],
        (IMG as any)["karting-doctor.png"],
        "/assets/img/karting-doctor.png",
      ])) ?? this.tex.enemy;

    // Metas
    this.finishTexLap1     = await this.tryLoad((IMG as any).finishLap1);
    this.finishTexLap2     = await this.tryLoad((IMG as any).finishLap2);
    this.finishTexFinal    = await this.tryLoad((IMG as any).finishFinal);
    this.finishTexFallback = await this.tryLoad((IMG as any).finish ?? (IMG as any).finishFinal);

    // Pickups
    this.tex.pedal = await this.tryLoad((IMG as any).pedalDist ?? IMG.pedalDist);
    this.tex.life  = await this.tryLoad((IMG as any).life ?? "/assets/img/life.png");
    this.tex.god   = await this.tryLoad((IMG as any).god ?? "/assets/img/god.png");
    // suerte: a veces puede aparecer un segundo
    this.godPickupsMax = Math.random() < 0.25 ? 2 : 1;

    // Fondo 2x
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

    this.powerBar.position.set(0, 22);
    this.hud.addChild(this.powerBar);

    this.ammoText.position.set(0, 40);
    this.hud.addChild(this.ammoText);

    this.timeText.position.set(200, 40);
    this.hud.addChild(this.timeText);

    this.lapText.position.set(0, 64);
    this.hud.addChild(this.lapText);
    this.updateLapHud();

    this.levelTag.position.set(230, 64);
    this.hud.addChild(this.levelTag);

    // Mini-mapa
    this.mapBg
      .clear()
      .roundRect(this.mapX, this.mapY, this.mapW, this.mapH, 3)
      .fill(0x2a2a2a)
      .stroke({ width: 2, color: 0x000000 });
    this.mapPinPlayer.clear().circle(0, 0, 3).fill(0x00d2ff);
    this.mapPinR1.clear().circle(0, 0, 2.5).fill(0xff7f00);
    this.mapPinR2.clear().circle(0, 0, 2.5).fill(0x00ff66);
    this.mapLapTick.clear().rect(-1, -6, 2, this.mapH + 12).fill(0xffffff);
    this.hud.addChild(this.mapBg, this.mapPinPlayer, this.mapPinR1, this.mapPinR2, this.mapLapTick);

    // ticks decorativos
    const tick = (p: number) => {
      const g = new PIXI.Graphics().rect(-1, -4, 2, this.mapH + 8).fill(0x3a3a3a);
      g.position.set(this.mapX + p * this.mapW, this.mapY);
      this.hud.addChild(g);
    };
    tick(0.25); tick(0.50); tick(0.75);

    // Cartel de anuncio
    this.lapAnnounce.anchor.set(0.5);
    this.lapAnnounce.position.set(this.W/2, this.H/2 - 100);
    this.lapAnnounce.visible = false;
    this.stage.addChild(this.lapAnnounce);

    // Meta inicial
    this.setFinishTextureForLap(1);

    // Rivales (ahora Fredy y Doctor)
    this.spawnRivalsAtStart();
    this.setupPositionLabels();

    // Enemigos
    this.nextEnemyIn();

    // Pickups
    this.updateAmmoHud(); this.redrawPower();

    // Overlay oculto (countdown lo arma abajo)
    this.overlay.visible = false;

    // Timer visual
    this.raceTime = 0;
    this.timeText.text = "00:00.000";

    // Sonidos (mismos que L1)
    this.opts.audio?.playBgmLevel1?.();
    this.opts.audio?.playSfx?.("motor");

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

    // Panel con más padding, fondo negro alpha .4 y borde grueso
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
    // reset del estilo de texto por si venía de otra corrida
(this.countdownText.style as any).fill = 0xffffff;
this.countdownText.alpha = 1;

// estado inicial del semáforo: solo ROJO encendido
this.setTrafficLights(true, false, false);
// si querés beep inicial, descomentá:
// this.opts.audio?.playOne?.("countBeep");
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
    const r1: Rival = { sp: mk(this.tex.rival1), pos: { x: startWorldX + 40, y: this.playerY - 6 }, speed: this.baseSpeed, base: 485, amp: 45, phase: Math.random()*Math.PI*2 };
    const r2: Rival = { sp: mk(this.tex.rival2), pos: { x: startWorldX - 40, y: this.playerY + 6 }, speed: this.baseSpeed, base: 470, amp: 35, phase: Math.random()*Math.PI*2 };
    this.rivals.push(r1, r2);
    for (const r of this.rivals) { r.sp.x = this.screenX(r.pos.x); r.sp.y = r.pos.y; }
  }

  // Enemigo runner (viene “en contra” como en L1)
  private spawnRunner() {
    const margin = 240;
    const x = this.camX + this.W + margin;
    const y = this.playerY;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 750;
    sp.scale.set(this.enemyScale); // 👈
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0x27ae60);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    // velocidad relativa con variación
    const rel = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 80);
    const e: Runner = {
      kind: "runner", sp, pos: { x, y }, speed: this.baseSpeed + rel, hp: 3, dead: false, shootFlash: 0,
      shootCd: 0
    };
    this.enemies.push(e);
  }

  // Enemigo torreta (queda a un lado y dispara)
  private spawnTurret() {
    const margin = 260;
    const x = this.camX + this.W + margin;
    const y = this.playerY - 24;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 750;
    sp.scale.set(this.enemyScale); 
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0xc0392b);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const e: Turret = { kind: "turret", sp, pos: { x, y }, shootCd: 0.6 + Math.random()*0.8, hp: 2, dead: false };
    this.enemies.push(e);
  }

 private spawnEnemy() {
  if (Math.random() < this.TURRET_CHANCE) this.spawnTurret();
  else this.spawnRunner();
}


  private enemyShoot(from: Enemy) {
  if (from.dead) return;

  // mundo → mundo (sin mezclar screenX en el ángulo)
  const sxW = from.pos.x,        sy = from.pos.y - 24;
  const dxW = this.camX + this.player.x, dy = this.player.y - 10;
  const ang = Math.atan2(dy - sy, dxW - sxW);
  const v = 430;

  // vinilo grande para ambos; podés diferenciar tamaños si querés
  const size = from.kind === "turret" ? this.DISC_SCALE_TURRET : this.DISC_SCALE_RUNNER;
  const gfx = this.makeReggaetonDisc(size);

  const shot: Shot = {
    sp: gfx,
    pos: { x: sxW, y: sy },          // posición en mundo
    vx: Math.cos(ang) * v,
    vy: Math.sin(ang) * v,
  };

  // giro
  (shot.sp as any).rotSpeed = Math.random() < 0.5 ? -8 : 8;

  // mundo → pantalla en X
  shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
  shot.sp.zIndex = this.SHOT_Z;

  this.world.addChild(shot.sp);
  this.shots.push(shot);

  this.opts.audio?.playOne?.("enemyShoot");

  if (this.tex.enemyAtk && !from.dead) {
    from.sp.texture = this.tex.enemyAtk;
    setTimeout(() => { if (!from.dead && this.tex.enemy) from.sp.texture = this.tex.enemy; }, 180);
  }
}



  /* =================== Fin / Overlays con auto-hide 3s =================== */
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
  
    // 👇 aire dinámico debajo del título (sirve cuando es “1º”)
    const EXTRA_GAP = 34; // ajustá a gusto (30–40 va bien)
    const yDebajoDelTitulo = title.y + (title.height * 0.5) + EXTRA_GAP;
    time.position.set(this.W / 2, yDebajoDelTitulo);
  
    this.overlay.addChild(time);
    this.overlay.visible = true;
  }

private levelComplete(place: 1 | 2 | 3) {
  if (this.finished) return;
  this.finished = true;
  this.controlsLocked = true;

  // FREEZE combate / spawns
  this.invuln = 9999;
  this.enemyTimer = 9999;
  // destruir proyectiles para que no queden flotando
  for (const s of this.shots)       { try { s.sp.destroy(); } catch {} }
  for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
  this.shots = [];
  this.playerShots = [];

  // ⛔ NO paramos el BGM: queremos "como L2" con música de fondo
  // si querés cortar solo el motor, descomentá:
  // this.opts.audio?.stopSfx?.("motor");

  const label = place === 1 ? "¡1º!" : place === 2 ? "2º" : "3º";
  this.showResultOverlay(label);

  if (this.overlayTimer) clearTimeout(this.overlayTimer);
  this.overlayTimer = window.setTimeout(() => {
    this.overlay.visible = false;
    this.opts.onLevelComplete?.(place);
  }, 2500); // mismo timing que L2
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
    // seguridad: cortar motor
    this.opts.audio?.stopSfx?.("motor");
  }

  /* ============================== GOD mode =============================== */
    private setGod(on: boolean) {
    this.godMode = on;
    if (on) {
      this.godTimer = this.godDuration;
      (this.player as any).tint = 0xffee66;

      // halo visible
      this.drawGodHalo();
      this.godHalo.visible = true;
      this.godHalo.alpha = 0.5;
      this.godHaloPulse = 0;

      // reset de ráfagas automáticas
      this.godBurstTimer = 0.05;

      // cartel
      this.showLapAnnounce("¡MODO DIOS!");
    } else {
      (this.player as any).tint = 0xffffff;
      this.godHalo.visible = false;

      // 🔥 limpiar cualquier trazo que haya quedado
      for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
      this.godTrail.length = 0;
      try { this.trailContainer.removeChildren(); } catch {}
    }
  }


  private drawGodHalo() {
    this.godHalo.clear();
    // halo doble elíptico detrás del kart
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 70, 36).fill({ color: 0xffd200, alpha: 0.22 });
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 44, 18).fill({ color: 0xffffaa, alpha: 0.18 });
    this.godHalo.zIndex = 990;
  }

  private emitGodTrail() {
    // dos nubecitas por tick
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
    if (this.finished) return;

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

      // mantener las 3 encendidas durante el GO
      this.setTrafficLights(true, true, true);
      // si preferís solo verde: this.setTrafficLights(false, false, true);

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

    // Distorsión por tiempo (visual)
    if (this.hasDistortion) {
      this.distortTimer -= dt;
      if (this.distortTimer <= 0) { this.hasDistortion = false; this.redrawPower(); }
    }

    // GOD MODE: tiempo + FX
       if (this.godMode) {
      this.godTimer -= dt;
      if (this.godTimer <= 0) {
        this.setGod(false);
      } else {
        // halo sigue al jugador
        this.godHalo.position.set(this.player.x, 0);
        this.drawGodHalo();
        // pulso
        this.godHaloPulse += dt * 3;
        const k = 0.5 + 0.2 * Math.sin(this.godHaloPulse * 4);
        this.godHalo.alpha = k;

        // trail
        this.godTrailTimer -= dt;
        if (this.godTrailTimer <= 0) {
          this.emitGodTrail();
          this.godTrailTimer = 0.03; // ~30-35 fps de partículas
        }

        // 👉 ráfaga automática “fueguito” (como en L1/L2)
        this.godBurstTimer -= dt;
        if (this.godBurstTimer <= 0) {
          this.emitGodBurst();                 // dispara una ráfaga
          this.godBurstTimer = 0.22;           // cadencia
        }
      }
    }

    // 👉 actualizar y limpiar el trail del modo dios
    for (const t of this.godTrail) {
      t.life -= dt;
      const p = Math.max(0, t.life / t.max);
      t.sp.alpha = p;
      t.sp.x -= 160 * dt;                      // arrastra un poquito hacia la izquierda
      const s = 0.6 + 0.4 * p;                 // se achican al morir
      t.sp.scale.set(s, s);
    }
    this.godTrail = this.godTrail.filter(t => {
      const alive = t.life > 0;
      if (!alive) { try { t.sp.destroy(); } catch {} }
      return alive;
    });


    // Fade del anuncio de vuelta
    if (this.lapAnnounceTimer > 0) {
      this.lapAnnounceTimer -= dt;
      const t = Math.max(0, this.lapAnnounceTimer);
      const total = 2.0;
      this.lapAnnounce.alpha = t / total;
      if (this.lapAnnounceTimer <= 0) this.lapAnnounce.visible = false;
    }

    // velocidad / lateral (x2 en Modo Dios)
    const accelPressed = this.input.a.right && !this.controlsLocked;
    const boost = this.godMode ? 2.0 : 1.0;
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

    // disparo jugador (solo si tenés el pickup activo y munición)
    const shootPressed = (this.input as any).a.fire2 || (this.input as any).a.ctrl || (this.input as any).a.F;
    if (!this.controlsLocked && shootPressed && this.hasDistortion && this.playerShotCd <= 0 && this.ammo > 0) {
      const sx = this.player.x + 40;
      const sy = this.player.y - 24;
      const speed = 900;
const gfx = this.makeNoteShot(); // 🎵
      const shot: Shot = { sp: gfx, pos: { x: this.camX + sx, y: sy }, vx: speed, vy: 0 };
      shot.sp.position.set(sx, sy);
      shot.sp.zIndex = 800;
      this.world.addChild(shot.sp);
      this.playerShots.push(shot);
      this.playerShotCd = this.playerShotCdMax;
      this.setPlayerTextureShoot();
      this.opts.audio?.playOne?.("playerShoot");

      // gastar bala
      this.ammo--; this.updateAmmoHud();
      if (this.ammo <= 0) { this.hasDistortion = false; this.redrawPower(); }
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

    // vueltas (solo distancia)
    const playerWorldX = this.camX + this.player.x;
    while (!this.finished && !this.controlsLocked && playerWorldX >= this.lapFinishX) {
      if (this.lap < this.lapsTotal) {
        this.lap += 1;
        this.updateLapHud();

        if (this.lap === this.lapsTotal) {
          this.showLapAnnounce("¡ÚLTIMA VUELTA!");
        } else if (this.shouldAnnounceLap(this.lap)) {
          this.showLapAnnounce(`VUELTA ${this.lap}`);
        }

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

    /* ===== Rivales ===== */
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

// ✅ llamalo una vez acá, ya con player y rivales posicionados
this.updateRacePositions();
  

    /* ===== Enemigos ===== */
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.controlsLocked) { this.spawnEnemy(); this.nextEnemyIn(); }

    for (const e of this.enemies) {
      if (e.kind === "runner") {
        e.shootCd -= dt;
if (e.shootCd <= 0 && !e.dead && !this.controlsLocked) {
  this.enemyShoot(e);
  e.shootCd = 0.7 + Math.random() * 0.7;
}
        // runners vienen “hacia vos”
        e.pos.x -= e.speed * dt;
        e.sp.x = this.screenX(e.pos.x);
        e.sp.y = this.playerY;

        const R = e as Runner;
        if (R.shootFlash > 0) {
          R.shootFlash -= dt;
          if (R.shootFlash <= 0 && !R.dead && this.tex.enemy) e.sp.texture = this.tex.enemy;
        }

        // colisión con jugador (si no está muerto)
        if (!e.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds();
          const eb = e.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 50 * dt * 60;
            e.pos.x += 100 * dt;
            const minKeep = this.baseSpeed * 0.7; if (this.speed < minKeep) this.speed = minKeep;

            // sonamos sólo si realmente aplicó daño
            if (this.hurtPlayer(6)) {
              this.opts.audio?.playOne?.("crash");
            }
          }
        }
      } else {
        // torretas: quedan fijas (se “alejan” por la cámara)
        e.pos.x -= this.baseSpeed * dt * 0.2;
        e.sp.x = this.screenX(e.pos.x);
        e.sp.y = e.pos.y;

        // disparo periódico
        e.shootCd -= dt;
        if (e.shootCd <= 0 && !e.dead && !this.controlsLocked) {
          this.enemyShoot(e);
          e.shootCd = 0.7 + Math.random() * 0.7;
        }

        // colisión con jugador si no está muerta
        if (!e.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds();
          const eb = e.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 50 * dt * 60;
            if (this.hurtPlayer(8)) {
              this.opts.audio?.playOne?.("crash");
            }
          }
        }
      }
    }

    // disparo enemigo (balas)
    for (const s of this.shots) {
      s.pos.x += s.vx * dt;
      s.pos.y += s.vy * dt;
        // rotación del vinilo (si existe rotSpeed)
  const rs = (s.sp as any).rotSpeed ?? 0;
  if (rs) s.sp.rotation += rs * dt;
      s.sp.x = this.screenX(s.pos.x);
      s.sp.y = s.pos.y;

      const pb = this.player.getBounds(), sb = s.sp.getBounds();
      const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
      if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
        if (this.hurtPlayer(12)) this.opts.audio?.playOne?.("impact"); // ⬅️ gateado
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

    // ⬇️ timer independiente para vida
    this.lifePickupTimer -= dt;
    if (this.lifePickupTimer <= 0 && !this.controlsLocked) {
      this.spawnLifePickup();
      this.lifePickupTimer = this.lifePickupMin + Math.random() * (this.lifePickupMax - this.lifePickupMin);
    }

    // ⭐ GOD pickup raro
    this.godPickupTimer -= dt;
    if (this.godPickupsSpawned < this.godPickupsMax && this.godPickupTimer <= 0 && !this.controlsLocked) {
      this.spawnGodPickup();
      // reinicia el temporizador; la cuenta de “spawned” se hace al agarrarlo
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

    // disparos del jugador contra enemigos
    for (const s of this.playerShots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
      s.sp.rotation = Math.sin(s.pos.x * 0.02) * 0.25;


      for (const e of this.enemies) {
        if (e.dead) continue;
        const eb = e.sp.getBounds(), sb = s.sp.getBounds();
        const hit = sb.right > eb.left && sb.left < eb.right && sb.bottom > eb.top && sb.top < eb.bottom;
        if (hit) {
          // daño
          e.hp -= 1;
          e.sp.alpha = 0.85; setTimeout(() => { e.sp.alpha = 1; }, 60);
          s.pos.x = this.camX + this.W + 9999;

          if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            if (this.tex.enemyWreck) e.sp.texture = this.tex.enemyWreck;

            // runner: se “va” hacia la izquierda y lo culleamos pronto
            if (e.kind === "runner") {
              (e as Runner).speed = this.baseSpeed * 0.8;
            }
          }
        }
      }
    }
    this.playerShots = this.playerShots.filter(s => { const alive = s.pos.x < this.camX + this.W + 300; if (!alive) s.sp.destroy(); return alive; });

    // culling enemigos (incluye muertos)
    this.enemies = this.enemies.filter(e => { const alive = e.pos.x > this.camX - 600; if (!alive) e.sp.destroy(); return alive; });

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
    sp.zIndex = 800;
    if (!this.tex.pedal) {
      const g = new PIXI.Graphics().rect(-12,-8,24,16).fill(0x00d2ff);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "distortion" });
  }

  // ⬇️ pickup de vida
  private spawnLifePickup() {
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite(this.tex.life ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 800;
    if (!this.tex.life) {
      const g = new PIXI.Graphics().circle(0, 0, 10).fill(0x33dd33);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "life" });
  }

  // ⭐ GOD pickup (muy raro)
  private spawnGodPickup() {
    if (this.godPickupsSpawned >= this.godPickupsMax) return;
    const x = this.camX + this.W + 220;
    const y = this.playerY - 60;
    const sp = new PIXI.Sprite(this.tex.god ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 820;
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
      this.distortTimer = this.distortDuration;
      this.ammo = 10; // <- 10 tiros
      this.updateAmmoHud();
      this.opts.audio?.playOne?.("pickup");
      this.redrawPower();
    } else if (p.kind === "life") {
      this.hp = Math.min(this.maxHP, this.hp + 25);
      this.redrawHP();
      this.opts.audio?.playOne?.("pickupLife");
    } else if (p.kind === "god") {
      this.setGod(true);
      this.godPickupsSpawned++; // cuenta esta toma
      this.opts.audio?.playOne?.("pickupGod"); // SFX dedicado
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
  const col = 0xff00ff;   // color principal
  const edge = 0xff00ff;  // contorno

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
  g.scale.set(scale);  // 👈 duplica / cuadruplica el tamaño
  return g;
}
// 🔥 Disparo tipo "fueguito" con glow
private makeFlameShot(): PIXI.Graphics {
  const g = new PIXI.Graphics();
  const glow = new PIXI.Graphics().circle(0, 0, 10)
    .fill({ color: 0xff7a1a, alpha: 0.22 });
  g.addChild(glow);

  g.circle(0, 0, 6).fill(0xff9933)
    .stroke({ width: 2, color: 0xffd24a, alignment: 1, alpha: 0.9 });
  // cola
  g.roundRect(-8, -2, 8, 4, 2).fill(0xffc266);
  return g;
}

// 💥 Emite una ráfaga en abanico hacia delante
private emitGodBurst() {
  const sx = this.player.x + 44;
  const sy = this.player.y - 18;

  // 5–6 proyectiles con pequeña dispersión vertical
  const N = 6;
  for (let i = 0; i < N; i++) {
    const g = this.makeFlameShot();
    const vx = 1000 + Math.random() * 260;      // velocidad alta
    const vy = (Math.random() - 0.5) * 220;     // leve abanico vertical

    const shot: Shot = {
      sp: g,
      pos: { x: this.camX + sx, y: sy },
      vx, vy,
    };

    g.position.set(sx, sy);
    g.zIndex = 820; // por arriba de enemigos
    this.world.addChild(g);
    this.playerShots.push(shot);
  }

  // Reutilizamos un SFX existente (evitamos depender de uno nuevo)
  this.opts.audio?.playOne?.("playerShoot");
}


// ===== Labels de posición (sin flama)
private setupPositionLabels() {
  this.posTextP.anchor.set(0.5, 1);
  this.posTextR1.anchor.set(0.5, 1);
  this.posTextR2.anchor.set(0.5, 1);
  (this.posTextP  as any).zIndex = 2000;
  (this.posTextR1 as any).zIndex = 2000;
  (this.posTextR2 as any).zIndex = 2000;
  this.world.addChild(this.posTextP, this.posTextR1, this.posTextR2);
}

// Ordena por X “de mundo” y coloca 1/2/3 arriba de la cabeza
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

  const OFFSET = -36; // separacion por encima de la cabeza
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
    if (this.invuln > 0 || this.ended || this.finished || this.godMode) return false; // ⬅️ nada de daño
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime;
    this.redrawHP();
    this.setPlayerTextureHit();
    this.opts.audio?.playOne?.("playerHit");
    if (this.hp <= 0) this.endGame();
    return true; // ⬅️ daño aplicado
  }

  /* ============================== Destroy ================================ */
  destroy() {
    try { this.stage.removeChildren(); } catch {}
    try { this.world.removeChildren(); } catch {}
    try { this.bgLayer.removeChildren(); } catch {}
    try { this.posTextP.destroy(); } catch {}
try { this.posTextR1.destroy(); } catch {}
try { this.posTextR2.destroy(); } catch {}
    try { this.hud.removeChildren(); } catch {}
    for (const e of this.enemies) { try { e.sp.destroy(); } catch {} }
    for (const r of this.rivals)  { try { r.sp.destroy(); } catch {} }
    for (const s of this.shots)   { try { s.sp.destroy(); } catch {} }
    for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
    for (const p of this.pickups) { try { p.sp.destroy(); } catch {} }
    for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
    try { this.godHalo.destroy(); } catch {}
    try { this.trailContainer.destroy({ children: true }); } catch {}
    try { this.stage.destroy({ children: true }); } catch {}
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.opts.audio?.stopSfx?.("motor");
    this.ready = false;
  }
}
