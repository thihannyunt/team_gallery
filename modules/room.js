// The gallery's walls, in scene units. The room was 40 x 40 (about 12.5 m square); the left wall, with
// the crew portraits, was moved out to make a piano salon (grandPiano.js) between it and the main floor,
// so the room runs 54 across (about 17 m) and is no longer centred on x = 0.
export const ROOM = { left: -34, right: 20, front: -20, back: 20, ceiling: 10 };

export const ROOM_WIDTH = ROOM.right - ROOM.left; // along x
export const ROOM_DEPTH = ROOM.back - ROOM.front; // along z
export const ROOM_CENTER_X = (ROOM.left + ROOM.right) / 2;
export const ROOM_CENTER_Z = (ROOM.front + ROOM.back) / 2;

// The Sky Lounge is closed for now: it cost frame rate everywhere in the gallery. With this false the
// front wall is solid and the tunnel, the lounge and its sky view are never built (main.js, walls.js).
export const SKY_LOUNGE_OPEN = false;

// A doorway at the left end of the front wall opens onto a tunnel (about 1.9 m wide, 2.7 m high and
// 7.5 m long) to the Sky Lounge, a glass room on the 60th floor (skyLounge.js). The lounge is 44 x 32
// (about 13.7 x 10 m), glass on three sides, its solid back wall shared with the tunnel's far end.
export const TUNNEL = { left: -33.4, right: -27.4, front: -44, back: ROOM.front, ceiling: 5.5 };
export const TUNNEL_CENTER_X = (TUNNEL.left + TUNNEL.right) / 2;
export const SKY_LOUNGE = { left: -52.4, right: -8.4, front: -76, back: TUNNEL.front, ceiling: 10 };
export const SKY_CENTER_X = (SKY_LOUNGE.left + SKY_LOUNGE.right) / 2;
export const SKY_CENTER_Z = (SKY_LOUNGE.front + SKY_LOUNGE.back) / 2;

// Every space a visitor can walk in, as boxes on the floor plan, with their ceilings
const AREAS = [
  { left: ROOM.left, right: ROOM.right, front: ROOM.front, back: ROOM.back, ceiling: ROOM.ceiling },
  ...(SKY_LOUNGE_OPEN ? [TUNNEL, SKY_LOUNGE] : []),
];

const inside = (area, x, z, gap) =>
  x >= area.left + gap && x <= area.right - gap && z >= area.front + gap && z <= area.back - gap;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keeps a camera (the third-person view, playerView.js) inside the walls: it may be in any of the spaces,
// otherwise it's pulled back into the one the player stands in. `ceilingGap` keeps it under that ceiling.
export const keepInside = (position, player, gap, floorY, ceilingGap) => {
  const own = AREAS.find((area) => inside(area, player.x, player.z, 0)) ?? AREAS[0];
  const area = AREAS.find((a) => inside(a, position.x, position.z, gap)) ?? own;
  position.x = clamp(position.x, area.left + gap, area.right - gap);
  position.z = clamp(position.z, area.front + gap, area.back - gap);
  position.y = clamp(position.y, floorY, Math.min(area.ceiling, own.ceiling) - ceilingGap);
};
