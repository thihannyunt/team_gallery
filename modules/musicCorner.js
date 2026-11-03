import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER, CENTERLINE_Y } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';

// Music corner in the middle of the back wall, between the exit door and the "Behind the Scenes"
// photos: an electric guitar on
// a wall hanger, its cable plugged into a small combo amp on the floor, and a wall showcase holding a
// silver flute. Modelled in meters (front facing +z, back against the wall at z = 0), then scaled into
// scene units; built from simple shapes so there's nothing to download.

const U = UNITS_PER_METER;
const WALL_Z = 20; // back wall
const GUITAR = { x: -2.8, hangerHeight: 1.78 }; // hanger height in meters above the floor
const AMP = { offset: -0.12, width: 0.46, height: 0.42, depth: 0.25 }; // offset along the wall from the guitar
const SHOWCASE = { x: 2.0, width: 0.86, height: 0.28, depth: 0.11, scale: 1.45 }; // hung larger than life, like the photos

// For lighting.js: a ceiling track light on the guitar and one on the flute, like the photos get
const guitarCenterY = FLOOR_Y + (GUITAR.hangerHeight - 0.5) * U;
export const musicCornerLights = [
  { center: new THREE.Vector3(GUITAR.x, guitarCenterY, WALL_Z - 0.2), width: 0.45 * U, height: 1.0 * U },
  { center: new THREE.Vector3(SHOWCASE.x, CENTERLINE_Y, WALL_Z - 0.2), width: SHOWCASE.width * SHOWCASE.scale * U, height: SHOWCASE.height * SHOWCASE.scale * U },
].map((target) => ({ ...target, normal: new THREE.Vector3(0, 0, -1) }));

const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dcdc, roughness: 0.18, metalness: 0.95 });
const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45 });
const maple = new THREE.MeshStandardMaterial({ color: 0xd8b07a, roughness: 0.45 });
const rosewood = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.6 });
const walnut = new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.55 });
const cream = new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.5 });

const box = (width, height, depth, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};

// Guitar

// Double-cutaway solid body outline, centred on the neck's line, in meters (y up toward the neck)
const bodyShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.235);
  s.bezierCurveTo(0.12, -0.235, 0.18, -0.19, 0.175, -0.1);
  s.bezierCurveTo(0.17, -0.03, 0.12, 0.0, 0.125, 0.06);
  s.bezierCurveTo(0.13, 0.12, 0.16, 0.17, 0.12, 0.215); // upper horn on the treble side
  s.bezierCurveTo(0.09, 0.24, 0.06, 0.17, 0.035, 0.13); // cutaway down to the neck
  s.lineTo(-0.035, 0.13);
  s.bezierCurveTo(-0.07, 0.15, -0.09, 0.2, -0.125, 0.18); // shorter bass-side horn
  s.bezierCurveTo(-0.165, 0.15, -0.13, 0.06, -0.14, 0.01);
  s.bezierCurveTo(-0.15, -0.05, -0.19, -0.09, -0.18, -0.14);
  s.bezierCurveTo(-0.17, -0.21, -0.1, -0.235, 0, -0.235);
  return s;
};

// Teal burst finish: lime-tinted centre fading to near-black teal at the edges
const burstTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 150, 10, 128, 128, 150);
  gradient.addColorStop(0, '#5fb59a');
  gradient.addColorStop(0.45, '#0b6b69');
  gradient.addColorStop(1, '#011f1f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(1 / 0.4, 1 / 0.5); // the extrusion's UVs are in meters
  texture.offset.set(0.5, 0.47);
  return texture;
};

