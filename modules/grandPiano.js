import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { collider } from './badmintonDecor.js';
import { SCREEN_CENTER } from './projector.js';
import { mergeStatic } from './mergeStatic.js';
import { createGlow, createLightCone } from './fakeGlow.js';

// A gloss-black grand piano on a raised round walnut mini stage in the back corner by the crew portraits
// (room.js), the pianist facing the projector screen across the room. The lid is up on its stick and opens toward the entrance, showing the
// gold plate and strings; "Court Connect" is lettered in gold on the fallboard and "Play me!" sheet
// music sits on the desk. Its own lights: a ceiling spot over the stage (the only light in the room
// that casts a shadow, so the piano sits on the stage instead of floating), a second spot into the
// open lid, a warm glow around the stage's foot, and a studio reflection map just for the lacquer.
// All 88 keys are modelled; pianoPlay.js sits the visitor at the bench and presses them as they play.
// Modelled in meters (the case front at z = 0, the keys out toward +z, the tail toward -z; bass on
// the left at -x), then scaled into scene units.

const U = UNITS_PER_METER;
// Center in scene units (the back corner by the crew wall), sizes in meters: the platform and the step round it
const STAGE = { x: -25.5, z: 12, radius: 1.6, height: 0.2, step: 0.3 };
// The way the pianist looks, along x and z: at the projector screen on the far wall
const FACING = new THREE.Vector2(SCREEN_CENTER.x - STAGE.x, SCREEN_CENTER.z - STAGE.z).normalize();
const CASE = { halfWidth: 0.74, length: 2.0, bottom: 0.62, top: 0.98, wall: 0.035 };
const LID_ANGLE = THREE.MathUtils.degToRad(21); // on the short stick, so it doesn't hide the portraits behind it
const LID_FRONT = 0.28; // the lid's fixed front strip, which the music desk stands on
const KEYS = { lowest: 21, count: 88, pitch: 0.02345, y: 0.715, whiteLength: 0.15, blackLength: 0.095 };
const PRESS_ANGLE = 0.07; // how far a pressed key tips down
const STAGE_CENTER_FROM_FRONT = 0.95; // the stage is centred under the body, a little behind the keys

const piano = new THREE.Group();
const keyMeshes = new Map(); // MIDI note -> key mesh
let shadowRenderer;

// Where the stage is, in the room, for pianoPlay.js
export const pianoStage = new THREE.Vector3(STAGE.x, FLOOR_Y, STAGE.z);

// ---- Materials ----

const lacquer = new THREE.MeshPhysicalMaterial({
  color: 0x16161a, // a touch off black, so the spotlight shows the case's shape
  roughness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  envMapIntensity: 1.3, // brighter studio reflections in the lacquer
});
const satinBlack = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.6 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd4a646, roughness: 0.25, metalness: 1, envMapIntensity: 1 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.32, envMapIntensity: 0.4 });
const ebony = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.28, envMapIntensity: 0.6 });
const leather = new THREE.MeshStandardMaterial({ color: 0x1a1716, roughness: 0.7 });
const felt = new THREE.MeshStandardMaterial({ color: 0x6d1420, roughness: 1 }); // the red key-slip felt

const box = (width, height, depth, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};

// A rod between two points, for the lid stick and the lyre
const rod = (from, to, radius, material) => {
  const length = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
};

const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  const redraw = () => {
    draw(canvas.getContext('2d'), width, height);
    texture.needsUpdate = true;
  };
  redraw();
  document.fonts?.ready.then(redraw); // again once the web fonts are in
  return texture;
};

// ---- The case outline, seen from above, as (x, s) with s running back from the front (s = -z) ----

const outlineShape = () => {
  const { halfWidth: w, length: l } = CASE;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-w, l - 0.28); // the straight bass side
  shape.quadraticCurveTo(-w, l, -w + 0.32, l); // the rounded tail
  // The treble bentside: an S-curve from the tail out to the full width near the keys
  shape.splineThru([
    new THREE.Vector2(-0.15, l - 0.05),
    new THREE.Vector2(0.08, l - 0.22),
    new THREE.Vector2(0.22, l - 0.48),
    new THREE.Vector2(0.34, l - 0.78),
    new THREE.Vector2(0.48, l - 1.02),
    new THREE.Vector2(0.66, l - 1.22),
    new THREE.Vector2(w, l - 1.48),
    new THREE.Vector2(w, l - 1.65),
  ]);
  shape.lineTo(w, 0);
  shape.lineTo(-w, 0);
  return shape;
};

