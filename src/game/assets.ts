// ===== IMÁGENES =====
export const IMG = {
  // Nivel
  fondo: "/assets/img/nivel1-fondo.png",
  suelo: "/assets/img/nivel1-suelo.png",
  pared: "/assets/img/nivel1-pared.png",
  fondo4: "/assets/img/fondo4.png",
  suelo4: "/assets/img/suelo4.png",


  // Jugador
  kartSide: "/assets/img/karting-neonboy-lateral-der.png",
  kartEmet: "/assets/img/karting-emet.png",
  kartBrujo: "/assets/img/karting-brujo.png",
  kartHit:  "/assets/img/karting-neonboy-hit.png",
  kartDead: "/assets/img/karting-neonboy-dead.png",
  kartShoot:"/assets/img/karting-neonboy-shoot.png",          // NUEVO (al disparar)

  // Enemigos
  regSide:   "/assets/img/karting-reguetonero-lateral-der.png",
  regShoot:  "/assets/img/karting-reguetonero-ataque.png",    // al disparar
  regWreck:  "/assets/img/karting-reguetonero-destruido.png", // destruido (queda)
  

  // Pickups
  pedalDist: "/assets/img/pickup-pedal-distorsion.png",

  kartRival1: "/assets/img/karting-rival1.png",
  kartRival2: "/assets/img/karting-rival2.png",
  finishLap1: "/assets/img/finish-lap1.png",
  finishLap2: "/assets/img/finish-lap2.png",
  finishFinal: "/assets/img/finish-final.png", // meta de la 3ª vuelta
  // fallback general opcional:
  finish: "/assets/img/finish.png",
} as const;


// ===== SONIDOS =====
// Loops (persistentes)
export type SfxLoopName =
  | "motor";

// One-shots (disparan 1 vez)
export type SfxOneName =
  | "enemyShoot"
  | "playerHit"
  | "playerShoot"
  | "pickup"
  | "crash"
  | "impact"
  | "countBeep"
  | "countGo";

// Mapa de sonidos (solo sonidos; nada de imágenes aquí)
export const SFX: Record<SfxLoopName | SfxOneName, string> = {
  // loop
  motor: "/assets/sfx/sfx-motor-neonboy.wav",

  // one-shots gameplay
  enemyShoot: "/assets/sfx/sfx-reguetonero-ataque.wav",
  playerHit:  "/assets/sfx/sfx-reguetonero-hit.wav",
  playerShoot:"/assets/sfx/sfx-guitarra-shot.wav",
  pickup:     "/assets/sfx/sfx-pickup.wav",
  crash:      "/assets/sfx/sfx-crash.wav",
  impact:     "/assets/sfx/sfx-impact.wav",

  // UI / largada
  countBeep:  "/assets/sfx/ui-count-beep.wav",
  countGo:    "/assets/sfx/ui-count-go.wav",
};

// ===== MÚSICA =====
export const BGM: Record<"menu" | "nivel1", string> = {
  menu:   "/assets/music/bgm-menu.wav",
  nivel1: "/assets/music/bgm-nivel1.wav",
};


