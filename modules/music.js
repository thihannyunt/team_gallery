import * as THREE from 'three';
import { ROOM, ROOM_CENTER_X, ROOM_CENTER_Z } from './room.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { createJazz } from './jazz.js';

// Surround sound: four wall-mounted speakers, one high in each corner on a swivel bracket, all playing
// the gallery's chill jazz (jazz.js). Up on the walls they leave the floor free (the piano stage has the
// back-left corner). Each speaker is a positional sound source, so the music shifts around you as you
// walk the room and is loudest next to a speaker.

const CORNER = 1.2; // speakers hang this far in from both walls
const MOUNT_HEIGHT = 3.55; // meters above the floor: up by the ceiling (about 4.1 m), clear of the frames and whiteboard
const TILT = 0.32; // radians, aimed down toward the visitors
const SPEAKERS = [
  { x: ROOM.left + CORNER, z: ROOM.front + CORNER },
  { x: ROOM.right - CORNER, z: ROOM.front + CORNER },
  { x: ROOM.left + CORNER, z: ROOM.back - CORNER },
  { x: ROOM.right - CORNER, z: ROOM.back - CORNER },
];
const VOLUME = 0.6;
const HEARING_DISTANCE = 10; // full volume within this many units of a speaker, softer further away
const FADE_TIME = 1.2; // seconds to fade in or out
const START_ON_ENTER = true; // entering the gallery (a click, tap or Enter) counts as the gesture browsers need for sound

let listener;
let jazz;
let master;
let playing = false;
let stoppedByUser = false;
let ducked = false; // silenced while the menu's intro video plays its own soundtrack (introVideo.js)

const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.6 }); // walnut
const baffleMaterial = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.35, metalness: 0.8 });
const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4, metalness: 0.6 });

const CABINET = { width: 0.22, height: 0.34, depth: 0.22 };

// Bookshelf-size speaker in meters, centred on the origin, front (drivers) facing +z
const createCabinet = () => {
  const { width, height, depth } = CABINET;
  const cabinet = new THREE.Group();
  cabinet.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), cabinetMaterial));
  const baffle = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.02, height - 0.02), baffleMaterial);
  baffle.position.z = depth / 2 + 0.001;
  cabinet.add(baffle);
  // Tweeter, woofer and bass port, top to bottom
  [
    [0.1, 0.026],
    [-0.02, 0.07],
    [-0.13, 0.02],
  ].forEach(([y, radius], i) => {
    const cone = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), i === 2 ? baffleMaterial : coneMaterial);
    cone.position.set(0, y, depth / 2 + 0.003);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.006, 0.004, 6, 32), trimMaterial);
    ring.position.copy(cone.position);
    cabinet.add(cone, ring);
  });
  return cabinet;
};

// A speaker hung at (x, z), turned to the middle of the room, on an arm back to the nearer wall.
// Returns the group (in meters, already scaled) and the cabinet, which carries the sound.
const createWallSpeaker = (x, z) => {
  const yaw = Math.atan2(ROOM_CENTER_X - x, ROOM_CENTER_Z - z); // drivers toward the middle of the room
  const mount = new THREE.Group();
  mount.position.set(x, FLOOR_Y + MOUNT_HEIGHT * UNITS_PER_METER, z);
  mount.rotation.y = yaw;

  const cabinet = createCabinet();
  cabinet.rotation.x = TILT;
  mount.add(cabinet);

  // The bracket runs straight back from the cabinet until it meets a wall
  const back = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const toSideWall = back.x < 0 ? (x - ROOM.left) / -back.x : (ROOM.right - x) / back.x;
  const toEndWall = back.z < 0 ? (z - ROOM.front) / -back.z : (ROOM.back - z) / back.z;
  const reach = Math.min(toSideWall, toEndWall) / UNITS_PER_METER; // meters to the wall
  const start = CABINET.depth / 2;
  const length = Math.max(0.05, reach - start - 0.015);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, length), bracketMaterial);
  arm.position.z = -(start + length / 2);
  const swivel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), bracketMaterial);
  swivel.position.z = -start;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.015), bracketMaterial);
  plate.position.z = -(reach - 0.0075);
  plate.rotation.y = (toSideWall < toEndWall ? Math.PI / 2 : 0) - yaw; // flat against that wall
  mount.add(arm, swivel, plate);

  mount.scale.setScalar(UNITS_PER_METER);
  return { mount, cabinet };
};

// Adds the speakers and their sound; up on the walls they need no colliders, so the list is empty
export const setupMusic = (scene, camera) => {
  listener = new THREE.AudioListener();
  camera.add(listener);

  jazz = createJazz(listener.context);
  master = listener.context.createGain();
  master.gain.value = 0;
  jazz.output.connect(master);

  SPEAKERS.forEach(({ x, z }) => {
    const { mount, cabinet } = createWallSpeaker(x, z);
    const sound = new THREE.PositionalAudio(listener);
    sound.setRefDistance(HEARING_DISTANCE);
    sound.setRolloffFactor(1);
    sound.setVolume(VOLUME);
    sound.setNodeSource(master);
    cabinet.add(sound);
    scene.add(mount);
  });

  // Phones on silent still play the music, like the landing video does (Safari 17+)
  if (navigator.audioSession) navigator.audioSession.type = 'playback';

  return [];
};

// The music button shows what's playing now; pressing it switches to the other state
const updateMusicButton = () => {
  const button = document.getElementById('music_toggle');
  button.querySelector('.music-icon').textContent = playing ? '🔊' : '🔇';
  button.querySelector('.button-label').textContent = playing ? 'Stop Music' : 'Play Music';
  button.setAttribute('aria-label', playing ? 'Stop music' : 'Play music');
  button.setAttribute('aria-pressed', String(playing));
};

const fadeTo = (gain) => {
  const context = listener.context;
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setTargetAtTime(gain, context.currentTime, FADE_TIME / 3);
};

export const setMusicDucked = (on) => {
  ducked = on;
  if (playing) fadeTo(on ? 0 : 1);
};

export const startAudio = () => {
  if (!jazz || playing) return;
  const context = listener.context;
  context.resume(); // browsers keep sound suspended until the visitor interacts
  playing = true;
  stoppedByUser = false;
  jazz.start();
  fadeTo(ducked ? 0 : 1);
  updateMusicButton();
};

// Called by menu.js each time the visitor enters the gallery: music on, unless they turned it off
export const startAudioOnEnter = () => {
  if (START_ON_ENTER && !stoppedByUser) startAudio();
};

export const stopAudio = () => {
  if (!jazz || !playing) return;
  playing = false;
  stoppedByUser = true;
  fadeTo(0);
  updateMusicButton();
  setTimeout(() => {
    if (!playing) jazz.stop();
  }, FADE_TIME * 1000);
};
