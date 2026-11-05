import * as THREE from 'three';
import { mergeStatic } from './mergeStatic.js';
import { createGlow } from './fakeGlow.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';
import { ROOM } from './room.js';
import { VIEW, drawRace, isRaceOn, stepRace, steerAmount } from './racingGame.js';

// Racing simulator on the front wall, between the grand piano and the Rally Bar: a black aluminium
// cockpit rig with a bucket seat, a direct-drive wheel, three pedals and a shifter, facing three angled
// screens on a stand, with a lit "Court Connect GP" sign above. The screens run the game across all
// three (racingGame.js); racingPlay.js sits the visitor in the seat to drive.
// Modelled in meters (front facing +z, back against the wall at z = 0), then scaled into scene units;
// built from simple shapes and canvas textures, so there's nothing to download.

const U = UNITS_PER_METER;
const PLACE = { x: -8.3, z: ROOM.front }; // the front wall
const SCREENS = { width: 0.8, height: 0.46, y: 1.02, z: 0.32, angle: THREE.MathUtils.degToRad(48), bezel: 0.014, depth: 0.035 };
const WHEEL = { y: 0.8, z: 0.94, radius: 0.14, tilt: -0.38, turn: 1.5 }; // `turn`: radians at full lock
const SIGN = { width: 1.5, height: 0.3, y: 1.78 };
const FPS = { attract: 20, race: 30 };

// Where the screens are in the room, for racingPlay.js to put the driver's eyes in front of them
export const racingScreens = {
  center: new THREE.Vector3(), // the middle screen's picture
  normal: new THREE.Vector3(0, 0, 1), // out of it, toward the seat
  centerWidth: (SCREENS.width - 2 * SCREENS.bezel) * U,
  totalWidth: (SCREENS.width * (1 + 2 * Math.cos(SCREENS.angle)) + 0.02) * U, // across all three, seen from the seat
  height: (SCREENS.height - 2 * SCREENS.bezel) * U,
};

// For lighting.js: a ceiling track light on the sign, like the photos get
export const racingSimLight = {
  center: new THREE.Vector3(PLACE.x, FLOOR_Y + SIGN.y * U, PLACE.z + 0.2),
  normal: new THREE.Vector3(0, 0, 1),
  width: SIGN.width * U,
  height: SIGN.height * U,
};

const aluminium = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.38, metalness: 0.7 });
const satin = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.3, metalness: 0.9 });
const fabric = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.92 });
const leather = new THREE.MeshStandardMaterial({ color: 0x101112, roughness: 0.6 });
const teal = new THREE.MeshStandardMaterial({ color: COLORS.teal ?? 0x024b4a, roughness: 0.7 });
const lime = new THREE.MeshStandardMaterial({ color: COLORS.lime, roughness: 0.45 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 });
const plastic = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.35 });

const box = (width, height, depth, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};
const cylinder = (radius, length, material, segments = 16) => new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);

let game = null; // { ctx, texture, elapsed, time }
let turn = null; // the wheel's rim, turned as the visitor steers
let seat = null;

// ---- The rig ----

const createFrame = () => {
  const frame = new THREE.Group();
  const rail = 0.05;
  // Floor mat with a lime edge, then the two base rails and their cross members
  frame.add(box(0.99, 0.008, 1.99, lime, 0, 0.004, 1.0), box(0.95, 0.012, 1.95, rubber, 0, 0.008, 1.0));
  [-0.27, 0.27].forEach((x) => frame.add(box(rail, rail, 1.45, aluminium, x, 0.014 + rail / 2, 1.18)));
  [0.48, 1.15, 1.86].forEach((z) => frame.add(box(0.6, rail, rail, aluminium, 0, 0.014 + rail / 2, z)));
  // Wheel deck on two uprights
  [-0.2, 0.2].forEach((x) => frame.add(box(rail, 0.58, rail, aluminium, x, 0.33, 0.74)));
  frame.add(box(0.5, 0.03, 0.3, aluminium, 0, 0.635, 0.76));
  // Pedals on an angled plate
  const pedals = new THREE.Group();
  pedals.position.set(0, 0.07, 0.55);
  pedals.rotation.x = -0.35;
  pedals.add(box(0.4, 0.025, 0.28, aluminium));
  [-0.11, 0, 0.11].forEach((x, i) => {
    const pedal = box(i === 0 ? 0.07 : 0.05, 0.13, 0.012, satin, x, 0.08, 0.02);
    pedal.rotation.x = -0.5;
    pedals.add(pedal, box(0.014, 0.1, 0.014, aluminium, x, 0.05, -0.04));
  });
  frame.add(pedals);
  // Sequential shifter on the right
  frame.add(box(0.08, 0.3, 0.06, aluminium, 0.33, 0.17, 1.12));
  const stick = cylinder(0.008, 0.16, satin, 10);
  stick.position.set(0.33, 0.39, 1.12);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), lime);
  knob.position.set(0.33, 0.48, 1.12);
  frame.add(stick, knob);
  return frame;
};

