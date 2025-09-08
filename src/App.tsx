// App.tsx
import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import { AudioBus } from "./game/audio";
import "./index.css";

type Mode = "menu" | "playing" | "over" | "controls";

/* =================== Helpers táctiles =================== */
const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const pressKey = (code: string, key?: string) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code, key: key ?? code, bubbles: true, cancelable: true }));

const releaseKey = (code: string, key?: string) =>
  window.dispatchEvent(new KeyboardEvent("keyup", { code, key: key ?? code, bubbles: true, cancelable: true }));

function TouchBtn({
  label, onDown, onUp, style,
}: { label: string; onDown: () => void; onUp: () => void; style?: React.CSSProperties; }) {
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      style={{
        position: "absolute",
        bottom: 16,
        width: 64,
        height: 64,
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "grid",
        placeItems: "center",
        fontSize: 28,
        color: "#eaeaea",
        userSelect: "none",
        touchAction: "none",
        pointerEvents: "auto",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

const touchWrap: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none" };

/* ---------- estilos loader ---------- */
const loadOverlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 99, display: "grid", placeItems: "center", background: "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.65))", backdropFilter: "blur(2px)" };
const loadPanel: React.CSSProperties   = { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, border: "1px solid #1f2937", boxShadow: "0 12px 40px rgba(0,0,0,0.45)", background: "rgba(17,17,17,0.92)", color: "#eaeaea", fontFamily: "system-ui, Segoe UI, Roboto, sans-serif", fontWeight: 700 };
const spinner: React.CSSProperties     = { width: 18, height: 18, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.25)", borderTopColor: "#fa66a6", animation: "nbk-spin .8s linear infinite" };

/* ================================ App ================================ */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [isLoading, setIsLoading] = useState(false);
  const [loadPct, setLoadPct] = useState(0);

  const audioRef = useRef<AudioBus>(new AudioBus());

  const destroyGame = () => {
    if (gameRef.current) { gameRef.current.destroy(); gameRef.current = null; }
    if (hostRef.current) hostRef.current.innerHTML = "";
  };

  const startGame = async () => {
    audioRef.current.stopAll?.(); // cortar BGM de menú antes de entrar al juego
    destroyGame();                // crear juego NUEVO (empieza en Level 1)
    const root = hostRef.current!; root.innerHTML = "";
    const game = new Game({ onGameOver: () => setMode("over"), audio: audioRef.current });
    gameRef.current = game;

    setIsLoading(true); setLoadPct(0);
    try {
      await game.init(root, { onProgress: (p01) => setLoadPct(Math.round(p01 * 100)) });
      game.start(); setMode("playing");
    } catch (err) {
      console.error(err); setMode("menu");
    } finally {
      setIsLoading(false);
    }
  };

  // ⬇️ Cambiado: reintentar relanza el ÚLTIMO nivel en la MISMA instancia
  const retry = async () => {
    if (!gameRef.current) { await startGame(); return; } // fallback
    setMode("playing");               // sacá el overlay de 'over'
    await gameRef.current.retryLastLevel();
  };

  // 👇 No reinicies BGM si venimos de "controls"
  const backToMenu = () => {
    const comingFrom = mode;
    destroyGame();
    setMode("menu");

    if (comingFrom === "playing" || comingFrom === "over") {
      audioRef.current.stopAll?.();
      audioRef.current.playBgmMenu?.();
    }
  };

  useEffect(() => {
    return () => { try { audioRef.current.stopAll?.(); } catch {} destroyGame(); };
  }, []);

  useEffect(() => {
    const unlock = () => {
      audioRef.current.resume?.();
      audioRef.current.playBgmMenu?.();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (mode === "menu") audioRef.current.playBgmMenu?.();
  }, [mode]);

  useEffect(() => {
    const root = hostRef.current!; const W = 1280, H = 720;
    const fit = () => { const sw = window.innerWidth, sh = window.innerHeight; const scale = Math.min(sw / W, sh / H); root.style.width = `${W * scale}px`; root.style.height = `${H * scale}px`; };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, []);

  const controlsData = [
    { key: "→ (Flecha derecha)", action: "Acelera (y se mueve un poco a la derecha)" },
    { key: "← (Flecha izquierda)", action: "Mueve a la izquierda" },
    { key: "Espacio", action: "Salto" },
    { key: "F o Ctrl", action: "Disparo (con pedal)" },
    { key: "P o Esc", action: "Pausa" },
  ];

  return (
    <div style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center", background: "#0a0a0a" }}>
      <style>{`@keyframes nbk-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div ref={hostRef} style={{ touchAction: "none" }} />
      {mode !== "playing" && <div style={menuBg} />}

      {mode === "menu" && (
        <div style={uiWrap}>
          <div style={panel}>
            <img style={logoStyle} src={`${import.meta.env.BASE_URL}assets/img/neonkart.png`} alt="Neonboy Kart" />
            <button
              style={{ ...btnPrimary, opacity: isLoading ? 0.7 : 1, pointerEvents: isLoading ? "none" : "auto" }}
              onClick={startGame}
            >
              {isLoading ? "Cargando…" : "▶ Start"}
            </button>
            <button style={btn} onClick={() => setMode("controls")} disabled={isLoading}>🎮 Controles</button>
          </div>
        </div>
      )}

      {mode === "controls" && (
        <div style={uiWrap}>
          <div style={panel}>
            <img style={logoStyle} src={`${import.meta.env.BASE_URL}assets/img/neonkart.png`} alt="Neonboy Kart" />
            <div style={tableWrap}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyleLeft}>Tecla</th>
                    <th style={thStyleRight}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {controlsData.map((r, i) => (
                    <tr key={r.key} style={i % 2 === 0 ? zebraA : zebraB}>
                      <td style={tdKey}>{r.key}</td>
                      <td style={td}>{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button style={btnPrimary} onClick={startGame}>▶ Start</button>
            <button style={btn} onClick={backToMenu}>↩ Volver</button>
          </div>
        </div>
      )}

      {mode === "over" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h2 style={title}>GAME OVER</h2>
            <button style={btnPrimary} onClick={retry}>↻ Reintentar</button>
            <button style={btn} onClick={backToMenu}>🏠 Menú</button>
          </div>
        </div>
      )}

      {isLoading && (
        <div style={loadOverlay}>
          <div style={loadPanel}>
            <div style={spinner} />
            <div style={{ display: "grid", gap: 6 }}>
              <span>Cargando juego… {loadPct}%</span>
              <div style={{ width: 180, height: 8, borderRadius: 6, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                <div style={{ width: `${loadPct}%`, height: "100%", background: "#fa66a6" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "playing" && isTouchDevice() && (
        <div style={touchWrap} className="hud-touch-app">
          <TouchBtn label="◀" onDown={() => pressKey("ArrowLeft")}  onUp={() => releaseKey("ArrowLeft")}  style={{ left: 16 }} />
          <TouchBtn label="▶" onDown={() => pressKey("ArrowRight")} onUp={() => releaseKey("ArrowRight")} style={{ left: 100 }} />
          <TouchBtn label="●" onDown={() => pressKey("KeyF", "f")}  onUp={() => releaseKey("KeyF", "f")} style={{ right: 96 }} />
          <TouchBtn label="⤒" onDown={() => pressKey("Space", " ")} onUp={() => releaseKey("Space", " ")} style={{ right: 16 }} />
          <TouchBtn
            label="Ⅱ"
            onDown={() => pressKey("KeyP", "p")}
            onUp={() => releaseKey("KeyP", "p")}
            style={{ right: 16, top: 16, bottom: "auto", width: 56, height: 56, fontSize: 22, borderRadius: 12 }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- estilos ---------- */
const menuBg: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
  backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.55)), url('${import.meta.env.BASE_URL}assets/img/menuBack.jpg')`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center center",
  backgroundAttachment: "fixed",
  backgroundColor: "#000"
};

const uiWrap: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 2, display: "flex",
  alignItems: "center", justifyContent: "center", padding: 16,
  overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
  overscrollBehaviorY: "contain" as any, background: "transparent",
};

const panel: React.CSSProperties  = {
  width: 520, maxWidth: "92vw", maxHeight: "calc(100dvh - 64px)",
  overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
  background: "rgba(20,20,20,0.2)", padding: 24,
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)", textAlign: "center",
  color: "#eaeaea", fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
  borderRadius: 16,
};

const title: React.CSSProperties  = { margin: "6px 0 16px", fontSize: 36, color: "#fa66a6" };
const btnBase: React.CSSProperties = { display: "block", width: "100%", padding: "12px 16px", margin: "12px 0", fontSize: 18, borderRadius: 12, border: "1px solid #333", cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btnBase, background: "rgba(247, 86, 215, 0.82)", color: "#091218", fontWeight: 700 };
const btn: React.CSSProperties       = { ...btnBase, background: "rgba(20,20,20,0.6)", color: "#eaeaea" };

const logoStyle: React.CSSProperties = { display: "block", margin: "0 auto 12px", width: "min(40vw, 260px)", height: "auto" };

const tableWrap: React.CSSProperties = {
  margin: "10px 0 20px", borderRadius: 12, overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  backdropFilter: "blur(2px)"
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 16, textAlign: "left" };
const thCommon: React.CSSProperties = { padding: "10px 14px", fontWeight: 800, letterSpacing: 0.3, background: "rgba(250, 102, 166, 0.6)", color: "#1c0f17" };
const thStyleLeft: React.CSSProperties  = { ...thCommon, width: "44%" };
const thStyleRight: React.CSSProperties = { ...thCommon, width: "56%" };
const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#eee" };
const tdKey: React.CSSProperties = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: "#fff" };
const zebraA: React.CSSProperties = { background: "rgba(18,18,18,0.6)" };
const zebraB: React.CSSProperties = { background: "rgba(36,36,36,0.6)" };
