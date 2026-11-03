import * as THREE from 'three';
import { FLOOR_Y } from './paintingData.js';
import { createCharacter } from './character.js';

// Third-person view. The PointerLockControls camera stays the player's "eyes": movement,
// collisions, touch look and painting proximity all keep using it. A second camera follows
// over the character's right shoulder and is the one that renders.
//
// Camera rules (after https://albertshih.blogspot.com/2014/01/a-short-rant-about-third-person-camera.html):
// - it looks at what the player looks at, not at the character, so paintings stay in view
// - the pivot is raised above the character's head and the camera sits off to the side,
//   so the character never blocks the middle of the screen
// - it stays high enough that the floor doesn't fill half the screen

// Remembers the visitor's own first/third person switch between visits. Renamed from 'viewMode',
// which older versions saved on every load, so everyone now starts in first person.
const STORAGE_KEY = 'viewModeChoice';
const SHOULDER_OFFSET = new THREE.Vector3(2.2, 3.2, 11); // right, up and behind the player's eyes
const FOCUS_DISTANCE = 12; // the camera aims at the spot this far ahead of the player's eyes
const ROOM_LIMIT = 19.2; // walls stand at ±20, keep the camera on this side of them
const CEILING_LIMIT = 9.5; // ceiling is at y = 10

let playerCamera;
let viewCamera;
let character;
let thirdPerson = false;
const lastPosition = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const offset = new THREE.Vector3();
const focus = new THREE.Vector3();
let seatedYaw = null; // while sitting, the body stays facing the seat's way even as the player looks around
let firstPersonOnly = false; // at the arcade, the view goes up to the screen whatever the setting

// The camera to render and aim clicks with
export const getViewCamera = () => (thirdPerson && !firstPersonOnly ? viewCamera : playerCamera);

// See through the player's own eyes for a while (arcadePlay.js), without changing their choice
export const forceFirstPerson = (on) => {
  firstPersonOnly = on;
  character.object.visible = thirdPerson && !on;
};

const setThirdPerson = (on) => {
  thirdPerson = on;
  character.object.visible = on && !firstPersonOnly;
  document.getElementById('touch-view-button').innerText = on ? '👁 1st person' : '👁 3rd person';
};

// Only a switch the visitor makes is remembered, never the default
const switchView = () => {
  setThirdPerson(!thirdPerson);
  try {
    localStorage.setItem(STORAGE_KEY, thirdPerson ? 'third' : 'first');
  } catch {
    // storage blocked (private mode etc.), the choice just won't be remembered
  }
};

const readSavedView = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setupPlayerView = (scene, camera) => {
  playerCamera = camera;
  // Not camera.clone(): that would also copy the music's audio listener
  viewCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.near, camera.far);
  character = createCharacter();
  scene.add(character.object);
  lastPosition.copy(camera.position);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'v') switchView();
  });
  document.getElementById('touch-view-button').addEventListener('click', switchView);

  setThirdPerson(readSavedView() === 'third'); // first person unless the visitor picked third
};

// Sit the character down facing `bodyYaw`, or stand up with null (see seating.js)
export const setSeated = (bodyYaw) => {
  seatedYaw = bodyYaw;
  character.setSitting(bodyYaw !== null);
  lastPosition.copy(playerCamera.position); // moving onto or off a seat isn't walking
};

// Called every frame from the render loop
export const updatePlayerView = (delta) => {
  if (!thirdPerson || firstPersonOnly) return;

  // Same lens as the player camera, which changes it on resize (see fitCameraToScreen in scene.js)
  if (viewCamera.fov !== playerCamera.fov || viewCamera.aspect !== playerCamera.aspect) {
    viewCamera.fov = playerCamera.fov;
    viewCamera.aspect = playerCamera.aspect;
    viewCamera.updateProjectionMatrix();
  }

  const position = playerCamera.position;
  const speed =
    delta > 0 ? Math.hypot(position.x - lastPosition.x, position.z - lastPosition.z) / delta : 0;
  lastPosition.copy(position);

  euler.setFromQuaternion(playerCamera.quaternion);
  character.object.position.set(position.x, FLOOR_Y, position.z);
  character.object.rotation.y = seatedYaw ?? euler.y;
  character.animate(delta, speed);

  // Orbit the shoulder offset with the look direction: looking down lifts the camera up and over.
  // An upright phone is narrow, so move less to the side or the character slides off the screen.
  const side = SHOULDER_OFFSET.x * Math.min(1, playerCamera.aspect / 1.5);
  offset.set(side, SHOULDER_OFFSET.y, SHOULDER_OFFSET.z).applyQuaternion(playerCamera.quaternion);
  viewCamera.position.copy(position).add(offset);
  viewCamera.position.x = THREE.MathUtils.clamp(viewCamera.position.x, -ROOM_LIMIT, ROOM_LIMIT);
  viewCamera.position.z = THREE.MathUtils.clamp(viewCamera.position.z, -ROOM_LIMIT, ROOM_LIMIT);
  viewCamera.position.y = THREE.MathUtils.clamp(viewCamera.position.y, FLOOR_Y + 0.5, CEILING_LIMIT);

  // Aim ahead of the player from above the head, keeping the same sideways shift so the view runs
  // parallel to the player's: the character sits low and to the left instead of in front of the paintings
  focus.set(side, 0, -FOCUS_DISTANCE).applyQuaternion(playerCamera.quaternion).add(position);
  viewCamera.lookAt(focus);
};
