import * as THREE from 'three';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { collider } from './badmintonDecor.js';
import { createJazz } from './jazz.js';

// Surround sound: four floor-standing speakers, one in each corner, all playing the gallery's chill
// jazz (jazz.js). Each speaker is a positional sound source, so the music shifts around you as you
// walk the room and is loudest next to a speaker.

const SPEAKERS = [
  { x: -18.4, z: -18.4 },
  { x: 18.4, z: -18.4 },
  { x: -18.4, z: 18.4 },
  { x: 18.4, z: 18.4 },
];
const VOLUME = 0.6;
const HEARING_DISTANCE = 10; // full volume within this many units of a speaker, softer further away
const FADE_TIME = 1.2; // seconds to fade in or out
const START_ON_ENTER = true; // the "Meet our team in 3D" click counts as the user gesture browsers need for sound

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

// Floor-standing tower speaker in meters, front (drivers) facing +z, standing on y = 0
const createSpeakerModel = () => {
  const speaker = new THREE.Group();
  const width = 0.26;
  const height = 1.05;
  const depth = 0.32;
  const lift = 0.04;

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), cabinetMaterial);
  cabinet.position.y = lift + height / 2;
  const baffle = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.02, height - 0.02), baffleMaterial);
  baffle.position.set(0, lift + height / 2, depth / 2 + 0.001);
  speaker.add(cabinet, baffle);

  // Tweeter, two woofers and a bass port, top to bottom
  [
    [0.93, 0.028],
    [0.74, 0.08],
    [0.52, 0.08],
    [0.25, 0.035],
  ].forEach(([y, radius], i) => {
    const cone = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), i === 3 ? baffleMaterial : coneMaterial);
    cone.position.set(0, lift + y, depth / 2 + 0.003);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.006, 0.004, 6, 32), trimMaterial);
    ring.position.copy(cone.position);
    speaker.add(cone, ring);
  });

  [-1, 1].forEach((side) =>
    [-1, 1].forEach((end) => {
      const foot = new THREE.Mesh(new THREE.ConeGeometry(0.015, lift, 8), trimMaterial);
      foot.rotation.x = Math.PI; // point down like isolation spikes
      foot.position.set(side * (width / 2 - 0.03), lift / 2, end * (depth / 2 - 0.03));
      speaker.add(foot);
    })
  );

  speaker.scale.setScalar(UNITS_PER_METER);
  return speaker;
};

// Adds the speakers and their sound; returns colliders for main.js to add to the walls
export const setupMusic = (scene, camera) => {
  listener = new THREE.AudioListener();
  camera.add(listener);

  jazz = createJazz(listener.context);
  master = listener.context.createGain();
  master.gain.value = 0;
  jazz.output.connect(master);

  const colliders = SPEAKERS.map(({ x, z }) => {
    const speaker = createSpeakerModel();
    speaker.position.set(x, FLOOR_Y, z);
    speaker.rotation.y = Math.atan2(-x, -z); // drivers toward the middle of the room

    const sound = new THREE.PositionalAudio(listener);
    sound.setRefDistance(HEARING_DISTANCE);
    sound.setRolloffFactor(1);
    sound.setVolume(VOLUME);
    sound.setNodeSource(master);
    sound.position.y = 1.0; // tweeter height (the speaker group is in meters)
    speaker.add(sound);

    scene.add(speaker);
    return collider(x, z, 1.2, 1.2);
  });

  if (START_ON_ENTER) {
    document.getElementById('play_button').addEventListener('click', () => {
      if (!stoppedByUser) startAudio();
    });
  }

  return colliders;
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
