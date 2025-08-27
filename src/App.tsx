// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import "./index.css";

type Mode = "menu" | "playing" | "over" | "controls";

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>("menu");

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
    destroyGame();
    const root = hostRef.current!;
    root.innerHTML = "";
    const game = new Game({
      onGameOver: () => setMode("over"),
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
  };

  // limpieza al desmontar app (por si recargás en caliente)
  useEffect(() => {
    return () => destroyGame();
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center", background: "#0a0a0a" }}>
      {/* Contenedor del canvas */}
      <div ref={hostRef} style={{ touchAction: "none" }} />

      {/* MENÚ */}
      {mode === "menu" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h1 style={title}>NEONBOY KART</h1>
            <button style={btnPrimary} onClick={startGame}>▶ Start</button>
            <button style={btn} onClick={() => setMode("controls")}>🎮 Controles</button>
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
            <button style={btnPrimary} onClick={startGame}>▶ Start</button>
            <button style={btn} onClick={backToMenu}>↩ Volver</button>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {mode === "over" && (
        <div style={uiWrap}>
          <div style={panel}>
            <h2 style={title}>GAME OVER</h2>
            <button style={btnPrimary} onClick={retry}>↻ Reintentar</button>
            <button style={btn} onClick={backToMenu}>🏠 Menú</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- estilos chiquitos ---------- */
const uiWrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(0,0,0,0.55)",
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
const btnPrimary: React.CSSProperties = { ...btnBase, background: "#00f0ff", color: "#091218", fontWeight: 700 };
const btn: React.CSSProperties = { ...btnBase, background: "#171717", color: "#eaeaea" };
