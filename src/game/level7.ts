/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/game/Level7.ts
import * as PIXI from "pixi.js";
import { IMG } from "./assets";
import { Input } from "./input";
import type { AudioBus } from "./audio";
import { getTuning } from "./difficulty";
import { getSkin } from "./skins";

/* =============================== Tipos =================================== */
type Vec2 = { x: number; y: number };

type Runner = {
  kind: "runner";
  sp: PIXI.Sprite;
  pos: Vec2;
  speed: number;
  hp: number;
  dead: boolean;
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
type Rival = { sp: PIXI.Sprite; pos: Vec2; speed: number; base: number; amp: number; phase: number };

type Meteor = { sp: PIXI.Graphics; pos: Vec2; vx: number; vy: number; alive: boolean };
type Pickup = { sp: PIXI.Sprite; pos: Vec2; kind: "distortion" | "life" | "god" | "shield" };

type LevelOpts = {
  onGameOver?: () => void;
  onLevelComplete?: (place: 1 | 2 | 3) => void;
  audio?: AudioBus;
  difficulty?: import("./difficulty").DifficultyId; // 👈
  skin?: import("./skins").SkinId;
};

/* ============================== Clase ==================================== */
export class Level7 {
  /* ===== Core ===== */
  app: PIXI.Application;
  input: Input;
  opts: LevelOpts;
  constructor(app: PIXI.Application, input: Input, opts: LevelOpts = {}) {
    this.app = app;
    this.input = input;
    this.opts = opts;
    this.tuning = getTuning(opts.difficulty);
    this.skinDef = getSkin(opts.skin);

    this.app.stage.addChild(this.stage);
    this.stage.addChild(this.bgLayer, this.world, this.hud, this.overlay);

    this.world.sortableChildren = true;

    // FX Modo Dios
    this.godHalo.visible = false;
    (this.godHalo as any).zIndex = 990;
    (this.trailContainer as any).zIndex = 985;
    this.world.addChild(this.trailContainer, this.godHalo);
  }

  /* ===== Estado ===== */
  ready = false;

  /* ===== Viewport / Capas ===== */
  readonly W = 1280;
  readonly H = 720;
  stage = new PIXI.Container();
  bgLayer = new PIXI.Container();
  world = new PIXI.Container();
  hud = new PIXI.Container();
  overlay = new PIXI.Container();

  /* ===== Escalas (visual) ===== */
  playerScale = 0.58;
  rivalScale = 0.60;
  enemyScale = 0.58;

  /* ===== Fondo / Suelo ===== */
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;
  ground!: PIXI.TilingSprite;

  /* ===== Meta (arcos) ===== */
  private readonly FINISH_Y_OFFSET = 54;
  private finishSprite!: PIXI.Sprite | PIXI.Graphics;
  private finishTexLap?: PIXI.Texture;
  private finishTexFinal?: PIXI.Texture;
  private tuning!: ReturnType<typeof getTuning>;
  private skinDef!: ReturnType<typeof getSkin>;

  /* ===== Pista / vueltas ===== */
  camX = 0;
  trackLength = 32000;
  lapFinishX = this.trackLength;
  lapsTotal = 3;
  lap = 1;

  /* ===== HUD ===== */
  hpBarBg = new PIXI.Graphics();
  hpBarFg = new PIXI.Graphics();
  maxHP = 100;
  hp = 100;

  powerBar = new PIXI.Graphics();
  ammoText = new PIXI.Text({ text: "", style: { fill: 0x00d2ff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" } });
  timeText = new PIXI.Text({ text: "00:00.000", style: { fill: 0xffffff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" } });
  lapText = new PIXI.Text({ text: "VUELTA 1/6", style: { fill: 0xbfe8ff, fontSize: 18, fontFamily: "Arial", fontWeight: "900" } });
  levelTag = new PIXI.Text({ text: "L7", style: { fill: 0xccccff, fontSize: 12, fontFamily: "Arial", fontWeight: "700" } });
  /* ===== Shield (escudo) ===== */
  shieldOn = false;
  shieldCharges = 0;
  shieldMaxCharges = 5;
  shieldFlash = 0;

  shieldLabel = new PIXI.Text({
    text: "SHIELD",
    style: { fill: 0x00d2ff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });
  shieldText = new PIXI.Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });
  // Cartel grande
  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0x88c8ff, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0;
  /* ===== Posición sobre la cabeza ===== */
  posLabelP = new PIXI.Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true }
  });
  posLabelR1 = new PIXI.Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true }
  });
  posLabelR2 = new PIXI.Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true }
  });


  /* ===== Mini-mapa ===== */
  mapBg = new PIXI.Graphics();
  mapW = 560;
  mapH = 6;
  mapX = 640 - this.mapW / 2;
  mapY = 16;
  mapPinPlayer = new PIXI.Graphics();
  mapPinR1 = new PIXI.Graphics();
  mapPinR2 = new PIXI.Graphics();
  mapLapTick = new PIXI.Graphics();

  /* ===== Jugador ===== */
  player: PIXI.Sprite = new PIXI.Sprite();
  playerX = 360;
  playerY = 540;
  minX = 120;
  // Límite de avance visible: no pasa del 50% de la pantalla
  maxX = Math.floor(this.W * 0.66);


  // Espacio: más inercia, menos fricción y baja gravedad
  speed = 0;
  baseSpeed = 240;   // antes 200 — sube el piso de velocidad
  maxSpeed = 380;   // antes 360 — un poco más de techo
  accel = 420;   // antes 300 — acelera más rápido
  friction = 200;   // antes 260 — pierde menos cuando sueltas

  // Lateral (deriva)
  strafe = 380;
  lateralVel = 0;
  lateralFriction = 20;

  // “Salto” → thruster vertical (baja gravedad)
  jumping = false;
  jumpVy = 0;
  jumpOffset = 0;
  jumpImpulse = 900;
  gravity = 950;
  jumpCooldown = 0.45;
  jumpCdTimer = 0;
  jumpMaxFactor = 1.0;  // limitar Vmáx mientras flotás
  jumpAccelFactor = 1.0; // limitar accel mientras flotás
  godBoost = 1.4; // boost de velocidad en God Mode


  // Empuje hacia atrás (meteorito)
  backPushTimer = 0;
  backPushDuration = .5;

  // feedback daño
  invuln = 0;
  invulnTime = 0.8;
  hitTimer = 0;
  shootPlayerTimer = 0;

  // Distortion / ammo
  hasDistortion = false;
  distortTimer = 0;
  distortDuration = 10;
  ammo = 0;
  playerShots: Shot[] = [];
  playerShotCd = 0;
  playerShotCdMax = 0.25;

  // sprites jugador
  tex: Record<string, PIXI.Texture | undefined> = {};
  setPlayerTextureNormal() { if (this.tex.kart) this.player.texture = this.tex.kart; }
  setPlayerTextureHit() { if (this.tex.kartHit) { this.player.texture = this.tex.kartHit; this.hitTimer = 0.18; } }
  setPlayerTextureDead() { if (this.tex.kartDead) this.player.texture = this.tex.kartDead; }
  setPlayerTextureShoot() { if (this.tex.kartShoot) { this.player.texture = this.tex.kartShoot; this.shootPlayerTimer = 0.12; } }

  /* ===== Enemigos ===== */
  enemies: Enemy[] = [];
  enemyTimer = 0;
  baseEnemyMin = 2.5;
  baseEnemyMax = 4.5;

  get enemyMin() { return this.baseEnemyMin / this.tuning.enemyMultiplier; }
  get enemyMax() { return this.baseEnemyMax / this.tuning.enemyMultiplier; }
  runnerFactorMin = 0.75; // 55% de tu baseSpeed
  runnerFactorMax = 0.95; // 75% de tu baseSpeed
  minRunnerScreenSpeed = 240;


  /* ===== Disparos enemigos ===== */
  shots: Shot[] = [];

  /* ===== Rivales ===== */
  rivals: Rival[] = [];

  /* ===== Meteoritos (obstáculo) ===== */
  meteors: Meteor[] = [];
  meteorTimer = 1.2;
  meteorMin = 0.9;
  meteorMax = 1.6;
