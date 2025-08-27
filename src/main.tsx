import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // ⚠️ Quitar StrictMode en desarrollo para evitar doble montaje
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
