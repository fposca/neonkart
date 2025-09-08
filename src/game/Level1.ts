// src/game/Level1.ts
import * as PIXI from "pixi.js";
import { IMG } from "./assets";
import { Input } from "./input";
import type { AudioBus } from "./audio";

/* =============================== Tipos =================================== */
type Vec2 = { x: number; y: number };

type Enemy = {
  sp: PIXI.Sprite;
  pos: Vec2;
  speed: number;
  shootFlash: number;
  hp: number;
  dead: boolean;

  // IA rivales (solo para r1/r2)
  isRival?: boolean;
  base?: number;
  amp?: number;
  phase?: number;
  jitterT?: number;
};

type Shot = { sp: PIXI.Graphics; pos: Vec2; vx: number; vy: number };
type Pickup = { sp: PIXI.Sprite; pos: Vec2; kind: "distortion" | "life" | "god" };

type LevelOpts = {
  onGameOver?: () => void;
  onLevelComplete?: (place: 1 | 2 | 3) => void;
  audio?: AudioBus;
};

/* ============================== Clase ==================================== */
export class Level1 {
  app: PIXI.Application;
  input: Input;
  opts: LevelOpts;

  // viewport
  readonly W = 1280;
  readonly H = 720;

  readonly FINISH_Y_OFFSET = 54;
  // capas
  stage = new PIXI.Container();
  bgLayer = new PIXI.Container();
  world = new PIXI.Container();
  hud = new PIXI.Container();
  overlay = new PIXI.Container(); // cuenta regresiva / resultados

  // fondo scroll
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;

  // suelo
  ground!: PIXI.TilingSprite;

  // pista / metas
  camX = 0;
  trackLength = 24000;               // longitud de UNA vuelta (distancia)
  lapFinishX = this.trackLength;    // worldX de meta de la vuelta actual
  finishSprite!: PIXI.Sprite | PIXI.Graphics;

  // texturas meta por vuelta
  finishTexLap1?: PIXI.Texture;
  finishTexLap2?: PIXI.Texture;
  finishTexFinal?: PIXI.Texture;
  finishTexFallback?: PIXI.Texture;

  // vueltas (MODO DISTANCIA)
  lapsTotal = 3;
  lap = 1;
  lapText = new PIXI.Text({
    text: "VUELTA 1/7",
    style: { fill: 0xfff090, fontSize: 18, fontFamily: "Arial", fontWeight: "900" },
  });

  // HUD: anuncio de vuelta centrado
  lapAnnounce = new PIXI.Text({
    text: "",
    style: { fill: 0xffcc00, fontSize: 72, fontFamily: "Arial", fontWeight: "900", align: "center" },
  });
  lapAnnounceTimer = 0; // segundos visibles (se maneja en update(dt))
/* ===== Escalas (tamaño) ===== */
playerScale = 0.65; // kart del jugador
rivalScale  = 0.65; // Fredy/Doctor
enemyScale  = 0.65; // runners/torretas

  // jugador
  player = new PIXI.Sprite();
  playerX = 360;
  playerY = 520;
  minX = 120;
  maxX = 1180;

  // velocidades
  speed = 0;
  baseSpeed = 240;
  maxSpeed = 520;   // acelerando sos más rápido que rivales
  accel = 560;
  friction = 440;

  // lateral
  strafe = 520;

  // salto
  jumping = false;
  jumpVy = 0;
  jumpOffset = 0;
  jumpImpulse = 1500;
  gravity = 2600;

  // vida
  maxHP = 100;
  hp = 100;
  invuln = 0;
  invulnTime = 0.8;
  hpBarBg = new PIXI.Graphics();
  hpBarFg = new PIXI.Graphics();

  // estado
  ended = false;
  finished = false;
  hitTimer = 0;
  shootPlayerTimer = 0;

  // enemigos comunes
  enemies: Enemy[] = [];
  enemyTimer = 0;
  enemyMin = 2.5;
  enemyMax = 4.5;

  // rivales de carrera
  rivals: Enemy[] = [];

  // tiros
  shots: Shot[] = [];
  shotCooldown = 0;

  // overlay auto-hide
  overlayTimer: number | null = null;

  // pickups/poder
  pickups: Pickup[] = [];
  pickupTimer = 3.5;
  pickupMin = 6;
  pickupMax = 10;

  // life pickups
  lifePickupTimer = 9;     // primer spawn ~9s
  lifePickupMin = 12;      // luego entre 12..
  lifePickupMax = 18;      // ..y 18s

