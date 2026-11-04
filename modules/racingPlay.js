import * as THREE from 'three';
import { racingScreens, showRacingSeat } from './racingSim.js';
import { controlInput, endRace, startRace } from './racingGame.js';
import { canSit } from './seating.js';
import { keysPressed } from './movement.js';
import { resetTouchInput } from './touchControls.js';
import { forceFirstPerson } from './playerView.js';
import { setMusicDucked } from './music.js';

// Drive Court Connect GP on the racing simulator. Walk up behind the seat and a "Race" button appears
// (or press E); the view drops into the seat, with the three screens filling it and the wheel in front,
// and the race's countdown starts (racingGame.js). Keyboard: ← → or A / D to steer, ↑ / W for gas,
// ↓ / S to brake, Esc to step back. Touch: steer buttons under the left thumb, gas and brake under the
// right. While seated every key belongs to the game, so F, Space and the rest do nothing else.

const NEAR = 9.5; // scene units from the middle screen: standing just behind the seat
const FACING = Math.cos(THREE.MathUtils.degToRad(35)); // the screens must be within 35° of where they look
const MOVE_TIME = 0.8; // seconds to sit down, and to get back up

let camera;
let controls;
let mode = null; // null, 'enter', 'play' or 'leave'
let near = false;
let relockOnLeave = false;
let move = null; // { time, fromPosition, fromQuaternion } while sitting down or getting up
const standing = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }; // where they left from

const button = () => document.getElementById('racing-button');
const isExploring = () => document.body.classList.contains('exploring');

// Whether the visitor is in the seat, so the render loop leaves walking alone (rendering.js)
export const isAtRacing = () => mode !== null;

const forward = new THREE.Vector3();
const toScreen = new THREE.Vector3();
const findNear = () => {
  toScreen.subVectors(racingScreens.center, camera.position);
  toScreen.y = 0;
  const distance = toScreen.length();
  if (distance > NEAR) return false;
  camera.getWorldDirection(forward);
  forward.y = 0;
  return forward.normalize().dot(toScreen.divideScalar(distance)) > FACING;
};

// The driver's eyes: square on to the middle screen, back just far enough for all three screens to fill
// a wide view (only the middle one on an upright phone, with it in the top part and the pedals below).
const look = new THREE.Vector3();
const aim = new THREE.Matrix4();
const seatedPose = (position, quaternion) => {
  const { center, normal, centerWidth, totalWidth, height } = racingScreens;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const upright = camera.aspect < 1;
  const width = upright ? centerWidth : totalWidth;
  const distance = Math.max(width / 2 / (tan * camera.aspect * (upright ? 0.96 : 0.84)), height / 2 / (tan * 0.5));
  look.copy(center);
  if (upright) look.y -= 0.3 * distance * tan;
  position.copy(center).addScaledVector(normal, distance);
  position.y += 0.08 * distance; // a touch above the screens' middle, looking slightly down past the wheel
  aim.lookAt(position, look, camera.up);
  quaternion.setFromRotationMatrix(aim);
};

const startMove = () => {
  move = { time: 0, fromPosition: camera.position.clone(), fromQuaternion: camera.quaternion.clone() };
};

const sitDown = () => {
  if (mode) return;
  mode = 'enter';
  standing.position.copy(camera.position);
  standing.quaternion.copy(camera.quaternion);
  // Nothing held should walk on afterwards, and the mouse is freed for the on-screen buttons
  Object.keys(keysPressed).forEach((key) => (keysPressed[key] = false));
  resetTouchInput();
  relockOnLeave = controls.isLocked;
  if (controls.isLocked) controls.unlock();
  forceFirstPerson(true);
  document.body.classList.add('at-racing');
  button().hidden = true;
  setMusicDucked(true);
  startMove();
  startRace();
};

