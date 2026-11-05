import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';
import { ROOM, TUNNEL, TUNNEL_CENTER_X, SKY_LOUNGE, SKY_CENTER_X, SKY_CENTER_Z } from './room.js';
import { createSeat, seats } from './lounge.js';
import { createPlant } from './galleryDecor.js';
import { createSkyView, updateSkyView } from './skyView.js';
import { mergeStatic } from './mergeStatic.js';

// The Sky Lounge: through the doorway at the left end of the front wall, a tunnel ribbed with warm light
// leads to a glass room on the 60th floor (room.js has the floor plan). Glass on three sides, floor to
// ceiling: on the right the mountains, the waterfall, the forest and the sunset; on the left the ocean
// and its islands (skyView.js paints the view). A daybed faces each side and two armchairs face out
// ahead; sitting looks out of the window (seating.js). Built from simple shapes and canvas textures.

const U = UNITS_PER_METER;
const HEIGHT = TUNNEL.ceiling - FLOOR_Y; // the tunnel's inside height
const RIB_SPACING = 3; // a light rib every 3 units (about 1 m) along the tunnel
const BAY = { side: 32 / 6, front: 44 / 8 }; // glass panes between the mullions
const SUN = { azimuth: 0.62, elevation: 0.15 }; // where the warm light comes from, as in skyView.js

const tunnelWall = new THREE.MeshStandardMaterial({ color: 0x1f2a2a, roughness: 0.8 });
const tunnelFloor = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1 });
const ribLight = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
const guideLight = new THREE.MeshBasicMaterial({ color: COLORS.lime });
const walnut = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.55 });
const bronze = new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 0.4, metalness: 0.4 });
const facade = new THREE.MeshStandardMaterial({ color: 0x2b3236, roughness: 0.5, metalness: 0.2 });
// Lit by the windows (emissive, as the gallery's lamps don't reach this far)
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x5a5048 });
const glass = new THREE.MeshBasicMaterial({ color: 0xd5eef5, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
const cushionFabric = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.95, emissive: 0x3a3028 }); // oatmeal linen, in window light
const accentFabric = new THREE.MeshStandardMaterial({ color: COLORS.teal, roughness: 0.9 });

const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
};

const box = (width, height, depth, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};

