// src/game/Level5.ts
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
};

type Turret = {
  kind: "turret";
  sp: PIXI.Sprite;
  pos: Vec2;
  shootCd: number;
  hp: number;
  dead: boolean;
  hitCd?: number; 
  
};

type Enemy = Runner | Turret;

type Shot = { sp: PIXI.Graphics; pos: Vec2; vx: number; vy: number };

type Rival = {
  sp: PIXI.Sprite;
  pos: Vec2;
  speed: number;
  base: number;
  amp: number;
  phase: number;
};

type Icicle = { sp: PIXI.Graphics; pos: Vec2; vy: number; alive: boolean };
type Pickup = { sp: PIXI.Sprite; pos: Vec2; kind: "distortion" | "life" | "god" };

type LevelOpts = {
  onGameOver?: () => void;
  onLevelComplete?: (place: 1 | 2 | 3) => void; // último nivel: 1º = win, otro = game over
  audio?: AudioBus;
};

/* ============================== Clase ==================================== */
export class Level5 {
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

    // FX Modo Dios (halo + trail)
    this.godHalo.visible = false;
    this.godHalo.zIndex = 990; // bajo el player (1000)
    this.trailContainer.zIndex = 985;
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
  // Mini-mapa
mapBg = new PIXI.Graphics();
mapW = 560;
mapH = 6;
mapX = 640 - this.mapW / 2;
mapY = 16;
mapPinPlayer = new PIXI.Graphics();
mapPinR1 = new PIXI.Graphics();
mapPinR2 = new PIXI.Graphics();
mapLapTick = new PIXI.Graphics();

  overlay = new PIXI.Container();

  /* ===== Escalas (tamaño vis) ===== */
  playerScale = 0.58;
  rivalScale  = 0.60;
  enemyScale  = 0.58;

  /* ===== Fondo / Suelo ===== */
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;
  ground!: PIXI.TilingSprite;

  /* ===== Meta (arcos) ===== */
  private readonly FINISH_Y_OFFSET = 54;
  private finishSprite!: PIXI.Sprite | PIXI.Graphics;
  private finishTexLap?: PIXI.Texture;    // finish-lap-ice.png
  private finishTexFinal?: PIXI.Texture;  // finish-ice.png

  /* ===== Pista / vueltas (modo distancia) ===== */
  camX = 0;
  trackLength = 26000;             // vuelta más corta para final
  lapFinishX = this.trackLength;  // worldX de meta de la vuelta actual
  lapsTotal = 3;
  lap = 1;

