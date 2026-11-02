import * as THREE from 'three';

// "Rally": a large original abstract print on the front wall, to the right of the team portrait.
// Mid-century style in the Court Connect colours: a teal sun, a shuttlecock's flight arcing across in
// lime, and a corner of court lines. Painted in code on a canvas, so it's ours and needs no download.

const ART = { width: 9, height: 6 }; // the print itself
const MAT = 0.45;
const FRAME = 0.16;
const CENTER = { x: 4.5, y: 2.3, z: -19.95 }; // front wall stands at z = -20
const LABEL = { width: 1.9, height: 0.7 };

const outerWidth = ART.width + 2 * (MAT + FRAME);
const outerHeight = ART.height + 2 * (MAT + FRAME);

// For lighting.js: a ceiling track light gives the print the same pool of light as the photos
export const featureArtLight = {
  center: new THREE.Vector3(CENTER.x, CENTER.y, CENTER.z),
  normal: new THREE.Vector3(0, 0, 1),
  width: outerWidth,
  height: outerHeight,
};

const paint = (ctx, w, h) => {
  // Warm paper with a faint grain
  ctx.fillStyle = '#efe7d6';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(80, 60, 30, ${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }

  // Gold half-disc rising behind everything
  ctx.fillStyle = '#c9a227';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.78, h * 0.34, Math.PI, 0);
  ctx.fill();

  // Teal sun
  ctx.fillStyle = '#024b4a';
  ctx.beginPath();
  ctx.arc(w * 0.3, h * 0.42, h * 0.27, 0, Math.PI * 2);
  ctx.fill();

  // Deep ink block along the bottom: the court surface
  ctx.fillStyle = '#0d3b34';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  // Court lines in perspective on the ink block
  ctx.strokeStyle = '#f6f4ef';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h);
  ctx.lineTo(w * 0.22, h * 0.8);
  ctx.lineTo(w * 0.95, h * 0.8);
  ctx.moveTo(w * 0.42, h);
  ctx.lineTo(w * 0.5, h * 0.8);
  ctx.moveTo(w * 0.12, h * 0.9);
  ctx.lineTo(w, h * 0.9);
  ctx.stroke();

  // The net: a thin band with a light mesh
  ctx.fillStyle = 'rgba(246, 244, 239, 0.9)';
  ctx.fillRect(w * 0.6, h * 0.62, w * 0.012, h * 0.18);
  ctx.strokeStyle = 'rgba(246, 244, 239, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = h * (0.64 + i * 0.018);
    ctx.beginPath();
    ctx.moveTo(w * 0.612, y);
    ctx.lineTo(w * 0.86, y - h * 0.02);
    ctx.stroke();
  }
  ctx.fillStyle = '#f6f4ef';
  ctx.beginPath();
  ctx.moveTo(w * 0.606, h * 0.62);
  ctx.lineTo(w * 0.86, h * 0.6);
  ctx.lineTo(w * 0.86, h * 0.612);
  ctx.lineTo(w * 0.606, h * 0.632);
  ctx.fill();

  // The rally: a dashed lime arc of the shuttle's flight
  ctx.strokeStyle = '#d0eb00';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 34]);
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.7);
  ctx.quadraticCurveTo(w * 0.5, h * -0.12, w * 0.83, h * 0.36);
  ctx.stroke();
  ctx.setLineDash([]);

  // The shuttlecock at the end of the arc, nose first
  ctx.save();
  ctx.translate(w * 0.83, h * 0.36);
  ctx.rotate(0.95);
  ctx.fillStyle = '#f6f4ef';
  ctx.beginPath();
  ctx.moveTo(-34, -70);
  ctx.lineTo(34, -70);
  ctx.lineTo(14, 0);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0d1111';
  ctx.lineWidth = 3;
  [-0.5, 0, 0.5].forEach((t) => {
    ctx.beginPath();
    ctx.moveTo(t * 50, -70);
    ctx.lineTo(t * 18, 0);
    ctx.stroke();
  });
  ctx.fillStyle = '#d0eb00';
  ctx.fillRect(-15, -4, 30, 8);
  ctx.fillStyle = '#f6f4ef';
  ctx.beginPath();
  ctx.arc(0, 8, 15, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // A few loose ink dots for rhythm
  ctx.fillStyle = '#0d1111';
  [
    [0.55, 0.18, 9],
    [0.6, 0.24, 6],
    [0.66, 0.16, 5],
    [0.9, 0.12, 11],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(w * x, h * y, r, 0, Math.PI * 2);
    ctx.fill();
  });
};

const createLabel = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * LABEL.height) / LABEL.width);
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c1c1c';
    ctx.font = '800 58px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('Rally', 32, canvas.height * 0.38);
    ctx.fillStyle = '#6b6b6b';
    ctx.font = '500 28px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('Court Connect, 2026 · digital print', 32, canvas.height * 0.72);
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  document.fonts?.load('800 58px Manrope').then(() => {
    draw();
    texture.needsUpdate = true;
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL.width, LABEL.height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
  );
  label.position.set(outerWidth / 2 + 0.4 + LABEL.width / 2, -0.6, 0.01);
  return label;
};

export const createFeatureArt = (scene) => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round((2048 * ART.height) / ART.width);
  paint(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;

  const group = new THREE.Group();

  // Oak frame: four bars around the mat
  const oak = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.75 });
  const depth = 0.18;
  [
    [0, (outerHeight - FRAME) / 2, outerWidth, FRAME],
    [0, -(outerHeight - FRAME) / 2, outerWidth, FRAME],
    [(outerWidth - FRAME) / 2, 0, FRAME, outerHeight],
    [-(outerWidth - FRAME) / 2, 0, FRAME, outerHeight],
  ].forEach(([x, y, w, h]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), oak);
    bar.position.set(x, y, depth / 2);
    group.add(bar);
  });

  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(outerWidth - FRAME, outerHeight - FRAME),
    new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 1 })
  );
  mat.position.z = 0.02;
  // Unlit like the photos, so the colours stay true under the warm lights
  const print = new THREE.Mesh(new THREE.PlaneGeometry(ART.width, ART.height), new THREE.MeshBasicMaterial({ map: texture }));
  print.position.z = 0.03;

  group.add(mat, print, createLabel());
  group.position.set(CENTER.x, CENTER.y, CENTER.z);
  scene.add(group);
};
