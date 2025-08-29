// src/game/audio.ts
import { Howl, Howler } from "howler";
import { BGM, SFX } from "./assets";
import type { SfxLoopName, SfxOneName } from "./assets";

/** Prefija con BASE_URL para que funcione en subcarpetas */
const BASE = (import.meta as any)?.env?.BASE_URL ?? "/";

function withBase(src: string): string {
  // ya tiene http(s) o ya viene con BASE → no tocar
  if (/^https?:\/\//i.test(src) || src.startsWith(BASE)) return src;
  // empieza con "/" → reemplazar por base
  if (src.startsWith("/")) return `${BASE}${src.slice(1)}`;
  // relativo simple
  return `${BASE}${src}`;
}

/** Normaliza assets: string o string[] → string[] con BASE aplicado */
function sourcesFrom(asset: string | string[]): string[] {
  const arr = Array.isArray(asset) ? asset : [asset];
  return arr.map(withBase);
}

/** Throttle simple por SFX (evita repetir demasiadas veces en poco tiempo) */
class SfxGate {
  private last = new Map<string, number>();
  private windowMs: number;
  constructor(windowMs = 120) {
    this.windowMs = windowMs;
  }
  allow(key: string) {
    const now = performance.now();
    const t = this.last.get(key) ?? 0;
    if (now - t < this.windowMs) return false;
    this.last.set(key, now);
    return true;
  }
}

export class AudioBus {
  private bgm?: Howl;
  private sfxLoops = new Map<SfxLoopName, Howl>(); // ej: "motor"
  private master = 1;
  private gate = new SfxGate(120);

  /** Volumen maestro (0..1) */
  setMasterVolume(v: number) {
    this.master = Math.max(0, Math.min(1, v));
    Howler.volume(this.master);
  }

  /** Desbloqueo de audio tras primer interacción */
  async resume() {
    try {
      // Howler.ctx no está tipado en @types/howler → hacemos un cast suave
      type HowlerWithCtx = typeof Howler & { ctx?: AudioContext };
      const ctx = (Howler as HowlerWithCtx).ctx;
      if (ctx && ctx.state !== "running") await ctx.resume();
    } catch {}
  }

  // ===================== BGM =====================
  private playBgmFrom(asset: string | string[]) {
    this.stopBgm();
    const src = sourcesFrom(asset);
    this.bgm = new Howl({
      src,
      loop: true,
      volume: 0.5,
      html5: true, // streaming (no decodifica todo al inicio)
    });
    this.bgm.play();
  }

  playBgmMenu()   { this.playBgmFrom(BGM.menu); }
  playBgmLevel1() { this.playBgmFrom(BGM.nivel1); }

  stopBgm() {
    if (!this.bgm) return;
    try { this.bgm.stop(); this.bgm.unload(); } catch {}
    this.bgm = undefined;
  }

  // ===================== SFX loops (motor, etc.) =====================
  playSfx(name: SfxLoopName) {
    let h = this.sfxLoops.get(name);
    if (!h) {
      const asset = (SFX as any)[name] as string | string[];
      const src = sourcesFrom(asset);
      h = new Howl({
        src,
        loop: true,
        volume: 0.3,
        html5: true, // loops largos → stream
      });
      this.sfxLoops.set(name, h);
    }
    if (!h.playing()) h.play();
  }

  stopSfx(name: SfxLoopName) {
    const h = this.sfxLoops.get(name);
    if (!h) return;
    try { h.stop(); h.unload(); } catch {}
    this.sfxLoops.delete(name);
  }

  // ===================== One-shots =====================
  playOne(name: SfxOneName) {
    // throttle suave para evitar spam (crash/impact rápidos)
    if (!this.gate.allow(name)) return;

    const asset = (SFX as any)[name] as string | string[];
    const src = sourcesFrom(asset);
    new Howl({
      src,
      volume: 0.7,
      // html5: false → WebAudio para baja latencia en sfx cortos
    }).play();
  }

  // ===================== Utilidad =====================
  stopAll() {
    this.stopBgm();
    for (const k of Array.from(this.sfxLoops.keys())) this.stopSfx(k);
  }

  destroy() {
    this.stopAll();
  }
}
