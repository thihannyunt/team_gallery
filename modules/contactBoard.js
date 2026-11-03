import * as THREE from 'three';
import { about } from './teamData.js';

// "Contact us" whiteboard on the front wall, to the right of the team portrait: an aluminium-framed
// board with our email, website, LINE and sign-off written in marker, plus a marker tray along the bottom.
// The contact details come from teamData.js, so the board always matches the About page.
// The writing is drawn in code on a canvas, so it needs no download.

const BOARD = { width: 9.4, height: 5.8 }; // the writing surface
const FRAME = 0.14;
const CENTER = { x: 4.5, y: 2.3, z: -19.95 }; // front wall stands at z = -20

const outerWidth = BOARD.width + 2 * FRAME;
const outerHeight = BOARD.height + 2 * FRAME;

// For lighting.js: a ceiling track light gives the board the same pool of light as the photos
export const contactBoardLight = {
  center: new THREE.Vector3(CENTER.x, CENTER.y, CENTER.z),
  normal: new THREE.Vector3(0, 0, 1),
  width: outerWidth,
  height: outerHeight,
};

const MARKER = { navy: '#1f3c88', teal: '#0b5d5b', red: '#c63a2f', green: '#2e8540' };
const HAND = 'Caveat, "Comic Sans MS", "Segoe Print", cursive'; // loaded in index.html

// Writes `text` at `size`, shrinking it until it fits in `maxWidth`
const fitText = (ctx, text, x, y, size, weight, maxWidth) => {
  let px = size;
  ctx.font = `${weight} ${px}px ${HAND}`;
  while (ctx.measureText(text).width > maxWidth && px > 24) {
    px -= 4;
    ctx.font = `${weight} ${px}px ${HAND}`;
  }
  ctx.fillText(text, x, y);
};

// Marker doodles in front of each line, about 80 px across, centred on (x, y)

const drawEnvelope = (ctx, x, y) => {
  ctx.strokeRect(x - 40, y - 28, 80, 56);
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 28);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x + 40, y - 28);
  ctx.stroke();
};

const drawGlobe = (ctx, x, y) => {
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.moveTo(x - 36, y);
  ctx.lineTo(x + 36, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, 15, 36, 0, 0, Math.PI * 2);
  ctx.stroke();
};

// LINE's speech-bubble logo shape with "LINE" written inside
const drawLineLogo = (ctx, x, y) => {
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 44, 32, 0, 0.62 * Math.PI, 2.38 * Math.PI);
  ctx.lineTo(x - 6, y + 38);
  ctx.closePath();
  ctx.stroke();
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.textAlign = 'center';
  ctx.font = `800 26px Manrope, Arial, sans-serif`;
  ctx.fillText('LINE', x, y + 5);
  ctx.restore();
};

const drawSpeechBubble = (ctx, x, y) => {
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 42, 30, 0, 0.35 * Math.PI, 2.25 * Math.PI);
  ctx.lineTo(x - 30, y + 36);
  ctx.closePath();
  ctx.stroke();
};

