// src/game/assets.ts

// ===== IMÁGENES =====
export const IMG = {
  fondo: "/assets/img/nivel1-fondo.png",
  suelo: "/assets/img/nivel1-suelo.png",
  pared: "/assets/img/nivel1-pared.png",

  // Sprites jugador
  kartSide: "/assets/img/karting-neonboy-lateral-der.png",
  kartHit:  "/assets/img/karting-neonboy-hit.png",
  kartDead: "/assets/img/karting-neonboy-dead.png",

  // Enemigo lateral
  regSide:  "/assets/img/karting-reguetonero-lateral-der.png",
} as const;

// ===== SONIDOS =====
export type SfxLoopName = "motor";
export type SfxOneName  = "enemyShoot" | "playerHit";

export const SFX: Record<SfxLoopName | SfxOneName, string> = {
  motor:      "/assets/sfx/sfx-motor-neonboy.wav",
  enemyShoot: "/assets/sfx/sfx-reguetonero-ataque.wav",
  playerHit:  "/assets/sfx/sfx-reguetonero-hit.wav",
};

// ===== MÚSICA =====
export const BGM: Record<"menu" | "nivel1", string> = {
  menu:   "/assets/music/bgm-menu.wav",
  nivel1: "/assets/music/bgm-nivel1.wav",
};
