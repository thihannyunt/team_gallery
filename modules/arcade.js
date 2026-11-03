import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';

// Stand-up arcade cabinet on the front wall, right of the mini bar.
// An original "Shuttle Rally" machine in Court Connect colours: lit marquee, a tilted screen running
// a pixel-art badminton rally in attract mode, two joysticks with six buttons, and painted side art.
// Modelled in meters (front facing +z, back against the wall at z = 0), then scaled into scene units;
// built from simple shapes and canvas textures, so there's nothing to download.

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
const GAME = { width: 160, height: 120, fps: 20 }; // the pixel game's resolution and frame rate

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

// The attract-mode game: two pixel players keep a rally going over the net
let game;
const drawGame = (time) => {
  const { ctx, texture } = game;
  const W = GAME.width;
  const H = GAME.height;
  ctx.fillStyle = '#071821';
  ctx.fillRect(0, 0, W, H);

  // Court in perspective along the bottom, net in the middle
  ctx.fillStyle = '#0b5d4b';
  ctx.beginPath();
  ctx.moveTo(18, 70);
  ctx.lineTo(W - 18, 70);
  ctx.lineTo(W - 2, 108);
  ctx.lineTo(2, 108);
  ctx.fill();
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(10, 106, W - 20, 1);
  ctx.fillRect(22, 72, W - 44, 1);
  ctx.fillRect(W / 2, 46, 1, 44); // net post
  for (let y = 48; y < 64; y += 2) ctx.fillRect(W / 2 - 1, y, 3, 1); // net mesh

  // The shuttle flies a high arc from one player to the other every 1.2 s
  const RALLY = 1.2;
  const shot = Math.floor(time / RALLY);
  const t = (time % RALLY) / RALLY;
  const fromLeft = shot % 2 === 0;
  const startX = 34;
  const endX = W - 34;
  const x = fromLeft ? startX + (endX - startX) * t : endX - (endX - startX) * t;
  const y = 74 - Math.sin(Math.PI * t) * 50;
  const players = [
    { x: 30, color: '#d0eb00', swing: fromLeft ? 1 - t : t },
    { x: W - 30, color: '#ff6b5b', swing: fromLeft ? t : 1 - t },
  ];
  players.forEach(({ x: px, color, swing }, i) => {
    const step = Math.round(Math.sin(time * 6 + i) * 1.5); // a little footwork
    ctx.fillStyle = '#f2c79b';
    ctx.fillRect(px - 2 + step, 66, 5, 5); // head
    ctx.fillStyle = color;
    ctx.fillRect(px - 3 + step, 71, 7, 9); // shirt
    ctx.fillStyle = '#1b2a3a';
    ctx.fillRect(px - 3 + step, 80, 3, 8); // legs
    ctx.fillRect(px + 1 + step, 80, 3, 8);
    // Racket raised as the shuttle comes in
    const side = i === 0 ? 1 : -1;
    const reach = swing > 0.8 ? 10 : 6;
    ctx.fillStyle = '#f6f4ef';
    ctx.fillRect(px + side * 4 + step, 70 - reach, 1, reach);
    ctx.strokeStyle = '#f6f4ef';
    ctx.strokeRect(px + side * 4 + step - 2.5, 64 - reach, 5, 6);
  });
  // Shuttle with a short trail
  [0.06, 0.03].forEach((back, i) => {
    const tt = Math.max(0, t - back);
    const tx = fromLeft ? startX + (endX - startX) * tt : endX - (endX - startX) * tt;
    ctx.fillStyle = i === 0 ? 'rgba(246,244,239,0.3)' : 'rgba(246,244,239,0.6)';
    ctx.fillRect(Math.round(tx), Math.round(74 - Math.sin(Math.PI * tt) * 50), 2, 2);
  });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x), Math.round(y), 3, 3);

  // Scores and title, a point every few rallies
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#d0eb00';
  ctx.textAlign = 'left';
  ctx.fillText(`1P ${String(7 + (Math.floor(time / 7) % 14)).padStart(2, '0')}`, 4, 3);
  ctx.fillStyle = '#ff6b5b';
  ctx.textAlign = 'right';
  ctx.fillText(`2P ${String(5 + (Math.floor(time / 9) % 16)).padStart(2, '0')}`, W - 4, 3);
  ctx.fillStyle = '#f6f4ef';
  ctx.textAlign = 'center';
  ctx.fillText('HI 21', W / 2, 3);
  ctx.fillStyle = '#7fe0ff';
  ctx.fillText('SHUTTLE RALLY', W / 2, 16);
  if (Math.floor(time * 1.5) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillText('INSERT COIN', W / 2, H - 11);
  }
  // Scanlines, like a CRT
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let row = 0; row < H; row += 2) ctx.fillRect(0, row, W, 1);
  texture.needsUpdate = true;
};

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
  drawGame(0);
  const screen = slopedPanel(SCREEN.top, SCREEN.bottom, new THREE.MeshBasicMaterial({ map: texture }), 0.07);
  screen.scale.y = 0.84; // 4:3 picture inside the bezel
  screen.position.addScaledVector(new THREE.Vector3(0, -Math.sin(screen.rotation.x), Math.cos(screen.rotation.x)), 0.004); // just off the bezel

  cabinet.add(marquee, bezel, screen, createControls());
  cabinet.scale.setScalar(UNITS_PER_METER);
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
  const depth = CABINET.depth * UNITS_PER_METER;
  return [collider(PLACE.x, PLACE.z + depth / 2, CABINET.width * UNITS_PER_METER + 0.3, depth + 0.3)];
};

// Called every frame from the render loop; redraws the game at its own frame rate
export const updateArcade = (delta) => {
  if (!game) return;
  game.time += Math.min(delta, 0.1);
  game.elapsed += delta;
  if (game.elapsed < 1 / GAME.fps) return;
  game.elapsed = 0;
  drawGame(game.time);
};
