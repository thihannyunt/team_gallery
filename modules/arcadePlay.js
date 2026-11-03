import * as THREE from 'three';
import { arcadeScreen } from './arcade.js';
import { controlInput, endMatch, pressSwing, startMatch } from './shuttleRally.js';
import { canSit } from './seating.js';
import { keysPressed } from './movement.js';
import { resetTouchInput } from './touchControls.js';
import { forceFirstPerson } from './playerView.js';

// Play Shuttle Rally on the arcade cabinet. Walk up to it and a "Play" button appears (or press E);
// the view moves in until the cabinet's screen fills it and a match starts (shuttleRally.js).
// Keyboard: ← → or A / D to move, Space or ↑ to swing, Esc or E to step back. Touch: ◀ ▶ and SWING on
// the screen, or tap anywhere to swing. Stepping back puts the camera where the visitor stood.

const NEAR = 6.5; // scene units: about 2 m from the screen
const FACING = Math.cos(THREE.MathUtils.degToRad(35)); // the cabinet must be within 35° of where they look
const MOVE_TIME = 0.7; // seconds to step up to the screen, and back

let camera;
let controls;
let mode = null; // null, 'enter', 'play' or 'leave'
let near = false;
let relockOnLeave = false;
let move = null; // { time, fromPosition, fromQuaternion } while stepping up or back
const standing = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }; // where they left from

const button = () => document.getElementById('arcade-button');
const isExploring = () => document.body.classList.contains('exploring');

// Whether the visitor is at the cabinet, so the render loop leaves walking alone (rendering.js)
export const isAtArcade = () => mode !== null;

const forward = new THREE.Vector3();
const toScreen = new THREE.Vector3();
const findNear = () => {
  toScreen.subVectors(arcadeScreen.center, camera.position);
  toScreen.y = 0;
  const distance = toScreen.length();
  if (distance > NEAR) return false;
  camera.getWorldDirection(forward);
  forward.y = 0;
  return forward.normalize().dot(toScreen.divideScalar(distance)) > FACING;
};

// The camera square on to the screen, back just far enough for it to fill the view. Upright phones are
// tall, so there the screen sits in the top part and the pad gets the space below it.
const look = new THREE.Vector3();
const aim = new THREE.Matrix4();
const poseAtScreen = (position, quaternion) => {
  const { center, normal, up, width, height } = arcadeScreen;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.max(height / 2 / (tan * 0.86), width / 2 / (tan * camera.aspect * 0.94));
  const halfView = distance * tan;
  const lift = camera.aspect < 1 ? Math.max(0, 0.78 * halfView - height / 2) : 0;
  look.copy(center).addScaledVector(up, -lift);
  position.copy(look).addScaledVector(normal, distance);
  aim.lookAt(position, look, camera.up);
  quaternion.setFromRotationMatrix(aim);
};

const startMove = () => {
  move = { time: 0, fromPosition: camera.position.clone(), fromQuaternion: camera.quaternion.clone() };
};

const play = () => {
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
  document.body.classList.add('at-arcade');
  button().hidden = true;
  startMove();
  startMatch();
};

const leave = ({ relock }) => {
  if (mode !== 'enter' && mode !== 'play') return;
  mode = 'leave';
  endMatch();
  document.body.classList.remove('at-arcade');
  startMove();
  // Pointer lock needs a click or key, so Esc leaves the mouse free (Enter or Space resumes)
  if (relock && relockOnLeave) controls.lock();
  relockOnLeave = false;
};

const KEYS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  swing: [' ', 'ArrowUp', 'w', 'W'],
};

// A held button on the pad: press and hold to run, let go (or slide off it) to stop
const holdButton = (id, direction) => {
  const element = document.getElementById(id);
  const release = () => (controlInput[direction] = false);
  element.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    element.setPointerCapture?.(event.pointerId);
    controlInput[direction] = true;
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
};

export const setupArcadePlay = (playerCamera, pointerLockControls) => {
  camera = playerCamera;
  controls = pointerLockControls;

  button().addEventListener('click', play);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring() && !mode && near && !canSit()) play();
  });

  // At the cabinet every key belongs to the game (Esc would otherwise open the main menu, W/A/S/D walk)
  window.addEventListener(
    'keydown',
    (event) => {
      if (!mode || event.key === 'f') return; // full screen still works
      event.stopImmediatePropagation();
      event.preventDefault(); // Space and the arrows would scroll
      if (mode === 'leave') return;
      if (event.key === 'Escape') leave({ relock: false });
      if (event.key === 'e' || event.key === 'E') leave({ relock: true });
      if (KEYS.left.includes(event.key)) controlInput.left = true;
      if (KEYS.right.includes(event.key)) controlInput.right = true;
      if (KEYS.swing.includes(event.key) && !event.repeat) pressSwing();
    },
    true
  );
  window.addEventListener(
    'keyup',
    (event) => {
      if (!mode) return;
      event.stopImmediatePropagation();
      if (KEYS.left.includes(event.key)) controlInput.left = false;
      if (KEYS.right.includes(event.key)) controlInput.right = false;
    },
    true
  );

  // The pad covers the whole screen, so dragging can't turn the view, and a tap anywhere swings
  const pad = document.getElementById('arcade-pad');
  pad.addEventListener('pointerdown', (event) => {
    if (event.target === pad) pressSwing();
  });
  holdButton('arcade-left', 'left');
  holdButton('arcade-right', 'right');
  document.getElementById('arcade-swing').addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    pressSwing();
  });
  document.getElementById('arcade-exit').addEventListener('click', () => leave({ relock: true }));
};

const smooth = (t) => t * t * (3 - 2 * t);
const targetPosition = new THREE.Vector3();
const targetQuaternion = new THREE.Quaternion();

// Called every frame from the render loop
export const updateArcadePlay = (delta) => {
  if (!camera) return;

  if (!mode) {
    near = isExploring() && findNear();
    if (button().hidden === near) button().hidden = !near;
    return;
  }

  // Left the gallery (menu) mid-game: put the visitor back where they stood
  if (!isExploring() && mode !== 'leave') {
    leave({ relock: false });
    move.time = MOVE_TIME;
  }

  if (mode === 'leave') {
    targetPosition.copy(standing.position);
    targetQuaternion.copy(standing.quaternion);
  } else {
    poseAtScreen(targetPosition, targetQuaternion); // every frame, so turning the phone refits the screen
  }

  if (move) {
    move.time += delta;
    const t = smooth(Math.min(move.time / MOVE_TIME, 1));
    camera.position.lerpVectors(move.fromPosition, targetPosition, t);
    camera.quaternion.slerpQuaternions(move.fromQuaternion, targetQuaternion, t);
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
