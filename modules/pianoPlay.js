import * as THREE from 'three';
import { pianoStage, pianistView, setPianoKey } from './grandPiano.js';
import { createPianoSound } from './pianoSound.js';
import { setMusicDucked } from './music.js';
import { canSit } from './seating.js';
import { keysPressed } from './movement.js';
import { resetTouchInput } from './touchControls.js';
import { forceFirstPerson } from './playerView.js';

// Play the grand piano (grandPiano.js). Walk up to the stage and a "Play the piano" button appears (or
// press E); the view moves onto the bench, looking down over the keys, and a keyboard comes up along the
// bottom of the screen. Touch or click its keys (several at once, or slide along them), or play from a
// computer keyboard: A S D F G H J K L ; ' are the white keys, W E T Y U O P the black ones, Z / X move
// an octave, Space holds the sustain pedal. "Für Elise" plays its opening by itself. The 3D keys go
// down with every note. Esc or "Step back" leaves; the gallery's jazz fades out meanwhile.

const NEAR = 10; // scene units from the middle of the stage
const FACING = Math.cos(THREE.MathUtils.degToRad(35));
const MOVE_TIME = 0.8; // seconds to sit down, and to get up
const LOWEST_START = 36; // C2
const HIGHEST_START = 84; // C6
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const KEYBOARD_KEYS = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};
// The opening of "Für Elise" (Beethoven, 1810), as [sixteenths from the start, MIDI note, length in sixteenths]
const FUR_ELISE = (() => {
  const notes = [];
  let t = 0;
  const melody = (...midis) => midis.forEach((midi) => notes.push([t++, midi, 1]));
  // A bar of the left hand's broken chord with the right hand answering above it
  const bar = (top, bass, right) => {
    notes.push([t, top, 3], [t, bass[0], 6]);
    notes.push([t + 1, bass[1], 5], [t + 2, bass[2], 4]);
    t += 3;
    melody(...right);
  };
  melody(76, 75);
  melody(76, 75, 76, 71, 74, 72);
  bar(69, [45, 52, 57], [60, 64, 69]);
  bar(71, [40, 52, 56], [64, 68, 71]);
  bar(72, [45, 52, 57], [64, 76, 75]);
  melody(76, 75, 76, 71, 74, 72);
  bar(69, [45, 52, 57], [60, 64, 69]);
  bar(71, [40, 52, 56], [64, 72, 71]);
  notes.push([t, 69, 8], [t, 45, 8], [t + 1, 52, 7], [t + 2, 57, 6]);
  return notes;
})();
const SIXTEENTH = 0.16; // seconds

let camera;
let controls;
let audio = null;
let sound = null;
let mode = null; // null, 'enter', 'play' or 'leave'
let near = false;
let relockOnLeave = false;
let move = null;
let start = 60; // the C at the left end of the on-screen keyboard
let octaves = 2;
let sustain = false;
let demoTimers = [];
const sounding = new Map(); // MIDI note -> how many fingers/keys hold it
const standing = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

