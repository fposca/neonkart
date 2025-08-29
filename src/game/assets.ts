// ===== IMÁGENES =====
export const IMG = {
  // Nivel
  fondo: "/assets/img/nivel1-fondo.jpg",
  suelo: "/assets/img/nivel1-suelo.jpg",
  pared: "/assets/img/nivel1-pared.jpg",
  fondo4: "/assets/img/fondo4.jpg",
  suelo4: "/assets/img/suelo4.jpg",


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
  motor: "/assets/sfx/sfx-motor-neonboy.mp3",

  // one-shots gameplay
  enemyShoot: "/assets/sfx/sfx-reguetonero-ataque.mp3",
  playerHit:  "/assets/sfx/sfx-reguetonero-hit.mp3",
  playerShoot:"/assets/sfx/sfx-guitarra-shot_1.mp3",
  pickup:     "/assets/sfx/sfx-pickup.mp3",
  crash:      "/assets/sfx/sfx-crash.mp3",
  impact:     "/assets/sfx/sfx-impact.mp3",

  // UI / largada
  countBeep:  "/assets/sfx/ui-count-beep.mp3",
  countGo:    "/assets/sfx/ui-count-go.mp3",
};

// ===== MÚSICA =====
export const BGM: Record<"menu" | "nivel1", string> = {
  menu:   "/assets/music/bgm-menu.ogg",
  nivel1: "/assets/music/bgm-nivel1.ogg",
};


