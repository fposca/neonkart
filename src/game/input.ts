export type Actions = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;   // salto (Space)
  fire2: boolean;  // disparo (Ctrl / F)
  pause: boolean;  // ⬅ NUEVO (P o Escape)
};

export class Input {
  a: Actions = { left:false, right:false, up:false, down:false, fire:false, fire2:false, pause:false };

  constructor(_root: HTMLElement) {
    const prevent = new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"]);
    window.addEventListener("keydown", (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      this.setKey(e.code, true);
    }, { passive: false });

    window.addEventListener("keyup", (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      this.setKey(e.code, false);
    }, { passive: false });
  }

  private setKey(code: string, on: boolean) {
    if (code === "ArrowLeft"  || code === "KeyA") this.a.left  = on;
    if (code === "ArrowRight" || code === "KeyD") this.a.right = on;
    if (code === "ArrowUp"    || code === "KeyW") this.a.up    = on;
    if (code === "ArrowDown"  || code === "KeyS") this.a.down  = on;
    if (code === "Space") this.a.fire = on;
    if (code === "KeyF")  this.a.fire2 = on;
    if (code === "ControlLeft" || code === "ControlRight") this.a.fire2 = on;

    // ⬅ Pausa (P o Escape)
    if (code === "KeyP" || code === "Escape") this.a.pause = on;
  }
}
