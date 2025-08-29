export type Actions = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;   // salto (Space)
  fire2: boolean;  // disparo (Ctrl / F)
};

export class Input {
  a: Actions = { left:false, right:false, up:false, down:false, fire:false, fire2:false };

  constructor(_root: HTMLElement) {
    // ===== Teclado =====
    const prevent = new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"]);
    window.addEventListener("keydown", (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      this.setKey(e.code, true);
    }, { passive: false });

    window.addEventListener("keyup", (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      this.setKey(e.code, false);
    }, { passive: false });

    // ❌ Sin UI táctil interna ni fallback táctil crudo.
    // El control táctil lo hace la botonera del App, que emite KeyboardEvent.
  }

  private setKey(code: string, on: boolean) {
    if (code === "ArrowLeft"  || code === "KeyA") this.a.left  = on;
    if (code === "ArrowRight" || code === "KeyD") this.a.right = on; // acelera/strafe
    if (code === "ArrowUp"    || code === "KeyW") this.a.up    = on;
    if (code === "ArrowDown"  || code === "KeyS") this.a.down  = on;
    if (code === "Space") this.a.fire = on;  // salto
    if (code === "KeyF")  this.a.fire2 = on; // disparo alternativo
    if (code === "ControlLeft" || code === "ControlRight") this.a.fire2 = on; // Ctrl = disparo
  }
}
