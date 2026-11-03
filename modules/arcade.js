import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';
import { drawAttract, drawMatch, isMatchOn, stepMatch } from './shuttleRally.js';

// Stand-up arcade cabinet on the front wall, right of the mini bar.
// An original "Shuttle Rally" machine in Court Connect colours: lit marquee, a tilted screen running
// a pixel-art badminton rally in attract mode, two joysticks with six buttons, and painted side art.
// Modelled in meters (front facing +z, back against the wall at z = 0), then scaled into scene units;
// built from simple shapes and canvas textures, so there's nothing to download. The game on the screen
// is shuttleRally.js; arcadePlay.js lets the visitor step up and play it.

const PLACE = { x: 10, z: -20 }; // the front wall stands at z = -20
const CABINET = { width: 0.72, depth: 0.85, height: 1.85, side: 0.022 };
// Side profile as [z, y] in meters, back to front and bottom to top
const PROFILE = [
  [0, 0],
  [0, 1.85], // back top
  [0.56, 1.85], // marquee top
  [0.6, 1.62], // marquee bottom
  [0.48, 1.56], // screen top, set back under the marquee
  [0.62, 1.06], // screen bottom
  [0.86, 1.0], // control panel front edge
  [0.86, 0.9],
  [0.64, 0.87], // under the control panel
  [0.64, 0],
];
const SCREEN = { top: [0.48, 1.56], bottom: [0.62, 1.06] };
const MARQUEE = { top: [0.56, 1.85], bottom: [0.6, 1.62] };
const PANEL = { back: [0.62, 1.06], front: [0.86, 1.0] };
const GAME = { width: 160, height: 120, fps: 20, playFps: 30 }; // the pixel game's resolution and frame rates

// Where the screen is in the room, for arcadePlay.js to bring the camera up to it (filled in by createArcade)
export const arcadeScreen = {
  center: new THREE.Vector3(),
  normal: new THREE.Vector3(), // out of the glass, toward the player
  up: new THREE.Vector3(), // the screen's own up, leaning back with it
  width: 0,
  height: 0,
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

const black = new THREE.MeshStandardMaterial({ color: 0x111414, roughness: 0.5 });
const trim = new THREE.MeshStandardMaterial({ color: COLORS.lime, roughness: 0.4 });

// Side art: teal with lime speed stripes, a big shuttle and the game's name running up the side
const drawSideArt = (ctx, width, height) => {
  ctx.fillStyle = '#024b4a';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.rotate(-0.5);
  [0.18, 0.3, 0.38].forEach((y, i) => {
    ctx.fillStyle = i === 1 ? '#d0eb00' : 'rgba(208, 235, 0, 0.35)';
    ctx.fillRect(-width, height * y + width * 0.5, width * 3, height * (i === 1 ? 0.035 : 0.015));
  });
  ctx.restore();

  // A shuttle in flight, cork first
  ctx.save();
  ctx.translate(width * 0.5, height * 0.58);
  ctx.rotate(0.6);
  ctx.fillStyle = '#f6f4ef';
  ctx.beginPath();
  ctx.moveTo(-width * 0.08, 0);
  ctx.lineTo(-width * 0.3, -height * 0.2);
  ctx.lineTo(width * 0.3, -height * 0.2);
  ctx.lineTo(width * 0.08, 0);
  ctx.fill();
  ctx.fillStyle = '#c9a227';
  ctx.beginPath();
  ctx.arc(0, height * 0.02, width * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.2, height * 0.95);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#d0eb00';
  ctx.font = `800 ${Math.round(width * 0.17)}px Manrope, "Arial Black", sans-serif`;
  ctx.fillText('SHUTTLE RALLY', 0, 0);
  ctx.restore();
};

const drawMarquee = (ctx, width, height) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0b6b69');
  gradient.addColorStop(1, '#013635');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#d0eb00';
  ctx.shadowBlur = height * 0.12;
  ctx.fillStyle = '#e8ff4a';
  ctx.font = `800 ${Math.round(height * 0.42)}px Manrope, "Arial Black", sans-serif`;
  ctx.fillText('SHUTTLE RALLY', width / 2, height * 0.45);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f6f4ef';
  ctx.font = `700 ${Math.round(height * 0.15)}px Manrope, sans-serif`;
  ctx.fillText('COURT CONNECT ARCADE · 1 OR 2 PLAYERS', width / 2, height * 0.82);
};

