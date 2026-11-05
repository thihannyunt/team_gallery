import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';
import { mergeStatic } from './mergeStatic.js';
import { ROOM } from './room.js';
import { createGlow, createLightCone } from './fakeGlow.js';
import { discussionTableCenter, discussionSofa } from './lounge.js';

// The touches that make the gallery feel lived in: tall potted plants (monstera and fiddle-leaf fig) in
// the empty corners and beside the sofa, a rug under the discussion sofa to match the lounge's and a round
// one under the piano stage, a small lamp on the low table, and three
// low plinths with small objects: a signed shuttlecock under a glass cover, the Court Connect app on a
// phone stand, and the crew's trophy. Modelled in meters, then scaled into scene units; built from simple
// shapes and canvas textures, so there's nothing to download. The plants are shared with skyLounge.js.

const U = UNITS_PER_METER;

// Where things go, in scene units (x, z) on the floor
const PLANTS = [
  { kind: 'monstera', x: 2.2, z: -4.9 }, // either side of the lounge sofa, behind its arms
  { kind: 'fig', x: 2.2, z: 4.9 },
  { kind: 'fig', x: 18.3, z: -18.3 }, // the empty corner past the arcade
  { kind: 'fig', x: 18.9, z: 18.8, facing: Math.PI / 2 }, // the back corner, beside the whiteboard (contactBoard.js)
];
const PLINTHS = [
  { object: 'shuttle', x: -17, z: -6, height: 0.95 },
  { object: 'phone', x: -17, z: -1, height: 1.05 },
  { object: 'trophy', x: -17, z: 4, height: 0.85 },
];
const DISCUSSION_RUG = { x: -13, z: 15.4, width: 2.9, depth: 2.6 }; // meters; under the back wall's sofa and table
// Centred on the stage (grandPiano.js), just showing past its glow ring; the back and left walls hide the
// part that runs under them
const PIANO_RUG = { x: -25.5, z: 12, radius: 2.62 };
const TABLE_TOP = 0.425; // the discussion table's top, meters above the floor (lounge.js)

// Small seeded random numbers, so every visit grows the same plants
const random = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
};

// ---- Plants ----

// A monstera leaf: heart shaped, split from the edge toward the midrib, with a few holes
const monsteraLeaf = canvasTexture(256, 256, (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#3f8a45');
  gradient.addColorStop(1, '#1f5a2c');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(128, 250);
  ctx.bezierCurveTo(10, 210, -10, 70, 70, 22);
  ctx.bezierCurveTo(100, 6, 120, 30, 128, 44);
  ctx.bezierCurveTo(136, 30, 156, 6, 186, 22);
  ctx.bezierCurveTo(266, 70, 246, 210, 128, 250);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 230, 160, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 44);
  ctx.lineTo(128, 248);
  ctx.stroke();
  // The splits and holes, cut out of the leaf
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 7;
  [70, 105, 140, 175].forEach((y, i) => {
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(128 + side * (40 + i * 4), y + 18);
      ctx.lineTo(128 + side * 140, y - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(128 + side * 26, y + 10, 5, 9, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });
});

// A fiddle-leaf fig leaf: a glossy violin shape, wider toward the tip, with pale veins
const figLeaf = canvasTexture(128, 256, (ctx) => {
  ctx.fillStyle = '#2b5a27';
  ctx.beginPath();
  ctx.moveTo(64, 252);
  ctx.bezierCurveTo(30, 230, 34, 170, 22, 120);
  ctx.bezierCurveTo(4, 50, 40, 6, 64, 8);
  ctx.bezierCurveTo(88, 6, 124, 50, 106, 120);
  ctx.bezierCurveTo(94, 170, 98, 230, 64, 252);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // gloss down one side
  ctx.beginPath();
  ctx.ellipse(48, 100, 16, 70, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 220, 150, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.lineTo(64, 14);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let y = 40; y < 230; y += 24) {
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(64, y + 14);
      ctx.quadraticCurveTo(64 + side * 24, y + 4, 64 + side * 40, y - 4);
      ctx.stroke();
    });
  }
});