  /* ===== HUD ===== */
  hpBarBg = new PIXI.Graphics();
  hpBarFg = new PIXI.Graphics();
  maxHP = 100;
  hp = 100;
// ===== Labels grandes de posición =====
posTextP = new PIXI.Text({
  text: "1",
  style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true },
});
posTextR1 = new PIXI.Text({
  text: "2",
  style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true },
});
posTextR2 = new PIXI.Text({
  text: "3",
  style: { fill: 0xffffff, fontSize: 96, fontFamily: "Arial", fontWeight: "900", dropShadow: true },
});

  powerBar = new PIXI.Graphics(); // barra “Distortion”
  ammoText = new PIXI.Text({
    text: "",
    style: { fill: 0x00d2ff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  timeText = new PIXI.Text({
    text: "00:00.000",
    style: { fill: 0xffffff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  lapText = new PIXI.Text({
    text: "VUELTA 1/5",
    style: { fill: 0xbfe8ff, fontSize: 18, fontFamily: "Arial", fontWeight: "900" },
  });

  // Cartel grande (avisos de vuelta y “¡MODO DIOS!”)
  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0x66d6ff, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0;

  // Etiqueta de nivel
  levelTag = new PIXI.Text({
    text: "L5",
    style: { fill: 0xccccff, fontSize: 12, fontFamily: "Arial", fontWeight: "700" },
  });

  /* ===== Jugador ===== */
  player = new PIXI.Sprite();
  playerX = 360;
  playerY = 550;
  minX = 120;
  maxX = Math.floor(this.W * 0.75);

  // Física hielo
speed = 0;
baseSpeed = 190;     // ↓ antes 250
maxSpeed  = 360;     // ↓ antes 520
cameraSpeedMul = 0.95; // ↓ antes 1.35 (scrollea más lento)
accel     = 300;     // ↓ antes 560 (acelera con menos mordida)
  friction = 300;        // longitudinal
  strafe = 520;
  lateralVel = 0;        // derrape persistente
  lateralFriction = 40;  // hielo frena lento

  // salto (compat)
  jumping = false;
  jumpVy = 0;
  jumpOffset = 0;
  jumpImpulse = 1180;
  gravity = 1900;

  // Congelamiento (carámbanos)
  frozenTimer = 0;
  frozenDuration = 2.2;

  // feedback daño
  invuln = 0;
  invulnTime = 0.8;
  hitTimer = 0;
  shootPlayerTimer = 0;

  // Distortion / ammo (como L1/L3)
  hasDistortion = false;
  distortTimer = 0;
  distortDuration = 10;
  ammo = 0; // ← 10 por pickup
  playerShots: Shot[] = [];
  playerShotCd = 0;
  playerShotCdMax = 0.25;

  // sprites jugador
  tex: Record<string, PIXI.Texture | undefined> = {};
  setPlayerTextureNormal() { if (this.tex.kart) this.player.texture = this.tex.kart; }
  setPlayerTextureHit()    { if (this.tex.kartHit) { this.player.texture = this.tex.kartHit; this.hitTimer = 0.18; } }
  setPlayerTextureDead()   { if (this.tex.kartDead) this.player.texture = this.tex.kartDead; }
  setPlayerTextureShoot()  { if (this.tex.kartShoot) { this.player.texture = this.tex.kartShoot; this.shootPlayerTimer = 0.12; } }

  /* ===== Enemigos ===== */
  enemies: Enemy[] = [];
  enemyTimer = 0;
  enemyMin = 2.2;
  enemyMax = 3.6;

  /* ===== Disparos enemigos ===== */
  shots: Shot[] = [];

  /* ===== Rivales ===== */
  rivals: Rival[] = [];

  /* ===== Carámbanos ===== */
  icicles: Icicle[] = [];
//   icicleTimer = 1.6;   // spawnea cada ~1.6s al inicio
//   icicleMin = 1.2;
//   icicleMax = 2.0;
//   icicleVyMin = 640;
//   icicleVyMax = 800;

  /* ===== Modo Dios ===== */
  godMode = false;
  godTimer = 0;
  godDuration = 4;      // duración
  godPickupTimer = 24;   // primer intento tarde
  godPickupMin = 28;
  godPickupMax = 42;
  godPickupsSpawned = 0;
  godPickupsMax = 1;     // puede subir a 2 según “suerte”
  // FX
  godHalo = new PIXI.Graphics();
  godHaloPulse = 0;
  trailContainer = new PIXI.Container();
  godTrail: { sp: PIXI.Graphics; life: number; max: number }[] = [];
  godTrailTimer = 0;
  godBurstTimer = 0;     // ráfaga automática como en L1/L3

  /* ===== Overlays / fin ===== */
  overlayTimer: number | null = null;
  ended = false;
  finished = false;
  raceTime = 0;

  /* ===== Countdown / Semáforo ===== */
  controlsLocked = true; // arrancamos bloqueado hasta el GO
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
  private colorForPlace(place: number): number {
  if (place === 1) return 0xffd24a;   // dorado
  if (place === 2) return 0xc0c0c0;   // plateado
  return 0x7a7a7a;                    // bronce/gris
}

private setupPositionLabels() {
  this.posTextP.anchor.set(0.5, 1);
  this.posTextR1.anchor.set(0.5, 1);
  this.posTextR2.anchor.set(0.5, 1);
  (this.posTextP  as any).zIndex = 2000;
  (this.posTextR1 as any).zIndex = 2000;
  (this.posTextR2 as any).zIndex = 2000;
  this.world.addChild(this.posTextP, this.posTextR1, this.posTextR2);
}

// Ordena por X de mundo y coloca 1/2/3
private updateRacePositions() {
  const playerWX = this.camX + this.player.x;
  const r1WX = this.rivals[0]?.pos.x ?? -Infinity;
  const r2WX = this.rivals[1]?.pos.x ?? -Infinity;

  const rows = [
    { sp: this.player,        wx: playerWX, label: this.posTextP },
    { sp: this.rivals[0]?.sp, wx: r1WX,     label: this.posTextR1 },
    { sp: this.rivals[1]?.sp, wx: r2WX,     label: this.posTextR2 },
  ].filter(r => r.sp) as { sp: PIXI.Sprite; wx: number; label: PIXI.Text }[];

  rows.sort((a, b) => b.wx - a.wx);

  const OFFSET = -16; // ⬅ como en L7: más cerca de la cabeza
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const yTop = r.sp.y - r.sp.height * ((r.sp as any).anchor?.y ?? 0.5);
    r.label.text = String(i + 1);
    (r.label.style as any).fill = this.colorForPlace(i + 1);
    r.label.x = r.sp.x;
    r.label.y = yTop - OFFSET;
  }
}

  private async tryLoad(url?: string) { if (!url) return undefined; try { return await PIXI.Assets.load(url); } catch { return undefined; } }
  private async tryMany(paths: (string | undefined)[]) { for (const p of paths) { const t = await this.tryLoad(p); if (t) return t; } return undefined; }
  private screenX(worldX: number) { return worldX - this.camX; }
  private fmt(ms: number) {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), mil = Math.floor(ms % 1000);
    const p2 = (n: number) => (n < 10 ? `0${n}` : `${n}`), p3 = (n: number) => n.toString().padStart(3, "0");
    return `${p2(m)}:${p2(s)}.${p3(mil)}`;
  }
private clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

private lapProgressFor(worldX: number) {
  const baseLapX = (this.lap - 1) * this.trackLength;
  const raw = (worldX - baseLapX) / this.trackLength;
  return this.clamp01(raw);
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

  private redrawHP() {
    const p = Math.max(0, this.hp / this.maxHP);
    this.hpBarFg.clear();
    this.hpBarFg.roundRect(1, 1, 258 * p, 16, 8).fill(p > 0.4 ? 0x66ddff : 0x66aaff);
  }
  private redrawPower() {
    this.powerBar.clear();
    if (!this.hasDistortion) return;
    const p = Math.max(0, this.distortTimer / this.distortDuration);
    this.powerBar.roundRect(0, 0, 260 * p, 4, 2).fill(0x00d2ff);
  }
  private updateAmmoHud() { this.ammoText.text = this.hasDistortion ? `Ammo: ${this.ammo}` : ""; }
  private updateLapHud() { this.lapText.text = `VUELTA ${this.lap}/${this.lapsTotal}`; }
  
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
  /* ===== Meta: recrear SIEMPRE el sprite según vuelta ===== */
  private setFinishTextureForLap(lap: number) {
    let t: PIXI.Texture | undefined;
    if (lap < this.lapsTotal) t = this.finishTexLap ?? this.finishTexFinal;
    else t = this.finishTexFinal ?? this.finishTexLap;

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
    // Fondo / Suelo (hielo)
    this.tex.fondo = await this.tryMany([
      (IMG as any).fondoIce, "/assets/img/fondo-ice.jpg", IMG.fondo
    ]);
    this.tex.suelo = await this.tryMany([
      (IMG as any).sueloIce, "/assets/img/suelo-ice.jpg", IMG.suelo
    ]);

    // Jugador (arte de hielo, con fallback a arte normal)
    this.tex.kart      = await this.tryMany([ (IMG as any).kartIceFront, "/assets/img/kart-ice-front.png", (IMG as any).kartSide, IMG.kartSide ]);
    this.tex.kartHit   = await this.tryMany([ (IMG as any).kartIceHit,   "/assets/img/kart-ice-hit.png",   (IMG as any).kartHit,   IMG.kartHit ]);
    this.tex.kartDead  = await this.tryMany([ (IMG as any).kartIceDead,  "/assets/img/kart-ice-dead.png",  (IMG as any).kartDead,  IMG.kartDead ]);
    this.tex.kartShoot = await this.tryMany([ (IMG as any).kartIceShoot, "/assets/img/kart-ice-shoot.png", (IMG as any).kartShoot, IMG.kartShoot ]);

    // Enemigos (hielo con fallback a regulares)
    this.tex.enemy      = await this.tryMany([ (IMG as any).enemyIceFront,  "/assets/img/enemy-ice-front.png",  (IMG as any).regSide,  IMG.regSide ]);
    this.tex.enemyAtk   = await this.tryMany([ (IMG as any).enemyIceAttack, "/assets/img/enemy-ice-attack.png", (IMG as any).regShoot, IMG.regShoot ]);
    this.tex.enemyWreck = await this.tryMany([ (IMG as any).enemyIceDead,   "/assets/img/enemy-ice-dead.png",   (IMG as any).regWreck, IMG.regWreck ]);

    // Rivales (dos variantes hielo, fallback a enemy)
    this.tex.rival1 = await this.tryMany([ (IMG as any).rivalIce1, "/assets/img/rival-ice-1.png" ]) ?? this.tex.enemy;
    this.tex.rival2 = await this.tryMany([ (IMG as any).rivalIce2, "/assets/img/rival-ice-2.png" ]) ?? this.tex.enemy;

    // Metas (arcos hielo)
    this.finishTexLap   = await this.tryMany([ (IMG as any).finishLapIce, "/assets/img/finish-lap-ice.png" ]);
    this.finishTexFinal = await this.tryMany([ (IMG as any).finishIce,    "/assets/img/finish-ice.png" ]);

    // Pickups (MISMAS imágenes de siempre, sin -ice)
    (this.tex as any).pedal = await this.tryMany([ (IMG as any).pedalDist, IMG.pedalDist ]);
    (this.tex as any).life  = await this.tryMany([ (IMG as any).life, IMG.life, "/assets/img/life.png" ]);
    (this.tex as any).god   = await this.tryMany([ (IMG as any).god,  IMG.god,  "/assets/img/god.png" ]);

    // Fondo 2x
    if (this.tex.fondo) {
      const t = this.tex.fondo;
      const sx = this.W / t.width, sy = this.H / t.height;
      this.bgWidthScaled = this.W;
      this.bg1 = new PIXI.Sprite(t); this.bg1.scale.set(sx, sy); this.bg1.x = 0;
      this.bg2 = new PIXI.Sprite(t); this.bg2.scale.set(sx, sy); this.bg2.x = this.bgWidthScaled;
    } else {
      const t = this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,this.W,this.H).fill(0x80a8c8));
      this.bg1.texture = t; this.bg2.texture = t; this.bg2.x = this.W; this.bgWidthScaled = this.W;
    }
    this.bgLayer.addChild(this.bg1, this.bg2);

    // Suelo
    const gtex = this.tex.suelo ?? this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,512,160).fill(0xbfe8ff));
    this.ground = new PIXI.TilingSprite({ texture: gtex, width: this.W, height: 160 });
    this.ground.y = this.H - this.ground.height;
    this.ground.zIndex = 100;
    this.world.addChild(this.ground);

    // Jugador
    this.player.texture = this.tex.kart ?? PIXI.Texture.WHITE;
    this.player.anchor.set(0.5, 0.8);
    this.player.position.set(this.playerX, this.playerY);
    this.player.zIndex = 1000;
    this.player.scale.set(this.playerScale);
    this.world.addChild(this.player);

    // HUD
    this.hud.position.set(20, 20);
    this.hpBarBg.roundRect(0,0,260,18,9).fill(0x164b66).stroke({ width:2, color:0x000000 });
    this.hud.addChild(this.hpBarBg, this.hpBarFg);
    this.redrawHP();

    this.powerBar.position.set(0, 22);
    this.hud.addChild(this.powerBar);

    this.ammoText.position.set(0, 40);
    this.hud.addChild(this.ammoText);

    this.timeText.position.set(200, 40);
    this.hud.addChild(this.timeText);

    this.lapText.position.set(0, 64);
    this.updateLapHud();
    
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

// marcas 25/50/75
const tick = (p: number) => {
  const g = new PIXI.Graphics().rect(-1, -4, 2, this.mapH + 8).fill(0x3a3a3a);
  g.position.set(this.mapX + p * this.mapW, this.mapY);
  this.hud.addChild(g);
};
tick(0.25); tick(0.50); tick(0.75);

// posición inicial
this.updateMiniMap();

    this.hud.addChild(this.lapText);

    this.levelTag.position.set(230, 64);
    this.hud.addChild(this.levelTag);

    // Cartel de anuncio
    this.lapAnnounce.anchor.set(0.5);
    this.lapAnnounce.position.set(this.W/2, this.H/2 - 100);
    this.lapAnnounce.visible = false;
    this.stage.addChild(this.lapAnnounce);

    // Meta inicial (arco)
    this.setFinishTextureForLap(1);

    // Rivales y timers
    this.spawnRivalsAtStart();
    this.setupPositionLabels();

    this.nextEnemyIn();
    this.nextIcicleIn();

    // Pickups HUD inicial
    this.updateAmmoHud(); this.redrawPower();
    // “suerte” para 2º GOD pickup
    this.godPickupsMax = Math.random() < 0.25 ? 2 : 1;

    // Audio
    this.opts.audio?.playBgmLevel5?.();
    this.opts.audio?.playSfx?.("motor");

    // Cuenta regresiva
    this.setupCountdown();

    // Listo
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

    // Panel con padding, fondo negro alpha .4
    this.overlay.removeChildren();
    const panelW = 560;
    const panelH = 260;

    const panel = new PIXI.Graphics()
      .roundRect(0, 0, panelW, panelH, 24)
      .fill({ color: 0x000000, alpha: 0.4 });

    const cx = (this.W - panelW) / 2;
    const cy = (this.H - panelH) / 2 - 30;
    panel.position.set(cx, cy);

    const centerX = cx + panelW / 2;
    const centerY = cy + panelH / 2;

    this.countdownText.position.set(centerX, centerY - 34);
    this.traffic.position.set(centerX, centerY + 62);

    this.overlay.addChild(panel, this.countdownText, this.traffic);
    this.overlay.visible = true;

    // reset estilo por si venía de otra corrida
    (this.countdownText.style as any).fill = 0xffffff;
    this.countdownText.alpha = 1;

    // estado inicial del semáforo: solo ROJO encendido
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
      sp.anchor.set(0.5, 0.8);
      sp.zIndex = 700;
      sp.scale.set(this.rivalScale);
      this.world.addChild(sp);
      return sp;
    };
    const startWorldX = this.camX + this.player.x;
const r1Base = this.baseSpeed + (this.maxSpeed - this.baseSpeed) * 0.50; // medio
const r2Base = this.baseSpeed + (this.maxSpeed - this.baseSpeed) * 0.45; // un poco menos

const r1: Rival = { sp: mk(this.tex.rival1), pos: { x: startWorldX + 40, y: this.playerY - 8 }, speed: this.baseSpeed, base: r1Base, amp: 40, phase: Math.random()*Math.PI*2 };
const r2: Rival = { sp: mk(this.tex.rival2), pos: { x: startWorldX - 60, y: this.playerY + 10 }, speed: this.baseSpeed, base: r2Base, amp: 32, phase: Math.random()*Math.PI*2 };    this.rivals.push(r1, r2);
    for (const r of this.rivals) { r.sp.x = this.screenX(r.pos.x); r.sp.y = r.pos.y; }
  }

  private nextEnemyIn() { this.enemyTimer = this.enemyMin + Math.random() * (this.enemyMax - this.enemyMin); }
  private spawnRunner() {
    const margin = 240;
    const x = this.camX + this.W + margin;
    const y = this.playerY;
    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 750;
    sp.scale.set(this.enemyScale);
    this.world.addChild(sp);
const v = this.baseSpeed * (0.85 + Math.random() * 0.15); // 85%..100% del base
this.enemies.push({ kind: "runner", sp, pos: { x, y }, speed: v, hp: 3, dead: false });
  }
  private spawnTurret() {
    const margin = 260;
    const x = this.camX + this.W + margin;
    const y = this.playerY - 4;
    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.zIndex = 750;
    sp.scale.set(this.enemyScale);
    this.world.addChild(sp);
    this.enemies.push({ kind: "turret", sp, pos: { x, y }, shootCd: 0.6 + Math.random()*0.7, hp: 2, dead: false });
  }
  private spawnEnemy() {
    if (Math.random() < 0.35) this.spawnTurret();
    else this.spawnRunner();
  }

  private enemyShoot(from: Enemy) {
    if (from.dead) return;
    const sxW = from.pos.x, sy = from.pos.y - 24;
    const dxW = this.camX + this.player.x, dy = this.player.y - 10;
    const ang = Math.atan2(dy - sy, dxW - sxW);
    const v = 430;

    const gfx = this.makeSnowBall(); // bala “de nieve” ❄️
    const shot: Shot = { sp: gfx, pos: { x: sxW, y: sy }, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v };
    shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
    shot.sp.zIndex = 950;
    this.world.addChild(shot.sp);
    this.shots.push(shot);

    this.opts.audio?.playOne?.("enemyShoot");
    if (this.tex.enemyAtk && !from.dead) {
      from.sp.texture = this.tex.enemyAtk;
      setTimeout(() => { if (!from.dead && this.tex.enemy) from.sp.texture = this.tex.enemy; }, 160);
    }
  }

  /* ===== Carámbanos ===== */
  private icicleTimer = 1.6;
  private icicleMin = 1.2;
  private icicleMax = 2.0;
  private icicleVyMin = 640;
  private icicleVyMax = 800;

  private nextIcicleIn() { this.icicleTimer = this.icicleMin + Math.random() * (this.icicleMax - this.icicleMin); }
  private spawnIcicle() {
    const worldX = this.camX + 120 + Math.random() * (this.W - 240);
    const g = this.makeIcicle();
    const vy = this.icicleVyMin + Math.random() * (this.icicleVyMax - this.icicleVyMin);
    const ic: Icicle = { sp: g, pos: { x: worldX, y: -40 }, vy, alive: true };
    g.position.set(this.screenX(ic.pos.x), ic.pos.y);
    g.zIndex = 850;
    this.world.addChild(g);
    this.icicles.push(ic);
  }

  /* ============================ Pickups ================================ */
  // almacén de pickups + timers
  private pickups: Pickup[] = [];
  private pickupTimer = 3.5;
  private pickupMin = 6;
  private pickupMax = 10;

  private lifePickupTimer = 9;
  private lifePickupMin = 12;
  private lifePickupMax = 18;

  private spawnPickup(){
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite((this.tex as any).pedal ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 800;
    if (!(this.tex as any).pedal) {
      const g = new PIXI.Graphics().rect(-12,-8,24,16).fill(0x00d2ff);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "distortion" });
  }

  private spawnLifePickup() {
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite((this.tex as any).life ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 800;
    if (!(this.tex as any).life) {
      const g = new PIXI.Graphics().circle(0, 0, 10).fill(0x33ddff);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "life" });
  }

  private spawnGodPickup() {
    if (this.godPickupsSpawned >= this.godPickupsMax) return;
    const x = this.camX + this.W + 220;
    const y = this.playerY - 60;
    const sp = new PIXI.Sprite((this.tex as any).god ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 820;
    if (!(this.tex as any).god) {
      const g = new PIXI.Graphics().circle(0,0,12).fill(0xffee66).stroke({ width:2, color:0xaa9900 });
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "god" });
  }

  private givePickup(p: Pickup) {
    if (p.kind === "distortion") {
      this.hasDistortion = true;
      this.distortTimer = this.distortDuration;
      this.ammo = 10;
      this.updateAmmoHud();
      this.redrawPower();
      this.opts.audio?.playOne?.("pickup");
    } else if (p.kind === "life") {
      this.hp = Math.min(this.maxHP, this.hp + 25);
      this.redrawHP();
      this.opts.audio?.playOne?.("pickupLife");
    } else if (p.kind === "god") {
      this.setGod(true);
      this.godPickupsSpawned++;
      this.opts.audio?.playOne?.("pickupGod");
    }
  }
  /* ============================ FX helpers ============================= */
