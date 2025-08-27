// src/game/Level1.ts
import * as PIXI from "pixi.js";
import { IMG } from "./assets";
import { Input } from "./input";
import type { AudioBus } from "./audio";

type Vec2 = { x: number; y: number };
type Enemy = { sp: PIXI.Sprite; pos: Vec2; speed: number };
type Shot  = { sp: PIXI.Graphics; pos: Vec2; vx: number; vy: number };

type LevelOpts = {
  onGameOver?: () => void;
  audio?: AudioBus;
};

export class Level1 {
  app: PIXI.Application;
  input: Input;
  opts: LevelOpts;

  // viewport
  readonly W = 1280;
  readonly H = 720;

  // capas
  stage = new PIXI.Container();
  bgLayer = new PIXI.Container();
  world = new PIXI.Container();
  hud = new PIXI.Container();

  // fondo
  bg1 = new PIXI.Sprite();
  bg2 = new PIXI.Sprite();
  bgWidthScaled = 0;

  // suelo
  ground!: PIXI.TilingSprite;

  // cámara
  camX = 0;

  // jugador
  player = new PIXI.Sprite();
  playerX = 360;
  playerY = 520;
  minX = 120;
  maxX = 1180;

  // scroll
  speed = 0;
  baseSpeed = 220;
  maxSpeed  = 440;
  accel = 520;
  friction = 420;

  // movimiento lateral
  strafe = 520;

  // salto
  jumping = false;
  jumpVy = 0;
  jumpOffset = 0;
  jumpImpulse = 1900;
  gravity     = 2900;

  // vida
  maxHP = 100;
  hp = 100;
  invuln = 0;
  invulnTime = 0.8;
  hpBarBg = new PIXI.Graphics();
  hpBarFg = new PIXI.Graphics();

  // estado fin
  ended = false;           // <- congela update al morir
  hitTimer = 0;            // <- tiempo de “golpeado” para sprite

  // enemigos
  enemies: Enemy[] = [];
  enemyTimer = 0;
  enemyMin = 2.5;
  enemyMax = 4.5;