const createWheel = () => {
  const mount = new THREE.Group();
  // Direct-drive motor on the deck, with its shaft out to the wheel
  mount.add(box(0.15, 0.14, 0.24, plastic, 0, 0.72, 0.8));
  const shaft = cylinder(0.025, 0.08, satin);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, WHEEL.y - 0.01, WHEEL.z - 0.06);
  mount.add(shaft);

  const wheel = new THREE.Group();
  wheel.position.set(0, WHEEL.y, WHEEL.z);
  wheel.rotation.x = WHEEL.tilt;
  turn = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.017, 12, 40), leather);
  const hub = cylinder(0.05, 0.035, plastic, 20);
  hub.rotation.x = Math.PI / 2;
  const button = cylinder(0.018, 0.01, lime, 16);
  button.rotation.x = Math.PI / 2;
  button.position.z = 0.02;
  turn.add(rim, hub, button);
  [
    [0.095, 0, 0],
    [-0.095, 0, 0],
    [0, -0.075, Math.PI / 2],
  ].forEach(([x, y, angle]) => {
    const spoke = box(0.1, 0.03, 0.012, plastic, x, y, 0);
    spoke.rotation.z = angle;
    turn.add(spoke);
  });
  // A short top marker, and rev lights across the top that read green, amber, red
  turn.add(box(0.012, 0.03, 0.02, lime, 0, WHEEL.radius, 0.004));
  ['#2fd85a', '#2fd85a', '#2fd85a', '#f2c230', '#f2c230', '#ff3b30', '#ff3b30'].forEach((color, i) => {
    const led = box(0.01, 0.01, 0.006, new THREE.MeshBasicMaterial({ color }), (i - 3) * 0.016, 0.055, 0.02);
    turn.add(led);
  });
  // Shift paddles behind the rim
  [-1, 1].forEach((side) => turn.add(box(0.05, 0.08, 0.006, satin, side * 0.12, 0.02, -0.03)));
  wheel.add(turn);
  mount.add(wheel);
  return mount;
};

const createSeat = () => {
  const group = new THREE.Group();
  group.add(box(0.42, 0.14, 0.36, aluminium, 0, 0.11, 1.42)); // bracket on the rails
  group.add(box(0.46, 0.08, 0.46, fabric, 0, 0.23, 1.42)); // cushion
  [-1, 1].forEach((side) => {
    group.add(box(0.07, 0.1, 0.44, fabric, side * 0.215, 0.3, 1.42));
    group.add(box(0.012, 0.012, 0.44, lime, side * 0.25, 0.35, 1.42));
  });
  const back = new THREE.Group();
  back.position.set(0, 0.25, 1.64);
  back.rotation.x = 0.28; // leaning back, away from the wheel
  back.add(box(0.48, 0.82, 0.08, fabric, 0, 0.41, 0));
  back.add(box(0.26, 0.52, 0.01, teal, 0, 0.36, -0.045)); // teal centre panel
  [-1, 1].forEach((side) => {
    back.add(box(0.07, 0.56, 0.12, fabric, side * 0.215, 0.32, -0.04));
    back.add(box(0.012, 0.56, 0.012, lime, side * 0.25, 0.32, -0.1));
    back.add(box(0.06, 0.04, 0.02, rubber, side * 0.08, 0.7, -0.045)); // harness slots
  });
  group.add(back);
  return group;
};

// The picture on one of the three screens: a third of the game's wide canvas
const picture = (texture, third) => {
  const geometry = new THREE.PlaneGeometry(SCREENS.width - 2 * SCREENS.bezel, SCREENS.height - 2 * SCREENS.bezel);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (third + uv.getX(i)) / 3);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
};

