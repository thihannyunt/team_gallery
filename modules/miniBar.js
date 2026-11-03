import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';

// Mini bar on the front wall, right of the team portrait and away from the projector screen: a back-bar cabinet with
// lit shelves of bottles and a neon sign, a counter with a foot rail, three stools and two pendant
// lamps. The crossed rackets above it hang in badmintonDecor.js.
// Modelled in meters (front facing +z, back against the wall at z = 0), then scaled into scene
// units; built from simple shapes so it stays light on phones.

const PLACE = { x: 0, z: -20 }; // middle of the front wall, which stands at z = -20
const BACK_BAR = { width: 2.0, depth: 0.42, height: 0.9 };
const SPLASH = { bottom: 0.93, top: 2.42 }; // panel behind the shelves
const SHELVES = [1.22, 1.58];
const COUNTER = { width: 2.2, height: 1.05, depth: 0.56, z: 1.5, overhang: 0.22 };
const STOOLS = { z: 2.25, xs: [-0.7, 0, 0.7], seat: 0.76 };
const PENDANT_DROP = 2.05; // shade bottom above the floor

const walnut = new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.55 });
const stone = new THREE.MeshStandardMaterial({ color: 0x1c2121, roughness: 0.25, metalness: 0.1 });
const brass = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.3, metalness: 0.85 });
const darkWalnut = new THREE.MeshStandardMaterial({ color: 0x3e281a, roughness: 0.6 });
const tealPanel = new THREE.MeshStandardMaterial({ color: COLORS.teal, roughness: 0.7 });
const deepTeal = new THREE.MeshStandardMaterial({ color: 0x013635, roughness: 0.85 });
const blackMetal = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.6 });
const glass = new THREE.MeshStandardMaterial({ color: 0xe8f2f2, roughness: 0.05, transparent: true, opacity: 0.35 });

const box = (width, height, depth, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};

// Soft warm glow fading down from a light strip (additive, like the cove lights in lighting.js)
const glowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, 'rgba(255, 205, 140, 0.75)');
  gradient.addColorStop(1, 'rgba(255, 205, 140, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(canvas);
})();
const glowMaterial = new THREE.MeshBasicMaterial({
  map: glowTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });

// LED strip under a ledge at depth z, its glow washing down the surface behind it at surfaceZ
const ledStrip = (width, glowHeight, x, y, z, surfaceZ) => {
  const group = new THREE.Group();
  const strip = box(width, 0.008, 0.008, ledMaterial, 0, 0, 0);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, glowHeight), glowMaterial);
  glow.position.set(0, -glowHeight / 2, surfaceZ - z + 0.002);
  group.add(strip, glow);
  group.position.set(x, y, z);
  return group;
};

// Bottles in a few spirits colours, each with a cream label band; heights vary along the row
const BOTTLE_COLORS = [0x8a4b12, 0x2f5d2a, 0xc9d8d6, 0x6e1f2b, 0x2b4f7a, 0xa8741a];
const bottleMaterials = BOTTLE_COLORS.map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.08, transparent: true, opacity: 0.88 })
);
const labelMaterial = new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.8 });
const capMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });

const createBottle = (i) => {
  const bottle = new THREE.Group();
  const material = bottleMaterials[i % bottleMaterials.length];
  const radius = 0.034 + (i % 3) * 0.005;
  const height = 0.19 + ((i * 7) % 5) * 0.018;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material);
  body.position.y = height / 2;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.013, radius, 0.05, 16), material);
  shoulder.position.y = height + 0.025;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.06, 12), material);
  neck.position.y = height + 0.08;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), capMaterial);
  cap.position.y = height + 0.12;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.001, radius + 0.001, height * 0.35, 16, 1, true), labelMaterial);
  label.position.y = height * 0.45;
  bottle.add(body, shoulder, neck, cap, label);
  return bottle;
};

const bottleRow = (count, span, y, z, offset) =>
  Array.from({ length: count }, (_, i) => {
    const bottle = createBottle(i + offset);
    bottle.position.set(-span / 2 + (span * i) / (count - 1), y, z);
    return bottle;
  });

