import * as THREE from 'three';
import { instrumentSpots } from './musicCorner.js';
import { setMusicDucked } from './music.js';
import { canSit } from './seating.js';
import { buildKhlui, openKhlui, closeKhlui, khluiKey } from './khluiSim.js';
import { buildGuitar, openGuitar, closeGuitar, guitarKey } from './guitarSim.js';

// Play the music corner's instruments. Walk up to the khlui showcase or the guitar and look at it, and a
// "Play" button appears (or press E); it opens that instrument's panel (khluiSim.js, guitarSim.js).
// The gallery's jazz fades out while you play, and comes back when you close the panel (X or Esc).

const NEAR = 7.5; // scene units: about 2.3 m
const FACING = Math.cos(THREE.MathUtils.degToRad(30)); // within 30° of where the visitor looks

const INSTRUMENTS = {
  khlui: { label: '🎵 Play the khlui', open: openKhlui, close: closeKhlui, key: khluiKey },
  guitar: { label: '🎸 Play the guitar', open: openGuitar, close: closeGuitar, key: guitarKey },
};

let camera;
let controls;
let audio = null;
let target = null; // the instrument in front of the visitor
let shownFor = undefined;
let playing = null; // the open instrument's name
let relockOnClose = false;

const button = () => document.getElementById('instrument-button');
const dialog = () => document.getElementById('instrument-dialog');
const isExploring = () => document.body.classList.contains('exploring');
const photoOffered = () => !document.getElementById('photo-button').hidden; // E is the photo's then

const forward = new THREE.Vector3();
const toSpot = new THREE.Vector3();
const findTarget = () => {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  let best = null;
  let bestAlignment = FACING;
  Object.entries(instrumentSpots).forEach(([name, spot]) => {
    toSpot.subVectors(spot, camera.position);
    toSpot.y = 0;
    const distance = toSpot.length();
    if (distance > NEAR || distance < 0.01) return;
    const alignment = forward.dot(toSpot.divideScalar(distance));
    if (alignment > bestAlignment) {
      best = name;
      bestAlignment = alignment;
    }
  });
  return best;
};

const show = (name) => {
  if (name === shownFor) return;
  shownFor = name;
  button().hidden = !name;
  if (name) button().firstChild.textContent = INSTRUMENTS[name].label;
};

const open = () => {
  if (!target || playing) return;
  playing = target;
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    audio = null;
  }
  if (audio) INSTRUMENTS[playing].open(audio);
  setMusicDucked(true);
  relockOnClose = controls.isLocked; // free the mouse for the panel
  if (controls.isLocked) controls.unlock();
  dialog().dataset.instrument = playing;
  dialog().classList.add('show');
  show(null);
};

const close = ({ relock }) => {
  if (!playing) return;
  INSTRUMENTS[playing].close();
  playing = null;
  dialog().classList.remove('show');
  setMusicDucked(false);
  if (relock && relockOnClose) controls.lock();
  relockOnClose = false;
};

export const setupInstrumentPlay = (playerCamera, pointerLockControls) => {
  camera = playerCamera;
  controls = pointerLockControls;
  buildKhlui();
  buildGuitar();

  button().addEventListener('click', open);
  document.getElementById('close-instrument').addEventListener('click', () => close({ relock: true }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring() && !playing && !canSit() && !photoOffered()) open();
  });

  // While an instrument is open the keys only play it: nothing else in the gallery or the browser gets
  // them (W/A/S/D would walk, F would go full screen though it's a khlui note, Space would scroll).
  // Esc closes it; Tab/Enter still work the buttons, and Cmd/Ctrl/Alt shortcuts go to the browser.
  const handOver = (down) => (event) => {
    if (!playing) return;
    event.stopImmediatePropagation();
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key !== 'Tab' && event.key !== 'Enter') event.preventDefault();
    if (down && event.key === 'Escape') {
      close({ relock: false });
      return;
    }
    INSTRUMENTS[playing].key(event, down);
  };
  window.addEventListener('keydown', handOver(true), true);
  window.addEventListener('keyup', handOver(false), true);
};

// Called every frame from the render loop
export const updateInstrumentPlay = () => {
  if (!camera) return;
  if (playing && !isExploring()) close({ relock: false }); // left for the menu
  target = isExploring() && !playing ? findTarget() : null;
  show(target);
};
