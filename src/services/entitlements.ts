// src/services/entitlements.ts
export type Entitlements = { premium: boolean };

const KEY = "entitlements";

export function loadEntitlements(): Entitlements {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"premium":false}'); }
  catch { return { premium: false }; }
}

export function hasPremium(): boolean {
  return loadEntitlements().premium;
}

// Útil para pruebas mientras no conectamos checkout real
export function grantPremium() {
  localStorage.setItem(KEY, JSON.stringify({ premium: true }));
}
export function revokePremium() {
  localStorage.setItem(KEY, JSON.stringify({ premium: false }));
}
