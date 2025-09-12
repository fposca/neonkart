export type SkinId = "default" | "neon" | "shadow" | "retro";

export type SkinDef = {
  id: SkinId;
  title: string;
  thumb: string;            // miniatura para el menú
  kartSide: string;         // normal
  kartHit: string;          // golpeado
  kartDead: string;         // destruido
  kartShoot: string;        // disparando
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const B = (import.meta as any)?.env?.BASE_URL ?? "/";

export const SKINS: SkinDef[] = [
  {
    id: "default",
    title: "Clásico",
    thumb: `${B}assets/skins/default/thumb.png`,
    kartSide: `${B}assets/skins/default/side.png`,
    kartHit: `${B}assets/skins/default/hit.png`,
    kartDead: `${B}assets/skins/default/dead.png`,
    kartShoot: `${B}assets/skins/default/shoot.png`,
  },
  {
    id: "neon",
    title: "Neón",
    thumb: `${B}assets/skins/neon/thumb.png`,
    kartSide: `${B}assets/skins/neon/side.png`,
    kartHit: `${B}assets/skins/neon/hit.png`,
    kartDead: `${B}assets/skins/neon/dead.png`,
    kartShoot: `${B}assets/skins/neon/shoot.png`,
  },
  {
    id: "shadow",
    title: "Shadow",
    thumb: `${B}assets/skins/shadow/thumb.png`,
    kartSide: `${B}assets/skins/shadow/side.png`,
    kartHit: `${B}assets/skins/shadow/hit.png`,
    kartDead: `${B}assets/skins/shadow/dead.png`,
    kartShoot: `${B}assets/skins/shadow/shoot.png`,
  },
  {
    id: "retro",
    title: "Retro",
    thumb: `${B}assets/skins/retro/thumb.png`,
    kartSide: `${B}assets/skins/retro/side.png`,
    kartHit: `${B}assets/skins/retro/hit.png`,
    kartDead: `${B}assets/skins/retro/dead.png`,
    kartShoot: `${B}assets/skins/retro/shoot.png`,
  },
];

export function getSkin(id: SkinId = "default"): SkinDef {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}