const createGuitar = () => {
  const guitar = new THREE.Group(); // origin: the bottom of the body, on the neck's line
  const thickness = 0.045;

  const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape(), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 24,
  });
  const finish = new THREE.MeshStandardMaterial({ map: burstTexture(), roughness: 0.18, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeometry, [finish, new THREE.MeshStandardMaterial({ color: 0x011f1f, roughness: 0.25 })]);
  body.position.y = 0.235;
  guitar.add(body);
  const front = thickness + 0.005;

  // Cream pickguard, two pickups, bridge, volume/tone knobs and the output jack on the lower edge
  const guard = new THREE.Shape();
  guard.moveTo(-0.03, 0.13);
  guard.lineTo(0.03, 0.13);
  guard.bezierCurveTo(0.07, 0.05, 0.09, -0.02, 0.06, -0.06);
  guard.lineTo(-0.11, -0.03);
  guard.bezierCurveTo(-0.12, 0.05, -0.07, 0.12, -0.03, 0.13);
  const pickguard = new THREE.Mesh(new THREE.ShapeGeometry(guard, 16), cream);
  pickguard.position.set(0, 0.235, front);
  guitar.add(pickguard);
  [0.3, 0.2].forEach((y) => {
    guitar.add(box(0.085, 0.028, 0.012, blackPlastic, 0, y, front + 0.006));
    for (let i = 0; i < 6; i++) guitar.add(box(0.005, 0.005, 0.004, chrome, -0.03 + i * 0.012, y, front + 0.013));
  });
  guitar.add(box(0.085, 0.022, 0.014, chrome, 0, 0.1, front + 0.007));
  const knobGeometry = new THREE.CylinderGeometry(0.011, 0.012, 0.016, 16);
  [
    [0.085, 0.13],
    [0.1, 0.085],
    [0.075, 0.055],
  ].forEach(([x, y]) => {
    const knob = new THREE.Mesh(knobGeometry, blackPlastic);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, y, front + 0.008);
    guitar.add(knob);
  });
  const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), chrome);
  jack.rotation.z = Math.PI / 2;
  jack.position.set(0.168, 0.1, thickness / 2);
  guitar.add(jack);

  // Neck, fretboard with frets and dot inlays, headstock with six tuners
  const neckLength = 0.47;
  const neckBottom = 0.36;
  guitar.add(box(0.05, neckLength, 0.022, maple, 0, neckBottom + neckLength / 2, thickness - 0.005));
  guitar.add(box(0.048, neckLength - 0.01, 0.006, rosewood, 0, neckBottom + neckLength / 2, thickness + 0.009));
  for (let fret = 0; fret < 21; fret++) {
    const y = neckBottom + neckLength - 0.012 - neckLength * (1 - Math.pow(2, -fret / 12)) * 1.2;
    if (y < neckBottom + 0.01) break;
    guitar.add(box(0.048, 0.002, 0.002, chrome, 0, y, thickness + 0.013));
    if ([3, 5, 7, 9, 15, 17].includes(fret)) guitar.add(box(0.007, 0.007, 0.001, cream, 0, y - 0.012, thickness + 0.0125));
  }
  const headstock = new THREE.Shape();
  headstock.moveTo(-0.026, 0);
  headstock.lineTo(0.026, 0);
  headstock.lineTo(0.045, 0.16);
  headstock.quadraticCurveTo(0.01, 0.2, -0.03, 0.17);
  headstock.lineTo(-0.026, 0);
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(headstock, { depth: 0.016, bevelEnabled: false }), blackPlastic);
  const headY = neckBottom + neckLength;
  head.position.set(0, headY, thickness - 0.012);
  guitar.add(head);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const y = headY + 0.03 + (i % 3) * 0.042;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), chrome);
    post.rotation.x = Math.PI / 2;
    post.position.set(side * 0.018, y, thickness + 0.008);
    const key = box(0.022, 0.012, 0.008, chrome, side * 0.05, y, thickness - 0.004);
    guitar.add(post, key);
  }

  // Strings from the bridge to the nut
  const points = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.02 + i * 0.008;
    points.push(new THREE.Vector3(x, 0.1, front + 0.016), new THREE.Vector3(x * 0.85, headY, thickness + 0.015));
  }
  guitar.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xcfd3d3 })));

  return { guitar, jack: new THREE.Vector3(0.175, 0.1, thickness / 2), neckTop: headY };
};