// "Rally Bar" in lime neon script
const createNeon = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 190px Caveat, "Comic Sans MS", cursive';
    ctx.shadowColor = 'rgba(208, 235, 0, 0.9)';
    [40, 18].forEach((blur) => {
      ctx.shadowBlur = blur;
      ctx.fillStyle = '#e9ff6a';
      ctx.fillText('Rally Bar', canvas.width / 2, canvas.height / 2);
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fbffe0';
    ctx.fillText('Rally Bar', canvas.width / 2, canvas.height / 2);
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  document.fonts?.load('700 190px Caveat').then(() => {
    draw();
    texture.needsUpdate = true;
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.375),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  return sign;
};

const createBackBar = () => {
  const group = new THREE.Group();
  const { width, depth, height } = BACK_BAR;
  group.add(box(width, height - 0.06, depth, walnut, 0, (height - 0.06) / 2 + 0.06, depth / 2));
  group.add(box(width - 0.04, 0.06, depth - 0.06, blackMetal, 0, 0.03, depth / 2 - 0.03)); // recessed kick
  // Four teal doors with brass pulls
  const doorWidth = (width - 0.1) / 4;
  for (let i = 0; i < 4; i++) {
    const x = -width / 2 + 0.05 + doorWidth * (i + 0.5);
    group.add(box(doorWidth - 0.02, height - 0.2, 0.012, tealPanel, x, height / 2 + 0.03, depth + 0.006));
    group.add(box(0.012, 0.12, 0.02, brass, x + (i % 2 ? -1 : 1) * (doorWidth / 2 - 0.06), height * 0.62, depth + 0.02));
  }
  group.add(box(width + 0.04, 0.03, depth + 0.03, stone, 0, height + 0.015, depth / 2 + 0.015));

  // Backsplash, two floating shelves with LED strips, bottles and the neon sign
  const splashHeight = SPLASH.top - SPLASH.bottom;
  group.add(box(width, splashHeight, 0.02, deepTeal, 0, SPLASH.bottom + splashHeight / 2, 0.01));
  SHELVES.forEach((y, row) => {
    group.add(box(width - 0.2, 0.03, 0.2, walnut, 0, y, 0.12));
    group.add(ledStrip(width - 0.24, 0.32, 0, y - 0.018, 0.1, 0.02));
    group.add(...bottleRow(row ? 9 : 11, width - 0.4, y + 0.015, 0.12, row * 5));
  });
  group.add(...bottleRow(7, width - 0.6, height + 0.03, 0.14, 11)); // a few on the counter top
  group.add(ledStrip(width - 0.1, 0.25, 0, SPLASH.top - 0.01, 0.03, 0.02)); // wash down from the top edge

  const neon = createNeon();
  neon.position.set(0, SPLASH.top - 0.24, 0.025); // above the tallest bottles on the top shelf
  group.add(neon);
  return group;
};

const createCounter = () => {
  const group = new THREE.Group();
  const { width, height, depth, z, overhang } = COUNTER;
  const front = z + depth / 2;
  group.add(box(width, height - 0.04, depth, walnut, 0, (height - 0.04) / 2, z));
  // Vertical slats across the front
  const slats = 22;
  for (let i = 0; i < slats; i++) {
    const x = -width / 2 + (width * (i + 0.5)) / slats;
    group.add(box(width / slats - 0.012, height - 0.12, 0.02, i % 2 ? walnut : darkWalnut, x, (height - 0.12) / 2 + 0.06, front + 0.01));
  }
  group.add(box(width + 0.06, 0.05, depth + overhang, stone, 0, height - 0.025, z + overhang / 2));
  group.add(ledStrip(width, 0.5, 0, height - 0.055, front + 0.06, front + 0.02)); // warm wash down the slats

  // Brass foot rail on two brackets
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, width - 0.1, 16), brass);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 0.22, front + 0.14);
  group.add(rail);
  [-0.8, 0.8].forEach((x) => group.add(box(0.03, 0.03, 0.13, brass, x, 0.22, front + 0.07)));

  // A cocktail shaker, two glasses and a bowl of limes on the counter
  const top = height;
  const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.2, 20), brass);
  shaker.position.set(-0.55, top + 0.1, z + 0.05);
  group.add(shaker);
  [-0.35, 0.45].forEach((x) => {
    const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.1, 20), glass);
    tumbler.position.set(x, top + 0.05, z + 0.12);
    group.add(tumbler);
  });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stone);
  bowl.position.set(0.1, top + 0.1, z + 0.02);
  group.add(bowl);
  const lime = new THREE.MeshStandardMaterial({ color: 0x8cc63f, roughness: 0.6 });
  [
    [0.06, 0.04],
    [0.14, 0.0],
    [0.09, 0.08],
    [0.12, -0.03],
  ].forEach(([x, dz], i) => {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), lime);
    fruit.position.set(x, top + 0.04 + (i === 3 ? 0.04 : 0), z + 0.02 + dz);
    group.add(fruit);
  });
  return group;
};