// The leaf's own colours glow a little (emissiveMap), as if an uplight caught them (see plantLight)
const leafMaterial = (map) =>
  new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.55,
    emissive: 0x8a8470,
    emissiveMap: map,
  });
const monsteraMaterial = leafMaterial(monsteraLeaf);
const figMaterial = leafMaterial(figLeaf);
const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4c7a3a, roughness: 0.8 });
const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.9 });
const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2219, roughness: 1 });
const potMaterials = {
  charcoal: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.6 }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xb4643f, roughness: 0.85 }),
};

const createPot = (radius, height, finish) => {
  const pot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.78, height, 32), potMaterials[finish]);
  body.position.y = height / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.008, 0.012, 8, 40), potMaterials[finish]);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.015, 32), soilMaterial);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = height - 0.03;
  pot.add(body, rim, soil);
  return pot;
};

// A leaf `width` x `length` meters, its base at `base`, pointing out from the plant at `yaw` and tilted up
// from level by `lift` (radians), so its face shows from the side
const addLeaf = (plant, material, width, length, base, yaw, lift, twist) => {
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  leaf.geometry.translate(0, length / 2, 0); // hinge at the stalk end
  const holder = new THREE.Group();
  holder.position.copy(base);
  holder.rotation.set(0, yaw, 0);
  leaf.rotation.set(Math.PI / 2 - lift, 0, twist); // out along the holder's +z, which yaw turns outward
  holder.add(leaf);
  plant.add(holder);
};

// A tall potted plant, 'monstera' (big split leaves on long stalks) or 'fig' (a fiddle-leaf fig: a trunk
// with leaves all the way up). Returns a group in scene units, standing on the floor at its origin.
export const createPlant = (kind, seed = 1) => {
  const rand = random(seed * 7919 + (kind === 'fig' ? 3 : 0));
  const plant = new THREE.Group();
  if (kind === 'monstera') {
    plant.add(createPot(0.26, 0.42, 'cream'));
    for (let i = 0; i < 13; i++) {
      const yaw = (i / 13) * Math.PI * 2 + rand() * 0.4;
      const height = 0.75 + rand() * 0.75; // stalks from 0.75 to 1.5 m
      const lean = 0.18 + rand() * 0.22;
      const tip = new THREE.Vector3(Math.sin(yaw) * height * lean, 0.4 + height, Math.cos(yaw) * height * lean);
      const start = new THREE.Vector3(0, 0.4, 0);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, start.distanceTo(tip), 6), stemMaterial);
      stalk.position.copy(start).add(tip).multiplyScalar(0.5);
      stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(start).normalize());
      plant.add(stalk);
      const size = 0.42 + rand() * 0.2;
      addLeaf(plant, monsteraMaterial, size, size, tip, yaw, 0.25 + rand() * 0.55, (rand() - 0.5) * 0.6);
    }
  } else {
    plant.add(createPot(0.22, 0.4, rand() > 0.5 ? 'charcoal' : 'terracotta'));
    const trunkHeight = 1.85;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, trunkHeight, 8), barkMaterial);
    trunk.position.y = 0.38 + trunkHeight / 2;
    plant.add(trunk);
    for (let i = 0; i < 34; i++) {
      const along = 0.35 + (i / 34) * 0.65; // leaves on the upper two thirds
      const y = 0.38 + trunkHeight * along;
      const yaw = i * 2.4 + rand() * 0.6; // spiral round the trunk
      const base = new THREE.Vector3(Math.sin(yaw) * 0.03, y, Math.cos(yaw) * 0.03);
      const length = 0.26 + rand() * 0.12 + (1 - along) * 0.08;
      addLeaf(plant, figMaterial, length * 0.55, length, base, yaw, 0.15 + rand() * 0.65, (rand() - 0.5) * 0.8);
    }
  }
  plant.scale.setScalar(U);
  return plant;
};

// ---- Rugs ----

const rugMaterial = (map, color) =>
  new THREE.MeshStandardMaterial({
    map,
    color,
    roughness: 1,
    polygonOffset: true, // keeps the rug from flickering against the wooden floor
    polygonOffsetFactor: -1,
  });