const drawShuttle = (ctx, x, y) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.beginPath();
  ctx.moveTo(-34, -60);
  ctx.lineTo(34, -60);
  ctx.lineTo(13, 0);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  [-0.5, 0, 0.5].forEach((t) => {
    ctx.moveTo(t * 50, -60);
    ctx.lineTo(t * 18, 0);
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 6, 14, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
};

const write = (ctx, w, h) => {
  // Board surface with a few faint ghosts of old, wiped-off writing
  ctx.fillStyle = '#f6f8f8';
  ctx.fillRect(0, 0, w, h);
  [
    [0.3, 0.75, 360, 60, -0.1],
    [0.62, 0.3, 300, 46, 0.08],
    [0.82, 0.82, 260, 40, -0.05],
  ].forEach(([x, y, rx, ry, angle]) => {
    ctx.fillStyle = 'rgba(120, 130, 140, 0.05)';
    ctx.beginPath();
    ctx.ellipse(w * x, h * y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'left'; // reset: the board is drawn twice and the sign-off leaves it right-aligned
  ctx.textBaseline = 'alphabetic';

  // Heading with a wavy underline
  ctx.fillStyle = MARKER.navy;
  ctx.font = `700 190px ${HAND}`;
  ctx.fillText('Contact us', 130, 230);
  const headingWidth = ctx.measureText('Contact us').width;
  ctx.strokeStyle = MARKER.red;
  ctx.lineWidth = 10;
  ctx.beginPath();
  for (let x = 0; x <= headingWidth; x += 8) {
    const y = 272 + Math.sin(x / 38) * 7;
    if (x === 0) ctx.moveTo(130 + x, y);
    else ctx.lineTo(130 + x, y);
  }
  ctx.stroke();

  ctx.fillStyle = MARKER.teal;
  ctx.font = `600 84px ${HAND}`;
  ctx.fillText("We'd love to hear from you!", 150, 380);

  // One line per way to reach us, each with a doodle in front
  const textX = 300;
  const maxWidth = w - textX - 110;
  [
    { draw: drawEnvelope, label: 'Email', text: about.email, color: MARKER.navy },
    { draw: drawGlobe, label: 'Web', text: about.appUrl.replace(/^https?:\/\//, ''), color: MARKER.navy },
    { draw: drawLineLogo, label: 'LINE', text: about.lineUrl.replace(/^https?:\/\//, ''), color: MARKER.green },
    { draw: drawSpeechBubble, text: 'Questions, ideas, a session to organise? Say hi!', color: MARKER.teal },
  ].forEach(({ draw, label, text, color }, i) => {
    const y = 560 + i * 160;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    draw(ctx, 200, y - 30);
    ctx.fillStyle = color;
    if (label) {
      ctx.font = `700 66px ${HAND}`;
      ctx.fillText(`${label}:`, textX, y - 70);
    }
    fitText(ctx, text, textX, label ? y + 20 : y, label ? 112 : 92, 700, maxWidth);
  });

  // Sticky note in the top right corner with the crew's tagline, held on by a magnet
  ctx.save();
  ctx.translate(w - 330, 250);
  ctx.rotate(0.06);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(-182, -172, 372, 372);
  ctx.fillStyle = '#ffe36e';
  ctx.fillRect(-190, -180, 372, 372);
  ctx.fillStyle = '#3a3a3a';
  ctx.textAlign = 'center';
  const words = about.tagline.split(' ');
  const lines = [];
  ctx.font = `600 62px ${HAND}`;
  words.forEach((word) => {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width < 320) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  });
  const firstLine = 30 - ((lines.length - 1) * 66) / 2; // vertically centred on the note
  lines.forEach((line, i) => ctx.fillText(line, -4, firstLine + i * 66));
  ctx.fillStyle = MARKER.red;
  ctx.beginPath();
  ctx.arc(-4, -176, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sign-off in the bottom right with a shuttle doodle
  ctx.textAlign = 'right';
  ctx.fillStyle = MARKER.red;
  ctx.font = `700 110px ${HAND}`;
  ctx.fillText(about.signOff, w - 230, h - 90);
  ctx.strokeStyle = MARKER.red;
  ctx.lineWidth = 7;
  drawShuttle(ctx, w - 140, h - 110);
};

// Satin aluminium; kept low on metalness because the room has no reflections for metal to pick up
const aluminium = new THREE.MeshStandardMaterial({ color: 0xd3d6da, roughness: 0.4, metalness: 0.25 });
const plastic = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.6 });

// Marker lying on the tray along x, cap to the right
const createMarker = (color) => {
  const marker = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 })
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
  );
  cap.position.y = 0.26;
  marker.add(body, cap);
  marker.rotation.z = -Math.PI / 2;
  return marker;
};

const createTray = () => {
  const tray = new THREE.Group();
  const width = BOARD.width * 0.7;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.32), aluminium);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.03), aluminium);
  lip.position.set(0, 0.03, 0.15);
  [-1, 1].forEach((side) => {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.34), plastic);
    end.position.set((side * width) / 2, 0.03, 0);
    tray.add(end);
  });
  tray.add(shelf, lip);

  [MARKER.navy, MARKER.red, MARKER.green].forEach((color, i) => {
    const marker = createMarker(color);
    marker.position.set(-2.2 + i * 0.6, 0.07, 0.02 + (i % 2) * 0.05);
    marker.rotation.y = (i - 1) * 0.08;
    tray.add(marker);
  });

  // Eraser: teal grip on a grey felt pad
  const eraser = new THREE.Group();
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.17),
    new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1 })
  );
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.1, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x024b4a, roughness: 0.5 })
  );
  grip.position.y = 0.075;
  eraser.add(felt, grip);
  eraser.position.set(1.6, 0.045, 0.02);
  eraser.rotation.y = -0.12;
  tray.add(eraser);

  tray.position.set(0, -outerHeight / 2 - 0.02, 0.17);
  return tray;
};

export const createContactBoard = (scene) => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round((2048 * BOARD.height) / BOARD.width);
  const ctx = canvas.getContext('2d');
  write(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  // Redraw once the handwriting font has arrived
  document.fonts?.load('700 100px Caveat').then(() => {
    write(ctx, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  const group = new THREE.Group();

  // Aluminium frame: four bars around the board, with grey corner caps
  const depth = 0.12;
  [
    [0, (outerHeight - FRAME) / 2, outerWidth, FRAME],
    [0, -(outerHeight - FRAME) / 2, outerWidth, FRAME],
    [(outerWidth - FRAME) / 2, 0, FRAME, outerHeight],
    [-(outerWidth - FRAME) / 2, 0, FRAME, outerHeight],
  ].forEach(([x, y, w, h]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), aluminium);
    bar.position.set(x, y, depth / 2);
    group.add(bar);
  });
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sy) => {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(FRAME * 1.6, FRAME * 1.6, depth * 1.3), plastic);
      corner.position.set((sx * (outerWidth - FRAME)) / 2, (sy * (outerHeight - FRAME)) / 2, depth / 2);
      group.add(corner);
    })
  );

  // Lit by the room and its track light like the wall around it, so the white sits in the same warm
  // pool of light instead of glowing at full brightness the way the unlit photos do
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.width, BOARD.height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45 })
  );
  surface.position.z = 0.02;

  group.add(surface, createTray());
  group.position.set(CENTER.x, CENTER.y, CENTER.z);
  scene.add(group);
};
