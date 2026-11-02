import * as THREE from 'three';
import { UNITS_PER_METER } from './paintingData.js';
import { COLORS, createRacketModel } from './badmintonDecor.js';

// The player's character for the third-person view: a badminton player in the Court Connect
// jersey with a racket in his right hand. Modelled in meters (1.75 m tall), feet at y = 0,
// facing -z like the camera. Built from simple shapes so it costs almost nothing on phones.

const SKIN = 0xc28a62;
const HAIR = 0x1b1512;

const WALK_CYCLE_SPEED = 9; // leg swings per second (radians of the walk phase)
const WALKING_SPEED = 0.5; // scene units per second; slower than this counts as standing still
// Sitting lowers the hips (0.9 m standing) onto a seat cushion about 0.5 m high
export const SEATED_DROP = -0.33;

const material = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

const capsule = (radius, length, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 12), mat);

export const createCharacter = () => {
  const skin = material(SKIN, 0.7);
  const jersey = material(COLORS.teal);
  const trim = material(COLORS.lime, 0.6);
  const shorts = material(COLORS.ink);
  const shoes = material(COLORS.cream, 0.6);
  const hair = material(HAIR, 0.9);

  const root = new THREE.Group();
  const figure = new THREE.Group(); // the whole body; drops down onto the seat when sitting
  const body = new THREE.Group(); // everything above the hips, bobs while walking
  root.add(figure);
  figure.add(body);

  // Legs swing from the hips and bend at the knees
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.9, 0);
    const thigh = capsule(0.07, 0.3, skin);
    thigh.position.y = -0.22;
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = capsule(0.06, 0.3, skin);
    shin.position.y = -0.2;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.27), shoes);
    shoe.position.set(0, -0.425, -0.05);
    knee.add(shin, shoe);
    hip.add(thigh, knee);
    figure.add(hip);
    return { hip, knee };
  });

  const shortsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.3, 16), shorts);
  shortsMesh.position.y = 0.8;
  shortsMesh.scale.z = 0.7;

  const torso = capsule(0.17, 0.36, jersey);
  torso.position.y = 1.2;
  torso.scale.z = 0.62;
  const waistband = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.04, 16, 1, true), trim);
  waistband.position.y = 0.94;
  waistband.scale.z = 0.66;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 16), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.52;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), skin);
  neck.position.y = 1.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), skin);
  head.position.y = 1.66;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.123, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 1.67;
  hairCap.rotation.x = 0.25; // covers the back of the head, leaves the face clear

  body.add(shortsMesh, torso, waistband, collar, neck, head, hairCap);

  // Arms hang from the shoulders: sleeve, upper arm, forearm, hand
  const createArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 1.45, 0);
    const sleeve = capsule(0.062, 0.12, jersey);
    sleeve.position.y = -0.08;
    const upperArm = capsule(0.048, 0.24, skin);
    upperArm.position.y = -0.17;
    const forearm = capsule(0.042, 0.22, skin);
    forearm.position.y = -0.45;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skin);
    hand.position.y = -0.6;
    shoulder.add(sleeve, upperArm, forearm, hand);
    body.add(shoulder);
    return shoulder;
  };
  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Racket in the right hand, held up and forward in a ready position with the strings toward the camera
  const grip = new THREE.Group();
  grip.position.y = -0.6;
  grip.rotation.x = -1.1;
  const racket = createRacketModel(COLORS.lime, COLORS.cream);
  racket.position.y = -0.09; // hand closes around the handle, not the butt
  grip.add(racket);
  rightArm.add(grip);

  const READY_ARM = 0.55; // right arm raised forward to hold the racket
  rightArm.rotation.set(READY_ARM, 0, 0.18);
  leftArm.rotation.z = -0.12;

  root.scale.setScalar(UNITS_PER_METER);

  let phase = 0;
  let stride = 0; // 0 standing, 1 walking, eased so starting and stopping look smooth
  let sitting = false;

  // Seated: thighs forward along the cushion, shins down to the floor, hips on the seat
  const setSitting = (on) => {
    sitting = on;
    figure.position.y = on ? SEATED_DROP : 0;
    legs.forEach(({ hip, knee }) => {
      hip.rotation.x = on ? Math.PI / 2 : 0;
      knee.rotation.x = on ? -Math.PI / 2 : 0;
    });
    leftArm.rotation.x = on ? 0.45 : 0; // hand resting on the knee
    rightArm.rotation.x = READY_ARM;
    body.position.y = 0;
    stride = 0;
  };

  const animate = (delta, speed) => {
    if (sitting) return;
    const target = speed > WALKING_SPEED ? 1 : 0;
    stride += (target - stride) * Math.min(1, delta * 8);
    phase += delta * WALK_CYCLE_SPEED * stride;

    const swing = Math.sin(phase) * stride;
    legs[0].hip.rotation.x = swing * 0.6;
    legs[1].hip.rotation.x = -swing * 0.6;
    // The leg swinging back bends at the knee
    legs[0].knee.rotation.x = -Math.max(0, -swing) * 0.5;
    legs[1].knee.rotation.x = -Math.max(0, swing) * 0.5;
    leftArm.rotation.x = -swing * 0.5;
    rightArm.rotation.x = READY_ARM + swing * 0.12; // the racket arm barely swings
    body.position.y = Math.abs(Math.sin(phase)) * 0.03 * stride;
  };

  return { object: root, animate, setSitting };
};