  // distorsión (arma)
  hasDistortion = false;
  distortTimer = 0;
  distortDuration = 10;
  ammo = 0;
  ammoText = new PIXI.Text({
    text: "",
    style: { fill: 0x00d2ff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  playerShots: Shot[] = [];
  playerShotCd = 0;
  playerShotCdMax = 0.25;

  // HUD poder + timer
  powerBar = new PIXI.Graphics();
  raceTime = 0; // sigue contando, pero NO afecta vueltas
  timeText = new PIXI.Text({
    text: "00:00.000",
    style: { fill: 0xffffff, fontSize: 14, fontFamily: "Arial", fontWeight: "700" },
  });

  // ===== Mini-mapa =====
  mapBg = new PIXI.Graphics();
  mapW = 560;           // ancho del mapa
  mapH = 6;
  mapX = 500;           // posición en HUD
  mapY = 24;
  mapPinPlayer = new PIXI.Graphics();
  mapPinR1 = new PIXI.Graphics();
  mapPinR2 = new PIXI.Graphics();
  mapLapTick = new PIXI.Graphics(); // palito de meta actual

  // ===== Cuenta regresiva / semáforo =====
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

  // ----- GOD MODE (estado + FX) -----
  // NUEVO NUMERO SEGUIMIENTO: flama del Modo Dios (partículas)
godFireContainer = new PIXI.Container();
godFire: { sp: PIXI.Graphics; life: number; max: number; }[] = [];
godFireTimer = 0;

  godMode = false;
  godTimer = 0;
  godDuration = 4; // segundos
  // spawn MUY raro (1 por nivel, 25% chance de 2)
  godPickupTimer = 24;   // primer intento tarde
  godPickupMin = 28;
  godPickupMax = 42;
  godPickupsSpawned = 0;
  godPickupsMax = 1;     // se decide en load()

  // FX: halo + trail
  godHalo = new PIXI.Graphics();
  godHaloPulse = 0;
  trailContainer = new PIXI.Container();
  godTrail: { sp: PIXI.Graphics; life: number; max: number; }[] = [];
  godTrailTimer = 0;

  // texturas
  tex: Record<string, PIXI.Texture | undefined> = {};

  constructor(app: PIXI.Application, input: Input, opts: LevelOpts = {}) {
    this.app = app;
    this.input = input;
    this.opts = opts;

    this.app.stage.addChild(this.stage);
    this.stage.addChild(this.bgLayer);
    this.stage.addChild(this.world);
    this.stage.addChild(this.hud);
    this.stage.addChild(this.overlay);

    // habilitar zIndex
    this.world.sortableChildren = true;

    // preparar contenedores FX
    this.godHalo.visible = false;
    this.godHalo.zIndex = 990;       // debajo del player (1000)
    this.trailContainer.zIndex = 985;
    this.world.addChild(this.trailContainer, this.godHalo);
    this.godFireContainer.zIndex = 1002;   // encima del halo (990), debajo del player (1000)
this.godFireContainer.visible = false;
this.world.addChild(this.godFireContainer);
  }

  /* ============================ Helpers ================================== */
  /* ===== Anti-cheese borde derecho ===== */
private edgeZonePx = 18;          // cuánto consideramos “pegado” al borde
private edgeStickSec = 2.0;       // tiempo para activar penalización
private edgePenaltyDur = 2.2;     // duración del empuje
private edgePenaltySpeed = 720;   // px/s de empuje hacia la izquierda
private edgeStickTimer = 0;       // acumula tiempo “pegado + saltando”
private edgePenaltyTimer = 0;     // penalización activa

  private nextEnemyIn() { this.enemyTimer = this.enemyMin + Math.random() * (this.enemyMax - this.enemyMin); }
  private async tryLoad(url?: string) { if (!url) return undefined; try { return await PIXI.Assets.load(url); } catch { return undefined; } }
  private screenX(worldX: number) { return worldX - this.camX; }
  private clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
private colorForPlace(place: number): number {
  // 1º dorado, 2º plateado, 3º gris oscuro
  if (place === 1) return 0xffd24a; // dorado
  if (place === 2) return 0xc0c0c0; // plateado
  return 0x7a7a7a;                  // gris oscuro
}

  private fmt(ms: number) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const pad3 = (n: number) => n.toString().padStart(3, "0");
    return `${pad2(m)}:${pad2(s)}.${pad3(mil)}`;
  }
  /* ===== Pickups (spawn pedal/distortion) ===== */
// private spawnPickup() {
//   if (this.controlsLocked) return;

//   const x = this.camX + this.W + 200;
//   const y = this.playerY - 40;

//   const sp = new PIXI.Sprite(this.tex.pedal ?? PIXI.Texture.WHITE);
//   sp.anchor.set(0.5);
//   sp.zIndex = 800;

//   // fallback si no hay textura
//   if (!this.tex.pedal) {
//     const g = new PIXI.Graphics().rect(-12, -8, 24, 16).fill(0x00d2ff);
//     sp.texture = this.app.renderer.generateTexture(g);
//   }

//   this.world.addChild(sp);
//   this.pickups.push({ sp, pos: { x, y }, kind: "distortion" });
// }


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
    // NUEVO NUMERO SEGUIMIENTO: crear y agregar labels al world
  // NUEVO NUMERO SEGUIMIENTO: crear y agregar labels + flamas al world
private setupPositionLabels() {
  this.posTextP.anchor.set(0.5, 1);
  this.posTextR1.anchor.set(0.5, 1);
  this.posTextR2.anchor.set(0.5, 1);

  (this.posTextP as any).zIndex = 2000;
  (this.posTextR1 as any).zIndex = 2000;
  (this.posTextR2 as any).zIndex = 2000;

  (this.posFlameP as any).zIndex = 1995;
  (this.posFlameR1 as any).zIndex = 1995;
  (this.posFlameR2 as any).zIndex = 1995;

  // primero las flamas (debajo), luego los textos (encima)
  this.world.addChild(this.posFlameP, this.posFlameR1, this.posFlameR2);
  this.world.addChild(this.posTextP, this.posTextR1, this.posTextR2);
}

  private updateLapHud() { this.lapText.text = `VUELTA ${this.lap}/${this.lapsTotal}`; }

  // progreso de la vuelta actual 0..1 (MODO DISTANCIA)
  private lapProgressFor(worldX: number) {
    const baseLapX = (this.lap - 1) * this.trackLength;
    const raw = (worldX - baseLapX) / this.trackLength;
    return this.clamp01(raw);
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

  // avisos de vuelta
  private shouldAnnounceLap(lap: number) {
    const last5Start = this.lapsTotal - 5 + 1; // 16 si lapsTotal=20
    if (lap >= last5Start) return true;       // 16..20 => todas
    return lap % 5 === 0;                     // 5,10,15
  }
  private showLapAnnounce(txt: string) {
    this.lapAnnounce.text = txt;
    this.lapAnnounce.visible = true;
    this.lapAnnounce.alpha = 1;
    this.lapAnnounceTimer = 2.0; // seg
    this.opts.audio?.playOne?.("countBeep");
  }

  /* =============================== Carga ================================= */
  async load() {
    // texturas base
    this.tex.fondo     = await this.tryLoad(IMG.fondo);
    this.tex.suelo     = await this.tryLoad(IMG.suelo);
    this.tex.kart      = await this.tryLoad(IMG.kartSide);
    this.tex.kartHit   = await this.tryLoad(IMG.kartHit);
    this.tex.kartDead  = await this.tryLoad(IMG.kartDead);
    this.tex.kartShoot = await this.tryLoad(IMG.kartShoot);

    this.tex.enemy      = await this.tryLoad(IMG.regSide);
    this.tex.enemyAtk   = await this.tryLoad(IMG.regShoot);
    this.tex.enemyWreck = await this.tryLoad(IMG.regWreck);

    // life
    this.tex.life = await this.tryLoad((IMG as any).life ?? "/assets/img/life.png");

    // GOD pickup
    this.tex.god = await this.tryLoad((IMG as any).god ?? "/assets/img/god.png");
    // suerte: a veces puede aparecer un segundo
    this.godPickupsMax = Math.random() < 0.25 ? 2 : 1;

    // rivales
    this.tex.rival1 = await this.tryLoad((IMG as any).kartRival1) ?? (await this.tryLoad(IMG.regSide));
    this.tex.rival2 = await this.tryLoad((IMG as any).kartRival2) ?? (await this.tryLoad(IMG.regSide));

    // metas
    this.finishTexLap1     = await this.tryLoad((IMG as any).finishLap1);
    this.finishTexLap2     = await this.tryLoad((IMG as any).finishLap2);
    this.finishTexFinal    = await this.tryLoad((IMG as any).finishFinal);
    this.finishTexFallback = await this.tryLoad((IMG as any).finish ?? (IMG as any).finishFinal);

    this.tex.pedal = await this.tryLoad(IMG.pedalDist);

    // fondo 2x
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

    // suelo
    const gtex = this.tex.suelo ?? this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,512,160).fill(0x222));
    this.ground = new PIXI.TilingSprite({ texture: gtex, width: this.W, height: 160 });
    this.ground.y = this.H - this.ground.height;
    this.ground.zIndex = 100;
    this.world.addChild(this.ground);

    // jugador
    this.player.texture = this.tex.kart ?? PIXI.Texture.WHITE;
    this.player.anchor.set(0.5, 0.8);
    this.player.position.set(this.playerX, this.playerY);
    this.player.scale.set(this.playerScale); // 👈 NUEVO
    this.player.zIndex = 1000; // por encima de todos
    this.world.addChild(this.player);

    // HUD (HP, poder, ammo, tiempo, vueltas)
    this.hud.position.set(20, 20);
    this.hpBarBg.roundRect(0,0,260,18,9).fill(0x222).stroke({width:2,color:0x000});
    this.hud.addChild(this.hpBarBg, this.hpBarFg);
    this.powerBar.position.set(0, 22);
    this.hud.addChild(this.powerBar);
    this.ammoText.position.set(0, 40);
    this.hud.addChild(this.ammoText);
    this.timeText.position.set(200, 40);
    this.hud.addChild(this.timeText);
    this.lapText.position.set(0, 64);
    this.hud.addChild(this.lapText);
    this.redrawHP(); this.redrawPower(); this.updateAmmoHud(); this.updateLapHud();

    // Mini-mapa (barra + pins + palito de meta)
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

    // ticks decorativos 25/50/75
    const tick = (p: number) => {
      const g = new PIXI.Graphics().rect(-1, -4, 2, this.mapH + 8).fill(0x3a3a3a);
      g.position.set(this.mapX + p * this.mapW, this.mapY);
      this.hud.addChild(g);
    };
    tick(0.25); tick(0.50); tick(0.75);

    // Cartel de anuncio (centrado en pantalla)
    this.lapAnnounce.anchor.set(0.5);
    this.lapAnnounce.position.set(this.W / 2, this.H / 2 - 100);
    this.lapAnnounce.visible = false;
    this.stage.addChild(this.lapAnnounce);

    // Meta inicial (lap 1)
    this.setFinishTextureForLap(1);

    // RIVALES: largan a la par
 
        this.spawnRivalsAtStart();

    // NUEVO NUMERO SEGUIMIENTO: inicializar labels de posición
    this.setupPositionLabels();


    this.nextEnemyIn();

    // overlay oculto al inicio; se usa para countdown
    this.overlay.visible = false;

    // timer & countdown
    this.raceTime = 0;
    this.timeText.text = "00:00.000";
    this.setupCountdown();
  }

  private setupCountdown() {
    this.controlsLocked = true;
    this.countdown = 3;
    this.countdownTimer = 1.0;
    this.goFlashTimer = 0;

    // texto
    this.countdownText.text = "3";
    this.countdownText.anchor.set(0.5);

    // semáforo
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

    // panel overlay centrado
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

    // luces
    this.setTrafficLights(false, false, false);
    this.setTrafficLights(true, false, false);
    this.opts.audio?.playOne?.("countBeep");
  }

  private setTrafficLights(red: boolean, yellow: boolean, green: boolean) {
    this.lampRed.tint = red ? 0xff0000 : 0x550000;
    this.lampYellow.tint = yellow ? 0xffdd33 : 0x554400;
    this.lampGreen.tint = green ? 0x00ff66 : 0x004d00;
  }

  private spawnRivalsAtStart() {
    const mk = (t?: PIXI.Texture) => {
      const sp = new PIXI.Sprite(t ?? this.tex.enemy ?? PIXI.Texture.WHITE);
      sp.anchor.set(0.5, 0.8);
      sp.scale.set(this.enemyScale); 
      sp.zIndex = 700; // debajo del player, arriba de enemigos
      sp.scale.set(this.rivalScale); // 👈 NUEVO
      this.world.addChild(sp);
      return sp;
    };

    const startWorldX = this.camX + this.player.x;

    const r1: Enemy = {
      sp: mk(this.tex.rival1),
      pos: { x: startWorldX + 40, y: this.playerY - 6 },
      speed: this.baseSpeed,
      shootFlash: 0, hp: 999, dead: false,
      isRival: true, base: 470, amp: 45, phase: Math.random() * Math.PI * 2, jitterT: 0,
    };
    const r2: Enemy = {
      sp: mk(this.tex.rival2),
      pos: { x: startWorldX - 40, y: this.playerY + 6 },
      speed: this.baseSpeed,
      shootFlash: 0, hp: 999, dead: false,
      isRival: true, base: 455, amp: 35, phase: Math.random() * Math.PI * 2, jitterT: 0,
    };

    this.rivals.push(r1, r2);

    for (const r of this.rivals) {
      r.sp.x = this.screenX(r.pos.x);
      r.sp.y = r.pos.y;
    }
  }

  /* ============================ Spawns/FX ================================ */
  private spawnEnemy() {
    if (this.controlsLocked) return;
    const margin = 240;
    const x = this.camX + this.W + margin;
    const y = this.playerY;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    sp.scale.set(this.enemyScale); 
    sp.zIndex = 750; // enemigos debajo de rivales y player
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0x27ae60);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const rel = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 80);
    const speed = this.baseSpeed + rel;

