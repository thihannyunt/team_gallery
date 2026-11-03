import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER, CENTERLINE_Y } from './paintingData.js';

// Badminton props: a display of crossed rackets above the mini bar, plus the racket and shuttle models
// and the collider helper the other decor modules share.
// Everything is modelled in meters at real equipment size, then scaled into scene units.
// Built from simple shapes (no downloads) so it stays light on phones.

export const COLORS = {
  lime: 0xd0eb00,
  teal: 0x024b4a,
  cream: 0xf6f4ef,
  ink: 0x0d1111,
  gold: 0xc9a227,
};

const RACKET = {
  length: 0.675,
  headWidth: 0.2,
  headHeight: 0.23,
  frameRadius: 0.004,
  throatLength: 0.03,
  shaftRadius: 0.0038,
  handleLength: 0.2,
  handleRadius: 0.013,
};

const SHUTTLE = {
  corkRadius: 0.0125,
  corkBodyHeight: 0.01,
  skirtHeight: 0.065,
  skirtTopRadius: 0.032,
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

const materials = new Map();
const solid = (color, options = {}) => {
  const key = `${color}-${options.roughness ?? ''}-${options.metalness ?? ''}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...options }));
  }
  return materials.get(key);
};

// Shuttlecock

const drawFeathers = (ctx, width, height) => {
  const count = 16;
  const featherWidth = width / count;
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, height * 0.55, width, height * 0.45); // feathers overlap near the cork
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.5) * featherWidth;
    const half = featherWidth * 0.48;
    ctx.beginPath();
    ctx.moveTo(cx - half, height);
    ctx.lineTo(cx - half, height * 0.2);
    ctx.quadraticCurveTo(cx - half, height * 0.03, cx, height * 0.03); // rounded feather tip
    ctx.quadraticCurveTo(cx + half, height * 0.03, cx + half, height * 0.2);
    ctx.lineTo(cx + half, height);
    ctx.fill();
  }
  ctx.strokeStyle = '#d6d0c4'; // quills
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.5) * featherWidth;
    ctx.beginPath();
    ctx.moveTo(cx, height);
    ctx.lineTo(cx, height * 0.12);
    ctx.stroke();
  }
};

let shuttleParts;
const getShuttleParts = () => {
  if (shuttleParts) return shuttleParts;

  const { corkRadius, corkBodyHeight, skirtHeight, skirtTopRadius } = SHUTTLE;
  const skirtBottom = corkRadius + corkBodyHeight * 0.6;
  const skirtRadiusAt = (t) => corkRadius * 0.95 + (skirtTopRadius - corkRadius * 0.95) * t;

  const cork = new THREE.SphereGeometry(corkRadius, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  cork.translate(0, corkRadius, 0);
  const corkBody = new THREE.CylinderGeometry(corkRadius, corkRadius, corkBodyHeight, 24);
  corkBody.translate(0, corkRadius + corkBodyHeight / 2, 0);
  const band = new THREE.CylinderGeometry(corkRadius * 1.03, corkRadius * 1.03, corkBodyHeight * 0.45, 24, 1, true);
  band.translate(0, corkRadius + corkBodyHeight * 0.55, 0);
  const skirt = new THREE.CylinderGeometry(skirtTopRadius, corkRadius * 0.95, skirtHeight, 32, 1, true);
  skirt.translate(0, skirtBottom + skirtHeight / 2, 0);
  const threads = [0.3, 0.55].map((t) => {
    const thread = new THREE.TorusGeometry(skirtRadiusAt(t), 0.0008, 6, 32);
    thread.rotateX(Math.PI / 2);
    thread.translate(0, skirtBottom + skirtHeight * t, 0);
    return thread;
  });

  const featherMaterial = new THREE.MeshStandardMaterial({
    map: canvasTexture(512, 256, drawFeathers),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.7,
  });

  shuttleParts = [
    [cork, solid(COLORS.cream, { roughness: 0.5 })],
    [corkBody, solid(COLORS.cream, { roughness: 0.5 })],
    [band, solid(COLORS.lime)],
    [skirt, featherMaterial],
    ...threads.map((thread) => [thread, solid(COLORS.teal)]),
  ];
  return shuttleParts;
};

// Upright shuttle, cork resting on y = 0, size in scene units per meter of real shuttle
const createShuttle = (size) => {
  const shuttle = new THREE.Group();
  getShuttleParts().forEach(([geometry, material]) => shuttle.add(new THREE.Mesh(geometry, material)));
  shuttle.scale.setScalar(UNITS_PER_METER * size);
  return shuttle;
};

// Racket

const drawStrings = (ctx, width, height) => {
  const count = 22;
  ctx.strokeStyle = 'rgba(246, 244, 239, 0.9)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= count; i++) {
    const t = (i / count) * width;
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(t, height);
    ctx.moveTo(0, t);
    ctx.lineTo(width, t);
    ctx.stroke();
  }
};

let racketGeometry;
const getRacketGeometry = () => {
  if (racketGeometry) return racketGeometry;

  const { length, headWidth, headHeight, frameRadius, throatLength, shaftRadius, handleLength, handleRadius } =
    RACKET;
  const headCenter = length - headHeight / 2;
  const headBottom = length - headHeight;
  const shaftLength = headBottom - throatLength - handleLength;

  const rim = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    rim.push(new THREE.Vector3((Math.cos(angle) * headWidth) / 2, headCenter + (Math.sin(angle) * headHeight) / 2, 0));
  }
  const frame = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 96, frameRadius, 8, true);

  const strings = new THREE.CircleGeometry(1, 48);
  strings.scale(headWidth / 2 - frameRadius, headHeight / 2 - frameRadius, 1);
  strings.translate(0, headCenter, 0);

  const throat = new THREE.CylinderGeometry(frameRadius * 3, shaftRadius, throatLength + frameRadius * 2, 12);
  throat.translate(0, headBottom - throatLength / 2, 0);
  const shaft = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12);
  shaft.translate(0, handleLength + shaftLength / 2, 0);
  const handle = new THREE.CylinderGeometry(handleRadius * 0.92, handleRadius, handleLength, 8); // octagonal grip
  handle.translate(0, handleLength / 2, 0);
  const cap = new THREE.CylinderGeometry(handleRadius * 1.08, handleRadius * 1.08, 0.008, 8);
  cap.translate(0, 0.004, 0);

  racketGeometry = { frame, strings, throat, shaft, handle, cap };
  return racketGeometry;
};

let stringMaterial;

// Racket in meters, standing on the butt of its handle at y = 0, strings facing +z
export const createRacketModel = (frameColor, gripColor) => {
  const geometry = getRacketGeometry();
  stringMaterial ??= new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 256, drawStrings),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frame = solid(frameColor, { roughness: 0.35, metalness: 0.2 });
  const shaft = solid(0x9aa3a3, { roughness: 0.3, metalness: 0.6 });

  const racket = new THREE.Group();
  racket.add(
    new THREE.Mesh(geometry.frame, frame),
    new THREE.Mesh(geometry.strings, stringMaterial),
    new THREE.Mesh(geometry.throat, frame),
    new THREE.Mesh(geometry.shaft, shaft),
    new THREE.Mesh(geometry.handle, solid(gripColor, { roughness: 0.9 })),
    new THREE.Mesh(geometry.cap, frame)
  );
  return racket;
};

// Same racket in scene units, `size` times real size
const createRacket = (size, frameColor, gripColor) => {
  const racket = createRacketModel(frameColor, gripColor);
  racket.scale.setScalar(UNITS_PER_METER * size);
  return racket;
};

// Arrangements

// Invisible box the player can't walk through (see checkCollision in movement.js)
export const collider = (x, z, width, depth) => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, 10, depth));
  box.position.set(x, 0, z);
  box.visible = false;
  return box;
};

// Two rackets crossed at the shafts with a shuttle below, hung on a wall (at the photos' centerline
// unless `y` says otherwise)
const createWallDisplay = ({ x, y = CENTERLINE_Y, z, rotationY }) => {
  const size = 1.5;
  const display = new THREE.Group();
  [
    [-0.6, COLORS.lime],
    [0.6, COLORS.teal],
  ].forEach(([tilt, color], i) => {
    const racket = createRacket(size, color, COLORS.cream);
    racket.position.y = -0.33 * UNITS_PER_METER * size; // pivot around the middle of the shaft
    const pivot = new THREE.Group();
    pivot.add(racket);
    pivot.rotation.z = tilt;
    pivot.position.z = i * 0.05; // one racket just in front of the other
    display.add(pivot);
  });
  const shuttle = createShuttle(size * 1.3);
  shuttle.position.set(0, -0.3 * UNITS_PER_METER * size, 0.15);
  display.add(shuttle);

  display.position.set(x, y, z);
  display.rotation.y = rotationY;
  return display;
};

// Returns the invisible colliders so main.js can add them to the walls the player bumps into
export const createBadmintonDecor = (scene) => {
  scene.add(createWallDisplay({ x: 0, y: 6.5, z: -19.3, rotationY: 0 })); // front wall, above the mini bar's neon sign (miniBar.js)
  return [];
};