  // tiros
  shots: Shot[] = [];
  shotCooldown = 0;

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
  }

  private nextEnemyIn() {
    this.enemyTimer = this.enemyMin + Math.random() * (this.enemyMax - this.enemyMin);
  }

  private async tryLoad(url: string) {
    try { return await PIXI.Assets.load(url); } catch { return undefined; }
  }

  async load() {
    // texturas
    this.tex.fondo = await this.tryLoad(IMG.fondo);
    this.tex.suelo = await this.tryLoad(IMG.suelo);
    this.tex.kart  = await this.tryLoad(IMG.kartSide);
    this.tex.kartHit  = await this.tryLoad(IMG.kartHit);
    this.tex.kartDead = await this.tryLoad(IMG.kartDead);
    this.tex.enemy = await this.tryLoad(IMG.regSide);

    // fondo con 2 sprites (llenan canvas)
    if (this.tex.fondo) {
      const tex = this.tex.fondo;
      const scaleX = this.W / tex.width;
      const scaleY = this.H / tex.height;
      this.bgWidthScaled = this.W;

      this.bg1 = new PIXI.Sprite(tex);
      this.bg1.scale.set(scaleX, scaleY);
      this.bg1.position.set(0, 0);

      this.bg2 = new PIXI.Sprite(tex);
      this.bg2.scale.set(scaleX, scaleY);
      this.bg2.position.set(this.bgWidthScaled, 0);
    } else {
      const t = this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,this.W,this.H).fill(0x1a1a1a));
      this.bg1.texture = t; this.bg2.texture = t;
      this.bg1.position.set(0,0); this.bg2.position.set(this.W,0);
      this.bg1.scale.set(1); this.bg2.scale.set(1);
      this.bgWidthScaled = this.W;
    }
    this.bgLayer.addChild(this.bg1, this.bg2);

    // suelo
    const gtex = this.tex.suelo ??
      this.app.renderer.generateTexture(new PIXI.Graphics().rect(0,0,512,160).fill(0x222));
    this.ground = new PIXI.TilingSprite({ texture: gtex, width: this.W, height: 160 });
    this.ground.y = this.H - this.ground.height;
    this.world.addChild(this.ground);

    // jugador
    if (this.tex.kart) this.player.texture = this.tex.kart;
    else {
      const g = new PIXI.Graphics().rect(-28,-18,56,36).fill(0xff00ff);
      this.player.texture = this.app.renderer.generateTexture(g);
    }
    this.player.anchor.set(0.5, 0.8);
    this.player.position.set(this.playerX, this.playerY);
    this.world.addChild(this.player);

    // HUD
    this.hud.position.set(20, 20);
    this.hpBarBg.roundRect(0,0, 260,18, 9).fill(0x222222).stroke({width:2, color:0x000000});
    this.hud.addChild(this.hpBarBg, this.hpBarFg);
    this.redrawHP();

    this.nextEnemyIn();
  }

  private redrawHP() {
    const pct = Math.max(0, this.hp / this.maxHP);
    this.hpBarFg.clear();
    this.hpBarFg.roundRect(1,1, 258*pct,16, 8).fill(pct>0.4?0x33dd66:0xdd3344);
  }

  private spawnEnemy() {
    const margin = 240;
    const x = this.camX + this.W + margin;
    const y = this.playerY;

    const sp = new PIXI.Sprite(this.tex.enemy ?? PIXI.Texture.WHITE);
    sp.anchor.set(0.5, 0.8);
    if (!this.tex.enemy) {
      const g = new PIXI.Graphics().rect(-24,-16,48,32).fill(0x27ae60);
      sp.texture = this.app.renderer.generateTexture(g);
    }
    this.world.addChild(sp);

    const rel = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random()*80);
    const speed = this.baseSpeed + rel;

    this.enemies.push({ sp, pos: { x, y }, speed });
  }

  private screenX(worldX: number) { return worldX - this.camX; }

  private enemyShoot(from: Enemy) {
    const sx = this.screenX(from.pos.x);
    const sy = from.pos.y - 24;
    const dx = this.player.x;
    const dy = this.player.y - 10;
    const ang = Math.atan2(dy - sy, dx - sx);
    const speed = 420;

    const shot: Shot = {
      sp: new PIXI.Graphics().circle(0,0,6).fill(0x00ccff),
      pos: { x: from.pos.x, y: sy },
      vx: Math.cos(ang)*speed,
      vy: Math.sin(ang)*speed,
    };
    shot.sp.position.set(this.screenX(shot.pos.x), shot.pos.y);
    this.world.addChild(shot.sp);
    this.shots.push(shot);

    this.opts.audio?.playOne("enemyShoot");
  }

  private setPlayerTextureHit() {
    if (this.tex.kartHit) this.player.texture = this.tex.kartHit;
    this.hitTimer = 0.18; // 180ms de “golpeado”
  }
  private setPlayerTextureNormal() {
    if (this.tex.kart) this.player.texture = this.tex.kart;
  }
  private setPlayerTextureDead() {
    if (this.tex.kartDead) this.player.texture = this.tex.kartDead;
  }

  private endGame() {
    if (this.ended) return;
    this.ended = true;
    this.setPlayerTextureDead();
    this.opts.onGameOver?.(); // avisa a React
  }

  private hurtPlayer(dmg: number) {
    if (this.invuln > 0 || this.ended) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = this.invulnTime;
    this.redrawHP();
    this.setPlayerTextureHit();
    this.opts.audio?.playOne("playerHit");
    if (this.hp <= 0) this.endGame();
  }

  update(dt: number) {
    // si terminó, mantener animaciones mínimas (parallax pausado)
    if (this.ended) {
      // podés hacer una pequeña caída visual si querés:
      // this.player.rotation = Math.min(0.2, this.player.rotation + dt*0.4);
      return;
    }

    // timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.setPlayerTextureNormal();
    }

    // velocidad mundo
    const target = this.input.a.right ? this.maxSpeed : this.baseSpeed;
    if (this.speed < target) this.speed = Math.min(target, this.speed + this.accel * dt);
    else this.speed = Math.max(target, this.speed - this.friction * dt * 0.5);

    // mover jugador
    if (this.input.a.left)  this.playerX -= this.strafe * dt;
    if (this.input.a.right) this.playerX += this.strafe * dt * 0.6;
    this.playerX = Math.max(this.minX, Math.min(this.maxX, this.playerX));

    // salto
    if (this.input.a.fire && !this.jumping) {
      this.jumping = true;
      this.jumpVy = this.jumpImpulse;
    }
    if (this.jumping) {
      this.jumpVy -= this.gravity * dt;
      this.jumpOffset += this.jumpVy * dt;
      if (this.jumpOffset <= 0) {
        this.jumpOffset = 0;
        this.jumping = false;
        this.jumpVy = 0;
      }
    }

    // cámara
    this.camX += this.speed * dt;

    // parallax
    const bgOffset = -(this.camX * 0.25) % this.bgWidthScaled;
    this.bg1.x = bgOffset;
    this.bg2.x = bgOffset + this.bgWidthScaled;
    if (this.bg1.x <= -this.bgWidthScaled) this.bg1.x += this.bgWidthScaled * 2;
    if (this.bg2.x <= -this.bgWidthScaled) this.bg2.x += this.bgWidthScaled * 2;
    this.ground.tilePosition.x = -this.camX * 1.0;

    // aplicar jugador
    this.player.x = this.playerX;
    this.player.y = this.playerY - this.jumpOffset;

    // spawns
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0) { this.spawnEnemy(); this.nextEnemyIn(); }

    // disparos enemigos
    this.shotCooldown -= dt;
    if (this.shotCooldown <= 0 && this.enemies.length > 0) {
      const cand = this.enemies.filter(e => {
        const x = this.screenX(e.pos.x);
        return x > this.player.x - 40 && x < this.W + 40;
      });
      if (cand.length) {
        const shooter = cand[(Math.random()*cand.length)|0];
        this.enemyShoot(shooter);
        this.shotCooldown = 0.6 + Math.random()*0.6;
      } else {
        this.shotCooldown = 0.2;
      }
    }

    // mover enemigos + colisión
    for (const e of this.enemies) {
      e.pos.x -= e.speed * dt;
      e.sp.x = this.screenX(e.pos.x);
      e.sp.y = e.pos.y;

      const pb = this.player.getBounds();
      const eb = e.sp.getBounds();
      const overlap = pb.right>eb.left && pb.left<eb.right && pb.bottom>eb.top && pb.top<eb.bottom;

      if (overlap && this.jumpOffset < 10) {
        this.playerX -= 50 * dt * 60;
        this.playerX = Math.max(this.minX, this.playerX);
        e.pos.x += 100 * dt;
        const minKeep = this.baseSpeed * 0.7;
        if (this.speed < minKeep) this.speed = minKeep;
        this.hurtPlayer(6);
      }
    }

    // proyectiles
    for (const s of this.shots) {
      s.pos.x += s.vx * dt;
      s.pos.y += s.vy * dt;
      s.sp.x = this.screenX(s.pos.x);
      s.sp.y = s.pos.y;

      const pb = this.player.getBounds();
      const sb = s.sp.getBounds();
      const hit = pb.right>sb.left && pb.left<sb.right && pb.bottom>sb.top && pb.top<sb.bottom;
      if (hit && this.jumpOffset < 10) {
        this.hurtPlayer(12);
        s.pos.x = this.camX - 9999;
      }
    }
    this.shots = this.shots.filter(s => {
      const alive = s.pos.x > this.camX - 300 && s.pos.x < this.camX + this.W + 400 && s.pos.y > 0 && s.pos.y < this.H;
      if (!alive) s.sp.destroy();
      return alive;
    });

    // culling enemigos
    this.enemies = this.enemies.filter(e => {
      const alive = e.pos.x > this.camX - 220;
      if (!alive) e.sp.destroy();
      return alive;
    });
  }
}
