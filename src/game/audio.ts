// src/game/audio.ts
import { Howl, Howler } from "howler";
import { BGM, SFX } from "./assets";
import type { SfxLoopName, SfxOneName } from "./assets";

/** Prefija con BASE_URL para que funcione en subcarpetas */
const BASE = (import.meta as any)?.env?.BASE_URL ?? "/";
const withBase = (src: string) => {
  if (/^https?:\/\//i.test(src) || src.startsWith(BASE)) return src;
  if (src.startsWith("/")) return `${BASE}${src.slice(1)}`;
  return `${BASE}${src}`;
};
/** Normaliza assets: string o string[] → string[] con BASE aplicado */
const sourcesFrom = (asset: string | string[]): string[] =>
  (Array.isArray(asset) ? asset : [asset]).map(withBase);

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


/* ========= Alias de one-shots opcionales =========
   Agrego nombres que usaste en el juego pero quizá no existan en SFX.
   Caen a sonidos existentes si faltan. Ajustá a gusto. */
type OneShotName = SfxOneName | "pickupLife" | "boost" | "pickupShield" | "shieldBreak";
const ALIAS_ONESHOTS: Partial<Record<OneShotName, SfxOneName>> = {
  pickupLife: "pickup",
  boost: "countGo",        // o "pickup"
  pickupShield: "pickup",
  shieldBreak: "impact",
};

export class AudioBus {
  private bgm?: Howl;
  private currentBgmKey?: string;
  private sfxLoops = new Map<SfxLoopName, Howl>();
  private master = 0.8;
  private gate = new SfxGate(120);

  /** Volumen maestro (0..1) — es la que llamás desde App.tsx */
  setVolume(v: number) {
    this.master = Math.max(0, Math.min(1, v));
    Howler.volume(this.master);
  }
  /** Alias por si en algún lado llamabas setMasterVolume */
  setMasterVolume(v: number) { this.setVolume(v); }
  getVolume() { return this.master; }

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
    // si ya suena la misma pista, no la reinicies
    if (this.bgm && this.bgm.playing() && this.currentBgmKey === key) return;

    this.stopBgm();
    const src = sourcesFrom(asset);
    this.bgm = new Howl({
      src,
      loop: true,
      volume: 0.5, // relativo al master
      html5: true,
    });
    this.currentBgmKey = key;
    this.bgm.play();
  }

  playBgmMenu()   { this.playBgmFrom(BGM.menu,   "menu"); }
  playBgmLevel1() { this.playBgmFrom(BGM.nivel1, "nivel1"); }
  playBgmLevel2() { this.playBgmFrom(BGM.nivel2, "nivel2"); }
  playBgmLevel3() { this.playBgmFrom(BGM.nivel3, "nivel3"); }
  playBgmLevel4() { this.playBgmFrom(BGM.nivel4, "nivel4"); }
  playBgmLevel5() { this.playBgmFrom(BGM.nivel5, "nivel5"); }
  playBgmLevel6() { this.playBgmFrom(BGM.nivel6, "nivel6"); }
  playBgmLevel7() { this.playBgmFrom(BGM.nivel7, "nivel7"); }

  stopBgm() {
    if (!this.bgm) return;
    try { this.bgm.stop(); this.bgm.unload(); } catch {}
    this.bgm = undefined;
    this.currentBgmKey = undefined;
  }

  // ===================== SFX en loop (motor, etc.) =====================
  playSfx(name: SfxLoopName) {
    let h = this.sfxLoops.get(name);
    if (!h) {
      const asset = (SFX as any)[name] as string | string[] | undefined;
      if (!asset) return;
      const src = sourcesFrom(asset);
      h = new Howl({
        src,
        loop: true,
        volume: 0.35, // relativo al master
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
      if (alias) asset = (SFX as any)[alias] as string | string[] | undefined;
    }
    if (!asset) return;

    const src = sourcesFrom(asset);
    const howl = new Howl({
      src,
      volume: opts?.volume ?? 0.7, // relativo al master
      html5: true,
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
