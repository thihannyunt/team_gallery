// The gallery's walls, in scene units. The room was 40 x 40 (about 12.5 m square); the left wall, with
// the crew portraits, was moved out to make a piano salon (grandPiano.js) between it and the main floor,
// so the room runs 54 across (about 17 m) and is no longer centred on x = 0.
export const ROOM = { left: -34, right: 20, front: -20, back: 20, ceiling: 10 };

export const ROOM_WIDTH = ROOM.right - ROOM.left; // along x
export const ROOM_DEPTH = ROOM.back - ROOM.front; // along z
export const ROOM_CENTER_X = (ROOM.left + ROOM.right) / 2;
export const ROOM_CENTER_Z = (ROOM.front + ROOM.back) / 2;
