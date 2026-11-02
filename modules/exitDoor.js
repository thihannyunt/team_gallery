import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { resetTouchInput } from './touchControls.js';
import { keysPressed } from './movement.js';

// Exit door on the back wall, near where visitors start, under a glowing green EXIT sign. Walking
// into it asks the visitor to confirm, then leaves the gallery for the Court Connect site.

const DOOR = { x: 8.5, width: 1.0 * UNITS_PER_METER, height: 2.1 * UNITS_PER_METER };
const WALL_Z = 20; // back wall
const TRIGGER_DEPTH = 1.6; // how close to the wall (scene units) counts as walking through
const STEP_BACK = 1.5; // the visitor is moved this far off the doormat while asked, so "Stay" doesn't ask again
const EXIT_URL = 'https://cconnect.tspdigital.solutions/';

let camera;
let controls;
let relockOnClose = false; // desktop: go back to mouse-look after "Stay" if it was on before

const signTexture = (text, sub) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.fillStyle = '#0b8a47';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f2fff6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 92px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(text, canvas.width / 2, sub ? 78 : canvas.height / 2);
    if (sub) {
      ctx.font = '700 30px Manrope, "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(sub, canvas.width / 2, 150);
    }
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  document.fonts?.load('800 92px Manrope').then(() => {
    draw();
    texture.needsUpdate = true;
  });
  return texture;
};

const createDoor = () => {
  const door = new THREE.Group();
  const casing = new THREE.MeshStandardMaterial({ color: 0x1a1d1d, roughness: 0.6 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x24302f, roughness: 0.55 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.3, metalness: 0.85 });

  // Frame around the opening
  const frame = 0.18;
  [
    [0, DOOR.height + frame / 2, DOOR.width + 2 * frame, frame],
    [-(DOOR.width + frame) / 2, DOOR.height / 2, frame, DOOR.height],
    [(DOOR.width + frame) / 2, DOOR.height / 2, frame, DOOR.height],
  ].forEach(([x, y, w, h]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), casing);
    bar.position.set(x, y, 0.11);
    door.add(bar);
  });

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR.width, DOOR.height, 0.1), leafMaterial);
  leaf.position.set(0, DOOR.height / 2, 0.05);
  // Narrow glass panel and a push bar, like a gallery fire exit
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR.width * 0.18, DOOR.height * 0.45),
    new THREE.MeshStandardMaterial({ color: 0x9fb8b4, roughness: 0.1, metalness: 0.3 })
  );
  glass.position.set(DOOR.width * 0.25, DOOR.height * 0.68, 0.101);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, DOOR.width * 0.8, 12), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.0 * UNITS_PER_METER, 0.22);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.56),
    new THREE.MeshBasicMaterial({ map: signTexture('EXIT', 'TO COURT CONNECT') })
  );
  plaque.position.set(-DOOR.width * 0.12, DOOR.height * 0.68, 0.101);
  door.add(leaf, glass, bar, plaque);

  // Glowing EXIT sign above the door
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.64, 0.14), [
    casing,
    casing,
    casing,
    casing,
    new THREE.MeshBasicMaterial({ map: signTexture('EXIT →') }),
    casing,
  ]);
  sign.position.set(0, DOOR.height + 0.95, 0.12);
  door.add(sign);

  // Doormat in front
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR.width + 0.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.02, 0.9);
  door.add(mat);

  door.position.set(DOOR.x, FLOOR_Y, WALL_Z - 0.01);
  door.rotation.y = Math.PI; // face into the room
  return door;
};

const dialog = () => document.getElementById('exit-dialog');
const isAskingToLeave = () => dialog().classList.contains('show');

const askToLeave = () => {
  camera.position.z = WALL_Z - TRIGGER_DEPTH - STEP_BACK;
  resetTouchInput();
  Object.keys(keysPressed).forEach((key) => (keysPressed[key] = false)); // a held key shouldn't walk on behind the dialog

  // Free the mouse so the buttons can be clicked
  relockOnClose = controls.isLocked;
  if (controls.isLocked) controls.unlock();

  dialog().classList.add('show');
  document.getElementById('exit-stay').focus();
};

const stay = ({ relock }) => {
  dialog().classList.remove('show');
  // Pointer lock needs a click, so pressing Esc leaves the mouse free (Enter resumes)
  if (relock && relockOnClose) controls.lock();
  relockOnClose = false;
};

export const setupExitDoor = (scene, playerCamera, pointerLockControls) => {
  camera = playerCamera;
  controls = pointerLockControls;
  scene.add(createDoor());

  document.getElementById('exit-confirm').addEventListener('click', () => window.location.assign(EXIT_URL));
  document.getElementById('exit-stay').addEventListener('click', () => stay({ relock: true }));
  // Clicking the dark area around the card also stays
  dialog().addEventListener('click', (event) => {
    if (event.target === dialog()) stay({ relock: true });
  });

  // While open, keys belong to the dialog: Esc stays instead of opening the menu,
  // and W/A/S/D don't walk around behind it (keyup still passes so keys can't get stuck)
  window.addEventListener(
    'keydown',
    (event) => {
      if (!isAskingToLeave()) return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        stay({ relock: false });
      }
    },
    true
  );
};

// Called every frame from the render loop
export const updateExitDoor = () => {
  if (!camera || !document.body.classList.contains('exploring') || isAskingToLeave()) return;
  const { x, z } = camera.position;
  if (Math.abs(x - DOOR.x) < DOOR.width / 2 && z > WALL_Z - TRIGGER_DEPTH) askToLeave();
};
