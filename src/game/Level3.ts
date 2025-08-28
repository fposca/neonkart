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
type Pickup = { sp: PIXI.Sprite; pos: Vec2; kind: "distortion" };

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

  /* ===== Fondo scroll ===== */
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;

  /* ===== Suelo ===== */
  ground!: PIXI.TilingSprite;

  /* ===== Pista / vueltas (modo distancia, MÁS LARGO) ===== */
  camX = 0;
  trackLength = 9000;            // <- vueltas más largas que L1/L2
  lapFinishX = this.trackLength; // worldX de meta de la vuelta actual
  lapsTotal = 2;                // <- cambiable: p.ej. 24 vueltas
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
    text: "VUELTA 1/24",
    style: { fill: 0xfff090, fontSize: 18, fontFamily: "Arial", fontWeight: "900" },
  });

  // Cartel grande de vuelta (cada 5 y las últimas 5; última = mensaje especial)
  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0xffcc00, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0;

  // Power + Timer (como L1)
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
  setPlayerTextureNormal() {
    if (this.tex.kart) this.player.texture = this.tex.kart;
  }
  setPlayerTextureDead() {
    if (this.tex.kartDead) this.player.texture = this.tex.kartDead;
  }
  setPlayerTextureShoot() {
    if (this.tex.kartShoot) {
      this.player.texture = this.tex.kartShoot;
      this.shootPlayerTimer = 0.12;
    }
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
  private async tryMany(paths: (string | undefined)[]) {
    for (const p of paths) { const t = await this.tryLoad(p); if (t) return t; }
    return undefined;
  }
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

  private totalTrackLen() { return this.trackLength * this.lapsTotal; }

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

    this.finishSprite.position.set(this.screenX(this.lapFinishX), this.H - 160);
    this.finishSprite.visible = true;
    this.world.addChild(this.finishSprite);
  }

  /* =============================== Carga ================================= */
  async load() {
    // FONDO / SUELO (intenta variantes L3 y cae a L1 si no existen)
    const fondo3 = (IMG as any).fondo3 ?? (IMG as any)["menu-fondo3"] ?? "/assets/img/menu-fondo3.png";
    const suelo3 = (IMG as any).suelo3 ?? "/assets/img/suelo3.png";
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

    // RIVALES: **karting-fredy.png** y **karting-doctor.png** con múltiples fallbacks
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

    // Pickup pedal
    this.tex.pedal = await this.tryLoad((IMG as any).pedalDist ?? IMG.pedalDist);

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

    this.overlay.removeChildren();
    const panel = new PIXI.Graphics().roundRect(0,0,420,220,18).fill(0x111111).stroke({ width:2, color:0x00d2ff });
    panel.position.set((this.W-420)/2, (this.H-220)/2 - 30);
    this.countdownText.position.set(panel.x + 210, panel.y + 70);
    this.traffic.position.set(panel.x + 210, panel.y + 150);

    this.overlay.addChild(panel, this.countdownText, this.traffic);
    this.overlay.visible = true;

    this.setTrafficLights(false, false, false);
    this.setTrafficLights(true, false, false);
    this.opts.audio?.playOne?.("countBeep");
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
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0x27ae60);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    // velocidad relativa con variación
    const rel = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 80);
    const e: Runner = { kind: "runner", sp, pos: { x, y }, speed: this.baseSpeed + rel, hp: 3, dead: false, shootFlash: 0 };
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
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0xc0392b);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const e: Turret = { kind: "turret", sp, pos: { x, y }, shootCd: 0.6 + Math.random()*0.8, hp: 2, dead: false };
    this.enemies.push(e);
  }

  private spawnEnemy() {
    // mezcla 65% runner / 35% torreta
    if (Math.random() < 0.65) this.spawnRunner(); else this.spawnTurret();
  }

  private enemyShoot(from: Enemy) {
    if (from.dead) return;

    const sx = this.screenX(from.pos.x);
    const sy = from.pos.y - 24;
    const dx = this.player.x, dy = this.player.y - 10;
    const ang = Math.atan2(dy - sy, dx - sx);
    const v = 420;

    const color = from.kind === "turret" ? 0xff5533 : 0x00ccff;
    const shot: Shot = {
      sp: new PIXI.Graphics().circle(0, 0, 6).fill(color),
      pos: { x: from.pos.x, y: sy },
      vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
    };
    shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
    shot.sp.zIndex = 650;
    this.world.addChild(shot.sp);
    this.shots.push(shot);

    this.opts.audio?.playOne?.("enemyShoot");

    // flash de disparo runner / torreta
    if (from.kind === "runner") {
      if (this.tex.enemyAtk) from.sp.texture = this.tex.enemyAtk;
      (from as Runner).shootFlash = 0.18;
    } else {
      if (this.tex.enemyAtk) from.sp.texture = this.tex.enemyAtk;
      setTimeout(() => { if (!from.dead && this.tex.enemy) from.sp.texture = this.tex.enemy; }, 180);
    }
  }

  /* =================== Fin / Overlays con auto-hide ====================== */
  private showResultOverlay(text: string) {
    this.overlay.removeChildren();

    const panel = new PIXI.Graphics()
      .roundRect(0, 0, 520, 200, 18)
      .fill(0x111111)
      .stroke({ width: 2, color: 0x00d2ff, alignment: 1 });

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
  }

  private levelComplete(place: 1 | 2 | 3) {
    if (this.finished) return;
    this.finished = true;
    const label = place === 1 ? "¡1º!" : place === 2 ? "2º" : "3º";
    this.showResultOverlay(label);
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    this.overlayTimer = window.setTimeout(() => {
      this.overlay.visible = false;
      this.opts.onLevelComplete?.(place);
    }, 3000);
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

  /* =============================== Update ================================ */
  update(dt: number) {
    if (!this.ready) return;
    if (this.ended) return;

    // COUNTDOWN
    if (this.controlsLocked) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        if (this.countdown === 3) {
          this.countdown = 2; this.countdownText.text = "2"; this.countdownTimer = 1.0;
          this.setTrafficLights(true, true, false);
          this.opts.audio?.playOne?.("countBeep");
        } else if (this.countdown === 2) {
          this.countdown = 1; this.countdownText.text = "1"; this.countdownTimer = 1.0;
          this.setTrafficLights(true, true, false);
          this.opts.audio?.playOne?.("countBeep");
        } else if (this.countdown === 1) {
          this.countdown = 0;
          this.countdownText.text = "GO!";
          (this.countdownText.style as any).fill = 0x00ff66;
          this.goFlashTimer = 0.6;
          this.countdownTimer = 0.4;
          this.setTrafficLights(false, false, true);
          this.opts.audio?.playOne?.("countGo");
        } else {
          this.overlay.removeChildren();
          this.overlay.visible = false;
          this.controlsLocked = false;
        }
      }
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

    // Fade del anuncio de vuelta
    if (this.lapAnnounceTimer > 0) {
      this.lapAnnounceTimer -= dt;
      const t = Math.max(0, this.lapAnnounceTimer);
      const total = 2.0;
      this.lapAnnounce.alpha = t / total;
      if (this.lapAnnounceTimer <= 0) this.lapAnnounce.visible = false;
    }

    // velocidad / lateral
    const accelPressed = this.input.a.right && !this.controlsLocked;
    const target = accelPressed ? this.maxSpeed : this.baseSpeed;
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
      const gfx = new PIXI.Graphics().roundRect(-20, -5, 40, 10, 4).fill(0x00d2ff);

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
      this.finishSprite.y = this.ground.y;
    }

    /* ===== Rivales ===== */
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      r.phase += dt * (0.7 + 0.3 * i);
      const osc = Math.sin(r.phase) * r.amp;

      const baseLapX = (this.lap - 1) * this.trackLength;
      const rivalRelX = r.pos.x - baseLapX;
      const playerRelX = (this.camX + this.player.x) - baseLapX;
      const gap = playerRelX - rivalRelX;

      let catchup = 0;
      if (gap > 450) catchup += 55;
      if (gap < -450) catchup -= 35;

      const rivalMaxWhenYouBoost = this.maxSpeed - 15;
      const rivalMaxWhenCruise   = this.maxSpeed + 35;

      const targetVBase = r.base + osc + catchup;
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
          if (overlap) {
            this.playerX -= 50 * dt * 60;
            e.pos.x += 100 * dt;
            const minKeep = this.baseSpeed * 0.7; if (this.speed < minKeep) this.speed = minKeep;
            this.hurtPlayer(6);
            this.opts.audio?.playOne?.("crash");
          }
        }
      } else {
        // torretas: quedan fijas (se “alejan” por la cámara)
        e.pos.x -= this.baseSpeed * dt * 0.2;
        e.sp.x = this.screenX(e.pos.x);
        e.sp.y = e.pos.y;

        // disparo periódico
        e.shootCd -= dt;
        if (e.shootCd <= 0 && !e.dead) {
          this.enemyShoot(e);
          e.shootCd = 0.7 + Math.random() * 0.7;
        }

        // colisión con jugador si no está muerta
        if (!e.dead && this.jumpOffset < 10) {
          const pb = this.player.getBounds();
          const eb = e.sp.getBounds();
          const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;
          if (overlap) {
            this.playerX -= 50 * dt * 60;
            this.hurtPlayer(8);
            this.opts.audio?.playOne?.("crash");
          }
        }
      }
    }

    // disparo enemigo (balas)
    for (const s of this.shots) {
      s.pos.x += s.vx * dt;
      s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x);
      s.sp.y = s.pos.y;

      const pb = this.player.getBounds(), sb = s.sp.getBounds();
      const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
      if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
        this.opts.audio?.playOne?.("impact");
        this.hurtPlayer(12);
        s.pos.x = this.camX - 9999;
      }
    }
    this.shots = this.shots.filter(s => {
      const alive = s.pos.x > this.camX - 300 && s.pos.x < this.camX + this.W + 400 && s.pos.y > 0 && s.pos.y < this.H;
      if (!alive) s.sp.destroy();
      return alive;
    });

    // Pickups
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && !this.controlsLocked) {
      this.spawnPickup();
      this.pickupTimer = this.pickupMin + Math.random() * (this.pickupMax - this.pickupMin);
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

  private givePickup(_p: Pickup){
    this.hasDistortion = true;
    this.distortTimer = this.distortDuration;
    this.ammo = 10; // <- 10 tiros
    this.updateAmmoHud();
    this.opts.audio?.playOne?.("pickup");
    this.redrawPower();
  }

  /* ============================== Daño player ============================ */
  private hurtPlayer(dmg: number) {
    if (this.invuln > 0 || this.ended) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime;
    this.redrawHP();
    this.setPlayerTextureHit();
    this.opts.audio?.playOne?.("playerHit");
    if (this.hp <= 0) this.endGame();
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
    try { this.stage.destroy({ children: true }); } catch {}
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.opts.audio?.stopSfx?.("motor");
    this.ready = false;
  }
}