let game; // the screen's canvas, its texture and mesh, and the game clock

// A flat panel stretched between two [z, y] points of the side profile, `inset` meters in from the sides
const slopedPanel = (top, bottom, material, inset = 0) => {
  const length = Math.hypot(top[0] - bottom[0], top[1] - bottom[1]);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(CABINET.width - 2 * inset, length), material);
  panel.position.set(0, (top[1] + bottom[1]) / 2, (top[0] + bottom[0]) / 2);
  panel.rotation.x = Math.atan2(top[0] - bottom[0], top[1] - bottom[1]); // local up runs bottom to top
  return panel;
};

const createControls = () => {
  const controls = new THREE.Group();
  const length = Math.hypot(PANEL.front[0] - PANEL.back[0], PANEL.front[1] - PANEL.back[1]);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(CABINET.width + 0.04, 0.03, length), black);
  controls.add(deck);

  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a0, roughness: 0.3, metalness: 0.8 });
  const buttonColors = [0xff4d4d, 0xffd23f, 0x3ddc84];
  [
    { x: -0.17, ball: 0xff4d4d },
    { x: 0.17, ball: 0x3a8dff },
  ].forEach(({ x, ball }) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), metal);
    shaft.position.set(x - 0.07, 0.04, 0.01);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 16, 12),
      new THREE.MeshStandardMaterial({ color: ball, roughness: 0.25 })
    );
    top.position.set(x - 0.07, 0.07, 0.01);
    controls.add(shaft, top);
    buttonColors.forEach((color, i) => {
      const button = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.014, 16),
        new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.15 })
      );
      button.position.set(x + 0.01 + i * 0.035, 0.022, 0.02 - (i === 1 ? 0.012 : 0));
      controls.add(button);
    });
  });
  controls.position.set(0, (PANEL.back[1] + PANEL.front[1]) / 2 + 0.015, (PANEL.back[0] + PANEL.front[0]) / 2);
  controls.rotation.x = Math.atan2(PANEL.back[1] - PANEL.front[1], PANEL.front[0] - PANEL.back[0]); // front edge lower
  return controls;
};