private makeSnowBall(scale = 3): PIXI.Graphics {
  const r = 8 * scale;       // radio base 8 → x3 = 24
  const glowR = 12 * scale;  // glow acompaña el tamaño

  const g = new PIXI.Graphics();
  g.circle(0, 0, r)
    .fill(0xe6f6ff)
    .stroke({ width: 2 * scale, color: 0x99d7ff, alignment: 1 });

  const glow = new PIXI.Graphics()
    .circle(0, 0, glowR)
    .fill({ color: 0x99d7ff, alpha: 0.22 });

  g.addChild(glow);
  return g;
}
  
 private makeIcicle(scale = 1.6): PIXI.Graphics {
  const s = scale;
  const g = new PIXI.Graphics();
  g.moveTo(0, -18*s).lineTo(10*s, 12*s).lineTo(-10*s, 12*s).closePath()
    .fill(0xc8ecff)
    .stroke({ width: 2*s, color: 0x66bfe8 });
  return g;
}

  private makeNoteShot(): PIXI.Graphics {
    const col = 0x66d6ff;
    const edge = 0x66d6ff;
    const g = new PIXI.Graphics();
    g.circle(0, 0, 8).fill(col).stroke({ width: 2, color: edge, alignment: 1 });
    g.roundRect(6, -26, 4, 26, 2).fill(col);
    const flag = new PIXI.Graphics().roundRect(10, -26, 18, 10, 4).fill(col);
    flag.alpha = 0.95;
    g.addChild(flag);
    g.rotation = -0.12;
    return g;
  }
  private makeFlameShot(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const glow = new PIXI.Graphics().circle(0, 0, 10).fill({ color: 0x66d6ff, alpha: 0.22 });
    g.addChild(glow);
    g.circle(0, 0, 6).fill(0x99e6ff).stroke({ width: 2, color: 0xd0f3ff, alignment: 1, alpha: 0.9 });
    g.roundRect(-8, -2, 8, 4, 2).fill(0xbfe8ff);
    return g;
  }

  /* ============================ God Mode =============================== */
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

      // reset ráfaga automática
      this.godBurstTimer = 0.05;

      // aviso
      this.showLapAnnounce("¡MODO DIOS!");
    } else {
      (this.player as any).tint = 0xffffff;
      this.godHalo.visible = false;

      // limpiar trail
      for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
      this.godTrail.length = 0;
      try { this.trailContainer.removeChildren(); } catch {}
    }
  }
  private drawGodHalo() {
    this.godHalo.clear();
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 70, 36).fill({ color: 0xffd200, alpha: 0.22 });
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 44, 18).fill({ color: 0xffffaa, alpha: 0.18 });
    this.godHalo.zIndex = 990;
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
  private emitGodBurst() {
    const sx = this.player.x + 44;
    const sy = this.player.y - 18;
    const N = 6;
    for (let i = 0; i < N; i++) {
      const g = this.makeFlameShot();
      const vx = 1000 + Math.random() * 260;
      const vy = (Math.random() - 0.5) * 220;
      const shot: Shot = { sp: g, pos: { x: this.camX + sx, y: sy }, vx, vy };
      g.position.set(sx, sy);
      g.zIndex = 820;
      this.world.addChild(g);
      this.playerShots.push(shot);
    }
    this.opts.audio?.playOne?.("playerShoot");
  }

  /* ============================ Overlays =============================== */
  private showResultOverlay(text: string, isWin = false) {
    this.overlay.removeChildren();
    const panel = new PIXI.Graphics()
      .roundRect(0, 0, 560, 220, 20)
      .fill({ color: 0x000000, alpha: 0.5 });
    panel.position.set((this.W - 560) / 2, (this.H - 220) / 2);
    this.overlay.addChild(panel);

    const title = new PIXI.Text({
      text,
      style: { fill: isWin ? 0x66ffcc : 0xffffff, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" }
    });
    title.anchor.set(0.5);
    title.position.set(this.W / 2, this.H / 2 - 22);
    this.overlay.addChild(title);

    const time = new PIXI.Text({
      text: this.fmt(this.raceTime * 1000),
      style: { fill: 0x66d6ff, fontSize: 22, fontFamily: "Arial", fontWeight: "700" },
    });
    time.anchor.set(0.5);
    time.position.set(this.W / 2, this.H / 2 + 30);
    this.overlay.addChild(time);

    this.overlay.visible = true;
  }

  private levelComplete(place: 1 | 2 | 3) {
  if (this.finished) return;
  this.finished = true;
  this.controlsLockHard();

  // Mostrar siempre "Nº". Si no es 1º => se considera derrota.
  this.showResultOverlay(`${place}º`, place === 1);

  if (this.overlayTimer) clearTimeout(this.overlayTimer);
  this.overlayTimer = window.setTimeout(() => {
    this.overlay.visible = false;
    if (place === 1) this.opts.onLevelComplete?.(place);
    else this.opts.onGameOver?.();
  }, 2600);
}


  private controlsLockHard() {
    this.controlsLocked = true;
    this.invuln = 9999;
    this.enemyTimer = 9999;
    this.icicleTimer = 9999;
    this.pickupTimer = 9999;
    this.lifePickupTimer = 9999;
    this.godPickupTimer = 9999;
    this.speed = 0;
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
    }, 2600);
    this.opts.audio?.stopSfx?.("motor");
  }

  private smashIcicle(ic: Icicle) {
    const p = new PIXI.Graphics().circle(0,0,16).fill({ color: 0xbfe8ff, alpha: 0.35 });
    p.position.set(this.screenX(ic.pos.x), this.ground.y - 10);
    p.zIndex = 860; this.world.addChild(p);
    this.opts.audio?.playOne?.("ice");
    setTimeout(() => { try { p.destroy(); } catch {} }, 180);
  }

  /* ============================ Update ================================= */
  update(dt: number) {
    if (!this.ready || this.ended || this.finished) return;

    /* ---------- Countdown semáforo ---------- */
    if (this.controlsLocked) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        if (this.countdown === 3) {
          this.countdown = 2;
          this.countdownText.text = "2";
          this.countdownTimer = 1.0;
          this.setTrafficLights(true, true, false);
          this.opts.audio?.playOne?.("countBeep");
        } else if (this.countdown === 2) {
          this.countdown = 1;
          this.countdownText.text = "1";
          this.countdownTimer = 1.0;
          this.setTrafficLights(true, true, true);
          this.opts.audio?.playOne?.("countBeep");
        } else if (this.countdown === 1) {
          this.countdown = 0;
          this.countdownText.text = "GO!";
          (this.countdownText.style as any).fill = 0x00ff66;
          this.goFlashTimer = 0.6;
          this.countdownTimer = 0.4;
          this.setTrafficLights(true, true, true);
          this.opts.audio?.playOne?.("countGo");
        } else {
          // arranca
          this.overlay.removeChildren();
          this.overlay.visible = false;
          this.controlsLocked = false;
          this.speed = this.baseSpeed;
        }
      }
      if (this.goFlashTimer > 0) {
        this.goFlashTimer -= dt;
        (this.countdownText as any).alpha = 0.55 + 0.45 * Math.sin(this.goFlashTimer * 20);
      }
    }

    // tiempo
    if (!this.controlsLocked && !this.finished) {
      this.raceTime += dt;
      this.timeText.text = this.fmt(this.raceTime * 1000);
    }

    // timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitTimer > 0) { this.hitTimer -= dt; if (this.hitTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.shootPlayerTimer > 0) { this.shootPlayerTimer -= dt; if (this.shootPlayerTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.playerShotCd > 0) this.playerShotCd -= dt;
    if (this.frozenTimer > 0) this.frozenTimer -= dt;

    // Distortion visual
    if (this.hasDistortion) {
      this.distortTimer -= dt;
      if (this.distortTimer <= 0) { this.hasDistortion = false; this.redrawPower(); }
    }

    // GOD MODE
    if (this.godMode) {
      this.godTimer -= dt;
      if (this.godTimer <= 0) {
        this.setGod(false);
      } else {
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
          this.godTrailTimer = 0.03;
        }
        // ráfaga auto
        this.godBurstTimer -= dt;
        if (this.godBurstTimer <= 0) {
          this.emitGodBurst();
          this.godBurstTimer = 0.22;
        }
      }
    }
    for (const t of this.godTrail) {
      t.life -= dt;
      const p = Math.max(0, t.life / t.max);
      t.sp.alpha = p;
      t.sp.x -= 160 * dt;
      const s = 0.6 + 0.4 * p;
      t.sp.scale.set(s, s);
    }
    this.godTrail = this.godTrail.filter(t => { const alive = t.life > 0; if (!alive) try { t.sp.destroy(); } catch {} return alive; });

    // Fade anuncio
    if (this.lapAnnounceTimer > 0) {
      this.lapAnnounceTimer -= dt;
      const t = Math.max(0, this.lapAnnounceTimer);
      const total = 2.0;
      this.lapAnnounce.alpha = t / total;
      if (this.lapAnnounceTimer <= 0) this.lapAnnounce.visible = false;
    }

    /* ---------- Física hielo ---------- */