    this.enemies.push({ sp, pos: { x, y }, speed, shootFlash: 0, hp: 3, dead: false });
  }
private enemyShoot(from: Enemy) {
  if (from.dead) return;

  const sx = this.screenX(from.pos.x), sy = from.pos.y - 24;
  const dx = this.player.x, dy = this.player.y - 10;
  const ang = Math.atan2(dy - sy, dx - sx);
  const v = 430;

  // ¡Siempre vinilo en L1!
  const gfx = this.makeReggaetonDisc();
gfx.scale.set(3); 
  const shot: Shot = {
    sp: gfx,
    pos: { x: from.pos.x, y: sy },
    vx: Math.cos(ang) * v,
    vy: Math.sin(ang) * v,
  };

  // que gire
  (shot.sp as any).rotSpeed = Math.random() < 0.5 ? -8 : 8;

  shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
  shot.sp.zIndex = 900;
  this.world.addChild(shot.sp);
  this.shots.push(shot);

  this.opts.audio?.playOne?.("enemyShoot");

  if (!from.dead && this.tex.enemyAtk) {
    from.sp.texture = this.tex.enemyAtk;
    setTimeout(() => { if (!from.dead && this.tex.enemy) from.sp.texture = this.tex.enemy; }, 180);
  }
}



  private setPlayerTextureHit(){ if (this.tex.kartHit) this.player.texture = this.tex.kartHit; this.hitTimer = 0.18; }
  private setPlayerTextureNormal(){ if (this.tex.kart) this.player.texture = this.tex.kart; }
  private setPlayerTextureDead(){ if (this.tex.kartDead) this.player.texture = this.tex.kartDead; }
  private setPlayerTextureShoot(){ if (this.tex.kartShoot) { this.player.texture = this.tex.kartShoot; this.shootPlayerTimer = 0.12; } }

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

  // Congelar juego/combate
  this.controlsLocked = true;
  this.invuln = 9999;
  this.shotCooldown = 9999;
  this.enemyTimer = 9999;
  this.pickupTimer = 9999;
  this.lifePickupTimer = 9999;
  this.godPickupTimer = 9999;
  this.speed = 0;

  // ⬇️ cortar audio que pueda quedar sonando
  this.opts.audio?.stopSfx?.("motor");
  // this.opts.audio?.stopBgm?.();

  // limpiar proyectiles
  for (const s of this.shots) { try { s.sp.destroy(); } catch {} }
  this.shots = [];
  for (const s of this.playerShots) { try { s.sp.destroy(); } catch {} }
  this.playerShots = [];

  const label = place === 1 ? "¡1º!" : place === 2 ? "2º" : "3º";
  this.showResultOverlay(label);

 if (this.overlayTimer) clearTimeout(this.overlayTimer);