// ---- Turbo (boost) ----
boostTimer = 0;            // tiempo restante de turbo
boostDuration = 2.0;       // segundos por pickup
boostFactor = 1.30;        // multiplicador de velocidad
  /* ===== Viento solar (evento global) ===== */
  windTimer = 6;
  windMin = 8;
  windMax = 14;
  windActive = 0;           // tiempo restante de ráfaga
  windStrength = 0;         // ±(px/s) que se suma a velocidades

  /* ===== Modo Dios ===== */
  godMode = false;
  godTimer = 0;
  godDuration = 4;
  godPickupTimer = 24;
  godPickupMin = 28;
  godPickupMax = 42;
  godPickupsSpawned = 0;
  godPickupsMax = 1;
  godHalo = new PIXI.Graphics();
  godHaloPulse = 0;
  trailContainer = new PIXI.Container();
  godTrail: { sp: PIXI.Graphics; life: number; max: number }[] = [];
  godTrailTimer = 0;
  godBurstTimer = 0;

  /* ===== Overlays / fin ===== */
  overlayTimer: number | null = null;
  ended = false;
  finished = false;
  raceTime = 0;

  /* ===== Countdown / Semáforo ===== */
  controlsLocked = true;
  countdown = 3;
  countdownTimer = 1.0;
  countdownText = new PIXI.Text({
    text: "3",
    style: { fill: 0xffffff, fontSize: 128, fontFamily: "Arial", fontWeight: "900", align: "center", dropShadow: true },
  });
  goFlashTimer = 0;
  traffic = new PIXI.Container();
  lampRed = new PIXI.Graphics();
  lampYellow = new PIXI.Graphics();
  lampGreen = new PIXI.Graphics();

  /* ============================ Helpers ================================== */
  private shieldPickupTimer = 14; shieldPickupMin = 16; shieldPickupMax = 26;

  private spawnShieldPickup() {
    const x = this.camX + this.W + 210, y = this.playerY - 48;
    const sp = new PIXI.Sprite((this.tex as any).shield ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5); (sp as any).zIndex = 800;
    if (!(this.tex as any).shield) {
      const g = new PIXI.Graphics().circle(0, 0, 11).fill(0x00d2ff).stroke({ width: 2, color: 0xffffff });
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "shield" });
  }

  private setShield(on: boolean) {
    this.shieldOn = on;
    // HUD siempre visible; manejamos “apagado” con alpha/número 0
    this.shieldLabel.visible = true;
    this.shieldText.visible = true;
  }

  private updateShieldHud() {
    this.shieldText.text = `x${this.shieldCharges}`;
    this.shieldText.x = this.shieldLabel.x + this.shieldLabel.width + 6;
    this.shieldText.y = this.shieldLabel.y;

    const has = this.shieldCharges > 0;
    const alpha = this.shieldFlash > 0 ? 1 : (has ? 1 : 0.5);
    this.shieldLabel.alpha = alpha;
    this.shieldText.alpha = alpha;
  }

  private async tryLoad(url?: string) { if (!url) return undefined; try { return await PIXI.Assets.load(url); } catch { return undefined; } }
  private async tryMany(paths: (string | undefined)[]) { for (const p of paths) { const t = await this.tryLoad(p); if (t) return t; } return undefined; }
  private screenX(worldX: number) { return worldX - this.camX; }
  private fmt(ms: number) {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), mil = Math.floor(ms % 1000);
    const p2 = (n: number) => (n < 10 ? `0${n}` : `${n}`), p3 = (n: number) => n.toString().padStart(3, "0");
    return `${p2(m)}:${p2(s)}.${p3(mil)}`;
  }

  private redrawHP() {
    const p = Math.max(0, this.hp / this.maxHP);
    const col = (this.hp < 30)        // ← umbral absoluto 30
      ? 0xff5a5a                      // rojo “peligro”
      : (p > 0.4 ? 0x66ddff : 0x66aaff); // colores anteriores

    this.hpBarFg.clear();
    this.hpBarFg.roundRect(1, 1, 258 * p, 16, 8).fill(col);
  }

  private redrawPower() {
    this.powerBar.clear();
    if (!this.hasDistortion) return;
    const p = Math.max(0, this.distortTimer / this.distortDuration);
    this.powerBar.roundRect(0, 0, 260 * p, 4, 2).fill(0x00d2ff);
  }
  private updateAmmoHud() { this.ammoText.text = this.hasDistortion ? `Ammo: ${this.ammo}` : ""; }
  private updateLapHud() { this.lapText.text = `VUELTA ${this.lap}/${this.lapsTotal}`; }
  private shouldAnnounceLap(lap: number) { const last5Start = this.lapsTotal - 5 + 1; return lap >= last5Start || lap % 5 === 0; }
  private showLapAnnounce(txt: string) {
    this.lapAnnounce.text = txt; this.lapAnnounce.visible = true; this.lapAnnounce.alpha = 1; this.lapAnnounceTimer = 2.0;
    this.opts.audio?.playOne?.("countBeep");
  }

  /* ===== Mini-mapa helpers ===== */
  private lapProgressFor(worldX: number) {
    const baseLapX = (this.lap - 1) * this.trackLength;
    const raw = (worldX - baseLapX) / this.trackLength;
    return Math.max(0, Math.min(1, raw));
  }
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

  /* ===== Meta por vuelta ===== */
  private setFinishTextureForLap(lap: number) {
    let t: PIXI.Texture | undefined;
    if (lap < this.lapsTotal) t = this.finishTexLap ?? this.finishTexFinal;
    else t = this.finishTexFinal ?? this.finishTexLap;

    // eslint-disable-next-line no-empty
    if (this.finishSprite) { try { this.finishSprite.destroy({ children: true }); } catch { } }

    if (t) {
      const s = new PIXI.Sprite(t);
      s.anchor.set(0.5, 1); s.zIndex = 750; this.finishSprite = s;
    } else {
      const g = new PIXI.Graphics().rect(-6, -100, 12, 100).fill(0xffffff);
      g.zIndex = 750; this.finishSprite = g;
    }
    this.finishSprite.position.set(this.screenX(this.lapFinishX), this.ground.y + this.FINISH_Y_OFFSET);
    this.finishSprite.visible = true; this.world.addChild(this.finishSprite);
  }

  /* =============================== Carga ================================= */
  async load() {
    // Fondo / “Suelo” espacial (fallbacks)
    this.tex.fondo = await this.tryMany([(IMG as any).fondoSpace, "/assets/img/fondo-space.jpg", IMG.fondo]);
    this.tex.suelo = await this.tryMany([(IMG as any).sueloSpace, "/assets/img/suelo-space.png", IMG.suelo]);

    // Jugador (nave)
    this.tex.kart = await this.tryMany([(IMG as any).kartSpaceFront, "/assets/img/karting-frente-space.png", (IMG as any).kartSide, IMG.kartSide]);
    this.tex.kartHit = await this.tryMany([(IMG as any).kartSpaceHit, "/assets/img/karting-pain-space.png", (IMG as any).kartHit, IMG.kartHit]);
    this.tex.kartDead = await this.tryMany([(IMG as any).kartSpaceDead, "/assets/img/karting-die-space.png", (IMG as any).kartDead, IMG.kartDead]);
    this.tex.kartShoot = await this.tryMany([(IMG as any).kartSpaceShoot, "/assets/img/karting-attack-space.png", (IMG as any).kartShoot, IMG.kartShoot]);

    // Enemigos (naves)
    this.tex.enemy = await this.tryMany([(IMG as any).enemySpaceFront, "/assets/img/enemies-space.png", (IMG as any).regSide, IMG.regSide]);
    this.tex.enemyAtk = await this.tryMany([(IMG as any).enemySpaceAttack, "/assets/img/enemies-attack-space.png", (IMG as any).regShoot, IMG.regShoot]);
    this.tex.enemyWreck = await this.tryMany([(IMG as any).enemySpaceDead, "/assets/img/enemies-die-space.png", (IMG as any).regWreck, IMG.regWreck]);

    // Rivales espaciales
    this.tex.rival1 = await this.tryMany([(IMG as any).spaceship1, "/assets/img/spaceship-1.png"]) ?? this.tex.enemy;
    this.tex.rival2 = await this.tryMany([(IMG as any).spaceship2, "/assets/img/spaceship-2.png"]) ?? this.tex.enemy;

    // Metas (arcos espaciales)
    this.finishTexLap = await this.tryMany([(IMG as any).finishLapSpace, "/assets/img/finish-lap-space.png", (IMG as any).finishLapIce, (IMG as any).finishLap]);
    this.finishTexFinal = await this.tryMany([(IMG as any).finishSpace, "/assets/img/finish-space.png", (IMG as any).finishIce, (IMG as any).finishFinal]);

    // Pickups
    (this.tex as any).pedal = await this.tryMany([(IMG as any).pedalDist, IMG.pedalDist]);
    (this.tex as any).life = await this.tryMany([(IMG as any).life, IMG.life, "/assets/img/life.png"]);
    (this.tex as any).god = await this.tryMany([(IMG as any).god, IMG.god, "/assets/img/god.png"]);
    (this.tex as any).shield = await this.tryMany([(IMG as any).shield, "/assets/img/shield.png"]);
    // OVERRIDE por skin
    const skin = this.skinDef;
    if (skin) {
      const frontOrSide = (skin as any).kartFront ?? skin.kartSide;
      const side = await this.tryLoad(frontOrSide);
      const hit = await this.tryLoad(skin.kartHit);
      const dead = await this.tryLoad(skin.kartDead);
      const shoot = await this.tryLoad(skin.kartShoot);
      if (side) this.tex.kart = side;
      if (hit) this.tex.kartHit = hit;
      if (dead) this.tex.kartDead = dead;
      if (shoot) this.tex.kartShoot = shoot;
    }

    // Fondo 2x
    if (this.tex.fondo) {
      const t = this.tex.fondo, sx = this.W / t.width, sy = this.H / t.height;
      this.bgWidthScaled = this.W;
      this.bg1 = new PIXI.Sprite(t); this.bg1.scale.set(sx, sy); this.bg1.x = 0;
      this.bg2 = new PIXI.Sprite(t); this.bg2.scale.set(sx, sy); this.bg2.x = this.bgWidthScaled;
    } else {
      const t = this.app.renderer.generateTexture(new PIXI.Graphics().rect(0, 0, this.W, this.H).fill(0x030814));
      this.bg1.texture = t; this.bg2.texture = t; this.bg2.x = this.W; this.bgWidthScaled = this.W;
    }
    this.bgLayer.addChild(this.bg1, this.bg2);

    // “Suelo” (cinta estelar abajo para dar referencia)
    const gtex = this.tex.suelo ?? this.app.renderer.generateTexture(new PIXI.Graphics().rect(0, 0, 512, 160).fill(0x0a1230));
    this.ground = new PIXI.TilingSprite({ texture: gtex, width: this.W, height: 140 });
    this.ground.y = this.H - this.ground.height;
    (this.ground as any).zIndex = 100;
    this.world.addChild(this.ground);

    // Jugador
    this.player.texture = this.tex.kart ?? PIXI.Texture.WHITE;
    this.player.anchor.set(0.5, 0.8);
    this.player.position.set(this.playerX, this.playerY);
    (this.player as any).zIndex = 1000;
    this.player.scale.set(this.playerScale);
    this.world.addChild(this.player);

    // HUD
    this.hud.position.set(20, 20);
    this.hpBarBg.roundRect(0, 0, 260, 18, 9).fill(0x12293f).stroke({ width: 2, color: 0x000000 });
    this.hud.addChild(this.hpBarBg, this.hpBarFg); this.redrawHP();

    (this.shieldLabel as any).zIndex = 3000;
    (this.shieldText as any).zIndex = 3001;

    // Colocación similar a L6
    this.shieldLabel.position.set(290, 20);
    this.shieldText.position.set(this.shieldLabel.x + this.shieldLabel.width + 6, this.shieldLabel.y);

    this.hud.addChild(this.shieldLabel, this.shieldText);

    // Estado inicial (si ya traés cargas de niveles previos)
    this.setShield(this.shieldCharges > 0);
    this.updateShieldHud();

    this.powerBar.position.set(0, 22);
    this.hud.addChild(this.powerBar);

    this.ammoText.position.set(0, 40); this.hud.addChild(this.ammoText);
    this.timeText.position.set(200, 40); this.hud.addChild(this.timeText);

    this.lapText.position.set(0, 64); this.updateLapHud(); this.hud.addChild(this.lapText);
    this.levelTag.position.set(230, 64); this.hud.addChild(this.levelTag);
    this.levelTag.text = `L7 • ${this.opts.difficulty ?? "normal"}`;


    // Mini-mapa
    this.mapBg.clear()
      .roundRect(this.mapX, this.mapY, this.mapW, this.mapH, 3)
      .fill(0x0b1e34).stroke({ width: 2, color: 0x000000 });
    this.mapPinPlayer.clear().circle(0, 0, 3).fill(0x00d2ff);
    this.mapPinR1.clear().circle(0, 0, 2.5).fill(0xff7f00);
    this.mapPinR2.clear().circle(0, 0, 2.5).fill(0x00ff88);
    this.mapLapTick.clear().rect(-1, -6, 2, this.mapH + 12).fill(0xffffff);
    this.hud.addChild(this.mapBg, this.mapPinPlayer, this.mapPinR1, this.mapPinR2, this.mapLapTick);
    const tick = (p: number) => {
      const g = new PIXI.Graphics().rect(-1, -4, 2, this.mapH + 8).fill(0x1b405f);
      g.position.set(this.mapX + p * this.mapW, this.mapY);
      this.hud.addChild(g);
    };
    tick(0.25); tick(0.5); tick(0.75);

    // Cartel de anuncio
    this.lapAnnounce.anchor.set(0.5);
    this.lapAnnounce.position.set(this.W / 2, this.H / 2 - 100);
    this.lapAnnounce.visible = false;
    this.stage.addChild(this.lapAnnounce);

    // Meta inicial
    this.setFinishTextureForLap(1);

    // Rivales y timers
    this.spawnRivalsAtStart();
    // Labels de posición (1º/2º/3º)
    this.posLabelP.anchor.set(0.5, 1);
    this.posLabelR1.anchor.set(0.5, 1);
    this.posLabelR2.anchor.set(0.5, 1);
    (this.posLabelP as any).zIndex = 2000;
    (this.posLabelR1 as any).zIndex = 2000;
    (this.posLabelR2 as any).zIndex = 2000;
    this.world.addChild(this.posLabelP, this.posLabelR1, this.posLabelR2);


    this.nextEnemyIn();
    this.nextMeteorIn();
    this.nextWindIn();

    // UI inicial pickups
    this.updateAmmoHud(); this.redrawPower();
    this.godPickupsMax = Math.random() < 0.25 ? 2 : 1;

    // Audio BGM
    if (this.opts.audio?.playBgmLevel7) this.opts.audio.playBgmLevel7();
    else this.opts.audio?.playBgmLevel6?.();
    this.opts.audio?.playSfx?.("motor");

    // Cuenta regresiva
    this.setupCountdown();

    this.ready = true;
  }

  /* ====================== Countdown / Semáforo =========================== */
  private setupCountdown() {
    this.controlsLocked = true;
    this.countdown = 3; this.countdownTimer = 1.0; this.goFlashTimer = 0;
    this.countdownText.text = "3"; this.countdownText.anchor.set(0.5);

    this.traffic.removeChildren();
    const r = 24;
    this.lampRed.circle(0, 0, r).fill(0x550000).stroke({ width: 4, color: 0x220000 });
    this.lampYellow.circle(0, 0, r).fill(0x554400).stroke({ width: 4, color: 0x221a00 });
    this.lampGreen.circle(0, 0, r).fill(0x004d00).stroke({ width: 4, color: 0x002200 });

    const spacing = 64;
    this.lampRed.position.set(-spacing, 0);
    this.lampYellow.position.set(0, 0);
    this.lampGreen.position.set(spacing, 0);
    this.traffic.addChild(this.lampRed, this.lampYellow, this.lampGreen);

    // panel overlay
    this.overlay.removeChildren();
    const panelW = 560, panelH = 260;
    const panel = new PIXI.Graphics().roundRect(0, 0, panelW, panelH, 24).fill({ color: 0x000000, alpha: 0.40 });
    const cx = (this.W - panelW) / 2, cy = (this.H - panelH) / 2 - 30;
    panel.position.set(cx, cy);
    const centerX = cx + panelW / 2, centerY = cy + panelH / 2;
    this.countdownText.position.set(centerX, centerY - 34);
    this.traffic.position.set(centerX, centerY + 62);

    this.overlay.addChild(panel, this.countdownText, this.traffic);
    this.overlay.visible = true;
    (this.countdownText.style as any).fill = 0xffffff; this.countdownText.alpha = 1;
    this.setTrafficLights(true, false, false);
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
      sp.anchor.set(0.5, 0.8); (sp as any).zIndex = 700; sp.scale.set(this.rivalScale);
      this.world.addChild(sp); return sp;
    };
    const startWorldX = this.camX + this.player.x;
    // antes:
    // base: 355 / 348
    const r1: Rival = { sp: mk(this.tex.rival1), pos: { x: startWorldX + 40, y: this.playerY - 8 }, speed: this.baseSpeed, base: 370, amp: 46, phase: Math.random() * Math.PI * 2 };
    const r2: Rival = { sp: mk(this.tex.rival2), pos: { x: startWorldX - 60, y: this.playerY + 10 }, speed: this.baseSpeed, base: 358, amp: 38, phase: Math.random() * Math.PI * 2 };
    this.rivals.push(r1, r2);
    for (const r of this.rivals) { r.sp.x = this.screenX(r.pos.x); r.sp.y = r.pos.y; }
  }

  private nextEnemyIn() { this.enemyTimer = this.enemyMin + Math.random() * (this.enemyMax - this.enemyMin); }
  private spawnRunner() {
    const x = this.camX + this.W + 240, y = this.playerY;
    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8); (sp as any).zIndex = 750; sp.scale.set(this.enemyScale);
    this.world.addChild(sp);

    const factor = this.runnerFactorMin + Math.random() * (this.runnerFactorMax - this.runnerFactorMin);
    const jitter = (Math.random() * 24 - 12); // ±12 px/s
    const speed = this.baseSpeed * factor + jitter;

    this.enemies.push({ kind: "runner", sp, pos: { x, y }, speed, hp: 3, dead: false });
  }

  private spawnTurret() {
    const x = this.camX + this.W + 260, y = this.playerY - 24;
    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8); (sp as any).zIndex = 750; sp.scale.set(this.enemyScale);
    this.world.addChild(sp);
    this.enemies.push({ kind: "turret", sp, pos: { x, y }, shootCd: 0.6 + Math.random() * 0.7, hp: 2, dead: false });
  }
  private colorForPlace(place: number): number {
    if (place === 1) return 0xffd24a; // dorado
    if (place === 2) return 0xc0c0c0; // plata
    return 0x7a7a7a;                  // bronce/gris
  }

  private updateRacePositions() {
    const playerWX = this.camX + this.player.x;
    const r1WX = this.rivals[0]?.pos.x ?? -Infinity;
    const r2WX = this.rivals[1]?.pos.x ?? -Infinity;

    const rows = [
      { sp: this.player, wx: playerWX, label: this.posLabelP },
      { sp: this.rivals[0]?.sp, wx: r1WX, label: this.posLabelR1 },
      { sp: this.rivals[1]?.sp, wx: r2WX, label: this.posLabelR2 },
    ].filter(r => r.sp) as { sp: PIXI.Sprite; wx: number; label: PIXI.Text }[];

    rows.sort((a, b) => b.wx - a.wx); // más adelante = mejor posición

    const OFFSET = -16; // separación sobre la cabeza
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const yTop = r.sp.y - r.sp.height * (r.sp.anchor?.y ?? 0.5);
      r.label.text = `${i + 1}`; // si preferís, podés usar `${i+1}º`
      (r.label.style as any).fill = this.colorForPlace(i + 1);
      r.label.x = r.sp.x;
      r.label.y = yTop - OFFSET;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  private spawnEnemy() { Math.random() < 0.35 ? this.spawnTurret() : this.spawnRunner(); }

  private enemyShoot(from: Enemy) {
    if (from.dead) return;
    const sxW = from.pos.x, sy = from.pos.y - 24;
    const dxW = this.camX + this.player.x, dy = this.player.y - 10;
    const ang = Math.atan2(dy - sy, dxW - sxW), v = 480;

    const gfx = this.makePlasmaBall(2.0); // disparo espacial
    const shot: Shot = { sp: gfx, pos: { x: sxW, y: sy }, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v };
    shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y); (shot.sp as any).zIndex = 950;
    this.world.addChild(shot.sp); this.shots.push(shot);

    this.opts.audio?.playOne?.("enemyShoot");
    if (this.tex.enemyAtk && !(from as any).dead) {
      (from as any).sp.texture = this.tex.enemyAtk;
      setTimeout(() => { if (!(from as any).dead && this.tex.enemy) (from as any).sp.texture = this.tex.enemy; }, 160);
    }
  }

  /* ===== Meteoritos ===== */
  private nextMeteorIn() { this.meteorTimer = this.meteorMin + Math.random() * (this.meteorMax - this.meteorMin); }
  private spawnMeteor() {
    const worldX = this.camX + this.W + 200;
    const startY = 200 + Math.random() * (this.H - 320);
    const g = this.makeMeteor();
    const vx = -(320 + Math.random() * 180);             // va hacia la izquierda
    const vy = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80);
    const m: Meteor = { sp: g, pos: { x: worldX, y: startY }, vx, vy, alive: true };
    g.position.set(this.screenX(m.pos.x), m.pos.y); (g as any).zIndex = 850;
    this.world.addChild(g); this.meteors.push(m);
  }

  /* ============================ Pickups ================================ */
  private pickups: Pickup[] = [];
  private pickupTimer = 3.5; pickupMin = 6; pickupMax = 10;
  private lifePickupTimer = 9; lifePickupMin = 12; lifePickupMax = 18;

  private spawnPickup() {
    const x = this.camX + this.W + 200, y = this.playerY - 40;
    const sp = new PIXI.Sprite((this.tex as any).pedal ?? PIXI.Texture.WHITE); sp.anchor.set(0.5); (sp as any).zIndex = 800;
    if (!(this.tex as any).pedal) { const g = new PIXI.Graphics().rect(-12, -8, 24, 16).fill(0x00d2ff); sp.texture = this.app.renderer.generateTexture(g); }
    this.world.addChild(sp); this.pickups.push({ sp, pos: { x, y }, kind: "distortion" });
  }
  private spawnLifePickup() {
    const x = this.camX + this.W + 200, y = this.playerY - 40;
    const sp = new PIXI.Sprite((this.tex as any).life ?? PIXI.Texture.WHITE); sp.anchor.set(0.5); (sp as any).zIndex = 800;
    if (!(this.tex as any).life) { const g = new PIXI.Graphics().circle(0, 0, 10).fill(0x33ddff); sp.texture = this.app.renderer.generateTexture(g); }
    this.world.addChild(sp); this.pickups.push({ sp, pos: { x, y }, kind: "life" });
  }
  private spawnGodPickup() {
    if (this.godPickupsSpawned >= this.godPickupsMax) return;
    const x = this.camX + this.W + 220, y = this.playerY - 60;
    const sp = new PIXI.Sprite((this.tex as any).god ?? PIXI.Texture.WHITE); sp.anchor.set(0.5); (sp as any).zIndex = 820;
    if (!(this.tex as any).god) { const g = new PIXI.Graphics().circle(0, 0, 12).fill(0xffee66).stroke({ width: 2, color: 0xaa9900 }); sp.texture = this.app.renderer.generateTexture(g); }
    this.world.addChild(sp); this.pickups.push({ sp, pos: { x, y }, kind: "god" });
  }
  private givePickup(p: Pickup) {
    if (p.kind === "distortion") {
      this.hasDistortion = true; this.distortTimer = this.distortDuration; this.ammo = 10; this.updateAmmoHud(); this.redrawPower();
       this.boostTimer = Math.max(this.boostTimer, this.boostDuration);
  this.showLapAnnounce("¡TURBO!");
      this.opts.audio?.playOne?.("pickup");
      
    } else if (p.kind === "life") {
      this.hp = Math.min(this.maxHP, this.hp + 25); this.redrawHP(); this.opts.audio?.playOne?.("pickupLife");
    } else if (p.kind === "shield") {
      this.shieldCharges = this.shieldMaxCharges; // llena a 5
      this.setShield(true);
      this.updateShieldHud();
      this.opts.audio?.playOne?.("pickup");
    }
    else {
      this.setGod(true); this.godPickupsSpawned++; this.opts.audio?.playOne?.("pickupGod");
    }
  }

  /* ============================ FX helpers ============================= */
  private makeMeteor(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    g.circle(0, 0, 14).fill(0x9a8b7a).stroke({ width: 3, color: 0x4a4036, alignment: 1, alpha: 0.9 });
    const pit = new PIXI.Graphics().circle(-4, -2, 3).fill(0x6f6152); g.addChild(pit);
    const glow = new PIXI.Graphics().circle(0, 0, 22).fill({ color: 0xffffff, alpha: 0.06 }); g.addChild(glow);
    return g;
  }
  private makePlasmaBall(scale = 2.0): PIXI.Graphics {
    const r = 10 * scale, edge = 0x66c2ff, core = 0x99e6ff;
    const g = new PIXI.Graphics();
    g.circle(0, 0, r).fill({ color: core, alpha: 0.75 }).stroke({ width: 2 * scale, color: edge, alignment: 1 });
    const tail = new PIXI.Graphics().roundRect(-r * 1.4, -r * 0.4, r * 1.4, r * 0.8, r * 0.4).fill({ color: edge, alpha: 0.4 });
    g.addChild(tail); return g;
  }
  private makeLaser(scale = 1.8): PIXI.Graphics {
    const w = 12 * scale, h = 4 * scale, r = 2 * scale;
    const g = new PIXI.Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, r)
      .fill(0x88ddff)
      .stroke({ width: Math.max(1, 1.2 * scale), color: 0xbbeaff, alignment: 1 });
    return g;
  }
  /* ============================ God Mode =============================== */
  private setGod(on: boolean) {
    this.godMode = on;
    if (on) {
      this.godTimer = this.godDuration; (this.player as any).tint = 0xbbe3ff;
      this.drawGodHalo(); this.godHalo.visible = true; this.godHalo.alpha = 0.55; this.godHaloPulse = 0;
      this.godBurstTimer = 0.05; this.showLapAnnounce("¡MODO DIOS!");
    } else {
      (this.player as any).tint = 0xffffff; this.godHalo.visible = false;
      for (const t of this.godTrail) { try { t.sp.destroy(); } catch { } }
      this.godTrail.length = 0; try { this.trailContainer.removeChildren(); } catch { }
    }
  }
  private drawGodHalo() {
    this.godHalo.clear();
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 72, 38).fill({ color: 0x66aaff, alpha: 0.22 });
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 46, 20).fill({ color: 0xccf2ff, alpha: 0.18 });
    (this.godHalo as any).zIndex = 990;
  }
  private emitGodTrail() {
    for (let i = 0; i < 2; i++) {
      const g = new PIXI.Graphics().roundRect(-10, -4, 20, 8, 4).fill(0xcde9ff);
      g.alpha = 0.85; g.position.set(this.player.x - 30 + (Math.random() * 14 - 7), this.player.y - this.jumpOffset + (Math.random() * 10 - 5));
      this.trailContainer.addChild(g);
      this.godTrail.push({ sp: g, life: 0.5, max: 0.5 });
    }
  }
  private emitGodBurst() {
    const sx = this.player.x + 44, sy = this.player.y - 18, N = 6;
    for (let i = 0; i < N; i++) {
      const g = this.makePlasmaBall(1.6);
      const vx = 820 + Math.random() * 220, vy = (Math.random() - 0.5) * 220;
      const shot: Shot = { sp: g, pos: { x: this.camX + sx, y: sy }, vx, vy };
      g.position.set(sx, sy); (g as any).zIndex = 820; this.world.addChild(g); this.playerShots.push(shot);
    }
    this.opts.audio?.playOne?.("playerShoot");
  }

  /* ============================ Overlays =============================== */
  private showResultOverlay(text: string, isWin = false) {
    this.overlay.removeChildren();
    const panel = new PIXI.Graphics().roundRect(0, 0, 560, 220, 20).fill({ color: 0x000000, alpha: 0.5 });
    panel.position.set((this.W - 560) / 2, (this.H - 220) / 2); this.overlay.addChild(panel);
    const title = new PIXI.Text({ text, style: { fill: isWin ? 0x99ffdd : 0xffffff, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" } });
    title.anchor.set(0.5); title.position.set(this.W / 2, this.H / 2 - 22); this.overlay.addChild(title);
    const time = new PIXI.Text({ text: this.fmt(this.raceTime * 1000), style: { fill: 0x88ddff, fontSize: 22, fontFamily: "Arial", fontWeight: "700" } });
    time.anchor.set(0.5); time.position.set(this.W / 2, this.H / 2 + 30); this.overlay.addChild(time);
    this.overlay.visible = true;
  }
  private levelComplete(place: 1 | 2 | 3) {
    if (this.finished) return; this.finished = true; this.controlsLockHard();
    if (place === 1) {
      this.showResultOverlay("¡GANASTE!", true);
      if (this.overlayTimer) clearTimeout(this.overlayTimer);
      this.overlayTimer = window.setTimeout(() => { this.overlay.visible = false; this.opts.onLevelComplete?.(place); }, 2600);
    } else {
      this.showResultOverlay(`${place}º`, false);
      if (this.overlayTimer) clearTimeout(this.overlayTimer);
      this.overlayTimer = window.setTimeout(() => { this.overlay.visible = false; this.opts.onGameOver?.(); }, 2600);
    }
  }
  private controlsLockHard() {
    this.controlsLocked = true; this.invuln = 9999;
    this.enemyTimer = 9999; this.meteorTimer = 9999;
    this.pickupTimer = 9999; this.lifePickupTimer = 9999; this.godPickupTimer = 9999; this.speed = 0;
  }
  private endGame() {
    if (this.ended) return; this.ended = true; this.setPlayerTextureDead(); this.showResultOverlay("GAME OVER");
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    this.overlayTimer = window.setTimeout(() => { this.overlay.visible = false; this.opts.onGameOver?.(); }, 2600);
    this.opts.audio?.stopSfx?.("motor");
  }

  /* ============================ Update ================================= */
  update(dt: number) {
    if (!this.ready || this.ended || this.finished) return;

    // COUNTDOWN
    if (this.controlsLocked) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        if (this.countdown === 3) { this.countdown = 2; this.countdownText.text = "2"; this.countdownTimer = 1.0; this.setTrafficLights(true, true, false); this.opts.audio?.playOne?.("countBeep"); }
        else if (this.countdown === 2) { this.countdown = 1; this.countdownText.text = "1"; this.countdownTimer = 1.0; this.setTrafficLights(true, true, true); this.opts.audio?.playOne?.("countBeep"); }
        else if (this.countdown === 1) { this.countdown = 0; this.countdownText.text = "GO!"; (this.countdownText.style as any).fill = 0x00ff66; this.goFlashTimer = 0.6; this.countdownTimer = 0.4; this.setTrafficLights(true, true, true); this.opts.audio?.playOne?.("countGo"); }
        else { this.overlay.removeChildren(); this.overlay.visible = false; this.controlsLocked = false; }
      }
      if (this.goFlashTimer > 0) { this.goFlashTimer -= dt; (this.countdownText as any).alpha = 0.55 + 0.45 * Math.sin(this.goFlashTimer * 20); }
    }

    // tiempo carrera
    if (!this.controlsLocked && !this.finished) { this.raceTime += dt; this.timeText.text = this.fmt(this.raceTime * 1000); }

    // timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitTimer > 0) { this.hitTimer -= dt; if (this.hitTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.shootPlayerTimer > 0) { this.shootPlayerTimer -= dt; if (this.shootPlayerTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.playerShotCd > 0) this.playerShotCd -= dt;
    if (this.backPushTimer > 0) this.backPushTimer -= dt;
    if (this.jumpCdTimer > 0) this.jumpCdTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.shieldFlash > 0) {
      this.shieldFlash -= dt;
      if (this.shieldFlash <= 0) this.updateShieldHud();
    }


    // Distortion barra
    if (this.hasDistortion) { this.distortTimer -= dt; if (this.distortTimer <= 0) { this.hasDistortion = false; this.redrawPower(); } }

    // GOD MODE
    if (this.godMode) {
      this.godTimer -= dt;
      if (this.godTimer <= 0) { this.setGod(false); }
      else {
        this.godHalo.position.set(this.player.x, 0); this.drawGodHalo();
        this.godHaloPulse += dt * 3; this.godHalo.alpha = 0.5 + 0.2 * Math.sin(this.godHaloPulse * 4);
        this.godTrailTimer -= dt; if (this.godTrailTimer <= 0) { this.emitGodTrail(); this.godTrailTimer = 0.03; }
        this.godBurstTimer -= dt; if (this.godBurstTimer <= 0) { this.emitGodBurst(); this.godBurstTimer = 0.22; }
      }
    }
    for (const t of this.godTrail) { t.life -= dt; const p = Math.max(0, t.life / t.max); t.sp.alpha = p; t.sp.x -= 160 * dt; const s = 0.6 + 0.4 * p; t.sp.scale.set(s, s); }
    this.godTrail = this.godTrail.filter(t => { const alive = t.life > 0; if (!alive) try { t.sp.destroy(); } catch { } return alive; });

    // Fade anuncio
    if (this.lapAnnounceTimer > 0) { this.lapAnnounceTimer -= dt; const t = Math.max(0, this.lapAnnounceTimer); const total = 2.0; this.lapAnnounce.alpha = t / total; if (this.lapAnnounceTimer <= 0) this.lapAnnounce.visible = false; }

    /* ---------- Viento solar ---------- */
    this.windTimer -= dt;
    if (this.windTimer <= 0 && this.windActive <= 0) {
      // Inicia ráfaga
      this.windActive = 2.4 + Math.random() * 1.4;
      this.windStrength = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80); // ± px/s
      this.windTimer = this.windMin + Math.random() * (this.windMax - this.windMin);
      this.showLapAnnounce(this.windStrength > 0 ? "¡Viento solar a favor!" : "¡Viento solar en contra!");
    }
    if (this.windActive > 0) { this.windActive -= dt; } else { this.windStrength = 0; }

    /* ---------- Física espacial ---------- */
  const accelPressed = this.input.a.right && !this.controlsLocked;

