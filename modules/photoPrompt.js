import * as THREE from 'three';
import { openPhotoViewer, isPhotoViewerOpen, preloadPhoto } from './photoViewer.js';
import { canSit } from './seating.js';

// "View photo" button: walk up to a photo and look at it, and a button appears at the bottom of the
// screen (press E on a keyboard, or tap it) that opens the full-size photo. It hides again as soon as
// the visitor walks or turns away, so it only shows when they're clearly looking at one photo.

const NEAR = 8.5; // scene units: about 2.6 m, close enough to be looking at this photo (and to open it)
const FACING = Math.cos(THREE.MathUtils.degToRad(28)); // the photo must be within 28° of where they look

let camera;
let paintings;
let target = null; // the photo in front of the visitor, or null
let shownFor = undefined; // the photo the button was last set up for, so the DOM only changes when needed

const button = () => document.getElementById('photo-button');
const isExploring = () => document.body.classList.contains('exploring');

const forward = new THREE.Vector3();
const toPhoto = new THREE.Vector3();

// The photo the visitor is closest to looking straight at, within reach
const findTarget = () => {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  let best = null;
  let bestAlignment = FACING;
  paintings.forEach((painting) => {
    toPhoto.subVectors(painting.position, camera.position);
    toPhoto.y = 0;
    const distance = toPhoto.length();
    if (distance > NEAR || distance < 0.01) return;
    toPhoto.divideScalar(distance);
    // Only from the front: the photo faces along its rotation, toward the visitor
    const facesVisitor = Math.sin(painting.rotation.y) * toPhoto.x + Math.cos(painting.rotation.y) * toPhoto.z < 0;
    const alignment = forward.dot(toPhoto);
    if (facesVisitor && alignment > bestAlignment) {
      best = painting;
      bestAlignment = alignment;
    }
  });
  return best;
};

// Whether the visitor stands close enough to open this photo, by any means (also clickHandling.js)
export const isWithinReach = (painting) =>
  Math.hypot(painting.position.x - camera.position.x, painting.position.z - camera.position.z) <= NEAR;

const show = (painting) => {
  if (painting === shownFor) return;
  shownFor = painting;
  button().hidden = !painting;
  if (painting) {
    button().setAttribute('aria-label', `View photo: ${painting.userData.info.title}`);
    preloadPhoto(painting.userData.info); // ready by the time it's tapped
  }
};

const open = () => {
  if (target) openPhotoViewer(target.userData.info);
};

export const setupPhotoPrompt = (playerCamera, allPaintings) => {
  camera = playerCamera;
  paintings = allPaintings;
  button().addEventListener('click', open);
  // E is the interact key: sitting wins when a seat is in reach (seating.js), otherwise it opens the photo
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring() && !canSit()) open();
  });
};

// Called every frame from the render loop
export const updatePhotoPrompt = () => {
  if (!camera || !isExploring() || isPhotoViewerOpen()) {
    target = null;
  } else {
    target = findTarget();
  }
  show(target);
};
