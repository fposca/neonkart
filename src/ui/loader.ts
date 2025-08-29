// src/ui/loader.ts
export async function withLoader<T>(
  work: Promise<T>,
  label = "Cargando…"
): Promise<T> {
  // overlay
  const root = document.createElement("div");
  root.id = "loader-overlay";
  root.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    background:#0b0b0f; z-index:99999; color:#fff; font-family:Arial, sans-serif;
    flex-direction:column; gap:16px;
  `;
  const title = document.createElement("div");
  title.textContent = label;
  title.style.cssText = "font-weight:900; font-size:22px; letter-spacing:.5px;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "width:min(420px,80vw); height:12px; background:#222; border-radius:8px; overflow:hidden; box-shadow:0 0 0 2px #000 inset;";
  const fill = document.createElement("div");
  fill.style.cssText = "height:100%; width:0%; background:#00d2ff; transition:width .15s;";
  bar.appendChild(fill);

  const msg = document.createElement("div");
  msg.style.cssText = "font-size:12px; opacity:.8;";
  msg.textContent = "Preparando…";

  root.append(title, bar, msg);
  document.body.appendChild(root);

  // si el caller quiere ir actualizando, le exponemos un setter global simple
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__setLoaderProgress = (p: number, m?: string) => {
    fill.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
    if (m) msg.textContent = m;
  };

  try {
    const r = await work;
    fill.style.width = "100%";
    return r;
  } finally {
    setTimeout(() => root.remove(), 150);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__setLoaderProgress;
  }
}