// Same warm taupe as the lounge rug (lounge.js), with a woven border
const createDiscussionRug = () => {
  const map = canvasTexture(512, 416, (ctx, w, h) => {
    ctx.fillStyle = '#9c9384';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#857c6d';
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = 'rgba(2, 75, 74, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(42, 42, w - 84, h - 84);
  });
  const { x, z, width, depth } = DISCUSSION_RUG;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(width * U, depth * U), rugMaterial(map, 0xffffff));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, FLOOR_Y + 0.02, z);
  rug.receiveShadow = true;
  return rug;
};

// A round cream rug with a teal border under the piano's stage
const createPianoRug = () => {
  const map = canvasTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#d8cfbd';
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e3b39';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(c, c, c - 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.8)'; // a thin gold line inside the border
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c, c - 46, 0, Math.PI * 2);
    ctx.stroke();
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(PIANO_RUG.radius * U, 96), rugMaterial(map, 0xffffff));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(PIANO_RUG.x, FLOOR_Y + 0.012, PIANO_RUG.z);
  rug.receiveShadow = true;
  return rug;
};

// ---- Lamps ----

// A soft round pool of lamplight, laid on a floor or a table top (additive, like the bar's glows)
const glowPool = (() => {
  const map = canvasTexture(128, 128, (ctx, w) => {
    const gradient = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255, 200, 130, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 200, 130, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, w);
  });
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  return (radius) => {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), material);
    pool.rotation.x = -Math.PI / 2;
    return pool;
  };
})();

// Half metallic: fully metallic needs a reflection map, without one it renders nearly black
const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.45 });
const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.45, metalness: 0.6 });
const litShade = new THREE.MeshBasicMaterial({ color: 0xffdcaa, side: THREE.DoubleSide }); // glowing linen
const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1d6 }); // a spotlight's lit lens

// Linen drum shade lit from inside, `radius` and `height` in meters
const lampShade = (radius, height) => {
  const shade = new THREE.Group();
  shade.add(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height, 32, 1, true), litShade));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.25, 12, 8), bulbMaterial);
  bulb.position.y = -height * 0.15;
  shade.add(bulb);
  return shade;
};

// Table lamp: a round ceramic base and a small shade, its light pooling on the table top
const createTableLamp = () => {
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshStandardMaterial({ color: COLORS.teal, roughness: 0.35 }));
  base.scale.y = 1.15;
  base.position.y = 0.09;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), brass);
  neck.position.y = 0.23;
  const shade = lampShade(0.13, 0.15);
  shade.position.y = 0.33;
  const pool = glowPool(0.55);
  pool.position.y = 0.003;
  lamp.add(base, neck, shade, pool);
  lamp.scale.setScalar(U);
  return lamp;
};

// ---- Light ----

// Painted light (fakeGlow.js), not real lamps: every real light costs every lit surface in the gallery.
// Sizes in meters, inside groups that are scaled by U.
const WARM = 0xffd9a8; // the track lights' 3000 K (lighting.js)
const CEILING = (ROOM.ceiling - FLOOR_Y) / U; // the ceiling's height above the floor, in meters

// A small black spotlight can hanging just under the ceiling, its warm lens facing down (or up, `up`)
const lampCan = (up = false) => {
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 20), blackMetal);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), lensMaterial);
  lens.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
  lens.position.y = up ? 0.081 : -0.081;
  can.add(body, lens);
  return can;
};

// A ceiling spot onto a plinth `height` m tall: the can, its beam, a hot spot on the top and a pool of
// light on the floor round the base. (The plinth's sides brighten toward the top: plinthMaterial.)
const plinthLight = (height) => {
  const group = new THREE.Group();
  const can = lampCan();
  can.position.y = CEILING - 0.14;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), blackMetal);
  stem.position.y = CEILING - 0.03;
  const beamLength = CEILING - 0.22 - height;
  const beam = createLightCone(WARM, 0.05, 0.4, beamLength, 0.09);
  beam.position.y = CEILING - 0.22;
  const top = createGlow(WARM, 0.62, 0.62, 0.32);
  top.position.y = height + 0.002;
  const pool = createGlow(WARM, 2, 2, 0.55);
  pool.position.y = 0.004;
  group.add(can, stem, beam, top, pool);
  return group;
};

