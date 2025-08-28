// src/game/input.ts
export type Actions = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;   // salto (Space / botón "Salto")
  fire2: boolean;  // disparo (Ctrl / botón "Disparo")
};

export class Input {
  a: Actions = { left:false, right:false, up:false, down:false, fire:false, fire2:false };

  constructor(root: HTMLElement) {
    // ===== Teclado =====
    window.addEventListener("keydown", (e)=>this.setKey(e.code, true));
    window.addEventListener("keyup",   (e)=>this.setKey(e.code, false));

    // Ctrl = fire2 (disparo)
    window.addEventListener("keydown", (e) => {
      if (e.code === "ControlLeft" || e.code === "ControlRight") this.a.fire2 = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ControlLeft" || e.code === "ControlRight") this.a.fire2 = false;
    });

    // ===== Gestos táctiles "crudos" (fallback) =====
    // Mantengo algo básico para que sin UI también funcione tocar la pantalla.
    root.addEventListener("touchstart", (e)=>{
      const rect = root.getBoundingClientRect();
      for (const t of Array.from(e.touches)) {
        const x = (t.clientX - rect.left) / rect.width;
        this.a.left = x < 0.33 || this.a.left;
        this.a.right = (x >= 0.33 && x < 0.66) || this.a.right;
      }
      this.a.fire = true;
      if (e.touches.length >= 2) this.a.fire2 = true;
    }, {passive:true});
    root.addEventListener("touchmove", (e)=>{
      const rect = root.getBoundingClientRect();
      this.a.left = this.a.right = false;
      for (const t of Array.from(e.touches)) {
        const x = (t.clientX - rect.left) / rect.width;
        if (x < 0.33) this.a.left = true;
        else if (x < 0.66) this.a.right = true;
      }
    }, {passive:true});
    root.addEventListener("touchend", (e)=>{
      this.a.fire = false; this.a.fire2 = false;
      if (e.touches.length === 0) this.a.left = this.a.right = this.a.up = this.a.down = false;
    }, {passive:true});
    root.addEventListener("touchcancel", ()=>{
      this.a.left = this.a.right = this.a.up = this.a.down = this.a.fire = this.a.fire2 = false;
    }, {passive:true});

    // ===== Botones táctiles visibles (overlay) =====
    this.mountTouchUI(root);
  }

  private setKey(code: string, on: boolean) {
    if (code === "ArrowLeft"  || code === "KeyA") this.a.left  = on;
    if (code === "ArrowRight" || code === "KeyD") this.a.right = on; // en tu juego: acelera + strafe
    if (code === "ArrowUp"    || code === "KeyW") this.a.up    = on;
    if (code === "ArrowDown"  || code === "KeyS") this.a.down  = on;
    if (code === "Space") this.a.fire = on;  // salto
    if (code === "KeyF")  this.a.fire2 = on; // disparo alternativo
  }

  // ---------- UI táctil visible ----------
  private mountTouchUI(root: HTMLElement) {
    // Mostrar por defecto sólo en dispositivos táctiles
    const isCoarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const FORCE_SHOW = false; // poné true para ver los botones en desktop al testear
    if (!isCoarse && !FORCE_SHOW) return;

    this.injectCssOnce();

    const ui = document.createElement("div");
    ui.className = "hud-touch";
    ui.innerHTML = `
      <div class="hud-touch__left">
        <button class="btn btn--left" data-act="left" aria-label="Izquierda">⟵</button>
      </div>
      <div class="hud-touch__right">
        <div class="hud-touch__actions">
          <button class="btn btn--jump" data-act="fire" aria-label="Salto">⤒</button>
          <button class="btn btn--shoot" data-act="fire2" aria-label="Disparo">●</button>
        </div>
        <button class="btn btn--gas" data-act="right" aria-label="Acelerar">GAS</button>
      </div>
    `;
    root.appendChild(ui);

    // comportamiento: presionar/soltar mantiene el estado booleano
    const down = (act: keyof Actions) => {
      if (act === "fire2") this.a.fire2 = true;
      else if (act === "fire") this.a.fire = true;
      else if (act === "left") this.a.left = true;
      else if (act === "right") this.a.right = true;
    };
    const up = (act: keyof Actions) => {
      if (act === "fire2") this.a.fire2 = false;
      else if (act === "fire") this.a.fire = false;
      else if (act === "left") this.a.left = false;
      else if (act === "right") this.a.right = false;
    };

    const bindButton = (el: HTMLButtonElement, act: keyof Actions) => {
      let pid: number | null = null; // pointerId activo sobre ese botón
      el.addEventListener("pointerdown", (e) => {
        pid = (e as PointerEvent).pointerId ?? null;
        (e.target as HTMLElement).setPointerCapture?.(pid ?? undefined);
        down(act);
        e.preventDefault();
      }, { passive: false });
      const handleUp = (e: Event) => {
        up(act);
        if (e instanceof PointerEvent && pid != null) {
          (el as any).releasePointerCapture?.(pid);
        }
        pid = null;
      };
      el.addEventListener("pointerup", handleUp);
      el.addEventListener("pointercancel", handleUp);
      el.addEventListener("pointerleave", (_e) => {
        // si el dedo se va del botón, soltamos la acción para evitar “quedarse pegado”
        up(act);
      });
    };

    ui.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b)=> {
      const act = b.getAttribute("data-act") as keyof Actions;
      bindButton(b, act);
    });
  }

  private injectCssOnce() {
    if (document.getElementById("touch-ui-css")) return;
    const css = `
.hud-touch {
  position:absolute; inset:0; pointer-events:none;
  display:flex; justify-content:space-between; align-items:flex-end;
  padding: 16px; box-sizing: border-box;
}
.hud-touch__left, .hud-touch__right { pointer-events:auto; display:flex; gap:12px; align-items:flex-end; }
.hud-touch__left { align-items:flex-end; }
.hud-touch__actions { display:flex; flex-direction:column; gap:12px; }
.btn {
  -webkit-user-select:none; user-select:none;
  border:none; outline:none; border-radius:16px;
  padding: 14px 18px; font-size:20px; font-weight:800; font-family:system-ui, Arial, sans-serif;
  background: rgba(255,255,255,0.12); color:#fff;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.35);
  min-width: 72px;
  touch-action:none;
}
.btn:active { transform: translateY(1px) scale(0.99); }
.btn--left   { min-width:88px; }
.btn--gas    { min-width:120px; font-size:22px; padding: 16px 22px; background: rgba(0, 210, 255, 0.2); }
.btn--jump   { background: rgba(255, 204, 0, 0.2); }
.btn--shoot  { background: rgba(255, 80, 80, 0.22); }
@media (max-width: 820px) {
  .btn { padding: 12px 16px; font-size:18px; min-width: 64px; }
  .btn--gas { min-width: 108px; font-size:20px; }
}
    `.trim();
    const style = document.createElement("style");
    style.id = "touch-ui-css";
    style.textContent = css;
    document.head.appendChild(style);
  }
}