// Pale stone tiles for the lounge floor
const stoneFloor = (() => {
  const map = canvasTexture(512, 512, (ctx, w) => {
    ctx.fillStyle = '#d9d3c7';
    ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${150 + Math.random() * 60}, ${140 + Math.random() * 50}, ${120 + Math.random() * 40}, 0.08)`;
      ctx.fillRect(Math.random() * w, Math.random() * w, 6 + Math.random() * 30, 2 + Math.random() * 10);
    }
    ctx.strokeStyle = 'rgba(120, 110, 95, 0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 2, 0);
      ctx.lineTo((i * w) / 2, w);
      ctx.moveTo(0, (i * w) / 2);
      ctx.lineTo(w, (i * w) / 2);
      ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set((SKY_LOUNGE.right - SKY_LOUNGE.left) / 8, (SKY_LOUNGE.back - SKY_LOUNGE.front) / 8); // 4-unit tiles
  // Warm light of its own: the sky lights this room, but the gallery's lamps don't reach it
  return new THREE.MeshStandardMaterial({ map, roughness: 0.4, emissive: 0x6b5440 });
})();

// Walnut slats for the lounge's solid back wall
const slatWall = (() => {
  const map = canvasTexture(256, 256, (ctx, w) => {
    ctx.fillStyle = '#5c3e29';
    ctx.fillRect(0, 0, w, w);
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(20, 10, 5, 0.55)';
      ctx.fillRect(x, 0, 4, w);
      ctx.fillStyle = 'rgba(255, 220, 180, 0.06)';
      ctx.fillRect(x + 6, 0, 10, w);
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
})();

// The tower's own glass curtain wall, seen out of the side windows looking back: tinted panels between
// mullions, catching the sunset (unlit, as the sky is)
const curtainWall = (() => {
  const map = canvasTexture(256, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3d4466');
    sky.addColorStop(0.55, '#7a5a6e');
    sky.addColorStop(1, '#b5785a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(15, 18, 22, 0.85)';
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 5, h);
    for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 7);
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(100 / 16, 1); // 4-unit panels along each 100-unit face, one floor-height band per tile row
  return new THREE.MeshBasicMaterial({ map });
})();

// The warm glow of the setting sun across the lounge floor: brightest at the edge toward the sun
const sunGlow = canvasTexture(256, 256, (ctx, w, h) => {
  const gradient = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
  gradient.addColorStop(0, 'rgba(255, 170, 100, 0.6)');
  gradient.addColorStop(0.6, 'rgba(255, 160, 90, 0.18)');
  gradient.addColorStop(1, 'rgba(255, 160, 90, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  // Fade to nothing at the sides and far edge too, so the patch has no visible border
  ctx.globalCompositeOperation = 'destination-in';
  const sides = ctx.createLinearGradient(0, 0, w, 0);
  sides.addColorStop(0, 'rgba(0, 0, 0, 0)');
  sides.addColorStop(0.3, 'rgba(0, 0, 0, 1)');
  sides.addColorStop(0.7, 'rgba(0, 0, 0, 1)');
  sides.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sides;
  ctx.fillRect(0, 0, w, h);
});

// A lit sign: `title` big, `subtitle` in lime under it, on a dark teal panel
const sign = (width, height, title, subtitle) => {
  const map = canvasTexture(1024, Math.round((1024 * height) / width), (ctx, w, h) => {
    ctx.fillStyle = '#013635';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(208, 235, 0, 0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f6f4ef';
    ctx.font = `800 ${Math.round(h * 0.38)}px Manrope, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(title, w / 2, h * 0.52, w - 80);
    ctx.fillStyle = '#d0eb00';
    ctx.font = `700 ${Math.round(h * 0.17)}px Manrope, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(subtitle, w / 2, h * 0.82, w - 80);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map }));
};

// Walnut frame round the doorway on one face of a wall at z, facing `facing` (+1 toward +z)
const doorTrim = (z, facing) => {
  const trim = new THREE.Group();
  const width = TUNNEL.right - TUNNEL.left;
  const depth = 0.12;
  const zz = z + (facing * depth) / 2;
  trim.add(
    box(0.18, HEIGHT + 0.18, depth, walnut, TUNNEL.left - 0.09, FLOOR_Y + (HEIGHT + 0.18) / 2, zz),
    box(0.18, HEIGHT + 0.18, depth, walnut, TUNNEL.right + 0.09, FLOOR_Y + (HEIGHT + 0.18) / 2, zz),
    box(width + 0.36, 0.18, depth, walnut, TUNNEL_CENTER_X, TUNNEL.ceiling + 0.09, zz)
  );
  return trim;
};

const createTunnel = (group, colliders) => {
  const length = TUNNEL.back - TUNNEL.front;
  const width = TUNNEL.right - TUNNEL.left;
  const middleZ = (TUNNEL.back + TUNNEL.front) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length), tunnelFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(TUNNEL_CENTER_X, FLOOR_Y + 0.004, middleZ);
  floor.receiveShadow = true;
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, length), tunnelWall);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(TUNNEL_CENTER_X, TUNNEL.ceiling, middleZ);
  group.add(floor, ceiling);

  // Side walls, solid to walk along
  [TUNNEL.left - 0.15, TUNNEL.right + 0.15].forEach((x) => {
    colliders.push(box(0.3, HEIGHT, length, tunnelWall, x, FLOOR_Y + HEIGHT / 2, middleZ));
  });

  // Ribs of warm light round the walls and ceiling, and lime guide lines along the floor
  for (let z = TUNNEL.back - RIB_SPACING / 2; z > TUNNEL.front; z -= RIB_SPACING) {
    group.add(
      box(0.05, HEIGHT, 0.14, ribLight, TUNNEL.left + 0.025, FLOOR_Y + HEIGHT / 2, z),
      box(0.05, HEIGHT, 0.14, ribLight, TUNNEL.right - 0.025, FLOOR_Y + HEIGHT / 2, z),
      box(width, 0.05, 0.14, ribLight, TUNNEL_CENTER_X, TUNNEL.ceiling - 0.025, z)
    );
  }
  [TUNNEL.left + 0.45, TUNNEL.right - 0.45].forEach((x) => group.add(box(0.06, 0.01, length, guideLight, x, FLOOR_Y + 0.01, middleZ)));
  // No lamp of its own: every light costs every surface in the gallery, and the ribs light the way

  // In the gallery: a trimmed doorway with the sign over it
  group.add(doorTrim(ROOM.front, 1));
  const entrance = sign(5, 1.25, 'SKY LOUNGE', '60F · OCEAN & MOUNTAIN VIEW');
  entrance.position.set(TUNNEL_CENTER_X, TUNNEL.ceiling + 0.95, ROOM.front + 0.03);
  group.add(entrance);
};

// The glass room: stone floor, three walls of glass between bronze mullions, a walnut back wall with the
// tunnel's mouth, the building's ledge and roof edge outside, and the furniture
const createLounge = (group, colliders) => {
  const { left, right, front, back, ceiling } = SKY_LOUNGE;
  const width = right - left;
  const depth = back - front;
  const wallHeight = ceiling - FLOOR_Y;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), stoneFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(SKY_CENTER_X, FLOOR_Y, SKY_CENTER_Z);
  floor.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMaterial);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(SKY_CENTER_X, ceiling, SKY_CENTER_Z);
  group.add(floor, roof);
  // Long light slots in the ceiling
  [-1, 0, 1].forEach((i) => group.add(box(0.25, 0.02, depth - 6, ribLight, SKY_CENTER_X + i * 11, ceiling - 0.01, SKY_CENTER_Z)));

  // Outside: the floor slab's edge and the roof's overhang frame the view, the tower's face runs off to
  // either side behind the lounge (and hides the gallery's own building)
  const overhang = 3;
  const towerFace = 100; // how far the tower's face runs off to each side
  group.add(
    box(width + 2 * overhang, 0.8, depth + overhang, facade, SKY_CENTER_X, FLOOR_Y - 0.41, SKY_CENTER_Z - overhang / 2),
    box(width + 2 * overhang, 0.9, depth + overhang, facade, SKY_CENTER_X, ceiling + 0.46, SKY_CENTER_Z - overhang / 2),
    box(towerFace, 100, 0.3, curtainWall, left - towerFace / 2, 0, back + 0.15),
    box(towerFace, 100, 0.3, curtainWall, right + towerFace / 2, 0, back + 0.15)
  );

  // The back wall in walnut slats, round the tunnel's mouth
  const backZ = back - 0.15;
  colliders.push(
    box(TUNNEL.left - left, wallHeight, 0.3, slatWall, (left + TUNNEL.left) / 2, FLOOR_Y + wallHeight / 2, backZ),
    box(right - TUNNEL.right, wallHeight, 0.3, slatWall, (TUNNEL.right + right) / 2, FLOOR_Y + wallHeight / 2, backZ)
  );
  group.add(box(TUNNEL.right - TUNNEL.left, ceiling - TUNNEL.ceiling, 0.3, slatWall, TUNNEL_CENTER_X, (ceiling + TUNNEL.ceiling) / 2, backZ));
  group.add(doorTrim(back, -1));
  const title = sign(6, 1.6, 'SKY LOUNGE', 'LEVEL 60');
  title.position.set((left + TUNNEL.left) / 2, 4.6, back - 0.31);
  title.rotation.y = Math.PI;
  group.add(title);

  // Glass, floor to ceiling, between bronze mullions, with a sill and a head rail
  const glassWall = (length, x, z, rotationY, bay) => {
    const wall = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(length, wallHeight), glass);
    pane.position.y = FLOOR_Y + wallHeight / 2;
    wall.add(pane);
    for (let along = -length / 2; along <= length / 2 + 0.01; along += bay) {
      wall.add(box(0.12, wallHeight, 0.2, bronze, along, FLOOR_Y + wallHeight / 2, 0));
    }
    wall.add(box(length, 0.22, 0.24, bronze, 0, FLOOR_Y + 0.11, 0), box(length, 0.2, 0.24, bronze, 0, ceiling - 0.1, 0));
    wall.position.set(x, 0, z);
    wall.rotation.y = rotationY;
    group.add(wall);
  };
  glassWall(depth, left, SKY_CENTER_Z, Math.PI / 2, BAY.side);
  glassWall(depth, right, SKY_CENTER_Z, Math.PI / 2, BAY.side);
  glassWall(width, SKY_CENTER_X, front, 0, BAY.front);
  // Invisible walls just inside the glass, for walking
  colliders.push(
    Object.assign(box(0.4, 30, depth, glass, left, 0, SKY_CENTER_Z), { visible: false }),
    Object.assign(box(0.4, 30, depth, glass, right, 0, SKY_CENTER_Z), { visible: false }),
    Object.assign(box(width, 30, 0.4, glass, SKY_CENTER_X, 0, front), { visible: false })
  );

  // Sunset light: a warm glow painted across the floor from the windows on the sun's side, instead of a
  // real light. three.js lights every surface with every light wherever it is, so a lamp out here cost
  // the whole gallery about a sixth of its frame rate.
  const sunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.8, depth * 0.9),
    new THREE.MeshBasicMaterial({ map: sunGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sunPatch.material.userData.colorTuned = true; // set for linear light already (colorSettings.js)
  sunPatch.rotation.set(-Math.PI / 2, 0, -SUN.azimuth); // the glow's bright edge toward the sun
  sunPatch.position.set(SKY_CENTER_X + 6, FLOOR_Y + 0.012, SKY_CENTER_Z - 3);
  group.add(sunPatch);

  // A daybed facing each side, two armchairs facing out ahead with a little table between them
  const addFurniture = (count, material, x, z, facing) => {
    const furniture = createSeat(count, material);
    furniture.seat.position.set(x, FLOOR_Y, z);
    furniture.seat.rotation.y = facing;
    furniture.seat.updateMatrixWorld();
    group.add(furniture.seat);
    // Sitting looks out of the window, level with the horizon
    furniture.spots.forEach((spot) => {
      const position = furniture.seat.localToWorld(spot.clone());
      const lookAt = new THREE.Vector3(position.x + Math.sin(facing) * 12, 0.9, position.z + Math.cos(facing) * 12);
      seats.push({ kind: 'view', position, facing, lookAt });
    });
    const sideways = Math.abs(Math.sin(facing)) > 0.5;
    colliders.push(collider(x, z, sideways ? furniture.depth : furniture.width, sideways ? furniture.width : furniture.depth));
  };
  addFurniture(3, cushionFabric, left + 5.5, SKY_CENTER_Z, -Math.PI / 2); // toward the ocean
  addFurniture(3, cushionFabric, right - 5.5, SKY_CENTER_Z, Math.PI / 2); // toward the mountains
  addFurniture(1, accentFabric, SKY_CENTER_X - 4.2, front + 7, Math.PI);
  addFurniture(1, accentFabric, SKY_CENTER_X + 4.2, front + 7, Math.PI);
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 40), walnut);
  top.position.y = 0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), bronze);
  stem.position.y = 0.25;
  table.add(top, stem);
  table.scale.setScalar(U);
  table.position.set(SKY_CENTER_X, FLOOR_Y, front + 7);
  group.add(table);
  colliders.push(collider(SKY_CENTER_X, front + 7, 2, 2));

  // A round rug under the armchairs
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.6 * U, 72),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b5, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(SKY_CENTER_X, FLOOR_Y + 0.01, front + 8);
  group.add(rug);

  // Plants in the four corners: monsteras by the back wall, fiddle-leaf figs against the glass
  [
    ['monstera', left + 2.4, back - 2.4],
    ['monstera', right - 2.4, back - 2.4],
    ['fig', left + 2.2, front + 2.2],
    ['fig', right - 2.2, front + 2.2],
  ].forEach(([kind, x, z], i) => {
    const plant = createPlant(kind, 10 + i);
    plant.position.set(x, FLOOR_Y, z);
    group.add(plant);
    colliders.push(collider(x, z, 1.5, 1.5));
  });
};

// Adds the tunnel, the lounge and its view; returns the walls and furniture to collide with, for main.js
// to add to the walls
export const createSkyLounge = (scene) => {
  const group = new THREE.Group();
  const colliders = [];
  createTunnel(group, colliders);
  createLounge(group, colliders);
  mergeStatic(group); // nothing here moves: one draw call per material
  group.add(createSkyView(new THREE.Vector3(SKY_CENTER_X, FLOOR_Y + 1.6 * U, SKY_CENTER_Z)));
  scene.add(group);
  return colliders;
};

// Called every frame from the render loop: the clouds, the waterfall and the sea move
export const updateSkyLounge = (delta) => updateSkyView(delta);