// ===== Avance hacia adelante =====
const accelPressed = this.input.a.right && !this.controlsLocked && (this as any).frozenTimer <= 0;
const boost = this.godMode ? 2.0 : 1.0;
// extra sólo si acelerás; sin acelerar = baseSpeed pura
const extra = accelPressed ? (this.maxSpeed - this.baseSpeed) : 0;
const target = (this.baseSpeed + extra) * boost;

// suavizado (en hielo se siente mejor que “clavarlo” con min/max)
this.speed += (target - this.speed) * Math.min(1, dt * 4);

// por las dudas, nunca menos que baseSpeed cuando está en juego
if (!this.controlsLocked && this.speed < this.baseSpeed) this.speed = this.baseSpeed;


    if (!this.controlsLocked && this.frozenTimer <= 0) {
      const push = (this.input.a.left ? -1 : 0) + (this.input.a.right ? +0.6 : 0);
      this.lateralVel += push * (this.strafe * 0.8) * dt;
    }
    const sign = this.lateralVel >= 0 ? 1 : -1;
    const mag = Math.max(0, Math.abs(this.lateralVel) - this.lateralFriction * dt);
    this.lateralVel = sign * mag;

    // aplicar X (bordes)
    this.playerX += this.lateralVel * dt;
    this.playerX = Math.max(this.minX, Math.min(this.maxX, this.playerX));

    // congelado
    if (this.frozenTimer > 0) {
      this.speed = Math.max(0, this.speed - 600 * dt);
      (this.player as any).tint = 0x99d7ff;
    } else if (!this.godMode) {
      (this.player as any).tint = 0xffffff;
    }

    // salto
    if (!this.controlsLocked && this.input.a.fire && !this.jumping && this.frozenTimer <= 0) { this.jumping = true; this.jumpVy = this.jumpImpulse; }
    if (this.jumping) {
      this.jumpVy -= this.gravity * dt;
      this.jumpOffset += this.jumpVy * dt;
      if (this.jumpOffset <= 0) { this.jumpOffset = 0; this.jumping = false; this.jumpVy = 0; }
    }

    // disparo jugador (nota musical) cuando tenés Distortion
    const shootPressed = (this.input as any).a.fire2 || (this.input as any).a.ctrl || (this.input as any).a.F;
    if (!this.controlsLocked && shootPressed && this.hasDistortion && this.playerShotCd <= 0 && this.ammo > 0) {
      const sx = this.player.x + 40;
      const sy = this.player.y - 24;
      const speed = 900;
      const gfx = this.makeNoteShot();
      const shot: Shot = { sp: gfx, pos: { x: this.camX + sx, y: sy }, vx: speed, vy: 0 };
      shot.sp.position.set(sx, sy);
      shot.sp.zIndex = 920;
      this.world.addChild(shot.sp);
      this.playerShots.push(shot);
      this.playerShotCd = this.playerShotCdMax;
      this.setPlayerTextureShoot();
      this.opts.audio?.playOne?.("playerShoot");
      this.ammo--; this.updateAmmoHud();
      if (this.ammo <= 0) { this.hasDistortion = false; this.redrawPower(); }
    }

  // cámara / parallax