const createStool = () => {
  const stool = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.025, 32), blackMetal);
  base.position.y = 0.0125;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, STOOLS.seat - 0.05, 12), blackMetal);
  pole.position.y = (STOOLS.seat - 0.05) / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 32), brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.07, 32), tealPanel);
  seat.position.y = STOOLS.seat - 0.035;
  stool.add(base, pole, ring, seat);
  return stool;
};

// Two dome pendants over the counter, their bulbs glowing under the shade
const createPendants = (ceilingY) => {
  const group = new THREE.Group();
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.6 });
  const lining = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.3, metalness: 0.85, side: THREE.BackSide }); // seen from below
  [-0.55, 0.55].forEach((x) => {
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), shadeMaterial);
    shade.position.set(x, PENDANT_DROP, COUNTER.z);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.165, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), lining);
    inner.position.copy(shade.position);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), bulbMaterial);
    bulb.position.set(x, PENDANT_DROP + 0.05, COUNTER.z);
    const cordLength = ceilingY - (PENDANT_DROP + 0.17);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, cordLength, 6), blackMetal);
    cord.position.set(x, PENDANT_DROP + 0.17 + cordLength / 2, COUNTER.z);
    group.add(shade, inner, bulb, cord);
  });
  return group;
};

// Adds the bar and returns its invisible colliders for main.js to add to the walls
export const createMiniBar = (scene) => {
  const U = UNITS_PER_METER;
  const bar = new THREE.Group();
  const ceilingY = (10 - FLOOR_Y) / U; // the ceiling (y = 10) in meters above the floor
  bar.add(createBackBar(), createCounter(), createPendants(ceilingY));
  STOOLS.xs.forEach((x) => {
    const stool = createStool();
    stool.position.set(x, 0, STOOLS.z);
    bar.add(stool);
  });
  bar.scale.setScalar(U);
  bar.position.set(PLACE.x, FLOOR_Y, PLACE.z + 0.02); // built facing +z, into the room

  // The pendants' light pooling on the counter top
  const light = new THREE.PointLight(0xffcf8f, 0.9, 9, 2);
  light.position.set(PLACE.x, FLOOR_Y + (PENDANT_DROP + 0.05) * U, PLACE.z + COUNTER.z * U);
  scene.add(bar, light);

  const depthOf = (meters) => PLACE.z + meters * U; // meters out from the wall to world z
  return [
    collider(PLACE.x, depthOf(BACK_BAR.depth / 2), BACK_BAR.width * U, BACK_BAR.depth * U + 0.2),
    collider(PLACE.x, depthOf(COUNTER.z + COUNTER.overhang / 2), COUNTER.width * U + 0.3, (COUNTER.depth + COUNTER.overhang) * U + 0.3),
    collider(PLACE.x, depthOf(STOOLS.z), 1.8 * U, 0.42 * U),
  ];
};