// Wooden wall plate with a padded yoke the guitar hangs from by its headstock
const createHanger = () => {
  const hanger = new THREE.Group();
  hanger.add(box(0.09, 0.16, 0.025, walnut, 0, 0.03, 0.0125));
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), blackPlastic);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(side * 0.032, 0, 0.07);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), blackPlastic);
    tip.position.set(side * 0.032, 0.006, 0.115);
    hanger.add(arm, tip);
  });
  return hanger;
};

// Small combo amp: black tolex, dark grille with a lime piping border, control strip on top
const createAmp = () => {
  const amp = new THREE.Group();
  const { width, height, depth } = AMP;
  const tolex = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  amp.add(box(width, height, depth, tolex, 0, height / 2 + 0.015, depth / 2));
  amp.add(box(width - 0.06, height - 0.12, 0.004, new THREE.MeshStandardMaterial({ color: 0x2b2b26, roughness: 1 }), 0, (height - 0.12) / 2 + 0.035, depth + 0.002));
  const piping = new THREE.MeshStandardMaterial({ color: COLORS.lime, roughness: 0.5 });
  const gw = width - 0.06;
  const gh = height - 0.12;
  const gy = gh / 2 + 0.035;
  amp.add(
    box(gw + 0.01, 0.006, 0.006, piping, 0, gy + gh / 2, depth + 0.004),
    box(gw + 0.01, 0.006, 0.006, piping, 0, gy - gh / 2, depth + 0.004),
    box(0.006, gh, 0.006, piping, -gw / 2, gy, depth + 0.004),
    box(0.006, gh, 0.006, piping, gw / 2, gy, depth + 0.004)
  );
  // Control strip: input jack, five knobs and a red power light
  const panelY = height - 0.035;
  amp.add(box(width - 0.04, 0.05, 0.004, new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.4, metalness: 0.6 }), 0, panelY, depth + 0.002));
  for (let i = 0; i < 5; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.014, 16), cream);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(-0.08 + i * 0.045, panelY, depth + 0.01);
    amp.add(knob);
  }
  const input = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), chrome);
  input.rotation.x = Math.PI / 2;
  input.position.set(-0.18, panelY, depth + 0.007);
  const power = new THREE.Mesh(new THREE.CircleGeometry(0.005, 12), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  power.position.set(0.185, panelY, depth + 0.005);
  amp.add(input, power);
  // Badge
  const badge = box(0.08, 0.02, 0.004, chrome, 0.12, height - 0.085, depth + 0.006);
  amp.add(badge);
  return { amp, input: new THREE.Vector3(-0.18, panelY, depth + 0.012) };
};

// Coiled-on-the-floor cable from the guitar's jack to the amp's input, through `via` points
const createCable = (points) => {
  const curve = new THREE.CatmullRomCurve3(points);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.0045, 6), blackPlastic);
  // Plugs at both ends
  [points[0], points[points.length - 1]].forEach((at) => {
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), chrome);
    plug.position.copy(at);
    cable.add(plug);
  });
  return cable;
};

const createGuitarWall = () => {
  const group = new THREE.Group();
  const { guitar, jack, neckTop } = createGuitar();
  // The headstock sits on the yoke just above the nut
  const hangY = GUITAR.hangerHeight;
  guitar.position.set(0, hangY - neckTop + 0.006, 0.07);
  const hanger = createHanger();
  hanger.position.y = hangY;
  const { amp, input } = createAmp();
  amp.position.x = AMP.offset;

  const jackAt = jack.clone().add(guitar.position);
  const inputAt = input.clone().add(amp.position);
  const cable = createCable([
    jackAt.clone().add(new THREE.Vector3(0.02, 0, 0)),
    jackAt.clone().add(new THREE.Vector3(0.06, -0.05, 0.03)),
    new THREE.Vector3(0.14, 0.5, 0.18),
    new THREE.Vector3(0.18, 0.06, 0.38),
    new THREE.Vector3(0.05, 0.006, 0.5), // a loop lying on the floor
    new THREE.Vector3(-0.3, 0.006, 0.42),
    new THREE.Vector3(-0.32, 0.12, 0.3),
    inputAt.clone().add(new THREE.Vector3(0, 0.01, 0.06)),
    inputAt,
  ]);
  group.add(guitar, hanger, amp, cable);
  return group;
};

