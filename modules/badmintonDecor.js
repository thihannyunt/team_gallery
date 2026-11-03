import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER, CENTERLINE_Y } from './paintingData.js';

// Badminton props: a court on the floor in front of the about-us wall with its net up and a racket and
// shuttle set out neatly on each side, giant rackets in the front corners and crossed rackets on the
// back wall.
// Everything is modelled in meters at real equipment size, then scaled into scene units.
// Built from simple shapes (no downloads) so it stays light on phones.

export const COLORS = {
  lime: 0xd0eb00,
  teal: 0x024b4a,
  cream: 0xf6f4ef,
  ink: 0x0d1111,
  gold: 0xc9a227,
};

const COURT_CENTER = { x: 0, z: -12 }; // in front of the team portrait and contact whiteboard on the front wall
const COURT_SCALE = 0.35; // a full-size court (13.4 m) is longer than the room, so the floor court is about a third size

const COURT = {
  length: 13.4,
  width: 6.1,
  singlesInset: 0.46, // singles sideline, in from the doubles sideline
  shortService: 1.98, // short service line, out from the net
  longServiceDoubles: 0.76, // doubles long service line, in from the back line
  line: 0.04,
  margin: 0.5, // mat around the outside of the lines
  netTop: 1.55, // net height at the posts
  netDepth: 0.76, // how far the mesh hangs down from the top tape
  postOutside: 0.1, // posts stand just outside the doubles sidelines
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

// Court

const drawCourt = (ctx, width, height) => {
  const px = width / (COURT.length + 2 * COURT.margin); // pixels per meter
  const at = (m) => (COURT.margin + m) * px;

  ctx.fillStyle = '#0b5d4b';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f6f4ef';
  const line = COURT.line * px;
  const across = (x) => ctx.fillRect(at(x) - line / 2, at(0) - line / 2, line, COURT.width * px + line); // full width
  const along = (y, from = 0, to = COURT.length) =>
    ctx.fillRect(at(from) - line / 2, at(y) - line / 2, (to - from) * px + line, line);

  const net = COURT.length / 2;
  across(0);
  across(COURT.length);
  across(COURT.longServiceDoubles);
  across(COURT.length - COURT.longServiceDoubles);
  across(net - COURT.shortService);
  across(net + COURT.shortService);
  along(0);
  along(COURT.width);
  along(COURT.singlesInset);
  along(COURT.width - COURT.singlesInset);
  along(COURT.width / 2, 0, net - COURT.shortService); // centre lines
  along(COURT.width / 2, net + COURT.shortService, COURT.length);

  // Brand name in the margin along both sides
  ctx.fillStyle = 'rgba(208, 235, 0, 0.75)';
  ctx.font = `800 ${Math.round(COURT.margin * px * 0.45)}px Manrope, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COURT CONNECT', width / 2, (COURT.margin * px) / 2);
  ctx.save();
  ctx.translate(width / 2, height - (COURT.margin * px) / 2);
  ctx.rotate(Math.PI);
  ctx.fillText('COURT CONNECT', 0, 0);
  ctx.restore();
};

const createCourt = () => {
  const matLength = COURT.length + 2 * COURT.margin;
  const matWidth = COURT.width + 2 * COURT.margin;
  const scale = UNITS_PER_METER * COURT_SCALE;

  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(matLength * scale, matWidth * scale),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(1440, Math.round((1440 * matWidth) / matLength), drawCourt),
      roughness: 0.85,
      polygonOffset: true, // keeps the mat from flickering against the wooden floor
      polygonOffsetFactor: -1,
    })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = FLOOR_Y + 0.02;
  return mat;
};

// Net

const drawNetMesh = (ctx, width, height) => {
  const cell = 16;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(20, 24, 24, 0.9)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
};

// Net across the middle of the court, in meters at real size, running along z on the court's x = 0
const createNet = () => {
  const net = new THREE.Group();
  const span = COURT.width + 2 * COURT.postOutside;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(span, COURT.netDepth),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(1024, Math.round((1024 * COURT.netDepth) / span), drawNetMesh),
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      roughness: 0.9,
    })
  );
  mesh.position.y = COURT.netTop - COURT.netDepth / 2;
  const tape = new THREE.Mesh(new THREE.BoxGeometry(span, 0.075, 0.01), solid(COLORS.cream, { roughness: 0.7 }));
  tape.position.y = COURT.netTop - 0.0375;
  const bottomCord = new THREE.Mesh(new THREE.BoxGeometry(span, 0.012, 0.008), solid(COLORS.ink));
  bottomCord.position.y = COURT.netTop - COURT.netDepth;
  net.add(mesh, tape, bottomCord);

  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, COURT.netTop, 12), solid(COLORS.teal, { roughness: 0.4, metalness: 0.3 }));
    post.position.set((side * span) / 2, COURT.netTop / 2, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 20), solid(COLORS.ink, { roughness: 0.5 }));
    base.position.set((side * span) / 2, 0.025, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), solid(COLORS.lime));
    cap.position.set((side * span) / 2, COURT.netTop, 0);
    net.add(post, base, cap);
  });

  net.rotation.y = Math.PI / 2; // span along z, across the length of the court
  net.scale.setScalar(UNITS_PER_METER * COURT_SCALE);
  net.position.y = FLOOR_Y + 0.02;
  return net;
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

const plinthMaterial = () => solid(COLORS.cream, { roughness: 0.9 });

// Invisible box the player can't walk through (see checkCollision in movement.js)
export const collider = (x, z, width, depth) => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, 10, depth));
  box.position.set(x, 0, z);
  box.visible = false;
  return box;
};

// Giant racket on a square plinth, strings turned toward the middle of the room
const createGiantRacket = (x, z, frameColor) => {
  const plinthHeight = 0.6;
  const group = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, plinthHeight, 1.4), plinthMaterial());
  plinth.position.y = FLOOR_Y + plinthHeight / 2;
  const racket = createRacket(3, frameColor, COLORS.ink);
  racket.position.y = FLOOR_Y + plinthHeight;
  group.add(plinth, racket);
  group.position.set(x, 0, z);
  group.rotation.y = Math.atan2(-x, -z);
  return group;
};

// Two rackets crossed at the shafts with a shuttle below, hung on a wall
const createWallDisplay = ({ x, z, rotationY }) => {
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

  display.position.set(x, CENTERLINE_Y, z);
  display.rotation.y = rotationY;
  return display;
};

// Racket lying strings-up on the floor
const createFloorRacket = (x, z, angle, frameColor) => {
  const racket = createRacket(1, frameColor, COLORS.cream);
  racket.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(racket);
  holder.position.set(x, FLOOR_Y + RACKET.handleRadius * UNITS_PER_METER + 0.02, z);
  holder.rotation.y = angle;
  return holder;
};

// Shuttle standing upright on its cork
const createStandingShuttle = (x, z) => {
  const shuttle = createShuttle(2);
  shuttle.position.set(x, FLOOR_Y + 0.02, z);
  return shuttle;
};

// Returns the invisible colliders so main.js can add them to the walls the player bumps into
export const createBadmintonDecor = (scene) => {
  // The court with everything standing or lying on it, moved as one
  // One racket laid parallel to the net in the middle of each half, its shuttle standing beside it,
  // mirrored so both sides match
  const racketHalf = (RACKET.length / 2) * UNITS_PER_METER; // the racket's origin is the butt of the handle
  const court = new THREE.Group();
  court.add(
    createCourt(),
    createNet(),
    createFloorRacket(-4, racketHalf, 0, COLORS.lime),
    createFloorRacket(4, -racketHalf, Math.PI, COLORS.teal),
    createStandingShuttle(-5.4, 0),
    createStandingShuttle(5.4, 0)
  );
  court.position.set(COURT_CENTER.x, 0, COURT_CENTER.z);

  scene.add(
    court,
    createGiantRacket(-15, -15, COLORS.teal),
    createGiantRacket(15, -15, COLORS.lime),
    ...[
      { x: -13, z: 19.3, rotationY: Math.PI }, // back wall, either side of "Behind the Scenes"
      { x: 13, z: 19.3, rotationY: Math.PI },
    ].map(createWallDisplay)
  );

  const netLength = (COURT.width + 2 * COURT.postOutside) * UNITS_PER_METER * COURT_SCALE;
  return [
    collider(-15, -15, 1.6, 1.6),
    collider(15, -15, 1.6, 1.6),
    collider(COURT_CENTER.x, COURT_CENTER.z, 0.4, netLength), // walk around the net, not through it
  ];
};