const button = () => document.getElementById('piano-button');
const keysElement = () => document.getElementById('piano-keys');
const isExploring = () => document.body.classList.contains('exploring');
const photoOffered = () => !document.getElementById('photo-button').hidden;
const noteName = (midi) => `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export const isAtPiano = () => mode !== null;

// ---- Notes ----

const showKey = (midi, down) => {
  setPianoKey(midi, down);
  keysElement().querySelector(`[data-midi="${midi}"]`)?.classList.toggle('down', down);
};

const press = (midi, velocity = 0.8) => {
  sounding.set(midi, (sounding.get(midi) ?? 0) + 1);
  sound?.noteOn(midi, velocity);
  showKey(midi, true);
};

const release = (midi) => {
  const count = (sounding.get(midi) ?? 0) - 1;
  if (count > 0) {
    sounding.set(midi, count);
    return;
  }
  sounding.delete(midi);
  sound?.noteOff(midi);
  showKey(midi, false);
};

const releaseAll = () => [...sounding.keys()].forEach((midi) => {
  sounding.set(midi, 1);
  release(midi);
});

const setSustain = (on) => {
  sustain = on;
  sound?.setSustain(on);
  document.getElementById('piano-sustain').setAttribute('aria-pressed', String(on));
};

const stopDemo = () => {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
  document.getElementById('piano-demo').setAttribute('aria-pressed', 'false');
};

const playDemo = () => {
  const playing = demoTimers.length > 0;
  stopDemo();
  releaseAll();
  if (playing) return; // the button stops it too
  document.getElementById('piano-demo').setAttribute('aria-pressed', 'true');
  let end = 0;
  FUR_ELISE.forEach(([at, midi, length]) => {
    demoTimers.push(setTimeout(() => press(midi, midi < 60 ? 0.55 : 0.8), at * SIXTEENTH * 1000));
    demoTimers.push(setTimeout(() => release(midi), (at + length) * SIXTEENTH * 1000 - 30));
    end = Math.max(end, at + length);
  });
  demoTimers.push(setTimeout(stopDemo, end * SIXTEENTH * 1000));
};

// ---- The on-screen keyboard ----

const buildKeys = () => {
  const element = keysElement();
  element.textContent = '';
  const end = start + octaves * 12; // one more C at the right end
  const whites = [];
  for (let midi = start; midi <= end; midi++) if (WHITE_OFFSETS.includes(midi % 12)) whites.push(midi);
  const whiteWidth = 100 / whites.length;
  const hint = (midi) => Object.keys(KEYBOARD_KEYS).find((key) => start + KEYBOARD_KEYS[key] === midi) ?? '';
  whites.forEach((midi, i) => {
    const key = document.createElement('div');
    key.className = 'piano-key white';
    key.dataset.midi = String(midi);
    key.style.left = `${i * whiteWidth}%`;
    key.style.width = `${whiteWidth}%`;
    key.innerHTML = `<span class="key-hint"></span>${midi % 12 === 0 ? `<small>${noteName(midi)}</small>` : ''}`;
    key.querySelector('.key-hint').textContent = hint(midi).toUpperCase();
    element.append(key);
    // A black key after C, D, F, G and A, straddling the line to the next white key
    if ([0, 2, 5, 7, 9].includes(midi % 12) && midi + 1 <= end) {
      const black = document.createElement('div');
      black.className = 'piano-key black';
      black.dataset.midi = String(midi + 1);
      black.style.left = `${(i + 1) * whiteWidth - whiteWidth * 0.3}%`;
      black.style.width = `${whiteWidth * 0.6}%`;
      black.innerHTML = '<span class="key-hint"></span>';
      black.querySelector('.key-hint').textContent = hint(midi + 1).toUpperCase();
      element.append(black);
    }
  });
  document.getElementById('piano-range').textContent = `${noteName(start)} – ${noteName(end)}`;
  sound?.warm(Array.from({ length: end - start + 1 }, (_, i) => start + i));
};

// Two octaves on wide screens, one on phones held upright
const fitKeys = (force = false) => {
  const wanted = window.innerWidth >= 700 ? 2 : 1;
  if (!force && wanted === octaves) return;
  octaves = wanted;
  start = Math.min(start, HIGHEST_START - (octaves - 1) * 12);
  buildKeys();
};

const shiftOctave = (by) => {
  const next = Math.max(LOWEST_START, Math.min(HIGHEST_START - (octaves - 1) * 12, start + by * 12));
  if (next === start) return;
  releaseAll();
  start = next;
  buildKeys();
};

// Fingers and the mouse: each pointer holds one note, sliding onto another key moves it there
const pointers = new Map(); // pointerId -> MIDI note or null
const keyAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.piano-key');
const track = (event) => {
  const key = keyAt(event.clientX, event.clientY);
  const midi = key ? Number(key.dataset.midi) : null;
  const before = pointers.get(event.pointerId);
  if (midi === before) return;
  if (before !== undefined && before !== null) release(before);
  if (midi !== null) press(midi, 0.75);
  pointers.set(event.pointerId, midi);
};
const lift = (event) => {
  const midi = pointers.get(event.pointerId);
  if (midi !== undefined && midi !== null) release(midi);
  pointers.delete(event.pointerId);
};

// ---- Sitting down and getting up ----

const forward = new THREE.Vector3();
const toStage = new THREE.Vector3();
const findNear = () => {
  toStage.subVectors(pianoStage, camera.position);
  toStage.y = 0;
  const distance = toStage.length();
  if (distance > NEAR) return false;
  if (distance < 4) return true; // on the stage, whichever way they look
  camera.getWorldDirection(forward);
  forward.y = 0;
  return forward.normalize().dot(toStage.divideScalar(distance)) > FACING;
};

const eye = new THREE.Vector3();
const look = new THREE.Vector3();
const aim = new THREE.Matrix4();
const seatedPose = (position, quaternion) => {
  const panel = document.getElementById('piano-panel').getBoundingClientRect().height;
  pianistView(eye, look, camera, Math.min(panel / window.innerHeight, 0.6));
  position.copy(eye);
  aim.lookAt(eye, look, camera.up);
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
  Object.keys(keysPressed).forEach((key) => (keysPressed[key] = false));
  resetTouchInput();
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    sound = sound ?? createPianoSound(audio);
  } catch {
    sound = null; // no Web Audio: the keys still move
  }
  relockOnLeave = controls.isLocked;
  if (controls.isLocked) controls.unlock();
  forceFirstPerson(true);
  setMusicDucked(true);
  document.body.classList.add('at-piano');
  button().hidden = true;
  fitKeys(true);
  startMove();
};

const getUp = ({ relock }) => {
  if (mode !== 'enter' && mode !== 'play') return;
  mode = 'leave';
  stopDemo();
  releaseAll();
  setSustain(false);
  pointers.clear();
  sound?.stop();
  setMusicDucked(false);
  document.body.classList.remove('at-piano');
  startMove();
  if (relock && relockOnLeave) controls.lock();
  relockOnLeave = false;
};

export const setupPianoPlay = (playerCamera, pointerLockControls) => {
  camera = playerCamera;
  controls = pointerLockControls;

  button().addEventListener('click', sitDown);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring() && !mode && near && !canSit() && !photoOffered()) sitDown();
  });

  // At the piano the keys only play it: nothing else in the gallery or the browser gets them (W/A/S/D
  // would walk, F would go full screen though it's a note here, Space would scroll, ' would open the
  // browser's quick find). Esc gets up; Tab/Enter still work the buttons, and Cmd/Ctrl/Alt shortcuts
  // are left to the browser.
  const held = new Map(); // keyboard key -> the note it started, so an octave change mid-note still ends it
  window.addEventListener(
    'keydown',
    (event) => {
      if (!mode) return;
      event.stopImmediatePropagation();
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key !== 'Tab' && event.key !== 'Enter') event.preventDefault();
      if (mode === 'leave' || event.repeat) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') getUp({ relock: false });
      else if (key === 'z') shiftOctave(-1);
      else if (key === 'x') shiftOctave(1);
      else if (event.key === ' ') setSustain(true);
      else if (key in KEYBOARD_KEYS && !held.has(key)) {
        stopDemo();
        const midi = start + KEYBOARD_KEYS[key];
        held.set(key, midi);
        press(midi);
      }
    },
    true
  );
  window.addEventListener(
    'keyup',
    (event) => {
      if (!mode) return;
      event.stopImmediatePropagation();
      const key = event.key.toLowerCase();
      if (event.key === ' ') setSustain(false);
      if (held.has(key)) {
        release(held.get(key));
        held.delete(key);
      }
    },
    true
  );

  const keys = keysElement();
  keys.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    keys.setPointerCapture?.(event.pointerId);
    stopDemo();
    track(event);
  });
  keys.addEventListener('pointermove', (event) => pointers.has(event.pointerId) && track(event));
  keys.addEventListener('pointerup', lift);
  keys.addEventListener('pointercancel', lift);
  // The sustain button works as a pedal: down while held
  const pedal = document.getElementById('piano-sustain');
  pedal.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pedal.setPointerCapture?.(event.pointerId);
    setSustain(true);
  });
  pedal.addEventListener('pointerup', () => setSustain(false));
  pedal.addEventListener('pointercancel', () => setSustain(false));
  document.getElementById('piano-down').addEventListener('click', () => shiftOctave(-1));
  document.getElementById('piano-up').addEventListener('click', () => shiftOctave(1));
  document.getElementById('piano-demo').addEventListener('click', playDemo);
  document.getElementById('piano-exit').addEventListener('click', () => getUp({ relock: true }));
  window.addEventListener('resize', () => mode && fitKeys());
};

const smooth = (t) => t * t * (3 - 2 * t);
const targetPosition = new THREE.Vector3();
const targetQuaternion = new THREE.Quaternion();

// Called every frame from the render loop
export const updatePianoPlay = (delta) => {
  if (!camera) return;
  if (!mode) {
    near = isExploring() && findNear();
    if (button().hidden === near) button().hidden = !near;
    return;
  }
  if (!isExploring() && mode !== 'leave') {
    getUp({ relock: false }); // left for the menu
    move.time = MOVE_TIME;
  }
  if (mode === 'leave') {
    targetPosition.copy(standing.position);
    targetQuaternion.copy(standing.quaternion);
  } else {
    seatedPose(targetPosition, targetQuaternion); // every frame, so turning the phone refits the view
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