const createScreens = (texture) => {
  const group = new THREE.Group();
  const { width, height, y, z, angle, depth } = SCREENS;
  const half = width / 2;
  const centers = [
    { x: -half - half * Math.cos(angle) - 0.008, z: z + half * Math.sin(angle), rotation: angle },
    { x: 0, z, rotation: 0 },
    { x: half + half * Math.cos(angle) + 0.008, z: z + half * Math.sin(angle), rotation: -angle },
  ];
  centers.forEach((place, third) => {
    const screen = new THREE.Group();
    screen.position.set(place.x, y, place.z);
    screen.rotation.y = place.rotation;
    screen.add(box(width, height, depth, plastic, 0, 0, -depth / 2));
    const image = picture(texture, third);
    image.position.z = 0.001;
    screen.add(image, box(0.1, 0.1, 0.06, aluminium, 0, 0, -depth - 0.03)); // VESA mount
    if (third === 1) screen.userData.picture = image;
    group.add(screen);
  });
  // Stand: a cross bar behind the screens on two uprights with feet
  group.add(box(1.5, 0.04, 0.04, aluminium, 0, y, z - 0.1));
  [-0.55, 0.55].forEach((x) => {
    group.add(box(0.05, y + 0.02, 0.05, aluminium, x, (y + 0.02) / 2, z - 0.1));
    group.add(box(0.08, 0.03, 0.5, aluminium, x, 0.015, z - 0.05));
  });
  return group;
};

// The sign over the screens: "COURT CONNECT GP" in lime on teal, with a chequered strip
const createSign = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 205;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1212';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 32) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (x / 32 + row) % 2 ? '#f4f2ea' : '#0d1212';
      ctx.fillRect(x, canvas.height - 32 + row * 16, 32, 16);
    }
  }
  let size = 104;
  const font = () => `italic 900 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font();
  while (ctx.measureText('COURT CONNECT GP').width > canvas.width * 0.9) {
    size -= 4; // whatever font the browser has, the words fit the board
    ctx.font = font();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#d0eb00';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#d0eb00';
  ctx.fillText('COURT CONNECT GP', canvas.width / 2, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const sign = new THREE.Group();
  sign.add(box(SIGN.width + 0.04, SIGN.height + 0.04, 0.03, aluminium, 0, 0, 0.015));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.width, SIGN.height), new THREE.MeshBasicMaterial({ map: texture }));
  face.position.z = 0.031;
  sign.add(face);
  sign.position.set(0, SIGN.y, 0);
  return sign;
};

// Adds the rig and returns its colliders for main.js to add to the walls
export const createRacingSim = (scene) => {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // crisp pixels, like the arcade
  texture.minFilter = THREE.LinearFilter;
  game = { ctx: canvas.getContext('2d'), texture, elapsed: 0, time: 0 };
  drawRace(game.ctx, 0);

  seat = createSeat();
  const screens = createScreens(texture);
  const rig = new THREE.Group();
  rig.add(createFrame(), createWheel(), seat, screens, createSign());
  rig.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  rig.scale.setScalar(U);
  rig.position.set(PLACE.x, FLOOR_Y, PLACE.z + 0.02);

  // The screens' glow on the floor round the seat, painted on rather than lit (fakeGlow.js)
  const glow = createGlow(0xbfe6ff, 3 * U, 2.4 * U, 0.25);
  glow.position.set(PLACE.x, FLOOR_Y + 0.01, PLACE.z + 1.2 * U);
  scene.add(rig, glow);

  rig.updateMatrixWorld(true);
  const middle = screens.children.find((child) => child.userData.picture).userData.picture;
  middle.getWorldPosition(racingScreens.center);
  // Batch stationary parts, retaining the independently moving wheel and hidden driver seat.
  mergeStatic(seat, { opaqueOnly: true });
  mergeStatic(turn, { opaqueOnly: true });
  seat.userData.keepSeparate = true;
  turn.userData.keepSeparate = true;
  mergeStatic(rig, { opaqueOnly: true });

  const along = (meters) => PLACE.z + meters * U;
  return [
    collider(PLACE.x, along(1.0), 0.66 * U, 1.95 * U), // seat, wheel and pedals
    collider(PLACE.x, along(0.4), 2.1 * U, 0.75 * U), // the screens
  ];
};

// The driver sits in the seat, so it's hidden while they're in it (the camera would be inside it)
export const showRacingSeat = (visible) => {
  if (seat) seat.visible = visible;
};

// Called every frame from the render loop: runs the race (or attract mode), turns the wheel, and
// redraws the screens at the game's own frame rate
export const updateRacingSim = (delta) => {
  if (!game) return;
  game.time += delta;
  stepRace(delta);
  if (turn) turn.rotation.z = -steerAmount() * WHEEL.turn;
  game.elapsed += delta;
  if (game.elapsed < 1 / (isRaceOn() ? FPS.race : FPS.attract)) return;
  game.elapsed = 0;
  drawRace(game.ctx, game.time);
  game.texture.needsUpdate = true;
};