const camMul = this.cameraSpeedMul * (this.godMode ? 1.15 : 1.0);
this.camX += this.speed * camMul * dt;

const bgOffset = -(this.camX * 0.25) % this.bgWidthScaled;
this.bg1.x = bgOffset;
this.bg2.x = bgOffset + this.bgWidthScaled;

if (this.bg1.x <= -this.bgWidthScaled) this.bg1.x += this.bgWidthScaled * 2;
if (this.bg2.x <= -this.bgWidthScaled) this.bg2.x += this.bgWidthScaled * 2;
if (this.ground) this.ground.tilePosition.x = -this.camX;

    // aplicar jugador
    this.player.x = this.playerX;
    this.player.y = this.playerY - this.jumpOffset;

    // vueltas (con arcos)
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

    /* ---------- Rivales ---------- */
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      r.phase += dt * (0.7 + 0.3 * i);
      this.updateRacePositions();

      const osc = Math.sin(r.phase) * r.amp;

      const baseLapX = (this.lap - 1) * this.trackLength;
      const rivalRelX = r.pos.x - baseLapX;
      const playerRelX = (this.camX + this.player.x) - baseLapX;
      const gap = playerRelX - rivalRelX;

      let catchup = 0;
      if (gap > 450) catchup += 55;
      if (gap < -450) catchup -= 35;

      const freezeHandicap = this.frozenTimer > 0 ? 60 : 0;
      const rivalMax = this.maxSpeed + 35;
      const minRival = this.baseSpeed + 40;

      const targetVBase = r.base + osc + catchup + freezeHandicap;
      const targetV = Math.max(minRival, Math.min(rivalMax, targetVBase));
      r.speed = r.speed * 0.82 + targetV * 0.18;

      r.pos.x += r.speed * camMul * dt;
      r.sp.x = this.screenX(r.pos.x);
      r.sp.y = r.pos.y;
      r.sp.scale.set(this.rivalScale);
    }

    /* ---------- Enemigos ---------- */
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.controlsLocked) { this.spawnEnemy(); this.nextEnemyIn(); }

    for (const e of this.enemies) {
      if ((e as Turret).shootCd !== undefined) {
        // torreta
        const T = e as Turret;
// e.pos.x -= this.baseSpeed * camMul * 0.15 * dt; // ↓ 0.2 → 0.15        e.sp.x = this.screenX(e.pos.x);
       e.sp.x = this.screenX(e.pos.x);
e.sp.y = e.pos.y;
e.sp.scale.set(this.enemyScale);

        T.shootCd -= dt;
        if (T.shootCd <= 0 && !T.dead && !this.controlsLocked) {
          this.enemyShoot(T);
          T.shootCd = 0.6 + Math.random() * 0.7;
        }

    // DESPUÉS (resuelve la superposición y agrega cooldown)
if (!T.dead && this.jumpOffset < 10) {
  const pb = this.player.getBounds();
  const eb = T.sp.getBounds();
  const hit = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;

  if (hit && !this.controlsLocked) {
    // Separación mínima horizontal (elige el menor corrimiento)
    const sepL = pb.right - eb.left;   // player a la izquierda
    const sepR = eb.right - pb.left;   // player a la derecha
    const push = (sepL < sepR) ? sepL : -sepR;

    // Mover a AMBOS para que no queden pegados (2px de margen)
    this.playerX -= (push + Math.sign(push)*2);
    T.pos.x      +=  0.6 * push;

    // Un “impulso” lateral para que el player no vuelva a entrar
    if (push > 0) this.lateralVel = Math.min(this.lateralVel, -220);
    else          this.lateralVel = Math.max(this.lateralVel,  220);

    // Daño con cooldown (evita múltiples golpes en 1s)
    T.hitCd = Math.max(0, T.hitCd ?? 0);
    if (T.hitCd === 0) {
      if (this.hurtPlayer(8)) this.opts.audio?.playOne?.("crash");
      T.hitCd = 0.25;  // 250 ms
    }
  }

  // tick del cooldown
  if ((T.hitCd ?? 0) > 0) T.hitCd = Math.max(0, (T.hitCd as number) - dt);
}

      } else {
        // runner
        const R = e as Runner;
       R.pos.x -= R.speed * camMul * dt;
        R.sp.x = this.screenX(R.pos.x);
        R.sp.y = this.playerY;
        R.sp.scale.set(this.enemyScale);

        if (!R.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds(), eb = R.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap && !this.controlsLocked) {
            this.playerX -= 50 * dt * 60;
            R.pos.x += 100 * dt;
            if (this.hurtPlayer(6)) this.opts.audio?.playOne?.("crash");
          }
        }
      }
    }
