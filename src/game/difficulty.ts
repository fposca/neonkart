// src/game/difficulty.ts
export type DifficultyId = "normal" | "hard" | "extreme";

export type DifficultyTuning = {
  enemyMultiplier: number;    // más enemigos/torretas
  damageTaken: number;        // multiplicador de daño recibido
  iceRate: number;            // + peligros (hielo/meteoros/etc)
  pickupRates: { life: number; god: number; distortion: number }; // prob. de drops
};

export const DIFFICULTY: Record<DifficultyId, DifficultyTuning> = {
  normal:  { enemyMultiplier: 1.0, damageTaken: 1.0, iceRate: 1.0, pickupRates: { life: 0.9, god: 0.20, distortion: 0.80 } },
  hard:    { enemyMultiplier: 1.5, damageTaken: 1.3, iceRate: 1.4, pickupRates: { life: 0.7, god: 0.15, distortion: 0.70 } },
  extreme: { enemyMultiplier: 2.2, damageTaken: 1.8, iceRate: 2.0, pickupRates: { life: 0.5, god: 0.10, distortion: 0.60 } },
};

export function getTuning(id: DifficultyId | undefined): DifficultyTuning {
  return DIFFICULTY[id ?? "normal"];
}