// An uplight on the floor beside a plant's pot, its beam rising into the leaves, and a warm pool of
// light round the pot. `top`: how high the leaves reach, in meters; the lamp sits on the pot's +x side.
const plantLight = (top) => {
  const group = new THREE.Group();
  const can = lampCan(true);
  can.position.set(0.36, 0.08, 0.12);
  const beam = createLightCone(WARM, 0.05, 0.75, top - 0.25, 0.13);
  beam.rotation.x = Math.PI; // shining up
  beam.position.set(0.3, 0.17, 0.1);
  beam.rotation.z = 0.12; // leaning in over the pot
  const pool = createGlow(WARM, 2.2, 2.2, 0.55);
  pool.position.y = 0.004;
  group.add(can, beam, pool);
  return group;
};

// A warm wash rising up a wall behind a plant, 2.4 x 2.6 m and bright at the floor, on the wall facing
// the room at `yaw` (0: the front wall, facing +z), centred at (x, z) in scene units
const wallWash = (yaw, x, z) => {
  const wash = createGlow(WARM, 2.4, 2.6, 0.5, 'wash');
  wash.scale.setScalar(U);
  wash.rotation.set(0, yaw, Math.PI); // standing up, its bright edge at the floor
  wash.position.set(x, FLOOR_Y + 1.3 * U, z);
  return wash;
};

// A plant with its uplight, and a wash up each wall it stands close to. `facing`: which way (yaw) the
// uplight sits from the pot, toward the room. Returns its collider.
const WALL_REACH = 3; // how close to a wall (scene units) a plant must be to light it
const addPlant = (decor, { kind, x, z, seed, facing = 0 }) => {
  const plant = createPlant(kind, seed);
  plant.position.set(x, FLOOR_Y, z);
  const light = plantLight(kind === 'fig' ? 2.2 : 1.9);
  light.scale.setScalar(U);
  light.position.copy(plant.position);
  light.rotation.y = facing;
  decor.add(plant, light);
  if (z < ROOM.front + WALL_REACH) decor.add(wallWash(0, x, ROOM.front + 0.02));
  if (z > ROOM.back - WALL_REACH) decor.add(wallWash(Math.PI, x, ROOM.back - 0.02));
  if (x > ROOM.right - WALL_REACH) decor.add(wallWash(-Math.PI / 2, ROOM.right - 0.02, z));
  if (x < ROOM.left + WALL_REACH) decor.add(wallWash(Math.PI / 2, ROOM.left + 0.02, z));
  return collider(x, z, 1.5, 1.5);
};

// ---- Plinths ----

const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.85 });
// Lit from the spot above (plinthLight): the plinths glow warm toward their tops, fading to the floor
const PLINTH_SPOT = new THREE.Color(WARM).multiplyScalar(0.34);
plinthMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.spotColor = { value: PLINTH_SPOT };
  shader.uniforms.spotLow = { value: FLOOR_Y + 0.1 * U };
  shader.uniforms.spotHigh = { value: FLOOR_Y + 0.95 * U };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nuniform vec3 spotColor;\nuniform float spotLow;\nuniform float spotHigh;')
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += spotColor * smoothstep(spotLow, spotHigh, vWorldY);'
    );
};
const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xdfeef2,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const gold = new THREE.MeshStandardMaterial({ color: 0xe0b44a, roughness: 0.3, metalness: 0.45, emissive: 0x3a2a08 });

// A little museum label for the plinth's front: title and one line about it
const plaque = (title, text) => {
  const map = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(0, 0, 8, h);
    ctx.fillStyle = '#f6f4ef';
    ctx.font = '800 46px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(title, 30, 66, w - 50);
    ctx.fillStyle = 'rgba(246, 244, 239, 0.7)';
    ctx.font = '500 30px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(text, 30, 120, w - 50);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.1125), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }));
};