// Reemplaza el filtro actual por este:
this.enemies = this.enemies.filter(e => {
  const offLeft  = e.sp.x < -200 || e.pos.x < this.camX - 100;          // detrás de cámara
  const offRight = e.sp.x > this.W + 400 || e.pos.x > this.camX + this.W + 800; // demasiado lejos a la derecha
  const keep = !(offLeft || offRight);
  if (!keep) { try { e.sp.destroy(); } catch {} }
  return keep;
  
});

    // disparos enemigo
    for (const s of this.shots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
      const pb = this.player.getBounds(), sb = s.sp.getBounds();
      const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
      if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
        if (this.hurtPlayer(10)) this.opts.audio?.playOne?.("impact");
        s.pos.x = this.camX - 9999;
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
            (e as any).dead = true;
            if (this.tex.enemyWreck) e.sp.texture = this.tex.enemyWreck;
            if ((e as any).kind === "runner") { (e as any).speed = this.baseSpeed * 0.8; }
          }
        }
      }
    }
    this.playerShots = this.playerShots.filter(s => { const alive = s.pos.x < this.camX + this.W + 300; if (!alive) s.sp.destroy(); return alive; });

    // carámbanos
    this.icicleTimer -= dt;
    if (this.icicleTimer <= 0 && !this.controlsLocked) { this.spawnIcicle(); this.nextIcicleIn(); }

    for (const ic of this.icicles) {
      if (!ic.alive) continue;
      ic.pos.y += ic.vy * dt;
      ic.sp.x = this.screenX(ic.pos.x);
      ic.sp.y = ic.pos.y;

      // impacto suelo
      if (ic.pos.y >= this.ground.y - 8) {
        ic.alive = false; this.smashIcicle(ic);
      } else {
        // impacto jugador
        const pb = this.player.getBounds(), sb = ic.sp.getBounds();
        const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
        if (hit && this.jumpOffset < 10 && !this.controlsLocked && this.frozenTimer <= 0) {
          ic.alive = false; this.smashIcicle(ic);
          this.frozenTimer = this.frozenDuration;
          this.opts.audio?.playOne?.("impact");
        }
      }
    }
    this.icicles = this.icicles.filter(ic => { const keep = ic.alive; if (!keep) try { ic.sp.destroy(); } catch {} return keep; });

    // Pickups (spawn + recoger)
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && !this.controlsLocked) {
      this.spawnPickup();
      this.pickupTimer = this.pickupMin + Math.random() * (this.pickupMax - this.pickupMin);
    }
    this.lifePickupTimer -= dt;
    if (this.lifePickupTimer <= 0 && !this.controlsLocked) {
      this.spawnLifePickup();
      this.lifePickupTimer = this.lifePickupMin + Math.random() * (this.lifePickupMax - this.lifePickupMin);
    }
    this.godPickupTimer -= dt;
    if (this.godPickupsSpawned < this.godPickupsMax && this.godPickupTimer <= 0 && !this.controlsLocked) {
      this.spawnGodPickup();
      this.godPickupTimer = this.godPickupMin + Math.random() * (this.godPickupMax - this.godPickupMin);
    }

    for (const p of this.pickups) {
      p.pos.x -= this.baseSpeed * camMul * dt;
      p.sp.x = this.screenX(p.pos.x);
      p.sp.y = this.playerY - 40;

      const pb = this.player.getBounds(), qb = p.sp.getBounds();
      const touch = pb.right > qb.left && pb.left < qb.right && pb.bottom > qb.top && pb.top < qb.bottom;
      if (touch && !this.controlsLocked) { this.givePickup(p); p.pos.x = this.camX - 9999; }
    }
    this.pickups = this.pickups.filter(p => { const alive = p.pos.x > this.camX - 300; if (!alive) p.sp.destroy(); return alive; });
    this.updateMiniMap();
  }