// Flute showcase

const createFlute = () => {
  const flute = new THREE.Group(); // lies along x, centred, keys facing +z
  const silver = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.15, metalness: 1 });
  const length = 0.66;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, length, 20), silver);
  tube.rotation.z = Math.PI / 2;
  flute.add(tube);
  // Joint rings, crown and lip plate on the head joint
  [-0.13, 0.19].forEach((x) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.012, 20), silver);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = x;
    flute.add(ring);
  });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 16, 8), silver);
  crown.position.x = -length / 2;
  const lip = box(0.03, 0.022, 0.004, silver, -0.24, 0, 0.011);
  const embouchure = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), blackPlastic);
  embouchure.scale.x = 1.5;
  embouchure.position.set(-0.24, 0, 0.0135);
  flute.add(crown, lip, embouchure);
  // Keys: cups along the body and the foot joint, joined by a rod
  const cup = new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 16);
  for (let i = 0; i < 13; i++) {
    const key = new THREE.Mesh(cup, silver);
    key.rotation.x = Math.PI / 2;
    key.position.set(-0.08 + i * 0.03 + (i > 9 ? 0.012 : 0), 0, 0.0115);
    flute.add(key);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.42, 6), silver);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0.12, -0.009, 0.006);
  flute.add(rod);
  return flute;
};

const createShowcase = () => {
  const { width, height, depth } = SHOWCASE;
  const showcase = new THREE.Group();
  const frame = 0.025;
  // Walnut box, dark teal velvet inside, glass front
  showcase.add(
    box(width, frame, depth, walnut, 0, height / 2 - frame / 2, depth / 2),
    box(width, frame, depth, walnut, 0, -height / 2 + frame / 2, depth / 2),
    box(frame, height, depth, walnut, -width / 2 + frame / 2, 0, depth / 2),
    box(frame, height, depth, walnut, width / 2 - frame / 2, 0, depth / 2),
    box(width, height, 0.01, new THREE.MeshStandardMaterial({ color: 0x013635, roughness: 1 }), 0, 0, 0.005)
  );
  // Two clear rests and the flute lying on them
  const acrylic = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35 });
  [-0.2, 0.2].forEach((x) => showcase.add(box(0.015, 0.05, 0.05, acrylic, x, -0.06, 0.04)));
  const flute = createFlute();
  flute.position.set(0, -0.025, 0.05);
  flute.rotation.z = 0.02;
  showcase.add(flute);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 2 * frame, height - 2 * frame),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.12, depthWrite: false })
  );
  front.position.z = depth - 0.004;
  showcase.add(front);

  // Small plaque underneath, like the other wall labels
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const draw = () => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(0, 0, 8, 128);
    ctx.fillStyle = '#1c1c1c';
    ctx.font = '800 44px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('Off the Court', 30, 58);
    ctx.fillStyle = '#6b6b6b';
    ctx.font = '600 26px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('SILVER CONCERT FLUTE', 30, 98);
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load('800 44px Manrope').then(draw);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.08), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  plaque.position.set(width / 2 - 0.16, -height / 2 - 0.08, 0.003);
  showcase.add(plaque);
  return showcase;
};

// Adds the music corner and returns the amp's collider for main.js to add to the walls
export const createMusicCorner = (scene) => {
  const wall = new THREE.Group();
  const guitarWall = createGuitarWall();
  guitarWall.scale.setScalar(U);
  guitarWall.position.set(GUITAR.x, FLOOR_Y, WALL_Z - 0.02);
  const showcase = createShowcase();
  showcase.scale.setScalar(SHOWCASE.scale * U);
  showcase.position.set(SHOWCASE.x, CENTERLINE_Y, WALL_Z - 0.02);
  wall.add(guitarWall, showcase);
  wall.children.forEach((child) => (child.rotation.y = Math.PI)); // face into the room
  scene.add(wall);

  const ampX = GUITAR.x - AMP.offset * U; // turned to face the room, the offset runs the other way
  return [collider(ampX, WALL_Z - (AMP.depth * U) / 2, AMP.width * U + 0.3, AMP.depth * U + 0.6)];
};