// A shuttlecock standing on its cork, the crew's signatures across its feathers, under a glass dome.
// Shown twice life size so it reads from a few steps away.
const createSignedShuttle = () => {
  const group = new THREE.Group();
  const feathers = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 16) * w, h);
      ctx.lineTo((i / 16) * w + 6, 0);
      ctx.stroke();
    }
    ctx.fillStyle = '#c62828'; // a red thread band near the cork
    ctx.fillRect(0, h - 22, w, 6);
    // Six signatures in marker, scrawled round the skirt
    const rand = random(42);
    ctx.strokeStyle = '#1f3c88';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let s = 0; s < 6; s++) {
      let x = 20 + s * 82;
      let y = 40 + rand() * 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        x += 6 + rand() * 4;
        y = 40 + rand() * 40;
        ctx.quadraticCurveTo(x - 4, y - 18 * rand(), x, y);
      }
      ctx.stroke();
    }
  });
  feathers.wrapS = THREE.RepeatWrapping;
  const shuttle = new THREE.Group();
  const cork = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }));
  cork.rotation.x = Math.PI; // dome down, standing on it
  cork.position.y = 0.0125;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0128, 0.0128, 0.012, 24), new THREE.MeshStandardMaterial({ color: COLORS.teal, roughness: 0.5 }));
  band.position.y = 0.019;
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.013, 0.07, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: feathers, side: THREE.DoubleSide, roughness: 0.8 })
  );
  skirt.position.y = 0.025 + 0.035;
  shuttle.add(cork, band, skirt);
  shuttle.scale.setScalar(2.6);
  shuttle.position.y = 0.04;
  // A walnut base, and the glass dome over it
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.04, 40), new THREE.MeshStandardMaterial({ color: 0x4b2e1a, roughness: 0.45 }));
  base.position.y = 0.02;
  const dome = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 40, 1, true), glassMaterial);
  wall.position.y = 0.04 + 0.13;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMaterial);
  cap.position.y = 0.3;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), brass);
  knob.position.y = 0.44;
  dome.add(wall, cap, knob);
  group.add(base, shuttle, dome);
  return group;
};

// The Court Connect app on a phone, leaning on a little stand: the next match, who's in and a Join button
const createAppPhone = () => {
  const group = new THREE.Group();
  const screen = canvasTexture(360, 760, (ctx, w, h) => {
    const font = 'Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#f6f4ef';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#024b4a';
    ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = '#d0eb00';
    ctx.font = `800 40px ${font}`;
    ctx.fillText('Court Connect', 28, 92);
    ctx.fillStyle = 'rgba(246, 244, 239, 0.75)';
    ctx.font = `600 22px ${font}`;
    ctx.fillText('Find players. Book courts.', 28, 128);
    // Next match card
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 180, w - 44, 300);
    ctx.fillStyle = '#5b5b5b';
    ctx.font = `700 20px ${font}`;
    ctx.fillText('NEXT MATCH', 46, 222);
    ctx.fillStyle = '#0d1111';
    ctx.font = `800 34px ${font}`;
    ctx.fillText('Thu · 7:00 PM', 46, 268);
    ctx.font = `600 24px ${font}`;
    ctx.fillStyle = '#024b4a';
    ctx.fillText('Rallio Court 3 · Doubles', 46, 306);
    ['#024b4a', '#c9a227', '#b5345e', '#3a8dff'].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(70 + i * 44, 360, 20, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#5b5b5b';
    ctx.font = `600 22px ${font}`;
    ctx.fillText('4 of 6 in', 250, 368);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(46, 400, w - 92, 56);
    ctx.fillStyle = '#0d1111';
    ctx.font = `800 26px ${font}`;
    ctx.fillText('Join match', 120, 437);
    // Two more sessions, then the tab bar
    [520, 610].forEach((y, i) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, y, w - 44, 72);
      ctx.fillStyle = '#0d1111';
      ctx.font = `700 24px ${font}`;
      ctx.fillText(i ? 'Sun · Morning rally' : 'Sat · Social night', 46, y + 44);
    });
    ctx.fillStyle = '#024b4a';
    ctx.fillRect(0, h - 64, w, 64);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(w / 2 - 30, h - 40, 60, 6);
  });
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.076, 0.158, 0.008, 3, 0.006), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.5 }));
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ map: screen }));
  display.position.z = 0.0042;
  phone.add(body, display);
  phone.scale.setScalar(1.8); // a display model, bigger than life so the app can be read
  phone.position.set(0, 0.16, 0.01);
  phone.rotation.x = -0.25; // leaning back on the stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), blackMetal);
  stand.position.y = 0.015;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.012), blackMetal);
  back.position.set(0, 0.09, -0.04);
  back.rotation.x = -0.25;
  group.add(stand, back, phone);
  return group;
};

