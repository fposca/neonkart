// src/game/input.ts
export type Actions = {
  left: boolean; right: boolean; up: boolean; down: boolean; fire: boolean;
};

export class Input {
  a: Actions = { left:false, right:false, up:false, down:false, fire:false };

  constructor(root: HTMLElement) {
    // teclado
    window.addEventListener("keydown", (e)=>this.setKey(e.code, true));
    window.addEventListener("keyup",   (e)=>this.setKey(e.code, false));

    // touch muy simple: mitad izq = girar, mitad der = acelerar / fire con tap
    root.addEventListener("touchstart", (e)=>{
      for (const t of e.touches) {
        const x = t.clientX / root.clientWidth;
        this.a.up = x > 0.5;
        this.a.left = x < 0.25;
        this.a.right = x > 0.25 && x <= 0.5;
        this.a.fire = true;
      }
    }, {passive:true});
    root.addEventListener("touchend", ()=>{
      this.a.up = this.a.left = this.a.right = this.a.fire = false;
    });
  }

  private setKey(code: string, on: boolean) {
    if (code === "ArrowLeft"  || code === "KeyA") this.a.left  = on;
    if (code === "ArrowRight" || code === "KeyD") this.a.right = on;
    if (code === "ArrowUp"    || code === "KeyW") this.a.up    = on;
    if (code === "ArrowDown"  || code === "KeyS") this.a.down  = on;
    if (code === "Space") this.a.fire = on;
  }
}
