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
shield: "/assets/img/shield.png",
  kartRival1: "/assets/img/karting-rival1.png",
  kartRival2: "/assets/img/karting-rival2.png",
  finishLap1: "/assets/img/finish-lap1.png",
  finishLap2: "/assets/img/finish-lap2.png",
  finishFinal: "/assets/img/finish-final.png", // meta de la 3ª vuelta
  // fallback general opcional:
  finish: "/assets/img/finish.png",
  fondoIce: "/assets/img/fondo-ice.jpg",
  sueloIce: "/assets/img/suelo-ice.jpg",

  kartIceFront:  "/assets/img/karting-ice-frente.png",
  kartIceHit:    "/assets/img/karting-ice-hit.png",
  kartIceDead:   "/assets/img/karting-ice-dead.png",
  kartIceShoot:  "/assets/img/karting-ice-atack.png",

  enemyIceFront:  "/assets/img/enemy-ice-frente.png",
  enemyIceAttack: "/assets/img/enemy-ice-atack.png",   // ojo al nombre del archivo; si es “attack” cámbialo aquí
  enemyIceDead:   "/assets/img/enemy-ice-dead.png",

  rivalIce1: "/assets/img/racer-enemy.png",
  rivalIce2: "/assets/img/racer-enemy2.png",
  life: "/assets/img/life.png",
  god:  "/assets/img/god.png",
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
  | "pickupLife"
  | "crash"
  | "impact"
  | "pickup"
  | "countBeep"
  | "ice"
  | "pickupGod"   // ⬅️ nuevo
  | "countGo";

// Mapa de sonidos (solo sonidos; nada de imágenes aquí)
export const SFX: Record<SfxLoopName | SfxOneName, string> = {
  // loop
  motor: "/assets/sfx/sfx-motor-neonboy.mp3",

  // one-shots gameplay
  enemyShoot: "/assets/sfx/sfx-reguetonero-ataque.mp3",
  playerHit:  "/assets/sfx/sfx-reguetonero-hit.mp3",
  pickupGod:  "/assets/sfx/god-pickup.mp3",
  playerShoot:"/assets/sfx/sfx-guitarra-shot_1.mp3",
  pickupLife: "/assets/sfx/pickup-life.mp3", // ← NUEVO
  pickup:     "/assets/sfx/sfx-pickup.mp3",
  crash:      "/assets/sfx/sfx-crash.mp3",
  impact:     "/assets/sfx/sfx-impact.mp3",
  ice:     "/assets/sfx/ice.mp3",
  

  // UI / largada
  countBeep:  "/assets/sfx/ui-count-beep.mp3",
  countGo:    "/assets/sfx/ui-count-go.mp3",
};

// ===== MÚSICA =====
export const BGM: Record< "menu" | "nivel1" | "nivel2" | "nivel3" | "nivel4" | "nivel5" | "nivel6" | "nivel7", string> = {
  menu:   "/assets/music/bgm-menu.mp3",
  nivel1: "/assets/music/bgm-nivel1.mp3",
  nivel2: "/assets/music/bgm-nivel2.mp3",
  nivel3: "/assets/music/bgm-nivel3.mp3",
  nivel4: "/assets/music/bgm-nivel4.mp3",
  nivel5: "/assets/music/bgm-nivel5.mp3",
  nivel6: "/assets/music/bgm-nivel6.mp3",
   nivel7: "/assets/music/bgm-nivel7.mp3",
};


