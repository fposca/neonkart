// src/game/audio.ts
import { Howl, Howler } from "howler";
import { BGM, SFX } from "./assets";
import type { SfxLoopName, SfxOneName } from "./assets";

export class AudioBus {
  private bgm?: Howl;
  private sfxLoops = new Map<SfxLoopName, Howl>(); // ej: "motor"
  private master = 1;

  // Volumen maestro (0..1)
  setMasterVolume(v: number) {
    this.master = Math.max(0, Math.min(1, v));
    Howler.volume(this.master);
  }

  // ===== BGM =====
  playBgmMenu() {
    this.stopBgm();
    this.bgm = new Howl({ src: [BGM.menu], loop: true, volume: 0.5 });
    this.bgm.play();
  }

  playBgmLevel1() {
    this.stopBgm();
    this.bgm = new Howl({ src: [BGM.nivel1], loop: true, volume: 0.5 });
    this.bgm.play();
  }

  stopBgm() {
    if (!this.bgm) return;
    try { this.bgm.stop(); this.bgm.unload(); } catch { /* empty */ }
    this.bgm = undefined;
  }

  // ===== SFX en loop (motor) =====
  playSfx(name: SfxLoopName) {
    let h = this.sfxLoops.get(name);
    if (!h) {
      const src = SFX[name];
      h = new Howl({ src: [src], loop: true, volume: 0.3 });
      this.sfxLoops.set(name, h);
    }
    if (!h.playing()) h.play();
  }

  stopSfx(name: SfxLoopName) {
    const h = this.sfxLoops.get(name);
    if (!h) return;
    try { h.stop(); h.unload(); } catch { /* empty */ }
    this.sfxLoops.delete(name);
  }

  // ===== One-shots (disparo enemigo, golpe al jugador) =====
  playOne(name: SfxOneName) {
    const src = SFX[name];
    new Howl({ src: [src], volume: 0.7 }).play();
  }

  // ===== Utilidad =====
  stopAll() {
    this.stopBgm();
    for (const k of Array.from(this.sfxLoops.keys())) this.stopSfx(k);
  }

  destroy() {
    this.stopAll();
  }
}
