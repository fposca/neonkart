import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import { AudioBus } from "./game/audio";
import "./index.css";

type Mode = "menu" | "playing" | "over" | "controls";

/* =================== Helpers de controles táctiles =================== */
const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

// emitimos code y (opcional) key
const pressKey = (code: string, key?: string) =>
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      code,
      key: key ?? code,
      bubbles: true,
      cancelable: true,
    })
  );

const releaseKey = (code: string, key?: string) =>
  window.dispatchEvent(
    new KeyboardEvent("keyup", {
      code,
      key: key ?? code,
      bubbles: true,
      cancelable: true,
    })
  );

function TouchBtn({
  label,
  onDown,
  onUp,
  style,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
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

const touchWrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 3,
  pointerEvents: "none",
};

/* ---------- estilos loader ---------- */
const loadOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.65))",
  backdropFilter: "blur(2px)",
};
const loadPanel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 18px",
  borderRadius: 12,
  border: "1px solid #1f2937",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  background: "rgba(17,17,17,0.92)",
  color: "#eaeaea",
  fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
  fontWeight: 700,
};
const spinner: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.25)",
  borderTopColor: "#00f0ff",
  animation: "nbk-spin .8s linear infinite",
};

/* ================================ App ================================ */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [isLoading, setIsLoading] = useState(false);
  const [loadPct, setLoadPct] = useState(0); // ⬅ porcentaje

  // 🔊 Un único AudioBus para toda la app (menú + juego)
  const audioRef = useRef<AudioBus>(new AudioBus());

  // destruye el juego si existe
  const destroyGame = () => {
    if (gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
    }
    if (hostRef.current) hostRef.current.innerHTML = "";
  };

  // iniciar el juego
  const startGame = async () => {
    audioRef.current.stopAll?.();

    destroyGame();
    const root = hostRef.current!;
    root.innerHTML = "";

    const game = new Game({
      onGameOver: () => setMode("over"),
      audio: audioRef.current,
    });

    gameRef.current = game;

    // Loader del App (visible también en mobile)
    setIsLoading(true);
    setLoadPct(0);
    try {
      await game.init(root, {
        onProgress: (p01) => setLoadPct(Math.round(p01 * 100)), // ⬅ progreso
      });
      game.start();
      setMode("playing");
    } catch (err) {
      console.error(err);
      setMode("menu");
    } finally {
      setIsLoading(false);
    }
  };

  const retry = () => startGame();

  const backToMenu = () => {
    destroyGame();
    setMode("menu");
    audioRef.current.stopAll?.();
    audioRef.current.playBgmMenu?.();
  };

  // limpieza
  useEffect(() => {
    return () => {
      try { audioRef.current.stopAll?.(); } catch {}
      destroyGame();
    };
  }, []);

  // autoplay audio tras primer toque
  useEffect(() => {
    const unlock = () => { if (mode === "menu") audioRef.current.playBgmMenu?.(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [mode]);

  // asegura BGM del menú
  useEffect(() => {
    if (mode === "menu") audioRef.current.playBgmMenu?.();
  }, [mode]);

  // 📱 Escalado 1280x720
  useEffect(() => {
    const root = hostRef.current!;
    const W = 1280, H = 720;
    const fit = () => {
      const sw = window.innerWidth, sh = window.innerHeight;
      const scale = Math.min(sw / W, sh / H);
      root.style.width = `${W * scale}px`;
      root.style.height = `${H * scale}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0a0a",
      }}
    >
      {/* keyframes del spinner (inline) */}
      <style>{`@keyframes nbk-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Contenedor del canvas */}
      <div ref={hostRef} style={{ touchAction: "none" }} />

      {/* Fondo del MENÚ */}
      {mode !== "playing" && <div style={menuBg} />}

      {/* MENÚ */}
      {mode === "menu" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h1 style={title}>NEONBOY KART</h1>
            <button
              style={{ ...btnPrimary, opacity: isLoading ? 0.7 : 1, pointerEvents: isLoading ? "none" : "auto" }}
              onClick={startGame}
            >
              {isLoading ? "Cargando…" : "▶ Start"}
            </button>
            <button style={btn} onClick={() => setMode("controls")} disabled={isLoading}>
              🎮 Controles
            </button>
          </div>
        </div>
      )}

      {/* CONTROLES */}
      {mode === "controls" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h2 style={subtitle}>Controles</h2>
            <ul style={{ margin: "12px 0 20px 0", lineHeight: 1.6 }}>
              <li>→ acelera (y te mueve un poco a la derecha)</li>
              <li>← mueve a la izquierda</li>
              <li>Espacio: salto</li>
              <li>F o Ctrl: disparo (con pedal)</li>
            </ul>
            <button style={btnPrimary} onClick={startGame}>
              ▶ Start
            </button>
            <button style={btn} onClick={backToMenu}>
              ↩ Volver
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {mode === "over" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h2 style={title}>GAME OVER</h2>
            <button style={btnPrimary} onClick={retry}>
              ↻ Reintentar
            </button>
            <button style={btn} onClick={backToMenu}>
              🏠 Menú
            </button>
          </div>
        </div>
      )}

      {/* Loader del App (sobre la misma pantalla del botón) */}
      {isLoading && (
        <div style={loadOverlay}>
          <div style={loadPanel}>
            <div style={spinner} />
            <div style={{ display: "grid", gap: 6 }}>
              <span>Cargando juego… {loadPct}%</span>
              <div style={{
                width: 180, height: 8, borderRadius: 6,
                background: "rgba(255,255,255,0.12)", overflow: "hidden"
              }}>
                <div style={{
                  width: `${loadPct}%`, height: "100%",
                  background: "#00f0ff"
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botonera táctil (emite KeyboardEvent hacia Input) */}
      {mode === "playing" && isTouchDevice() && (
        <div style={touchWrap} className="hud-touch-app">
          {/* izquierda */}
          <TouchBtn
            label="◀"
            onDown={() => pressKey("ArrowLeft")}
            onUp={() => releaseKey("ArrowLeft")}
            style={{ left: 16 }}
          />
          {/* derecha / gas */}
          <TouchBtn
            label="▶"
            onDown={() => pressKey("ArrowRight")}
            onUp={() => releaseKey("ArrowRight")}
            style={{ left: 100 }}
          />
          {/* disparo */}
          <TouchBtn
            label="●"
            onDown={() => pressKey("KeyF", "f")}
            onUp={() => releaseKey("KeyF", "f")}
            style={{ right: 96 }}
          />
          {/* salto */}
          <TouchBtn
            label="⤒"
            onDown={() => pressKey("Space", " ")}
            onUp={() => releaseKey("Space", " ")}
            style={{ right: 16 }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- estilos chiquitos ---------- */

const menuBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.55)),
                    url('${import.meta.env.BASE_URL}menuBack.jpg')`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const uiWrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  zIndex: 2,
  background: "transparent",
};

const panel: React.CSSProperties = {
  width: 420,
  maxWidth: "92vw",
  background: "rgba(20,20,20,0.9)",
  border: "1px solid #222",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  textAlign: "center",
  color: "#eaeaea",
  fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
};

const title: React.CSSProperties = {
  margin: "6px 0 16px",
  fontSize: 36,
  color: "#00f0ff",
};
const subtitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 24,
  color: "#00f0ff",
};

const btnBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 16px",
  margin: "8px 0",
  fontSize: 18,
  borderRadius: 12,
  border: "1px solid #333",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#00f0ff",
  color: "#091218",
  fontWeight: 700,
};
const btn: React.CSSProperties = {
  ...btnBase,
  background: "#171717",
  color: "#eaeaea",
};
