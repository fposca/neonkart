// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import { AudioBus } from "./game/audio"; // ⬅️ importa el bus de audio compartido
import "./index.css";

type Mode = "menu" | "playing" | "over" | "controls";

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>("menu");

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

  // iniciar el nivel 1
  const startGame = async () => {
    // detener música del menú antes de entrar al juego
    audioRef.current.stopAll?.();

    destroyGame();
    const root = hostRef.current!;
    root.innerHTML = "";

    const game = new Game({
      onGameOver: () => setMode("over"),
      audio: audioRef.current, // ⬅️ usa el mismo bus dentro del juego
    });

    gameRef.current = game;
    await game.init(root);
    game.start();
    setMode("playing");
  };

  // reintentar
  const retry = () => {
    startGame();
  };

  // salir a menú (desde cualquier estado)
  const backToMenu = () => {
    destroyGame();
    setMode("menu");
    // al volver al menú, prendemos su música
    audioRef.current.stopAll?.();
    audioRef.current.playBgmMenu?.();
  };

  // limpieza al desmontar app
  useEffect(() => {
    return () => {
      try { audioRef.current.stopAll?.(); } catch {}
      destroyGame();
    };
  }, []);

  // 🔓 Desbloqueo de audio (autoplay) en el primer toque/click
  useEffect(() => {
    const unlock = () => {
      audioRef.current.resume?.();   // reanuda AudioContext si está suspendido
      if (mode === "menu") audioRef.current.playBgmMenu?.();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [mode]);

  // cada vez que entras al menú, asegura BGM del menú (si ya hubo interacción)
  useEffect(() => {
    if (mode === "menu") {
      audioRef.current.playBgmMenu?.();
    }
  }, [mode]);

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
      {/* Contenedor del canvas */}
      <div ref={hostRef} style={{ touchAction: "none" }} />

      {/* Fondo del MENÚ */}
      {mode !== "playing" && <div style={menuBg} />}

      {/* MENÚ */}
      {mode === "menu" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h1 style={title}>NEONBOY KART</h1>
            <button style={btnPrimary} onClick={startGame}>
              ▶ Start
            </button>
            <button style={btn} onClick={() => setMode("controls")}>
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
              <li>Evita disparos y pasa a los enemigos saltando</li>
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
    </div>
  );
}

/* ---------- estilos chiquitos ---------- */

const menuBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  backgroundImage:
    "linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.55)), url('/menuBack.png')",
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

const title: React.CSSProperties = { margin: "6px 0 16px", fontSize: 36, color: "#00f0ff" };
const subtitle: React.CSSProperties = { margin: "0 0 8px", fontSize: 24, color: "#00f0ff" };

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
const btn: React.CSSProperties = { ...btnBase, background: "#171717", color: "#eaeaea" };