// The outline as points, and the same outline `inset` meters further in (the inside of the rim)
const outlinePoints = () => outlineShape().getSpacedPoints(160).slice(0, -1);
const insetPoints = (points, inset) => {
  const n = points.length;
  let area = 0;
  points.forEach((p, i) => (area += p.x * points[(i + 1) % n].y - points[(i + 1) % n].x * p.y));
  const inward = area > 0 ? 1 : -1; // counter-clockwise outlines have the inside on the left
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tangent = new THREE.Vector2().subVectors(next, prev).normalize();
    return new THREE.Vector2(p.x - tangent.y * inset * inward, p.y + tangent.x * inset * inward);
  });
};

// Shapes are drawn in (x, s); this turns them into the room's (x, y, z), standing up from y = 0
const lieFlat = (geometry) => geometry.rotateX(-Math.PI / 2);

// The inside, seen through the open lid: spruce soundboard, the gold cast-iron plate with its round
// openings, tuning pins, the row of dampers and the strings, bass strings copper-wound and overstrung
const drawInterior = (ctx, width, height) => {
  const { halfWidth: w, length: l } = CASE;
  const toCanvas = (x, s) => [((x + w) / (2 * w)) * width, height - (s / l) * height]; // the front at the bottom
  ctx.fillStyle = '#b99561';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(110, 78, 40, 0.35)'; // spruce grain, on the diagonal like a real soundboard
  for (let i = -height; i < width; i += 9) {
    ctx.beginPath();
    ctx.moveTo(i, height);
    ctx.lineTo(i + height * 0.6, 0);
    ctx.stroke();
  }

  // The plate: an inset of the case outline in gold, with openings showing the soundboard
  const plate = insetPoints(outlinePoints(), 0.05);
  ctx.fillStyle = '#9c7a33';
  ctx.beginPath();
  plate.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](...toCanvas(p.x, Math.max(p.y, 0.04))));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b99561';
  [
    [-0.42, 1.25, 0.12, 0.22],
    [-0.1, 1.15, 0.09, 0.2],
    [0.18, 0.92, 0.08, 0.16],
    [0.42, 0.62, 0.07, 0.12],
    [-0.4, 0.62, 0.1, 0.12],
  ].forEach(([x, s, rx, rs]) => {
    const [cx, cy] = toCanvas(x, s);
    ctx.beginPath();
    ctx.ellipse(cx, cy, (rx / (2 * w)) * width, (rs / l) * height, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Strings: from the pins at the front back to the bridge, as long as the case allows on each side
  const back = (x) => {
    const t = (x + w) / (2 * w); // 0 at the bass side, 1 at the treble
    return l - 0.12 - t * t * (l - 0.62);
  };
  for (let i = 0; i < 88; i++) {
    const bass = i < 20;
    const x = -w + 0.08 + (i / 87) * (2 * w - 0.16);
    const xBack = bass ? x + 0.18 : x; // the bass strings cross over the others
    ctx.strokeStyle = bass ? '#b06b32' : '#e8e6e0';
    ctx.lineWidth = bass ? 2.2 - i * 0.04 : 1;
    ctx.beginPath();
    ctx.moveTo(...toCanvas(x, 0.1));
    ctx.lineTo(...toCanvas(xBack, back(xBack) - (bass ? 0.05 : 0)));
    ctx.stroke();
  }
  // Tuning pins and dampers across the front
  ctx.fillStyle = '#eceae4';
  for (let i = 0; i < 88; i++) {
    const [px, py] = toCanvas(-w + 0.08 + (i / 87) * (2 * w - 0.16), 0.07);
    ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
  }
  ctx.fillStyle = '#2a2420';
  for (let i = 0; i < 66; i++) {
    const [px, py] = toCanvas(-w + 0.3 + (i / 65) * (2 * w - 0.4), 0.2);
    ctx.fillRect(px - 2, py - 5, 4, 10);
  }
};

// "Court Connect" in gold on the fallboard
const drawNameboard = (ctx, width, height) => {
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = ctx.createLinearGradient(0, height * 0.3, 0, height * 0.7);
  gold.addColorStop(0, '#f3d98b');
  gold.addColorStop(1, '#b8862f');
  ctx.fillStyle = gold;
  ctx.font = `600 ${Math.round(height * 0.42)}px Georgia, "Times New Roman", serif`;
  ctx.letterSpacing = `${Math.round(height * 0.06)}px`;
  ctx.fillText('COURT CONNECT', width / 2, height * 0.5);
};

// Two pages of music on the desk, the first headed "Play me!"
const drawSheetMusic = (ctx, width, height) => {
  ctx.fillStyle = '#f6f1e2';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(width / 2 - 1, 0, 2, height); // the fold between the pages
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  [0, width / 2].forEach((left, page) => {
    const top = page === 0 ? height * 0.3 : height * 0.1;
    for (let staff = 0; staff < (page === 0 ? 4 : 5); staff++) {
      const y0 = top + staff * height * 0.16;
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      for (let line = 0; line < 5; line++) {
        ctx.beginPath();
        ctx.moveTo(left + 18, y0 + line * 6);
        ctx.lineTo(left + width / 2 - 18, y0 + line * 6);
        ctx.stroke();
      }
      ctx.fillStyle = '#1b1b1b';
      for (let x = left + 40; x < left + width / 2 - 26; x += 14 + random() * 10) {
        const y = y0 + Math.round(random() * 8) * 3;
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 3, y - 18, 1.4, 18);
      }
    }
  });
  ctx.fillStyle = '#0b5d4b';
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(height * 0.17)}px Caveat, cursive`;
  ctx.fillText('Play me!', width / 4, height * 0.2);
};

// ---- Building it ----

const createCase = () => {
  const { bottom, top, wall } = CASE;
  const outer = outlinePoints();
  const inner = insetPoints(outer, wall);

  // The rim: the outline with the inside cut out, standing from the case bottom to the top
  const rimShape = new THREE.Shape(outer);
  rimShape.holes.push(new THREE.Path(inner));
  const rim = new THREE.Mesh(
    lieFlat(new THREE.ExtrudeGeometry(rimShape, { depth: top - bottom, bevelEnabled: false, curveSegments: 1 })),
    lacquer
  );
  rim.position.y = bottom;

  // Underside and the inside floor (soundboard, plate and strings), sunk below the rim's top edge
  const belly = new THREE.Mesh(lieFlat(new THREE.ShapeGeometry(new THREE.Shape(outer))), satinBlack);
  belly.rotation.x = Math.PI; // facing down
  belly.position.y = bottom;
  const interiorMap = canvasTexture(512, 700, drawInterior);
  interiorMap.repeat.set(1 / (2 * CASE.halfWidth), 1 / CASE.length); // the shape's UVs are its (x, s)
  interiorMap.offset.set(0.5, 0);
  const interior = new THREE.Mesh(
    lieFlat(new THREE.ShapeGeometry(new THREE.Shape(inner))),
    new THREE.MeshStandardMaterial({ map: interiorMap, roughness: 0.6, color: 0x8a8274 }) // a touch darker: it sits right under both spots
  );
  interior.position.y = top - 0.12;

  // The lid: the outline behind its fixed front strip, hinged along the straight bass side
  const lidOutline = [
    new THREE.Vector2(-CASE.halfWidth, LID_FRONT),
    ...outer.filter((p) => p.y > LID_FRONT), // bass side, tail and bentside, in order
    new THREE.Vector2(CASE.halfWidth, LID_FRONT),
  ];
  const lidGeometry = lieFlat(new THREE.ExtrudeGeometry(new THREE.Shape(lidOutline), { depth: 0.02, bevelEnabled: false }));
  lidGeometry.translate(CASE.halfWidth, 0, 0); // the hinge line on the group's axis
  const lid = new THREE.Mesh(lidGeometry, lacquer);
  const hinge = new THREE.Group();
  hinge.position.set(-CASE.halfWidth, top, 0);
  hinge.rotation.z = LID_ANGLE;
  hinge.add(lid);
  const front = new THREE.Mesh(
    lieFlat(new THREE.ExtrudeGeometry(new THREE.Shape([
      new THREE.Vector2(-CASE.halfWidth, 0),
      new THREE.Vector2(CASE.halfWidth, 0),
      new THREE.Vector2(CASE.halfWidth, LID_FRONT),
      new THREE.Vector2(-CASE.halfWidth, LID_FRONT),
    ]), { depth: 0.02, bevelEnabled: false })),
    lacquer
  );
  front.position.y = top;

  // The lid stick, from just inside the treble rim up to the lid's underside
  const along = 1.12; // meters out from the hinge, across the lid
  const stickTop = new THREE.Vector3(-CASE.halfWidth + along * Math.cos(LID_ANGLE), top + along * Math.sin(LID_ANGLE), -0.95);
  const stick = rod(new THREE.Vector3(0.44, top, -0.95), stickTop, 0.012, lacquer);

  return [rim, belly, interior, hinge, front, stick];
};

const createKeyboard = () => {
  const group = new THREE.Group();
  const { lowest, count, pitch, y, whiteLength, blackLength } = KEYS;
  const isBlack = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);
  const whites = Array.from({ length: count }, (_, i) => lowest + i).filter((midi) => !isBlack(midi));
  const span = whites.length * pitch;
  const whiteGeometry = new THREE.BoxGeometry(pitch - 0.0012, 0.022, whiteLength).translate(0, 0.011, whiteLength / 2);
  const blackGeometry = new THREE.BoxGeometry(0.0125, 0.022, blackLength).translate(0, 0.023, blackLength / 2);
  let white = 0;
  for (let midi = lowest; midi < lowest + count; midi++) {
    const black = isBlack(midi);
    const key = new THREE.Mesh(black ? blackGeometry : whiteGeometry, black ? ebony : ivory);
    // Black keys sit over the line between their two white neighbours
    const x = -span / 2 + (black ? white : white + 0.5) * pitch;
    key.position.set(x, y, 0.0);
    key.castShadow = true;
    key.userData.keepSeparate = true; // keys rotate when played; the case can be batched
    group.add(key);
    keyMeshes.set(midi, key);
    if (!black) white += 1;
  }

  // Keybed under the keys, the red felt strip behind them, the key slip in front, cheek blocks at the ends
  const width = 2 * CASE.halfWidth;
  group.add(
    box(width, 0.06, 0.2, lacquer, 0, y - 0.03, 0.08),
    box(span, 0.012, 0.008, felt, 0, y + 0.03, 0.004),
    box(width, 0.035, 0.012, lacquer, 0, y - 0.005, whiteLength + 0.012),
    box((width - span) / 2, 0.09, 0.2, lacquer, -(span + (width - span) / 2) / 2, y + 0.01, 0.08),
    box((width - span) / 2, 0.09, 0.2, lacquer, (span + (width - span) / 2) / 2, y + 0.01, 0.08)
  );

  // The case front behind the keys is the fallboard, lettered in gold
  const nameboard = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.07), new THREE.MeshStandardMaterial({
    map: canvasTexture(1024, 64, drawNameboard),
    roughness: 0.3,
    metalness: 0.2,
  }));
  nameboard.position.set(0, y + 0.085, 0.002);
  group.add(nameboard);
  return group;
};

// The music desk on the lid's front strip, leaning back, with the sheet music on it
const createMusicDesk = () => {
  const desk = new THREE.Group();
  desk.add(box(0.8, 0.3, 0.015, lacquer, 0, 0.15, 0), box(0.8, 0.025, 0.04, lacquer, 0, 0.012, 0.02));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.24), new THREE.MeshStandardMaterial({
    map: canvasTexture(1024, 440, drawSheetMusic),
    roughness: 0.9,
  }));
  sheet.position.set(0, 0.155, 0.009);
  desk.add(sheet);
  desk.position.set(0, CASE.top + 0.02, -0.14);
  desk.rotation.x = -0.26;
  return desk;
};

// Two legs at the front, one under the tail, each on a brass caster; the lyre with three pedals
const createLegs = () => {
  const legs = new THREE.Group();
  [[-0.62, -0.14], [0.62, -0.14], [-0.3, -1.72]].forEach(([x, z]) => {
    const height = CASE.bottom - 0.05;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.038, height, 20), lacquer);
    leg.position.set(x, 0.05 + height / 2, z);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.05, 20), brass);
    caster.position.set(x, 0.025, z);
    const block = box(0.13, 0.06, 0.13, lacquer, x, CASE.bottom - 0.03, z);
    legs.add(leg, caster, block);
  });
  const pedalBox = box(0.34, 0.08, 0.13, lacquer, 0, 0.07, -0.42);
  legs.add(pedalBox);
  [-0.09, 0.09].forEach((x) => {
    legs.add(rod(new THREE.Vector3(x, 0.1, -0.42), new THREE.Vector3(x * 0.6, CASE.bottom, -0.38), 0.014, lacquer));
  });
  [-0.07, 0, 0.07].forEach((x) => legs.add(box(0.026, 0.012, 0.12, brass, x, 0.06, -0.32)));
  return legs;
};

const createBench = () => {
  const bench = new THREE.Group();
  bench.add(box(0.78, 0.06, 0.36, lacquer, 0, 0.44, 0), box(0.74, 0.05, 0.32, leather, 0, 0.495, 0));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => bench.add(box(0.05, 0.41, 0.05, lacquer, sx * 0.34, 0.205, sz * 0.14))));
  bench.position.z = 0.62;
  return bench;
};

// The round stage: walnut with a brass edge and a teal rug, and a warm glow on the floor around its foot
const createStage = () => {
  const { radius, height, step } = STAGE;
  const outer = radius + step;
  const stage = new THREE.Group();
  const walnut = new THREE.MeshStandardMaterial({ color: 0x4b2e1a, roughness: 0.45 });
  // A low step all the way round, then the platform on it, each with a brass nosing
  const tread = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer + 0.02, height / 2, 72), walnut);
  tread.position.y = height / 4;
  tread.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.02, height, 72), walnut);
  base.position.y = height / 2;
  base.receiveShadow = true;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 8, 96), brass);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = height;
  const stepEdge = new THREE.Mesh(new THREE.TorusGeometry(outer, 0.01, 8, 96), brass);
  stepEdge.rotation.x = Math.PI / 2;
  stepEdge.position.y = height / 2;
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(radius - 0.22, 72),
    new THREE.MeshStandardMaterial({ color: 0x0e3b39, roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = height + 0.003;
  rug.receiveShadow = true;

  const glowMap = canvasTexture(256, 8, (ctx, width) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(255, 196, 120, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 196, 120, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 8);
  });
  const glowGeometry = new THREE.RingGeometry(outer, outer + 0.55, 96, 1);
  // Map the ring's radius to the texture's x, so the glow fades outward
  const uv = glowGeometry.attributes.uv;
  const position = glowGeometry.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, (r - outer) / 0.55, 0.5);
  }
  const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.035; // clear of the floor's bumps
  stage.add(tread, stepEdge, base, edge, rug, glow);
  return stage;
};

// A soft dark patch under the piano where the light can't reach, so it sits on the rug
const createContactShadow = () => {
  const map = canvasTexture(128, 128, (ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.5),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(-0.05, 0.006, -1.0);
  return shadow;
};

// A ceiling spotlight with its fixture, from `from` (room coordinates) onto `to`
const createSpot = (from, to, { intensity, spread, penumbra, shadow }) => {
  const light = new THREE.SpotLight(0xffd9a8, intensity);
  light.position.copy(from);
  light.target.position.copy(to);
  light.angle = Math.atan(spread / from.distanceTo(to));
  light.penumbra = penumbra;
  light.decay = 1;
  light.distance = 30;
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    light.shadow.camera.near = 4;
    light.shadow.camera.far = 20;
  }
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 20), satinBlack);
  body.rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  lens.position.z = 0.276;
  can.add(body, lens);
  can.position.copy(from);
  can.lookAt(to);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 10 - from.y, 6), satinBlack);
  stem.position.set(from.x, (10 + from.y) / 2, from.z);
  return [light, light.target, can, stem];
};

// The piano's own studio reflections: lacquer needs something bright to mirror, and the room has no
// environment map (giving it one would change how everything else looks)
const applyReflections = (renderer) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  [lacquer, brass, ivory, ebony].forEach((material) => {
    material.envMap = environment;
    material.needsUpdate = true;
  });
};

// Press or release one key of the 3D keyboard (pianoPlay.js)
export const setPianoKey = (midi, down) => {
  const key = keyMeshes.get(midi);
  const angle = down ? PRESS_ANGLE : 0;
  if (!key || key.rotation.x === angle) return;
  key.rotation.x = angle;
  // The piano is the only moving shadow caster. Reuse its shadow until a key changes.
  if (shadowRenderer) shadowRenderer.shadowMap.needsUpdate = true;
};

// Where a seated pianist's eyes are and where they look, in the room (pianoPlay.js). `cover` is the share
// of the screen's height the on-screen keyboard takes along the bottom: the view tips down just enough
// to centre the nameboard (with the keys below it and the music desk above) in the space that's left.
const focus = new THREE.Vector3();
export const pianistView = (eye, look, camera, cover) => {
  // A little above a seated pianist's eyes; upright phones see a narrow slice, so sit further back there
  const back = camera.aspect < 1 ? 0.18 : 0;
  eye.set(0, 1.42 + back * 0.5, 0.78 + back);
  focus.set(0, 0.95, -0.08);
  piano.localToWorld(eye);
  piano.localToWorld(focus);
  const toFocus = focus.sub(eye);
  const across = Math.hypot(toFocus.x, toFocus.z);
  const pitch = Math.atan2(toFocus.y, across) - Math.atan(cover * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  look.set(toFocus.x / across, 0, toFocus.z / across).multiplyScalar(Math.cos(pitch));
  look.y = Math.sin(pitch);
  look.add(eye);
};

// Builds the stage, piano and lights; returns the colliders for main.js to add to the walls
export const createGrandPiano = (scene, renderer) => {
  shadowRenderer = renderer;
  const instrument = new THREE.Group();
  instrument.add(...createCase(), createKeyboard(), createMusicDesk(), createLegs());
  instrument.traverse((child) => {
    if (child.isMesh && child.material !== felt) child.castShadow = true;
  });
  mergeStatic(instrument, { opaqueOnly: true });
  piano.add(instrument, createBench(), createContactShadow());
  piano.scale.setScalar(U);
  const front = new THREE.Vector2(STAGE.x, STAGE.z).addScaledVector(FACING, -STAGE_CENTER_FROM_FRONT * U);
  piano.position.set(front.x, FLOOR_Y + STAGE.height * U, front.y);
  piano.rotation.y = Math.atan2(-FACING.x, -FACING.y); // the case front faces back toward the bench
  const stage = createStage();
  stage.scale.setScalar(U);
  stage.position.copy(pianoStage);
  scene.add(stage, piano);
  if (renderer) applyReflections(renderer);

  // Lights: one straight down over the piano (with the shadow), one from the audience side into the lid
  piano.updateMatrixWorld(true);
  const center = piano.localToWorld(new THREE.Vector3(0, 0.8, -0.95));
  const inside = piano.localToWorld(new THREE.Vector3(0.1, CASE.top, -1.0));
  const audience = piano.localToWorld(new THREE.Vector3(2.4, 0, -0.9));
  scene.add(
    ...createSpot(new THREE.Vector3(center.x, 9.2, center.z), center, { intensity: 3.4, spread: 1.9 * U, penumbra: 0.5, shadow: true }),
    ...createSpot(new THREE.Vector3(audience.x, 9.2, audience.z), inside, { intensity: 1.6, spread: 1.3 * U, penumbra: 0.7 })
  );
  // Painted light on top of the two spots (fakeGlow.js, no extra lamps): the beam in the air above the
  // piano and a warm pool on the stage round it
  const stageTop = FLOOR_Y + STAGE.height * U;
  const beam = createLightCone(0xffd9a8, 0.25, 1.5 * U, 9.2 - stageTop - 0.3, 0.07);
  beam.position.set(center.x, 9.2 - 0.3, center.z);
  const pool = createGlow(0xffd9a8, 3.6 * U, 3.6 * U, 0.4);
  pool.position.set(center.x, stageTop + 0.02, center.z);
  scene.add(beam, pool);

  // Colliders: the stage (visitors walk round it; the piano is played from the bench, pianoPlay.js),
  // squares along the body (the room's colliders don't turn), and the bench
  const stageSide = 1.6 * (STAGE.radius + STAGE.step) * U; // a square mostly inside the round step
  return [
    collider(STAGE.x, STAGE.z, stageSide, stageSide),
    ...[
      [0, 0.1, 0.78],
      [0, -0.55, 0.78],
      [-0.08, -1.1, 0.62],
      [-0.25, -1.6, 0.42],
      [0, 0.62, 0.4],
    ].map(([x, z, half]) => {
      const at = piano.localToWorld(new THREE.Vector3(x, 0, z));
      return collider(at.x, at.z, 2 * half * U, 2 * half * U);
    }),
  ];
};