this.overlayTimer = window.setTimeout(() => {
  this.overlay.visible = false;
  this.opts.onLevelComplete?.(place);
}, 3000); // 3s (>= 2s) para que el cartel quede visible
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
  }

  // ✅ gatea daño por invuln y por godMode
  private hurtPlayer(dmg: number): boolean {
    if (this.invuln > 0 || this.ended || this.godMode) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime;
    this.redrawHP();
    this.setPlayerTextureHit();
    this.opts.audio?.playOne?.("playerHit");
    if (this.hp <= 0) this.endGame();
    return true;
  }

  /* ============================== Pickups ================================ */
  private spawnPickup(){
    if (this.controlsLocked) return;
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

  private spawnLifePickup(){
    if (this.controlsLocked) return;
    const x = this.camX + this.W + 200;
    const y = this.playerY - 40;
    const sp = new PIXI.Sprite(this.tex.life ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 800;
    if (!this.tex.life) {
      const g = new PIXI.Graphics().circle(0,0,10).fill(0x33dd33);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "life" });
  }

  private spawnGodPickup(){
    if (this.controlsLocked || this.godPickupsSpawned >= this.godPickupsMax) return;
    const x = this.camX + this.W + 220;
    const y = this.playerY - 60;
    const sp = new PIXI.Sprite(this.tex.god ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5);
    sp.zIndex = 820;
    if (!this.tex.god) {
      const g = new PIXI.Graphics().circle(0,0,12).fill(0xffee66).stroke({width:2,color:0xaa9900});
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);
    this.pickups.push({ sp, pos: { x, y }, kind: "god" });
  }

  private givePickup(p: Pickup){
    if (p.kind === "distortion") {
      this.hasDistortion = true;
      this.distortTimer = this.distortDuration;
      this.ammo = 10;
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

  private setGod(on: boolean) {
    this.godMode = on;
    if (on) {
  // NUEVO NUMERO SEGUIMIENTO: activar flama God
  this.godFireContainer.visible = true;
  this.godFireTimer = 0;
} else {
  // NUEVO NUMERO SEGUIMIENTO: desactivar flama God + limpiar
  this.godFireContainer.visible = false;
  for (const f of this.godFire) { try { f.sp.destroy(); } catch {} }
  this.godFire = [];
}
    if (on) {
      this.godTimer = this.godDuration;
      (this.player as any).tint = 0xffee66;

      // halo visible
      this.drawGodHalo();
      this.godHalo.visible = true;
      this.godHalo.alpha = 0.5;
      this.godHaloPulse = 0;

      // cartelito
      this.showLapAnnounce("¡MODO DIOS!");
      
    } else {
      (this.player as any).tint = 0xffffff;
      this.godHalo.visible = false;
      
    }
  }

  private drawGodHalo(){
    this.godHalo.clear();
    // halo doble elíptico detrás del kart
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 70, 36).fill({ color: 0xffd200, alpha: 0.22 });
    this.godHalo.ellipse(0, this.playerY - this.jumpOffset - 18, 44, 18).fill({ color: 0xffffaa, alpha: 0.18 });
    this.godHalo.zIndex = 990;
  }
  // Nota musical “sol”/corchea simple en dorado
private makeNoteShot(): PIXI.Graphics {
  const col = 0xff00ff;         // dorado
  const edge = 0xff00ff;        // borde sutil

  const g = new PIXI.Graphics();

  // Cabeza de la nota
  g.circle(0, 0, 8).fill(col).stroke({ width: 2, color: edge, alignment: 1 });

  // Plica (palito)
  g.roundRect(6, -26, 4, 26, 2).fill(col);

  // Banderín (rectangulito redondeado a la derecha)
  const flag = new PIXI.Graphics().roundRect(10, -26, 18, 10, 4).fill(col);
  flag.alpha = 0.95;
  g.addChild(flag);

  // (opcional) toque de inclinación inicial
  g.rotation = -0.12;

  return g;
}

// 🎧 Disparo reggaetonero: "vinilo" girando
private makeReggaetonDisc(): PIXI.Graphics {
  const g = new PIXI.Graphics();

  // glow suave alrededor
  const glow = new PIXI.Graphics().circle(0, 0, 16).fill({ color: 0xff33aa, alpha: 0.22 });
  g.addChild(glow);

  // disco base
  g.circle(0, 0, 12).fill(0x111111).stroke({ width: 2, color: 0xffffff, alignment: 1, alpha: 0.6 });

  // “surcos” del vinilo
  g.circle(0, 0, 9).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  g.circle(0, 0, 6).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });

  // etiqueta del centro (neón)
  g.circle(0, 0, 4).fill(0xff33aa);

  return g;
}

  private emitGodTrail(){
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
// NUEVO NUMERO SEGUIMIENTO: emitir flama del Modo Dios
private emitGodFire() {
  // 2-3 llamas por tick
  const count = 2 + (Math.random() * 2) | 0;
  for (let i = 0; i < count; i++) {
    const g = new PIXI.Graphics();
    const col = Math.random() < 0.5 ? 0xff6a00 : 0xffd200; // naranja/amarillo
    const rw = 8 + Math.random() * 6;
    const rh = 12 + Math.random() * 8;

    g.ellipse(0, 0, rw, rh).fill(col);
    g.alpha = 0.9;

    // detrás del kart, con un poquito de aleatorio
    const px = this.player.x - 28 + (Math.random() * 12 - 6);
    const py = this.player.y - this.jumpOffset + 4 + (Math.random() * 10 - 5);
    g.position.set(px, py);

    this.godFireContainer.addChild(g);
    const life = 0.35 + Math.random() * 0.25;
    this.godFire.push({ sp: g, life, max: life });
  }
}

// NUEVO NUMERO SEGUIMIENTO: update de la flama God
private updateGodFire(dt: number) {
  if (!this.godFire.length) return;
  for (const p of this.godFire) {
    // subir y moverse hacia la izquierda (viento)
    p.sp.y -= 50 * dt;
    p.sp.x -= 120 * dt;
    p.life -= dt;

    const a = Math.max(0, p.life / p.max);
    p.sp.alpha = a;
    p.sp.scale.set(1 + (1 - a) * 0.4);
  }
  this.godFire = this.godFire.filter(p => {
    if (p.life > 0) return true;
    try { p.sp.destroy(); } catch {}
    return false;
  });
}

  private playerFire(){
    if (!this.hasDistortion || this.playerShotCd > 0) return;
    if (this.ammo <= 0) return;

    const sx = this.player.x + 40;
    const sy = this.player.y - 24;
    const speed = 900;

    // AHORA (nota musical)
const gfx = this.makeNoteShot();
const shot: Shot = { sp: gfx, pos: { x: this.camX + sx, y: sy }, vx: speed, vy: 0 };

    shot.sp.position.set(sx, sy);
    shot.sp.zIndex = 800; // por encima de rivales/enemigos
    this.world.addChild(shot.sp);
    this.playerShots.push(shot);
    this.playerShotCd = this.playerShotCdMax;
    this.opts.audio?.playOne?.("playerShoot");

    // gastar bala
    this.ammo--; this.updateAmmoHud();
    if (this.ammo <= 0) { this.hasDistortion = false; this.redrawPower(); }

    // sprite shooting
    this.setPlayerTextureShoot();
  }

  /* ===== Mini-mapa: actualizar pins y palito de meta ===== */
  private updateMiniMap() {
    const playerWorld = this.camX + this.player.x;
    const r1x = this.rivals[0]?.pos.x ?? playerWorld;
    const r2x = this.rivals[1]?.pos.x ?? playerWorld;

    const progP  = this.lapProgressFor(playerWorld);
    const progR1 = this.lapProgressFor(r1x);
    const progR2 = this.lapProgressFor(r2x);

    const px = this.mapX + progP  * this.mapW;
    const r1 = this.mapX + progR1 * this.mapW;
    const r2 = this.mapX + progR2 * this.mapW;

    this.mapPinPlayer.position.set(px, this.mapY + this.mapH * 0.5);
    this.mapPinR1.position.set(r1, this.mapY + this.mapH * 0.5);
    this.mapPinR2.position.set(r2, this.mapY + this.mapH * 0.5);

    // Palito de meta: en modo por vuelta queda al final de la barra
    this.mapLapTick.position.set(this.mapX + this.mapW, this.mapY);
  }
// NUEVO NUMERO SEGUIMIENTO: labels “1/2/3” sobre cada kart (más grande)
// Labels grandes (x3) con sombra
posTextP = new PIXI.Text({
  text: "1",
  style: {
    fill: 0xffffff,
    fontSize: 96,              // triple
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

// NUEVO NUMERO SEGUIMIENTO: flamas detrás de cada numerito
posFlameP = new PIXI.Graphics();
posFlameR1 = new PIXI.Graphics();
posFlameR2 = new PIXI.Graphics();
posFlameTime = 0;


// NUEVO NUMERO SEGUIMIENTO: actualiza y anima las flamas de los labels




  // NUEVO NUMERO SEGUIMIENTO: ordenar por worldX y ubicar labels 1/2/3 + flamas
// NUEVO NUMERO SEGUIMIENTO: ordenar por worldX y ubicar labels 1/2/3 + flamas arriba de la cabeza
private updateRacePositions() {
  const playerWX = this.camX + this.player.x;
  const r1WX = this.rivals[0]?.pos.x ?? -Infinity;
  const r2WX = this.rivals[1]?.pos.x ?? -Infinity;

  const rows = [
    { sp: this.player,        wx: playerWX, label: this.posTextP },
    { sp: this.rivals[0]?.sp, wx: r1WX,     label: this.posTextR1 },
    { sp: this.rivals[1]?.sp, wx: r2WX,     label: this.posTextR2 },
  ].filter(r => r.sp);

  rows.sort((a, b) => b.wx - a.wx); // más adelante = 1º

  const OFFSET_UP = -38;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sp = r.sp as PIXI.Sprite;
    const yTop = sp.y - sp.height * (sp.anchor?.y ?? 0.5);

    r.label.text = String(i + 1);
    (r.label.style as any).fill = this.colorForPlace(i + 1);
    r.label.x = sp.x;
    r.label.y = yTop - OFFSET_UP;
  }
}





  /* =============================== Update ================================ */
  update(dt: number) {
  
  // COUNTDOWN
if (this.controlsLocked && !this.finished && !this.ended) {
  this.countdownTimer -= dt;
  if (this.countdownTimer <= 0) {
    if (this.countdown === 3) {
      // Pasa a "2" → se enciende AMARILLO (rojo ya venía de setup)
      this.countdown = 2;
      this.countdownText.text = "2";
      this.countdownTimer = 1.0;
      this.setTrafficLights(true, true, false);   // rojo + amarillo
      this.opts.audio?.playOne?.("countBeep");
    } else if (this.countdown === 2) {
      // Pasa a "1" → se enciende VERDE (quedan las 3 encendidas)
      this.countdown = 1;
      this.countdownText.text = "1";
      this.countdownTimer = 1.0;
      this.setTrafficLights(true, true, true);    // rojo + amarillo + verde
      this.opts.audio?.playOne?.("countBeep");
    } else if (this.countdown === 1) {
      // GO!
      this.countdown = 0;
      this.countdownText.text = "GO!";
      (this.countdownText.style as any).fill = 0x00ff66;
      this.goFlashTimer = 0.6;
      this.countdownTimer = 0.4;

      // Opción A (acumulativo): mantener las 3 encendidas
      this.setTrafficLights(true, true, true);
      // Opción B (solo verde en GO): descomentá esta y comentá la de arriba
      // this.setTrafficLights(false, false, true);

      this.opts.audio?.playOne?.("countGo");
    } else {
      // Arranca la carrera
      this.overlay.removeChildren();
      this.overlay.visible = false;
      this.controlsLocked = false;
    }
  }

  // Parpadeo del "GO!"
  if (this.goFlashTimer > 0) {
    this.goFlashTimer -= dt;
    (this.countdownText as any).alpha = 0.55 + 0.45 * Math.sin(this.goFlashTimer * 20);
  }
}

  if (this.ended) return;
  if (this.finished) return; 

    // tiempo total (visual)
    if (!this.finished && !this.controlsLocked) {
      this.raceTime += dt;
      this.timeText.text = this.fmt(this.raceTime * 1000);
    }

    // ===== Lógica de vuelta por DISTANCIA =====
    const playerWorldX = this.camX + this.player.x;
    while (!this.finished && !this.controlsLocked && playerWorldX >= this.lapFinishX) {
      if (this.lap < this.lapsTotal) {
        this.lap += 1;
        this.updateLapHud();

        // Anuncio (cada 5 y todas en últimas 5; en la 20 “¡ÚLTIMA VUELTA!”)
        if (this.lap === this.lapsTotal) {
          this.showLapAnnounce("¡ÚLTIMA VUELTA!");
        } else if (this.shouldAnnounceLap(this.lap)) {
          this.showLapAnnounce(`VUELTA ${this.lap}`);
        }

        this.setFinishTextureForLap(this.lap);
        this.lapFinishX += this.trackLength; // siguiente meta
      } else {
        // resultado final según rivales
        const rivalsAhead = this.rivals.filter(r => r.pos.x >= this.lapFinishX).length;
        const place = (1 + rivalsAhead) as 1 | 2 | 3;
        this.levelComplete(place);
        return;
      }
    }

    // timers básicos
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitTimer > 0) { this.hitTimer -= dt; if (this.hitTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.shootPlayerTimer > 0) { this.shootPlayerTimer -= dt; if (this.shootPlayerTimer <= 0) this.setPlayerTextureNormal(); }
    if (this.playerShotCd > 0) this.playerShotCd -= dt;

    // distorsión (arma) por tiempo
    if (this.hasDistortion) {
      this.distortTimer -= dt;
      if (this.distortTimer <= 0) { this.hasDistortion = false; this.redrawPower(); }
    }

    // GOD MODE: countdown + FX (halo/trail)
    if (this.godMode) {
      this.godFireTimer -= dt;
if (this.godFireTimer <= 0) {
  this.emitGodFire();
  this.godFireTimer = 0.04; // ~25 fps partículas
}
this.updateGodFire(dt);
      this.godTimer -= dt;
      if (this.godTimer <= 0) {
        this.setGod(false);
      } else {
        // halo sigue al jugador
        this.godHalo.position.set(this.player.x, 0); // x = jugador (mismo mundo)
        this.drawGodHalo(); // redibuja a la altura actual del jugador
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
      }

    }

    // fade del anuncio de vuelta (2s)
    if (this.lapAnnounceTimer > 0) {
      this.lapAnnounceTimer -= dt;
      const t = Math.max(0, this.lapAnnounceTimer);
      const total = 2.0;
      this.lapAnnounce.alpha = t / total;
      if (this.lapAnnounceTimer <= 0) {
        this.lapAnnounce.visible = false;
      }
    }

    // velocidad jugador (x2 en godMode)
    const accelPressed = this.input.a.right && !this.controlsLocked;
    const boost = this.godMode ? 2.0 : 1.0;
    const target = (accelPressed ? this.maxSpeed : this.baseSpeed) * boost;
    if (this.speed < target) this.speed = Math.min(target, this.speed + this.accel * dt);
    else this.speed = Math.max(target, this.speed - this.friction * dt * 0.5);

    // mover jugador
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

    // disparo
    const shootPressed = (this.input as any).a.fire2 || (this.input as any).a.ctrl || (this.input as any).a.F;
    if (!this.controlsLocked && shootPressed && this.hasDistortion) this.playerFire();

    // cámara y parallax
    this.camX += this.speed * dt;
    const bgOffset = -(this.camX * 0.25) % this.bgWidthScaled;
    this.bg1.x = bgOffset; this.bg2.x = bgOffset + this.bgWidthScaled;
    if (this.bg1.x <= -this.bgWidthScaled) this.bg1.x += this.bgWidthScaled * 2;
    if (this.bg2.x <= -this.bgWidthScaled) this.bg2.x += this.bgWidthScaled * 2;
    this.ground.tilePosition.x = -this.camX;

    // aplicar jugador
    this.player.x = this.playerX;
    this.player.y = this.playerY - this.jumpOffset;

    // actualizar trail (mover y desvanecer)
    if (this.godTrail.length) {
      for (const p of this.godTrail) {
        // mover ligeramente hacia la izquierda (referencia a parallax del mundo)
        p.sp.x -= (this.baseSpeed * 1.2) * dt;
        p.life -= dt;
        const a = Math.max(0, p.life / p.max);
        p.sp.alpha = a * 0.85;
        const s = 0.9 + 0.2 * (1 - a);
        p.sp.scale.set(s);
      }
      // limpiar
      this.godTrail = this.godTrail.filter(tp => {
        if (tp.life > 0) return true;
        try { tp.sp.destroy(); } catch {}
        return false;
      });
    }

    // meta: posición fija en worldX de la vuelta actual
    if (this.finishSprite) {
      this.finishSprite.x = this.screenX(this.lapFinishX);
      this.finishSprite.y = this.ground.y + this.FINISH_Y_OFFSET;
    }

    /* -------------------- Rivales (IA) -------------------- */
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      r.phase! += dt * (0.7 + 0.3 * i);
      const osc = Math.sin(r.phase!) * (r.amp ?? 40);

      const baseLapX = (this.lap - 1) * this.trackLength;
      const rivalRelX = r.pos.x - baseLapX;
      const playerRelX = (this.camX + this.player.x) - baseLapX;
      const gap = playerRelX - rivalRelX;

      let catchup = 0;
      if (gap > 450) catchup += 55;   // si están muy atrás, aceleran
      if (gap < -450) catchup -= 35;  // si van muy adelante, aflojan

      r.jitterT! += dt;
      let jitter = 0;
      if (r.jitterT! > 0.4) { r.jitterT = 0; jitter = (Math.random() * 50 - 25); }

      const rivalMaxWhenYouBoost = this.maxSpeed - 15; // vos 520, ellos ~505
      const rivalMaxWhenCruise   = this.maxSpeed + 35; // si no acelerás, pueden 555

      // handicap durante godMode (les cuesta seguirte)
      const godHandicap = this.godMode ? -120 : 0;

      const targetVBase = (r.base ?? 460) + osc + catchup + jitter + godHandicap;
      const maxRival = accelPressed ? rivalMaxWhenYouBoost : rivalMaxWhenCruise;
      const minRival = this.baseSpeed + 40;

      const targetV = Math.max(minRival, Math.min(maxRival, targetVBase));
      r.speed = r.speed * 0.82 + targetV * 0.18;

      // separarse si se pegan
      for (let j = 0; j < this.rivals.length; j++) if (j !== i) {
        const o = this.rivals[j];
        const dx = r.pos.x - o.pos.x;
        if (Math.abs(dx) < 220) r.speed += (dx < 0 ? -25 : +15) * dt * 60;
      }

      r.pos.x += r.speed * dt;
      const farAhead = (r.pos.x - this.camX) > (this.W + 700);
      if (farAhead) r.speed -= 60 * dt * 60;

      r.sp.x = this.screenX(r.pos.x);
      r.sp.y = r.pos.y;
    }

    /* -------------------- Enemigos comunes -------------------- */
    // spawn
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0) { this.spawnEnemy(); this.nextEnemyIn(); }

    // disparos enemigos
    this.shotCooldown -= dt;
    if (this.shotCooldown <= 0 && this.enemies.length > 0 && !this.controlsLocked) {
      const cand = this.enemies.filter(e => !e.dead && this.screenX(e.pos.x) > this.player.x - 40 && this.screenX(e.pos.x) < this.W + 40);
      if (cand.length) {
        const shooter = cand[(Math.random() * cand.length) | 0];
        this.enemyShoot(shooter);
        this.shotCooldown = 0.6 + Math.random() * 0.6;
      } else this.shotCooldown = 0.2;
    }

    for (const e of this.enemies) {
      e.pos.x -= e.speed * dt;
      e.sp.x = this.screenX(e.pos.x);
      e.sp.y = this.playerY;

      if (e.shootFlash > 0) {
        e.shootFlash -= dt;
        if (e.shootFlash <= 0 && !e.dead && this.tex.enemy) e.sp.texture = this.tex.enemy;
      }

      // colisión con jugador
      const pb = this.player.getBounds();
      const eb = e.sp.getBounds();
      const overlap = pb.right > eb.left && pb.left < eb.right && pb.bottom > eb.top && pb.top < eb.bottom;

      if (overlap && this.jumpOffset < 10 && !this.controlsLocked) {
        if (!e.dead) {
          this.playerX -= 50 * dt * 60;
          e.pos.x += 100 * dt;
          const minKeep = this.baseSpeed * 0.7; if (this.speed < minKeep) this.speed = minKeep;

          // ✅ solo sonar/dañar una vez gracias a invuln/god
          if (this.hurtPlayer(6)) {
            this.opts.audio?.playOne?.("crash");
          }
        }
      }
    }

    // proyectiles enemigos
   for (const s of this.shots) {
  s.pos.x += s.vx * dt;
  s.pos.y += s.vy * dt;
  s.sp.x = this.screenX(s.pos.x);
  s.sp.y = s.pos.y;

  // 👇 rotación del vinilo si tiene rotSpeed
  const rs = (s.sp as any).rotSpeed ?? 0;
  if (rs) s.sp.rotation += rs * dt;

  const pb = this.player.getBounds(), sb = s.sp.getBounds();
  const hit = pb.right > sb.left && pb.left < sb.right && pb.bottom > sb.top && pb.top < sb.bottom;
  if (hit && this.jumpOffset < 10 && !this.controlsLocked) {
    if (this.hurtPlayer(12)) this.opts.audio?.playOne?.("impact");
    s.pos.x = this.camX - 9999;
  }
}

    this.shots = this.shots.filter(s => {
      const alive = s.pos.x > this.camX - 300 && s.pos.x < this.camX + this.W + 400 && s.pos.y > 0 && s.pos.y < this.H;
      if (!alive) s.sp.destroy();
      return alive;
    });

    // pickups
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.spawnPickup();
      this.pickupTimer = this.pickupMin + Math.random() * (this.pickupMax - this.pickupMin);
    }

    this.lifePickupTimer -= dt;
    if (this.lifePickupTimer <= 0) {
      this.spawnLifePickup();
      this.lifePickupTimer = this.lifePickupMin + Math.random() * (this.lifePickupMax - this.lifePickupMin);
    }

    // GOD pickup raro
    this.godPickupTimer -= dt;
    if (this.godPickupsSpawned < this.godPickupsMax && this.godPickupTimer <= 0) {
      this.spawnGodPickup();
      // no contamos acá (contamos al agarrarlo); reiniciamos el temporizador
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

    // disparos jugador
    for (const s of this.playerShots) {
      s.pos.x += s.vx * dt; s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x); s.sp.y = s.pos.y;
        s.sp.rotation = Math.sin(s.pos.x * 0.02) * 0.25;


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
            e.speed = this.baseSpeed;
            this.opts.audio?.playOne?.("crash");
          }
        }
      }
    }
    this.playerShots = this.playerShots.filter(s => { const alive = s.pos.x < this.camX + this.W + 300; if (!alive) s.sp.destroy(); return alive; });

    // culling enemigos
    this.enemies = this.enemies.filter(e => { const alive = e.pos.x > this.camX - 600; if (!alive) e.sp.destroy(); return alive; });
this.updateRacePositions();

    // ===== Mini-mapa al final del frame =====
    this.updateMiniMap();
  }

  /* ============================== Destroy ================================ */
  destroy() {
        // NUEVO NUMERO SEGUIMIENTO: limpiar labels
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
    for (const p of this.pickups) { try { p.sp.destroy(); } catch {} }
    for (const t of this.godTrail) { try { t.sp.destroy(); } catch {} }
    try { this.godHalo.destroy(); } catch {}
    for (const f of this.godFire) { try { f.sp.destroy(); } catch {} }
try { this.godFireContainer.destroy({ children: true }); } catch {}
    try { this.trailContainer.destroy({ children: true }); } catch {}
    try { this.stage.destroy({ children: true }); } catch {}
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
  }
}