/* ============================== Daño player ============================ */
private hurtPlayer(dmg: number): boolean {
  if (this.invuln > 0 || this.ended || this.finished || this.godMode) return false;
  this.hp = Math.max(0, this.hp - dmg);
  this.invuln = this.invulnTime;
  this.redrawHP();
  this.setPlayerTextureHit();
  this.opts.audio?.playOne?.("playerHit");
  if (this.hp <= 0) this.endGame();
  return true; // daño aplicado
}

  /* ============================ Pausa/Destroy ========================== */
  setPaused(on: boolean) {
    this.controlsLocked = on;
    if (on) this.opts.audio?.stopSfx?.("motor");
    else this.opts.audio?.playSfx?.("motor");
  }

  destroy() {
    try { this.posTextP.destroy(); } catch {}
try { this.posTextR1.destroy(); } catch {}
try { this.posTextR2.destroy(); } catch {}

    try { this.stage.removeChildren(); } catch {}
    try { this.world.removeChildren(); } catch {}
    try { this.bgLayer.removeChildren(); } catch {}
    try { this.hud.removeChildren(); } catch {}
    for (const e of this.enemies) { try { e.sp.destroy(); } catch {} }
    for (const r of this.rivals)  { try { r.sp.destroy(); } catch {} }
    for (const s of this.shots)   { try { s.sp.destroy(); } catch {} }
    for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
    for (const i of this.icicles) { try { i.sp.destroy(); } catch {} }
    for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
    try { this.godHalo.destroy(); } catch {}
    try { this.trailContainer.destroy({ children: true }); } catch {}
    try { this.stage.destroy({ children: true }); } catch {}
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.opts.audio?.stopSfx?.("motor");
    this.ready = false;
  }
}