const getUp = ({ relock }) => {
  if (mode !== 'enter' && mode !== 'play') return;
  mode = 'leave';
  endRace();
  showRacingSeat(true);
  setMusicDucked(false);
  document.body.classList.remove('at-racing');
  startMove();
  // Pointer lock needs a click or key, so Esc leaves the mouse free (Enter or Space resumes)
  if (relock && relockOnLeave) controls.lock();
  relockOnLeave = false;
};

const KEYS = {
  left: ['arrowleft', 'a'],
  right: ['arrowright', 'd'],
  gas: ['arrowup', 'w'],
  brake: ['arrowdown', 's'],
};
const controlFor = (key) => Object.keys(KEYS).find((control) => KEYS[control].includes(key.toLowerCase()));

// A held button on the pad: press and hold, let go (or slide off it) to stop
const holdButton = (id, control) => {
  const element = document.getElementById(id);
  const release = () => (controlInput[control] = false);
  element.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    try {
      element.setPointerCapture(event.pointerId); // keeps the press while the thumb slides a little
    } catch {
      // not a live pointer: the press still counts
    }
    controlInput[control] = true;
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
};

export const setupRacingPlay = (playerCamera, pointerLockControls) => {
  camera = playerCamera;
  controls = pointerLockControls;

  button().addEventListener('click', sitDown);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring() && !mode && near && !canSit()) sitDown();
  });

  // In the seat the keys only drive: nothing else in the gallery or the browser gets them (W/A/S/D
  // would walk, F go full screen, Space and the arrows scroll). Esc gets up; Tab/Enter still work the
  // buttons, and Cmd/Ctrl/Alt shortcuts are left to the browser.
  window.addEventListener(
    'keydown',
    (event) => {
      if (!mode) return;
      event.stopImmediatePropagation();
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key !== 'Tab' && event.key !== 'Enter') event.preventDefault();
      if (mode === 'leave') return;
      if (event.key === 'Escape') getUp({ relock: false });
      else if (event.key === 'e' || event.key === 'E') getUp({ relock: true });
      const control = controlFor(event.key);
      if (control) controlInput[control] = true;
    },
    true
  );
  window.addEventListener(
    'keyup',
    (event) => {
      if (!mode) return;
      event.stopImmediatePropagation();
      const control = controlFor(event.key);
      if (control) controlInput[control] = false;
    },
    true
  );

  holdButton('racing-left', 'left');
  holdButton('racing-right', 'right');
  holdButton('racing-gas', 'gas');
  holdButton('racing-brake', 'brake');
  document.getElementById('racing-exit').addEventListener('click', () => getUp({ relock: true }));
};

const smooth = (t) => t * t * (3 - 2 * t);
const targetPosition = new THREE.Vector3();
const targetQuaternion = new THREE.Quaternion();

// Called every frame from the render loop
export const updateRacingPlay = (delta) => {
  if (!camera) return;

  if (!mode) {
    near = isExploring() && findNear();
    if (button().hidden === near) button().hidden = !near;
    return;
  }

  // Left the gallery (menu) mid-race: put the visitor back where they stood
  if (!isExploring() && mode !== 'leave') {
    getUp({ relock: false });
    move.time = MOVE_TIME;
  }

  if (mode === 'leave') {
    targetPosition.copy(standing.position);
    targetQuaternion.copy(standing.quaternion);
  } else {
    seatedPose(targetPosition, targetQuaternion); // every frame, so turning the phone refits the screens
  }

  if (move) {
    move.time += delta;
    const t = smooth(Math.min(move.time / MOVE_TIME, 1));
    camera.position.lerpVectors(move.fromPosition, targetPosition, t);
    camera.quaternion.slerpQuaternions(move.fromQuaternion, targetQuaternion, t);
    if (mode === 'enter' && t > 0.6) showRacingSeat(false); // the seat would fill the view as they drop in
    if (move.time < MOVE_TIME) return;
    move = null;
    if (mode === 'enter') mode = 'play';
  }

  if (mode === 'leave') {
    mode = null;
    forceFirstPerson(false);
    return;
  }
  camera.position.copy(targetPosition);
  camera.quaternion.copy(targetQuaternion);
};