// boost por God Mode
const godMul = this.godMode ? this.godBoost : 1.0;
// boost por turbo (pickup)
const turboMul = this.boostTimer > 0 ? this.boostFactor : 1.0;
const totalBoost = godMul * turboMul;

const effMax   = this.jumping ? this.maxSpeed * this.jumpMaxFactor   : this.maxSpeed;
const effAccel = this.jumping ? this.accel    * this.jumpAccelFactor : this.accel;

// valores con boost total aplicado
const effMaxB = effMax * totalBoost;
const baseB   = this.baseSpeed * totalBoost;

const target = accelPressed ? effMaxB : baseB;
const windAdd = this.windStrength;

if (this.speed < target) this.speed = Math.min(target, this.speed + effAccel * dt);
else this.speed = Math.max(target, this.speed - this.friction * dt * 0.6);

// clamp usando effMaxB
this.speed = Math.max(0, Math.min(effMaxB, this.speed + windAdd * dt));



    if (this.speed < target) this.speed = Math.min(target, this.speed + effAccel * dt);
    else this.speed = Math.max(target, this.speed - this.friction * dt * 0.6);

    // ahora el clamp usa effMaxB (con boost), no effMax
    this.speed = Math.max(0, Math.min(effMaxB, this.speed + windAdd * dt));


    if (!this.controlsLocked) {
      const push = (this.input.a.left ? -1 : 0) + (this.input.a.right ? +0.6 : 0);
      this.lateralVel += push * (this.strafe * 0.8) * dt;
    }
    const sign = this.lateralVel >= 0 ? 1 : -1;
    const mag = Math.max(0, Math.abs(this.lateralVel) - this.lateralFriction * dt);
    this.lateralVel = sign * mag;

    // Empuje de meteorito (freno fuerte temporal)
    if (this.backPushTimer > 0) {
      // no te deja caer por debajo de 65% del baseSpeed
      const slowCap = this.baseSpeed * 0.65;
      this.speed = Math.max(slowCap, this.speed - 450 * dt); // antes 700
      if (!this.godMode) (this.player as any).tint = 0x99d7ff;
    } else if (!this.godMode) {
      (this.player as any).tint = 0xffffff;
    }

    // Thruster vertical (salto)
    if (!this.controlsLocked && this.input.a.fire && !this.jumping && this.jumpCdTimer <= 0) {
      this.jumping = true;
      this.jumpVy = this.jumpImpulse;
      this.jumpCdTimer = this.jumpCooldown;
    }
    if (this.jumping) {
      this.jumpVy -= this.gravity * dt; this.jumpOffset += this.jumpVy * dt;
      if (this.jumpOffset <= 0) { this.jumpOffset = 0; this.jumping = false; this.jumpVy = 0; }
    }

    // disparo jugador (láser)
    const shootPressed = (this.input as any).a.fire2 || (this.input as any).a.ctrl || (this.input as any).a.F;
    if (!this.controlsLocked && shootPressed && this.hasDistortion && this.playerShotCd <= 0 && this.ammo > 0) {
      const sx = this.player.x + 40, sy = this.player.y - 74, v = 980, gfx = this.makeLaser(); // 50px más alto
      const shot: Shot = { sp: gfx, pos: { x: this.camX + sx, y: sy }, vx: v, vy: 0 };
      shot.sp.position.set(sx, sy); (shot.sp as any).zIndex = 920; this.world.addChild(shot.sp); this.playerShots.push(shot);
      this.playerShotCd = this.playerShotCdMax; this.setPlayerTextureShoot(); this.opts.audio?.playOne?.("playerShoot");
      this.ammo--; this.updateAmmoHud(); if (this.ammo <= 0) { this.hasDistortion = false; this.redrawPower(); }
    }

    // cámara / parallax
    this.camX += this.speed * dt;
    const bgOffset = -(this.camX * 0.16) % this.bgWidthScaled; // parallax más suave
    this.bg1.x = bgOffset; this.bg2.x = bgOffset + this.bgWidthScaled;
    if (this.bg1.x <= -this.bgWidthScaled) this.bg1.x += this.bgWidthScaled * 2;
    if (this.bg2.x <= -this.bgWidthScaled) this.bg2.x += this.bgWidthScaled * 2;
    if (this.ground) this.ground.tilePosition.x = -this.camX;

    // aplicar jugador
    this.playerX += this.lateralVel * dt;
    this.playerX = Math.max(this.minX, Math.min(this.maxX, this.playerX));
    this.player.x = this.playerX;
    this.player.y = this.playerY - this.jumpOffset;

    // vueltas (arcos)
    const playerWorldX = this.camX + this.player.x;
    while (!this.finished && !this.controlsLocked && playerWorldX >= this.lapFinishX) {
      if (this.lap < this.lapsTotal) {
        this.lap += 1; this.updateLapHud();
        if (this.lap === this.lapsTotal) this.showLapAnnounce("¡ÚLTIMA VUELTA!");
        else if (this.shouldAnnounceLap(this.lap)) this.showLapAnnounce(`VUELTA ${this.lap}`);
        this.setFinishTextureForLap(this.lap); this.lapFinishX += this.trackLength;
      } else {
        const rivalsAhead = this.rivals.filter(r => r.pos.x >= this.lapFinishX).length;
        const place = (1 + rivalsAhead) as 1 | 2 | 3;
        this.levelComplete(place); break;
      }
    }
    if (this.finishSprite) { this.finishSprite.x = this.screenX(this.lapFinishX); this.finishSprite.y = this.ground.y + this.FINISH_Y_OFFSET; }

    /* ---------- Rivales ---------- */
    /* ---------- Rivales ---------- */
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      r.phase += dt * (0.7 + 0.3 * i);
      const osc = Math.sin(r.phase) * r.amp;

      const baseLapX = (this.lap - 1) * this.trackLength;
      const rivalRelX = r.pos.x - baseLapX;
      const playerRelX = (this.camX + this.player.x) - baseLapX;
      const gap = playerRelX - rivalRelX; // + = player adelante

      // Catch-up estilo L3 (más mordida cuando te vas lejos)
      let catchup = 0;
      if (gap > 450) catchup += 55;
      if (gap < -450) catchup -= 35;

      // Anti-pegote: cerca tuyo deja de “copiar” tu velocidad
      if (Math.abs(gap) < 140) catchup *= 0.25;

      // Handicap en God (no te siguen tanto)
      const godHandicap = this.godMode ? -90 : 0;

      // Caps como L3: si estás acelerando no te pasan; si soltás sí pueden
      const rivalMaxWhenYouBoost = this.maxSpeed - 15;   // 365 con max=380
      const rivalMaxWhenCruise = this.maxSpeed + 32;   // 412 con max=380
      const maxRival = this.input.a.right ? rivalMaxWhenYouBoost : rivalMaxWhenCruise;
      const minRival = this.baseSpeed + 40;              // 280 con base=240

      const targetVBase = r.base + osc + catchup + godHandicap;
      const targetV = Math.max(minRival, Math.min(maxRival, targetVBase));

      // Suavizado más reactivo (como L3)
      r.speed = r.speed * 0.82 + targetV * 0.18;

      r.pos.x += r.speed * dt;
      r.sp.x = this.screenX(r.pos.x);
      r.sp.y = r.pos.y;
    }

    // ✅ calculá/posicioná las etiquetas una vez por frame
    this.updateRacePositions();


    /* ---------- Enemigos ---------- */
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.controlsLocked) { this.spawnEnemy(); this.nextEnemyIn(); }

    for (const e of this.enemies) {
      if ((e as Turret).shootCd !== undefined) {
        const T = e as Turret;

        e.pos.x -= this.baseSpeed * dt * 0.2;
        e.sp.x = this.screenX(e.pos.x); e.sp.y = e.pos.y; e.sp.scale.set(this.enemyScale);
        T.shootCd -= dt;
        if (T.shootCd <= 0 && !T.dead && !this.controlsLocked) { this.enemyShoot(T); T.shootCd = 0.6 + Math.random() * 0.7; }
        if (!T.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds(), eb = T.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) { this.playerX -= 30 * dt * 60; if (this.hurtPlayer(8)) this.opts.audio?.playOne?.("crash"); }
        }
      } else {
        const R = e as Runner;

        // --- Anti-stall: asegura velocidad relativa mínima cuando está cerca ---
        // relLeft = px/s que cruza en pantalla hacia la izquierda
        const dxScreen = this.screenX(R.pos.x) - this.player.x;
        if (dxScreen > -200) { // a tu derecha o acaba de pasarte
          const relLeft = this.speed + R.speed; // siempre suma (cam + runner)
          const need = this.minRunnerScreenSpeed - relLeft;
          if (need > 0) {
            // Sube lo que falte, con un cap de aceleración por frame
            const add = Math.min(need, 500 * dt);
            R.speed += add;
          }
        }

        // --- Pass boost: si te roza, te sobrepasa y se va ---
        (R as any).passBoostTimer = Math.max(0, ((R as any).passBoostTimer ?? 0) - dt);
        if (Math.abs(dxScreen) < 36) (R as any).passBoostTimer = 0.8; // 0.8 s de "empuje"
        if ((R as any).passBoostTimer > 0) R.speed += 220 * dt;

        // avanzar runner
        R.pos.x -= R.speed * dt;
        R.sp.x = this.screenX(R.pos.x);
        R.sp.y = this.playerY;
        R.sp.scale.set(this.enemyScale);

        // colisión con el jugador
        if (!R.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds(), eb = R.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 30 * dt * 60;
            R.pos.x += 100 * dt;
            if (this.hurtPlayer(6)) this.opts.audio?.playOne?.("crash");
          }
        }
      }


    }
    this.enemies = this.enemies.filter(e => { const alive = e.pos.x > this.camX - 600; if (!alive) e.sp.destroy(); return alive; });

    // disparos enemigo
    for (const s of this.shots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
      const pb = this.player.getBounds(), sb = s.sp.getBounds();
      const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
      if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
        if (this.shieldCharges > 0) {
          this.shieldCharges -= 1;
          this.shieldFlash = 0.18;
          this.updateShieldHud();
          if (this.shieldCharges <= 0) { this.shieldOn = false; this.updateShieldHud(); }
          this.opts.audio?.playOne?.("impact");
        } else {
          if (this.hurtPlayer(10)) this.opts.audio?.playOne?.("impact");
        }
        s.pos.x = this.camX - 9999; // eliminar el disparo
      }

    }
    this.shots = this.shots.filter(s => { const alive = s.pos.x > this.camX - 300 && s.pos.x < this.camX + this.W + 400 && s.pos.y > 0 && s.pos.y < this.H; if (!alive) s.sp.destroy(); return alive; });

    // disparos del jugador
    for (const s of this.playerShots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
      for (const e of this.enemies) {
        if ((e as any).dead) continue;
        const eb = e.sp.getBounds(), sb = s.sp.getBounds();
        const hit = sb.right > eb.left && sb.left < eb.right && sb.bottom > eb.top && sb.top < eb.bottom;
        if (hit) {
          (e as any).hp -= 1; e.sp.alpha = 0.85; setTimeout(() => { e.sp.alpha = 1; }, 60);
          s.pos.x = this.camX + this.W + 9999;
          if ((e as any).hp <= 0 && !(e as any).dead) {
            (e as any).dead = true; if (this.tex.enemyWreck) e.sp.texture = this.tex.enemyWreck;
            if ((e as any).kind === "runner") { (e as any).speed = this.baseSpeed * 0.8; }
          }
        }
      }
    }
    this.playerShots = this.playerShots.filter(s => { const alive = s.pos.x < this.camX + this.W + 300; if (!alive) s.sp.destroy(); return alive; });

    // Meteoritos
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0 && !this.controlsLocked) { this.spawnMeteor(); this.nextMeteorIn(); }
    for (const m of this.meteors) {
      if (!m.alive) continue;
      m.pos.x += m.vx * dt; m.pos.y += m.vy * dt;
      m.sp.x = this.screenX(m.pos.x); m.sp.y = m.pos.y;
      if (m.pos.y < 80 || m.pos.y > this.H - 40) m.vy *= -1; // rebote suave en bordes verticales
      const pb = this.player.getBounds(), mb = m.sp.getBounds();
      const hit = pb.right > mb.left && pb.left < mb.right && pb.bottom > mb.top && pb.top < mb.bottom;
      if (hit && !this.controlsLocked && this.backPushTimer <= 0) {
        m.alive = false; try { m.sp.destroy(); } catch { }

        if (this.godMode) {
          // Ignorar completamente en God Mode
        } else if (this.shieldCharges > 0) {
          this.shieldCharges -= 1;
          this.shieldFlash = 0.18;
          this.updateShieldHud();
          if (this.shieldCharges <= 0) { this.shieldOn = false; this.updateShieldHud(); }
          this.opts.audio?.playOne?.("impact");
        } else {
          // Comportamiento original: freno temporal
          this.backPushTimer = this.backPushDuration;
          this.opts.audio?.playOne?.("impact");
        }
      }

    }
    this.meteors = this.meteors.filter(m => { const alive = m.pos.x > this.camX - 300; if (!alive) try { m.sp.destroy(); } catch { }; return alive; });

    // Pickups (spawn + recoger)
    this.shieldPickupTimer -= dt;
    if (this.shieldPickupTimer <= 0 && !this.controlsLocked) {
      this.spawnShieldPickup();
      this.shieldPickupTimer = this.shieldPickupMin + Math.random() * (this.shieldPickupMax - this.shieldPickupMin);
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && !this.controlsLocked) { this.spawnPickup(); this.pickupTimer = this.pickupMin + Math.random() * (this.pickupMax - this.pickupMin); }
    this.lifePickupTimer -= dt;
    if (this.lifePickupTimer <= 0 && !this.controlsLocked) { this.spawnLifePickup(); this.lifePickupTimer = this.lifePickupMin + Math.random() * (this.lifePickupMax - this.lifePickupMin); }
    this.godPickupTimer -= dt;
    if (this.godPickupsSpawned < this.godPickupsMax && this.godPickupTimer <= 0 && !this.controlsLocked) { this.spawnGodPickup(); this.godPickupTimer = this.godPickupMin + Math.random() * (this.godPickupMax - this.godPickupMin); }
    for (const p of this.pickups) {
      p.pos.x -= this.baseSpeed * dt; p.sp.x = this.screenX(p.pos.x); p.sp.y = this.playerY - 40;
      const pb = this.player.getBounds(), qb = p.sp.getBounds();
      const touch = pb.right > qb.left && pb.left < qb.right && pb.bottom > qb.top && pb.top < qb.bottom;
      if (touch && !this.controlsLocked) { this.givePickup(p); p.pos.x = this.camX - 9999; }
    }
    this.pickups = this.pickups.filter(p => { const alive = p.pos.x > this.camX - 300; if (!alive) p.sp.destroy(); return alive; });

    // Mini-mapa al final del frame
    this.updateMiniMap();
  }

  /* ============================== Daño player ============================ */
  private hurtPlayer(dmg: number): boolean {
    if (this.invuln > 0 || this.ended || this.finished || this.godMode) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime; this.redrawHP(); this.setPlayerTextureHit();
    this.opts.audio?.playOne?.("playerHit");
    if (this.hp <= 0) this.endGame();
    return true;
  }

  /* ============================ Pausa/Destroy ========================== */
  setPaused(on: boolean) {
    this.controlsLocked = on;
    if (on) this.opts.audio?.stopSfx?.("motor"); else this.opts.audio?.playSfx?.("motor");
  }
  destroy() {
    try { this.stage.removeChildren(); } catch { }
    try { this.shieldText.destroy(); } catch { }
    try { this.shieldLabel.destroy(); } catch { }

    try { this.world.removeChildren(); } catch { }
    try { this.bgLayer.removeChildren(); } catch { }
    try { this.hud.removeChildren(); } catch { }
    for (const e of this.enemies) { try { e.sp.destroy(); } catch { } }
    for (const r of this.rivals) { try { r.sp.destroy(); } catch { } }
    for (const s of this.shots) { try { s.sp.destroy(); } catch { } }
    for (const s of this.playerShots) { try { s.sp.destroy(); } catch { } }
    for (const m of this.meteors) { try { m.sp.destroy(); } catch { } }
    for (const t of this.godTrail) { try { t.sp.destroy(); } catch { } }
    try { this.godHalo.destroy(); } catch { }
    try { this.trailContainer.destroy({ children: true }); } catch { }
    try { this.stage.destroy({ children: true }); } catch { }
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.opts.audio?.stopSfx?.("motor");
    this.ready = false;
  }

  /* ============================ Timers init ============================ */
  //   private nextMeteorIn(){ this.meteorTimer = this.meteorMin + Math.random() * (this.meteorMax - this.meteorMin); }
  private nextWindIn() { this.windTimer = this.windMin + Math.random() * (this.windMax - this.windMin); }
}
