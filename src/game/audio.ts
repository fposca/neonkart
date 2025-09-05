import { Howl, Howler } from "howler";
import { BGM, SFX } from "./assets";
import type { SfxLoopName, SfxOneName } from "./assets";

/** Prefija con BASE_URL para que funcione en subcarpetas */
const BASE = (import.meta as any)?.env?.BASE_URL ?? "/";

function withBase(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith(BASE)) return src;
  if (src.startsWith("/")) return `${BASE}${src.slice(1)}`;
  return `${BASE}${src}`;
}

/** Normaliza assets: string o string[] → string[] con BASE aplicado */
function sourcesFrom(asset: string | string[]): string[] {
  const arr = Array.isArray(asset) ? asset : [asset];
  return arr.map(withBase);
}

/** Throttle simple por SFX (evita repetir demasiadas veces en poco tiempo) */
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

/* ========= NUEVO: aceptar 'pickupLife' y aliasarlo a 'pickup' si falta ======== */
type OneShotName = SfxOneName | "pickupLife";
const ALIAS_ONESHOTS: Partial<Record<OneShotName, SfxOneName>> = {
  pickupLife: "pickup",
};

export class AudioBus {
  private bgm?: Howl;
  private currentBgmKey?: string; // 👈 pista actual (para no reiniciar)
  private sfxLoops = new Map<SfxLoopName, Howl>();
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
      type HowlerWithCtx = typeof Howler & { ctx?: AudioContext };
      const ctx = (Howler as HowlerWithCtx).ctx;
      if (ctx && ctx.state !== "running") await ctx.resume();
    } catch {}
  }

  // ===================== BGM =====================
  private playBgmFrom(asset: string | string[], key: string) {
    // Si ya suena la misma pista, no la reinicies
    if (this.bgm && this.bgm.playing() && this.currentBgmKey === key) return;

    this.stopBgm();
    const src = sourcesFrom(asset);
    this.bgm = new Howl({
      src,
      loop: true,
      volume: 0.5,
      html5: true,
    });
    this.currentBgmKey = key;
    this.bgm.play();
  }

  playBgmMenu()   { this.playBgmFrom(BGM.menu,   "menu"); }
  playBgmLevel1() { this.playBgmFrom(BGM.nivel1, "nivel1"); }

  stopBgm() {
    if (!this.bgm) return;
    try { this.bgm.stop(); this.bgm.unload(); } catch {}
    this.bgm = undefined;
    this.currentBgmKey = undefined;
  }

  // ===================== SFX loops =====================
  playSfx(name: SfxLoopName) {
    let h = this.sfxLoops.get(name);
    if (!h) {
      const asset = (SFX as any)[name] as string | string[];
      const src = sourcesFrom(asset);
      h = new Howl({
        src,
        loop: true,
        volume: 0.3,
        html5: true,
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
  playOne(name: OneShotName, opts?: { volume?: number; rate?: number }) {
    if (!this.gate.allow(name)) return;

    let asset = (SFX as any)[name] as string | string[] | undefined;
    if (!asset) {
      const alias = ALIAS_ONESHOTS[name];
      if (alias) asset = (SFX as any)[alias];
    }
    if (!asset) return;

    const src = sourcesFrom(asset);
    const howl = new Howl({
      src,
      volume: opts?.volume ?? 0.7,
    });
    const id = howl.play();
    if (opts?.rate) howl.rate(opts.rate, id);
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