// The crew's trophy: a gold cup with handles on a black base
const createTrophy = () => {
  const group = new THREE.Group();
  const profile = [
    [0.0, 0.0], [0.06, 0.0], [0.06, 0.02], [0.025, 0.035], [0.016, 0.09], [0.022, 0.11],
    [0.07, 0.16], [0.085, 0.24], [0.08, 0.25], [0.0, 0.25],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), gold);
  cup.position.y = 0.07;
  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 24, Math.PI * 1.2), gold);
    handle.position.set(side * 0.085, 0.07 + 0.2, 0);
    handle.rotation.z = side > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
    group.add(handle);
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 0.15), blackMetal);
  base.position.y = 0.035;
  group.add(cup, base);
  return group;
};

const OBJECTS = {
  shuttle: { create: createSignedShuttle, title: 'Signed shuttle', text: 'From our first Court Connect night' },
  phone: { create: createAppPhone, title: 'Court Connect', text: 'The app that started it all' },
  trophy: { create: createTrophy, title: 'Crew Cup 2026', text: 'Won together, kept together' },
};

// A plinth `height` m tall with its object on top and a label on the face toward the main floor (+x)
const createPlinth = ({ object, height }) => {
  const plinth = new THREE.Group();
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.5, height, 0.5, 2, 0.01), plinthMaterial);
  block.position.y = height / 2;
  block.receiveShadow = true;
  const { create, title, text } = OBJECTS[object];
  const item = create();
  item.position.y = height;
  item.rotation.y = Math.PI / 2; // face the main floor
  const label = plaque(title, text);
  label.position.set(0.2501, height - 0.1, 0);
  label.rotation.y = Math.PI / 2;
  plinth.add(block, item, label, plinthLight(height));
  plinth.scale.setScalar(U);
  return plinth;
};

// Adds the decor and returns its invisible colliders for main.js to add to the walls
export const createGalleryDecor = (scene) => {
  const decor = new THREE.Group();
  const colliders = [];

  PLANTS.forEach((spec, i) => colliders.push(addPlant(decor, { ...spec, seed: i + 1 })));
  // A monstera at each end of the discussion sofa (createLounge runs first and records where it stands),
  // its uplight in front of the pot, toward the room (-z)
  [-1, 1].forEach((side, i) => {
    const x = discussionSofa.x + side * (discussionSofa.width / 2 + 0.85 * U); // leaves clear of the photos
    colliders.push(addPlant(decor, { kind: 'monstera', x, z: discussionSofa.z, seed: 20 + i, facing: Math.PI / 2 }));
  });

  PLINTHS.forEach((spec) => {
    const plinth = createPlinth(spec);
    plinth.position.set(spec.x, FLOOR_Y, spec.z);
    decor.add(plinth);
    colliders.push(collider(spec.x, spec.z, 0.5 * U + 0.2, 0.5 * U + 0.2));
  });

  decor.add(createDiscussionRug(), createPianoRug());


  const tableLamp = createTableLamp();
  // In the middle of the table (createLounge runs first and records where it stands)
  tableLamp.position.set(discussionTableCenter.x, FLOOR_Y + TABLE_TOP * U, discussionTableCenter.z);
  decor.add(tableLamp);

  scene.add(mergeStatic(decor)); // all of it stays put: one draw call per material
  return colliders;
};