const createCabinet = () => {
  const cabinet = new THREE.Group();

  // Side panels cut to the profile, with the side art on the outside
  const shape = new THREE.Shape(PROFILE.map(([z, y]) => new THREE.Vector2(z, y)));
  const sideGeometry = new THREE.ExtrudeGeometry(shape, { depth: CABINET.side, bevelEnabled: false });
  sideGeometry.rotateY(-Math.PI / 2); // shape x runs along +z, the extrusion toward -x
  const art = canvasTexture(512, 1024, drawSideArt);
  art.repeat.set(1 / CABINET.depth, 1 / CABINET.height); // the extrusion's UVs are in meters
  // Seen from the right the profile runs back to front leftward, so that side's art is mirrored to read
  const mirrored = art.clone();
  mirrored.repeat.x = -art.repeat.x;
  mirrored.offset.x = 1;
  [-1, 1].forEach((side) => {
    const map = side > 0 ? mirrored : art;
    const artMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.55 });
    const panel = new THREE.Mesh(sideGeometry, [artMaterial, trim]); // faces, then the edge (lime T-molding)
    panel.position.x = side > 0 ? CABINET.width / 2 : -CABINET.width / 2 + CABINET.side;
    cabinet.add(panel);
  });

  // The body between the sides: lower cabinet and the box behind the screen
  const inner = CABINET.width - 2 * CABINET.side;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.87, 0.64), black);
  lower.position.set(0, 0.435, 0.32);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.99, 0.46), black); // just behind the tilted screen
  upper.position.set(0, 1.355, 0.23);
  const underPanel = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.13, 0.24), black);
  underPanel.position.set(0, 0.935, 0.74);
  const top = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.02, 0.56), black);
  top.position.set(0, 1.84, 0.28);
  cabinet.add(lower, upper, underPanel, top);

  // Coin door with two glowing slots
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32), new THREE.MeshStandardMaterial({ color: 0x2a2f2f, roughness: 0.35, metalness: 0.6 }));
  door.position.set(0, 0.52, 0.641);
  cabinet.add(door);
  [-0.06, 0.06].forEach((x) => {
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    slot.position.set(x, 0.6, 0.642);
    cabinet.add(slot);
  });

  // Marquee and screen glow on their own (unlit materials), the screen behind a black bezel
  const marquee = slopedPanel(MARQUEE.top, MARQUEE.bottom, new THREE.MeshBasicMaterial({ map: canvasTexture(1024, 256, drawMarquee) }), CABINET.side);
  const bezel = slopedPanel(SCREEN.top, SCREEN.bottom, black, CABINET.side);

  const canvas = document.createElement('canvas');
  canvas.width = GAME.width;
  canvas.height = GAME.height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // keep the pixels crisp
  texture.minFilter = THREE.LinearFilter;
  game = { ctx: canvas.getContext('2d'), texture, elapsed: 0, time: 0 };
  drawAttract(game.ctx, 0);
  const screen = slopedPanel(SCREEN.top, SCREEN.bottom, new THREE.MeshBasicMaterial({ map: texture }), 0.07);
  screen.scale.y = 0.84; // 4:3 picture inside the bezel
  screen.position.addScaledVector(new THREE.Vector3(0, -Math.sin(screen.rotation.x), Math.cos(screen.rotation.x)), 0.004); // just off the bezel

  cabinet.add(marquee, bezel, screen, createControls());
  cabinet.scale.setScalar(UNITS_PER_METER);
  game.screen = screen;
  return cabinet;
};

// Adds the cabinet and returns its invisible collider for main.js to add to the walls
export const createArcade = (scene) => {
  const cabinet = createCabinet();
  cabinet.position.set(PLACE.x, FLOOR_Y, PLACE.z + 0.02);
  // The screen's glow on the floor and the visitor standing at the controls
  const glow = new THREE.PointLight(0x7fd8ff, 0.6, 6, 2);
  glow.position.set(PLACE.x, FLOOR_Y + 1.4 * UNITS_PER_METER, PLACE.z + 1.2 * UNITS_PER_METER);
  scene.add(cabinet, glow);

  cabinet.updateMatrixWorld(true);
  const { screen } = game;
  const facing = screen.getWorldQuaternion(new THREE.Quaternion());
  screen.getWorldPosition(arcadeScreen.center);
  arcadeScreen.normal.set(0, 0, 1).applyQuaternion(facing);
  arcadeScreen.up.set(0, 1, 0).applyQuaternion(facing);
  arcadeScreen.width = screen.geometry.parameters.width * UNITS_PER_METER;
  arcadeScreen.height = screen.geometry.parameters.height * screen.scale.y * UNITS_PER_METER;

  const depth = CABINET.depth * UNITS_PER_METER;
  return [collider(PLACE.x, PLACE.z + depth / 2, CABINET.width * UNITS_PER_METER + 0.3, depth + 0.3)];
};

// Called every frame from the render loop; plays the match (or attract mode) and redraws the screen
// at the game's own frame rate
export const updateArcade = (delta) => {
  if (!game) return;
  const step = Math.min(delta, 0.1);
  game.time += step;
  const playing = isMatchOn();
  if (playing) stepMatch(step);
  game.elapsed += delta;
  if (game.elapsed < 1 / (playing ? GAME.playFps : GAME.fps)) return;
  game.elapsed = 0;
  if (playing) drawMatch(game.ctx);
  else drawAttract(game.ctx, game.time);
  game.texture.needsUpdate = true;
};
